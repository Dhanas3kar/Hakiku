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
      return { recommendations: [], nextCursor: null };
    }

    const currentUserSkills = await db.query.profileSkills.findMany({
      where: eq(profileSkills.userId, userId),
    });
    const currentUserSkillIds = new Set(currentUserSkills.map(s => s.skillId));

    const currentUserInterests = await db.query.profileInterests.findMany({
      where: eq(profileInterests.userId, userId),
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
    const allProfiles = await db.query.profiles.findMany({
      with: {
        user: true,
      },
      limit: 500, // Hard cap for initial fetch
    });

    const candidates = allProfiles.filter(p => !excludedIds.has(p.userId));

    // 3. Score candidates
    const scoredCandidates = await Promise.all(candidates.map(async (candidate) => {
      let score = 0;

      if (candidate.campus && candidate.campus === currentUserProfile.campus) {
        score += 10;
      }
      if (candidate.department && candidate.department === currentUserProfile.department) {
        score += 15;
      }
      if (candidate.batchYear && candidate.batchYear === currentUserProfile.batchYear) {
        score += 10;
      }

      // Shared skills & interests
      const candidateSkills = await db.query.profileSkills.findMany({
        where: eq(profileSkills.userId, candidate.userId)
      });
      const sharedSkillsCount = candidateSkills.filter(s => currentUserSkillIds.has(s.skillId)).length;
      score += sharedSkillsCount * 15;

      const candidateInterests = await db.query.profileInterests.findMany({
        where: eq(profileInterests.userId, candidate.userId)
      });
      const sharedInterestsCount = candidateInterests.filter(i => currentUserInterestIds.has(i.interestId)).length;
      score += sharedInterestsCount * 15;

      // Mutual connections
      const candidateConns = await db.query.connections.findMany({
        where: or(
          eq(connections.userAId, candidate.userId),
          eq(connections.userBId, candidate.userId)
        )
      });
      let mutualCount = 0;
      candidateConns.forEach(c => {
        const id = c.userAId === candidate.userId ? c.userBId : c.userAId;
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

    return {
      recommendations: paginated.map(p => ({
        userId: p.userId,
        fullName: p.user?.fullName,
        headline: p.headline,
        campus: p.campus,
        department: p.department,
        avatarUrl: p.avatarUrl,
        score: p.score
      })),
      nextCursor
    };
  }
}
