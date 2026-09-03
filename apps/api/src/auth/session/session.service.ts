import { Injectable, UnauthorizedException } from '@nestjs/common';
import { db } from '../../db';
import { authSessions } from '../../db/schema';
import { eq, and, desc } from 'drizzle-orm';
import * as argon2 from 'argon2';
import { randomBytes, randomUUID } from 'crypto';

const ARGON2_OPTIONS = {
  type: argon2.argon2id as 2,
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
};

@Injectable()
export class SessionService {
  async createSession(userId: string, ipAddress?: string, userAgent?: string) {
    const rawToken = randomBytes(32).toString('hex');
    const hashedRefreshToken = await argon2.hash(rawToken, ARGON2_OPTIONS);
    const tokenFamilyId = randomUUID();

    const [session] = await db
      .insert(authSessions)
      .values({
        userId,
        tokenFamilyId,
        hashedRefreshToken,
        status: 'ACTIVE',
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
        ipAddress,
        userAgent,
      })
      .returning();

    return { rawToken, session };
  }

  async rotateSession(
    rawToken: string,
    familyId: string,
    ipAddress?: string,
    userAgent?: string,
  ) {
    // We expect the client to provide rawToken. We must find the active session by familyId and verify hash.
    const activeSessions = await db
      .select()
      .from(authSessions)
      .where(
        and(
          eq(authSessions.tokenFamilyId, familyId),
          eq(authSessions.status, 'ACTIVE'),
        ),
      );

    if (activeSessions.length === 0) {
      // Possible reuse! If the family exists but has no active session, or we were passed a rotated token.
      const allFamily = await db
        .select()
        .from(authSessions)
        .where(eq(authSessions.tokenFamilyId, familyId));
      if (allFamily.length > 0) {
        // Token reuse detected. Revoke entire family!
        await db
          .update(authSessions)
          .set({ status: 'REVOKED' })
          .where(eq(authSessions.tokenFamilyId, familyId));
      }
      throw new UnauthorizedException(
        'Invalid or reused refresh token. Session terminated.',
      );
    }

    const currentSession = activeSessions[0];

    // Verify the provided rawToken matches the active session
    const isMatch = await argon2.verify(
      currentSession.hashedRefreshToken,
      rawToken,
    );
    if (!isMatch) {
      // If it doesn't match the active session, let's check if it matches ANY rotated session in this family (reuse)
      const rotatedSessions = await db
        .select()
        .from(authSessions)
        .where(
          and(
            eq(authSessions.tokenFamilyId, familyId),
            eq(authSessions.status, 'ROTATED'),
          ),
        )
        .orderBy(desc(authSessions.rotatedAt));

      let reused = false;
      let graceSession = null;
      const gracePeriodMs = 30000; // 30 seconds
      const mostRecentRotated = rotatedSessions.length > 0 ? rotatedSessions[0] : null;

      for (const rs of rotatedSessions) {
        if (await argon2.verify(rs.hashedRefreshToken, rawToken)) {
          reused = true;
          if (
            mostRecentRotated &&
            rs.id === mostRecentRotated.id &&
            rs.rotatedAt &&
            (Date.now() - rs.rotatedAt.getTime()) < gracePeriodMs
          ) {
            graceSession = rs;
          }
          break;
        }
      }

      if (reused) {
        if (graceSession) {
          // Grace period: Return the already-established replacement session state
          // to prevent concurrent requests from revoking the family.
          return { rawToken, session: activeSessions[0] };
        }
        await db
          .update(authSessions)
          .set({ status: 'REVOKED' })
          .where(eq(authSessions.tokenFamilyId, familyId));
        throw new UnauthorizedException(
          'Token reuse detected. Session terminated.',
        );
      } else {
        throw new UnauthorizedException('Invalid refresh token.');
      }
    }

    // Check expiry
    if (currentSession.expiresAt < new Date()) {
      await db
        .update(authSessions)
        .set({ status: 'REVOKED' })
        .where(eq(authSessions.id, currentSession.id));
      throw new UnauthorizedException('Refresh token expired.');
    }

    // Atomic rotation via transaction
    return await db.transaction(async (tx) => {
      // Mark old as rotated
      await tx
        .update(authSessions)
        .set({ status: 'ROTATED', rotatedAt: new Date() })
        .where(eq(authSessions.id, currentSession.id));

      const newRawToken = randomBytes(32).toString('hex');
      const newHashed = await argon2.hash(newRawToken, ARGON2_OPTIONS);

      // Create new session in same family
      const [newSession] = await tx
        .insert(authSessions)
        .values({
          userId: currentSession.userId,
          tokenFamilyId: familyId,
          hashedRefreshToken: newHashed,
          status: 'ACTIVE',
          expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
          ipAddress,
          userAgent,
        })
        .returning();

      return { rawToken: newRawToken, session: newSession };
    });
  }

  async revokeSession(familyId: string) {
    await db
      .update(authSessions)
      .set({ status: 'REVOKED' })
      .where(eq(authSessions.tokenFamilyId, familyId));
  }
}
