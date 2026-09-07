import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { db } from '../../db';
import { polls, pollOptions, pollVotes } from '../../db/schema';
import { eq, and, sql } from 'drizzle-orm';

@Injectable()
export class PollService {
  async createPoll(
    userId: string,
    question: string,
    options: string[],
    isMultipleChoice: boolean = false,
    campus?: string,
  ) {
    if (options.length < 2 || options.length > 5) {
      throw new HttpException(
        'Polls must have between 2 and 5 options',
        HttpStatus.BAD_REQUEST,
      );
    }

    // Set endsAt to 7 days from now
    const endsAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const result = await db.transaction(async (tx) => {
      const [poll] = await tx
        .insert(polls)
        .values({
          authorId: userId,
          question,
          isMultipleChoice,
          campus,
          endsAt,
        })
        .returning();

      const optionValues = options.map((opt) => ({
        pollId: poll.id,
        text: opt,
      }));

      await tx.insert(pollOptions).values(optionValues);

      return poll;
    });

    return {
      message: 'Poll created',
      id: result.id,
    };
  }

  async adminRemovePoll(pollId: string) {
    const poll = await db.query.polls.findFirst({
      where: eq(polls.id, pollId),
    });

    if (!poll) {
      throw new HttpException('Poll not found', HttpStatus.NOT_FOUND);
    }

    await db
      .update(polls)
      .set({ status: 'REMOVED' })
      .where(eq(polls.id, pollId));

    return { message: 'Poll removed successfully' };
  }

  async vote(userId: string, pollId: string, optionId: string) {
    const poll = await db.query.polls.findFirst({
      where: eq(polls.id, pollId),
    });

    if (!poll) {
      throw new HttpException('Poll not found', HttpStatus.NOT_FOUND);
    }

    if (
      poll.status !== 'PUBLISHED' ||
      (poll.endsAt && poll.endsAt < new Date())
    ) {
      throw new HttpException('Poll is not active', HttpStatus.BAD_REQUEST);
    }

    return db.transaction(async (tx) => {
      // Check for existing votes
      const existingVotes = await tx
        .select()
        .from(pollVotes)
        .where(and(eq(pollVotes.pollId, pollId), eq(pollVotes.userId, userId)));

      if (!poll.isMultipleChoice && existingVotes.length > 0) {
        const prevVote = existingVotes[0];
        if (prevVote.optionId === optionId) {
          throw new HttpException(
            'You have already voted for this option',
            HttpStatus.CONFLICT,
          );
        } else {
          // Switch vote to new option
          await tx
            .delete(pollVotes)
            .where(
              and(
                eq(pollVotes.pollId, pollId),
                eq(pollVotes.userId, userId),
              ),
            );
          await tx
            .update(pollOptions)
            .set({ voteCount: sql`GREATEST(0, ${pollOptions.voteCount} - 1)` })
            .where(eq(pollOptions.id, prevVote.optionId));

          await tx.insert(pollVotes).values({
            pollId,
            optionId,
            userId,
          });
          await tx
            .update(pollOptions)
            .set({ voteCount: sql`${pollOptions.voteCount} + 1` })
            .where(eq(pollOptions.id, optionId));

          return { message: 'Vote updated' };
        }
      }

      if (
        poll.isMultipleChoice &&
        existingVotes.some((v) => v.optionId === optionId)
      ) {
        // Toggle off specific option in multiple choice
        await tx
          .delete(pollVotes)
          .where(
            and(
              eq(pollVotes.pollId, pollId),
              eq(pollVotes.userId, userId),
              eq(pollVotes.optionId, optionId),
            ),
          );
        await tx
          .update(pollOptions)
          .set({ voteCount: sql`GREATEST(0, ${pollOptions.voteCount} - 1)` })
          .where(eq(pollOptions.id, optionId));

        return { message: 'Vote removed' };
      }

      await tx.insert(pollVotes).values({
        pollId,
        optionId,
        userId,
      });

      await tx
        .update(pollOptions)
        .set({ voteCount: sql`${pollOptions.voteCount} + 1` })
        .where(eq(pollOptions.id, optionId));

      const updatedOptions = await tx
        .select({ id: pollOptions.id, text: pollOptions.text, voteCount: pollOptions.voteCount })
        .from(pollOptions)
        .where(eq(pollOptions.pollId, pollId));

      const updatedUserVotes = await tx
        .select({ optionId: pollVotes.optionId })
        .from(pollVotes)
        .where(and(eq(pollVotes.pollId, pollId), eq(pollVotes.userId, userId)));

      return {
        message: 'Vote recorded',
        pollId,
        options: updatedOptions,
        userVotedOptionIds: updatedUserVotes.map((v) => v.optionId),
      };
    });
  }

  async removeVote(userId: string, pollId: string, optionId?: string) {
    return db.transaction(async (tx) => {
      let conditions = and(
        eq(pollVotes.pollId, pollId),
        eq(pollVotes.userId, userId),
      );

      if (optionId) {
        conditions = and(conditions, eq(pollVotes.optionId, optionId));
      }

      const votesToRemove = await tx.select().from(pollVotes).where(conditions);

      if (votesToRemove.length === 0) {
        throw new HttpException('Vote not found', HttpStatus.NOT_FOUND);
      }

      await tx.delete(pollVotes).where(conditions);

      for (const vote of votesToRemove) {
        await tx
          .update(pollOptions)
          .set({ voteCount: sql`GREATEST(0, ${pollOptions.voteCount} - 1)` })
          .where(eq(pollOptions.id, vote.optionId));
      }

      const updatedOptions = await tx
        .select({ id: pollOptions.id, text: pollOptions.text, voteCount: pollOptions.voteCount })
        .from(pollOptions)
        .where(eq(pollOptions.pollId, pollId));

      const updatedUserVotes = await tx
        .select({ optionId: pollVotes.optionId })
        .from(pollVotes)
        .where(and(eq(pollVotes.pollId, pollId), eq(pollVotes.userId, userId)));

      return {
        message: 'Vote(s) removed',
        pollId,
        options: updatedOptions,
        userVotedOptionIds: updatedUserVotes.map((v) => v.optionId),
      };
    });
  }
}
