import { Injectable } from '@nestjs/common';
import { db } from '../../db';
import { polls, pollOptions, pollVotes, blocks } from '../../db/schema';
import { eq, desc, and, or, inArray } from 'drizzle-orm';

@Injectable()
export class PollQueryService {
  async listPolls(viewerId: string, limit: number = 20, offset: number = 0) {
    const activeBlocks = await this.getBlockedUserIds(viewerId);

    const activePolls = await db
      .select()
      .from(polls)
      .where(eq(polls.status, 'PUBLISHED'))
      .orderBy(desc(polls.createdAt))
      .limit(100);

    const safePolls = activePolls.filter((p) => !activeBlocks.has(p.authorId));
    const paginated = safePolls.slice(offset, offset + limit);

    if (paginated.length === 0) return { items: [] };

    const pollIds = paginated.map((p) => p.id);

    const allOptions = await db
      .select()
      .from(pollOptions)
      .where(inArray(pollOptions.pollId, pollIds));

    const allUserVotes = viewerId
      ? await db
          .select()
          .from(pollVotes)
          .where(and(eq(pollVotes.userId, viewerId), inArray(pollVotes.pollId, pollIds)))
      : [];

    const optionsByPollId = new Map<string, typeof allOptions>();
    allOptions.forEach((opt) => {
      const list = optionsByPollId.get(opt.pollId) || [];
      list.push(opt);
      optionsByPollId.set(opt.pollId, list);
    });

    const userVotesByPollId = new Map<string, string[]>();
    allUserVotes.forEach((v) => {
      const list = userVotesByPollId.get(v.pollId) || [];
      list.push(v.optionId);
      userVotesByPollId.set(v.pollId, list);
    });

    const items = paginated.map((p) => {
      const options = optionsByPollId.get(p.id) || [];
      const userVotedOptionIds = userVotesByPollId.get(p.id) || [];
      const totalVotes = options.reduce((sum, opt) => sum + (opt.voteCount || 0), 0);

      return {
        id: p.id,
        question: p.question,
        isMultipleChoice: p.isMultipleChoice,
        campus: p.campus,
        authorId: p.authorId,
        expiresAt: p.endsAt || null,
        isActive: p.status === 'PUBLISHED',
        createdAt: p.createdAt,
        totalVotes,
        userVotedOptionIds,
        options: options.map((opt) => ({
          id: opt.id,
          text: opt.text,
          voteCount: opt.voteCount || 0,
          percentage:
            totalVotes > 0 ? Math.round(((opt.voteCount || 0) / totalVotes) * 100) : 0,
          hasVoted: userVotedOptionIds.includes(opt.id),
        })),
      };
    });

    return { items };
  }

  async getPollDetails(pollId: string, viewerId: string) {
    const [poll] = await db
      .select()
      .from(polls)
      .where(and(eq(polls.id, pollId), eq(polls.status, 'PUBLISHED')))
      .limit(1);

    if (!poll) return null;

    const options = await db
      .select()
      .from(pollOptions)
      .where(eq(pollOptions.pollId, pollId));

    const userVotes = viewerId
      ? await db
          .select()
          .from(pollVotes)
          .where(and(eq(pollVotes.pollId, pollId), eq(pollVotes.userId, viewerId)))
      : [];

    const totalVotes = options.reduce((sum, opt) => sum + (opt.voteCount || 0), 0);
    const userVotedOptionIds = userVotes.map((v) => v.optionId);

    return {
      id: poll.id,
      question: poll.question,
      isMultipleChoice: poll.isMultipleChoice,
      campus: poll.campus,
      authorId: poll.authorId,
      expiresAt: poll.endsAt || null,
      isActive: poll.status === 'PUBLISHED',
      createdAt: poll.createdAt,
      totalVotes,
      userVotedOptionIds,
      options: options.map((opt) => ({
        id: opt.id,
        text: opt.text,
        voteCount: opt.voteCount || 0,
        percentage:
          totalVotes > 0 ? Math.round(((opt.voteCount || 0) / totalVotes) * 100) : 0,
        hasVoted: userVotedOptionIds.includes(opt.id),
      })),
    };
  }

  private async getBlockedUserIds(userId: string): Promise<Set<string>> {
    if (!userId) return new Set();

    const blockRecords = await db
      .select()
      .from(blocks)
      .where(or(eq(blocks.blockerId, userId), eq(blocks.blockedId, userId)));

    const blockedIds = new Set<string>();
    for (const b of blockRecords) {
      blockedIds.add(b.blockerId === userId ? b.blockedId : b.blockerId);
    }
    return blockedIds;
  }
}
