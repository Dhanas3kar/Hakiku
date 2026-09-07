import { Injectable } from '@nestjs/common';
import { db } from '../../db';
import {
  profiles,
  users,
  connections,
  connectionRequests,
  blocks,
  profileSkills,
  profileInterests,
} from '../../db/schema';
import { eq, or, inArray } from 'drizzle-orm';

@Injectable()
export class PeopleDiscoveryService {
  async getRecommendations(
    userId: string,
    cursor: string = '',
    limit: number = 20,
  ) {
    const offset = cursor
      ? parseInt(Buffer.from(cursor, 'base64').toString('utf-8'), 10)
      : 0;

    // 1. Fetch current user data
    const [currentUserProfile] = await db
      .select()
      .from(profiles)
      .where(eq(profiles.userId, userId))
      .limit(1);

    if (!currentUserProfile) {
      return { items: [], nextCursor: null };
    }

    const currentUserSkills = await db
      .select({ skillId: profileSkills.skillId })
      .from(profileSkills)
      .where(eq(profileSkills.profileId, currentUserProfile.id));

    const currentUserSkillIds = new Set(currentUserSkills.map((s) => s.skillId));

    const currentUserInterests = await db
      .select({ interestId: profileInterests.interestId })
      .from(profileInterests)
      .where(eq(profileInterests.profileId, currentUserProfile.id));

    const currentUserInterestIds = new Set(currentUserInterests.map((i) => i.interestId));

    // Connections (both directions)
    const currentUserConnections = await db
      .select()
      .from(connections)
      .where(or(eq(connections.userAId, userId), eq(connections.userBId, userId)));

    const connectionIds = new Set<string>();
    currentUserConnections.forEach((c) =>
      connectionIds.add(c.userAId === userId ? c.userBId : c.userAId),
    );

    // Pending requests
    const currentUserRequests = await db
      .select()
      .from(connectionRequests)
      .where(
        or(
          eq(connectionRequests.senderId, userId),
          eq(connectionRequests.receiverId, userId),
        ),
      );

    const pendingIds = new Set<string>();
    currentUserRequests.forEach((r) => {
      if (r.status === 'PENDING') {
        pendingIds.add(r.senderId === userId ? r.receiverId : r.senderId);
      }
    });

    // Blocks
    const currentUserBlocks = await db
      .select()
      .from(blocks)
      .where(or(eq(blocks.blockerId, userId), eq(blocks.blockedId, userId)));

    const blockIds = new Set<string>();
    currentUserBlocks.forEach((b) =>
      blockIds.add(b.blockerId === userId ? b.blockedId : b.blockerId),
    );

    // Excluded users list
    const excludedIds = new Set([
      ...connectionIds,
      ...pendingIds,
      ...blockIds,
      userId,
    ]);

    // 2. Fetch candidates (limiting to 200)
    const allProfiles = await db
      .select({
        profile: profiles,
        user: users,
      })
      .from(profiles)
      .innerJoin(users, eq(profiles.userId, users.id))
      .limit(200);

    const candidates = allProfiles.filter(
      (p) => !excludedIds.has(p.profile.userId),
    );

    if (candidates.length === 0) {
      return { items: [], nextCursor: null };
    }

    const candidateProfileIds = candidates.map((c) => c.profile.id);
    const candidateUserIds = candidates.map((c) => c.profile.userId);

    // 3. Batch fetch skills, interests, and connections for all candidates in 3 queries
    const allCandidateSkills = candidateProfileIds.length > 0
      ? await db
          .select({ profileId: profileSkills.profileId, skillId: profileSkills.skillId })
          .from(profileSkills)
          .where(inArray(profileSkills.profileId, candidateProfileIds))
      : [];

    const allCandidateInterests = candidateProfileIds.length > 0
      ? await db
          .select({ profileId: profileInterests.profileId, interestId: profileInterests.interestId })
          .from(profileInterests)
          .where(inArray(profileInterests.profileId, candidateProfileIds))
      : [];

    const allCandidateConns = candidateUserIds.length > 0
      ? await db
          .select({ userAId: connections.userAId, userBId: connections.userBId })
          .from(connections)
          .where(
            or(
              inArray(connections.userAId, candidateUserIds),
              inArray(connections.userBId, candidateUserIds),
            ),
          )
      : [];

    const skillsByProfileId = new Map<string, string[]>();
    allCandidateSkills.forEach((s) => {
      const list = skillsByProfileId.get(s.profileId) || [];
      list.push(s.skillId);
      skillsByProfileId.set(s.profileId, list);
    });

    const interestsByProfileId = new Map<string, string[]>();
    allCandidateInterests.forEach((i) => {
      const list = interestsByProfileId.get(i.profileId) || [];
      list.push(i.interestId);
      interestsByProfileId.set(i.profileId, list);
    });

    const connsByUserId = new Map<string, string[]>();
    allCandidateConns.forEach((c) => {
      const listA = connsByUserId.get(c.userAId) || [];
      listA.push(c.userBId);
      connsByUserId.set(c.userAId, listA);

      const listB = connsByUserId.get(c.userBId) || [];
      listB.push(c.userAId);
      connsByUserId.set(c.userBId, listB);
    });

    // 4. Fast synchronous scoring in memory
    const scoredCandidates = candidates.map((candidate) => {
      let score = 0;

      if (
        candidate.profile.campus &&
        candidate.profile.campus === currentUserProfile.campus
      ) {
        score += 10;
      }
      if (
        candidate.profile.department &&
        candidate.profile.department === currentUserProfile.department
      ) {
        score += 15;
      }
      if (
        candidate.profile.batchYear &&
        candidate.profile.batchYear === currentUserProfile.batchYear
      ) {
        score += 10;
      }

      const candSkills = skillsByProfileId.get(candidate.profile.id) || [];
      const sharedSkillsCount = candSkills.filter((id) => currentUserSkillIds.has(id)).length;
      score += sharedSkillsCount * 15;

      const candInterests = interestsByProfileId.get(candidate.profile.id) || [];
      const sharedInterestsCount = candInterests.filter((id) => currentUserInterestIds.has(id)).length;
      score += sharedInterestsCount * 15;

      const candConns = connsByUserId.get(candidate.profile.userId) || [];
      const mutualCount = candConns.filter((id) => connectionIds.has(id)).length;
      score += mutualCount * 40;

      return {
        ...candidate,
        score,
      };
    });

    // Sort by score DESC
    scoredCandidates.sort((a, b) => b.score - a.score);

    // Paginate
    const paginated = scoredCandidates.slice(offset, offset + limit);

    const nextOffset = offset + limit;
    const nextCursor =
      nextOffset < scoredCandidates.length
        ? Buffer.from(nextOffset.toString()).toString('base64')
        : null;

    const baseUrl = process.env.BASE_URL || 'http://localhost:3001';

    return {
      items: paginated.map((p) => ({
        id: p.profile.id,
        userId: p.profile.userId,
        username: p.profile.username,
        displayName: p.profile.displayName,
        bio: p.profile.bio,
        campus: p.profile.campus,
        department: p.profile.department,
        avatarUrl: p.profile.avatarKey
          ? `${baseUrl}/uploads/${p.profile.avatarKey}`
          : null,
        headline: p.profile.bio || null,
        score: p.score,
        reasons: [
          p.profile.campus === currentUserProfile.campus ? 'Same campus' : null,
          p.profile.department === currentUserProfile.department
            ? 'Same department'
            : null,
          p.profile.batchYear === currentUserProfile.batchYear
            ? 'Same batch'
            : null,
        ].filter(Boolean) as string[],
      })),
      nextCursor,
    };
  }
}
