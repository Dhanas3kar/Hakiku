import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { EmailService } from './email/email.service';
import { OtpService } from './otp/otp.service';
import { SessionService } from './session/session.service';
import { db } from '../db';
import { users, auditLogs } from '../db/schema';
import { eq } from 'drizzle-orm';

@Injectable()
export class AuthService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly emailService: EmailService,
    private readonly otpService: OtpService,
    private readonly sessionService: SessionService,
  ) {}

  private enforceDomain(email: string) {
    const normalized = email.trim().toLowerCase();
    if (!normalized.endsWith('@srmist.edu.in')) {
      throw new BadRequestException('Only @srmist.edu.in emails are allowed');
    }
    return normalized;
  }

  async sendOtp(email: string, ipAddress?: string): Promise<void> {
    const normalized = this.enforceDomain(email);
    const otp = await this.otpService.generateOtp(normalized);
    await this.emailService.sendOtp(normalized, otp);

    // Try to find user, insert audit log
    const existingUsers = await db
      .select()
      .from(users)
      .where(eq(users.email, normalized));
    const userId = existingUsers.length > 0 ? existingUsers[0].id : null;

    await db.insert(auditLogs).values({
      userId,
      event: 'OTP_SENT',
      ipAddress,
    });
  }

  async verifyOtp(
    email: string,
    otp: string,
    ipAddress?: string,
    userAgent?: string,
  ) {
    const normalized = this.enforceDomain(email);

    // Will throw UnauthorizedException on failure
    await this.otpService.verifyOtp(normalized, otp);

    // Ensure user exists
    const existingUsers = await db
      .select()
      .from(users)
      .where(eq(users.email, normalized));
    let user;
    if (existingUsers.length === 0) {
      const [newUser] = await db
        .insert(users)
        .values({
          email: normalized,
          isVerified: true,
          emailVerifiedAt: new Date(),
        })
        .returning();
      user = newUser;
    } else {
      user = existingUsers[0];
      if (!user.isVerified) {
        const [updatedUser] = await db
          .update(users)
          .set({ isVerified: true, emailVerifiedAt: new Date() })
          .where(eq(users.id, user.id))
          .returning();
        user = updatedUser;
      }
    }

    // Generate Session (Refresh Token)
    const { rawToken, session } = await this.sessionService.createSession(
      user.id,
      ipAddress,
      userAgent,
    );

    // Generate Access JWT (15 mins)
    const payload = { sub: user.id, email: user.email, role: user.role };
    const accessToken = await this.jwtService.signAsync(payload);

    await db.insert(auditLogs).values({
      userId: user.id,
      event: 'LOGIN_SUCCESS',
      ipAddress,
    });

    return {
      accessToken,
      refreshToken: rawToken,
      familyId: session.tokenFamilyId,
    };
  }

  async refresh(
    refreshToken: string,
    familyId: string,
    ipAddress?: string,
    userAgent?: string,
  ) {
    if (!refreshToken || !familyId) {
      throw new UnauthorizedException('Refresh token and family ID required');
    }

    const { rawToken, session } = await this.sessionService.rotateSession(
      refreshToken,
      familyId,
      ipAddress,
      userAgent,
    );

    const userRecords = await db
      .select()
      .from(users)
      .where(eq(users.id, session.userId));
    if (userRecords.length === 0) {
      throw new UnauthorizedException('User not found');
    }
    const user = userRecords[0];

    const payload = { sub: user.id, email: user.email, role: user.role };
    const accessToken = await this.jwtService.signAsync(payload);

    await db.insert(auditLogs).values({
      userId: user.id,
      event: 'TOKEN_REFRESHED',
      ipAddress,
    });

    return {
      accessToken,
      refreshToken: rawToken,
      familyId: session.tokenFamilyId,
    };
  }

  async logout(familyId: string, ipAddress?: string) {
    if (familyId) {
      await this.sessionService.revokeSession(familyId);
    }
    // We can insert a LOGOUT audit event if needed
  }
}
