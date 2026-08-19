import { Injectable } from '@nestjs/common';
import { db } from '../../db';
import { profiles, users, skills, interests, connections, connectionRequests, blocks, profileSkills, profileInterests } from '../../db/schema';
import { eq, or, and, ne } from 'drizzle-orm';

@Injectable()
export class PeopleDiscoveryService {
  
  async getRecommendations(userId: string, cursor: string = '', limit: number = 20) {
    const offset = cursor ? parseInt(Buffer.from(cursor, 'base64').toString('utf-8'), 10) : 0;
    
    // 1. Fetch current user data
    const currentUserProfile = await db.query.profiles.findFirst({
      where: eq(profiles.userId, userId),
    });

    if (!currentUserProfile) {
      return { items: [], nextCursor: null };
    }

    const currentUserSkills = await db.query.profileSkills.findMany({
      where: eq(profileSkills.profileId, currentUserProfile.id),
    });
    const currentUserSkillIds = new Set(currentUserSkills.map(s => s.skillId));

    const currentUserInterests = await db.query.profileInterests.findMany({
      where: eq(profileInterests.profileId, currentUserProfile.id),
    });
    const currentUserInterestIds = new Set(currentUserInterests.map(i => i.interestId));

    // Connections (both directions)
    const currentUserConnections = await db.query.connections.findMany({
      where: or(
        eq(connections.userAId, userId),
        eq(connections.userBId, userId)
      )
    });
    const connectionIds = new Set<string>();
    currentUserConnections.forEach(c => connectionIds.add(c.userAId === userId ? c.userBId : c.userAId));

    // Pending requests
    const currentUserRequests = await db.query.connectionRequests.findMany({
      where: or(
        eq(connectionRequests.senderId, userId),
        eq(connectionRequests.receiverId, userId)
      )
    });
    const pendingIds = new Set<string>();
    currentUserRequests.forEach(r => {
      if (r.status === 'PENDING') {
        pendingIds.add(r.senderId === userId ? r.receiverId : r.senderId);
      }
    });

    // Blocks
    const currentUserBlocks = await db.query.blocks.findMany({
      where: or(
        eq(blocks.blockerId, userId),
        eq(blocks.blockedId, userId)
      )
    });
    const blockIds = new Set<string>();
    currentUserBlocks.forEach(b => blockIds.add(b.blockerId === userId ? b.blockedId : b.blockerId));

    // Excluded users list
    const excludedIds = new Set([...connectionIds, ...pendingIds, ...blockIds, userId]);

    // 2. Fetch candidates (limiting to 200 for memory scoring to prevent OOM)
    // We could optimize this heavily in SQL but for prototype doing it in memory is acceptable
    const allProfiles = await db.select({
      profile: profiles,
      user: users,
    })
    .from(profiles)
    .innerJoin(users, eq(profiles.userId, users.id))
    .limit(500);

    const candidates = allProfiles.filter(p => !excludedIds.has(p.profile.userId));

    // 3. Score candidates
    const scoredCandidates = await Promise.all(candidates.map(async (candidate) => {
      let score = 0;

      if (candidate.profile.campus && candidate.profile.campus === currentUserProfile.campus) {
        score += 10;
      }
      if (candidate.profile.department && candidate.profile.department === currentUserProfile.department) {
        score += 15;
      }
      if (candidate.profile.batchYear && candidate.profile.batchYear === currentUserProfile.batchYear) {
        score += 10;
      }

      // Shared skills & interests
      const candidateSkills = await db.query.profileSkills.findMany({
        where: eq(profileSkills.profileId, candidate.profile.id)
      });
      const sharedSkillsCount = candidateSkills.filter(s => currentUserSkillIds.has(s.skillId)).length;
      score += sharedSkillsCount * 15;

      const candidateInterests = await db.query.profileInterests.findMany({
        where: eq(profileInterests.profileId, candidate.profile.id)
      });
      const sharedInterestsCount = candidateInterests.filter(i => currentUserInterestIds.has(i.interestId)).length;
      score += sharedInterestsCount * 15;

      // Mutual connections
      const candidateConns = await db.query.connections.findMany({
        where: or(
          eq(connections.userAId, candidate.profile.userId),
          eq(connections.userBId, candidate.profile.userId)
        )
      });
      let mutualCount = 0;
      candidateConns.forEach(c => {
        const id = c.userAId === candidate.profile.userId ? c.userBId : c.userAId;
        if (connectionIds.has(id)) mutualCount++;
      });
      score += mutualCount * 40;

      return {
        ...candidate,
        score
      };
    }));

    // Sort by score DESC
    scoredCandidates.sort((a, b) => b.score - a.score);

    // Paginate
    const paginated = scoredCandidates.slice(offset, offset + limit);

    const nextOffset = offset + limit;
    const nextCursor = nextOffset < scoredCandidates.length ? Buffer.from(nextOffset.toString()).toString('base64') : null;

    const baseUrl = process.env.BASE_URL || 'http://localhost:3000';

    return {
      items: paginated.map(p => ({
        id: p.profile.id,
        userId: p.profile.userId,
        username: p.profile.username,
        displayName: p.profile.displayName,
        bio: p.profile.bio,
        campus: p.profile.campus,
        department: p.profile.department,
        avatarUrl: p.profile.avatarKey ? `${baseUrl}/uploads/${p.profile.avatarKey}` : null,
        headline: p.profile.bio || null,
        score: p.score,
        reasons: [
          p.profile.campus === currentUserProfile.campus ? 'Same campus' : null,
          p.profile.department === currentUserProfile.department ? 'Same department' : null,
          p.profile.batchYear === currentUserProfile.batchYear ? 'Same batch' : null,
        ].filter(Boolean) as string[],
      })),
      nextCursor
    };
  }
}
