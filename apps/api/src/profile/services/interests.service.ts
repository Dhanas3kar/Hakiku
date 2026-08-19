import { db } from '../../db/index';
import {
  Injectable,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { eq, ilike } from 'drizzle-orm';
import { interests } from '../../db/schema';
import * as schema from '../../db/schema';

@Injectable()
export class InterestsService {
  private db;

  constructor() {
    const connectionString =
      process.env.DATABASE_URL ||
      'postgres://srm_admin:srm_password@localhost:5432/srm_connect';
    this.db = db;
  }

  async searchInterests(query?: string, limit: number = 20) {
    const maxLimit = Math.min(limit, 50);

    if (query && query.trim()) {
      return this.db
        .select()
        .from(interests)
        .where(ilike(interests.name, `%${query.trim().toLowerCase()}%`))
        .limit(maxLimit);
    }

    return this.db.select().from(interests).limit(maxLimit);
  }

  async createInterest(name: string, userRole: string, category?: string) {
    if (userRole !== 'ADMIN' && userRole !== 'MODERATOR') {
      throw new ForbiddenException(
        'Only admins and moderators are authorized to create new interests',
      );
    }

    const normalizedName = name.trim().toLowerCase();

    try {
      const [inserted] = await this.db
        .insert(interests)
        .values({
          name: normalizedName,
          category: category ? category.trim() : null,
        })
        .returning();

      return inserted;
    } catch (err: any) {
      if (err.code === '23505' || err.cause?.code === '23505') {
        throw new ConflictException(
          `Interest '${normalizedName}' already exists`,
        );
      }
      throw err;
    }
  }
}
