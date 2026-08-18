import { Injectable } from '@nestjs/common';
import { db } from '../../db';
import { polls, pollOptions, pollVotes, blocks } from '../../db/schema';
import { eq, desc, and, or } from 'drizzle-orm';

@Injectable()
export class PollQueryService {

  async listPolls(viewerId: string, limit: number = 20, offset: number = 0) {
    const activeBlocks = await this.getBlockedUserIds(viewerId);

    const activePolls = await db.query.polls.findMany({
      where: eq(polls.status, 'PUBLISHED'),
      orderBy: [desc(polls.createdAt)],
      limit: 100,
    });

    const safePolls = activePolls.filter(p => !activeBlocks.has(p.authorId));
    const paginated = safePolls.slice(offset, offset + limit);

    return Promise.all(paginated.map(p => this.getPollDetails(p.id, viewerId)));
  }

  async getPollDetails(pollId: string, viewerId: string) {
    const poll = await db.query.polls.findFirst({
      where: eq(polls.id, pollId)
    });

    if (!poll || poll.status !== 'PUBLISHED') return null;

    const options = await db.query.pollOptions.findMany({
      where: eq(pollOptions.pollId, pollId)
    });

    const userVotes = await db.query.pollVotes.findMany({
      where: and(
        eq(pollVotes.pollId, pollId),
        eq(pollVotes.userId, viewerId)
      )
    });

    const totalVotes = options.reduce((sum, opt) => sum + opt.voteCount, 0);
    const userVotedOptionIds = userVotes.map(v => v.optionId);

    return {
      id: poll.id,
      question: poll.question,
      isMultipleChoice: poll.isMultipleChoice,
      campus: poll.campus,
      endsAt: poll.endsAt,
      createdAt: poll.createdAt,
      totalVotes,
      options: options.map(opt => ({
        id: opt.id,
        text: opt.text,
        voteCount: opt.voteCount,
        percentage: totalVotes > 0 ? Math.round((opt.voteCount / totalVotes) * 100) : 0,
        hasVoted: userVotedOptionIds.includes(opt.id)
      }))
    };
  }

  private async getBlockedUserIds(userId: string): Promise<Set<string>> {
    const blockRecords = await db.query.blocks.findMany({
      where: or(
        eq(blocks.blockerId, userId),
        eq(blocks.blockedId, userId)
      )
    });
    
    const blockedIds = new Set<string>();
    for (const b of blockRecords) {
      blockedIds.add(b.blockerId === userId ? b.blockedId : b.blockerId);
    }
    return blockedIds;
  }
}
