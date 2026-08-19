import { db } from '../../db/index';
import {
  Injectable,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { eq, ilike, sql } from 'drizzle-orm';
import { skills } from '../../db/schema';
import * as schema from '../../db/schema';

@Injectable()
export class SkillsService {
  private db;

  constructor() {
    const connectionString =
      process.env.DATABASE_URL ||
      'postgres://srm_admin:srm_password@localhost:5432/srm_connect';
    this.db = db;
  }

  async searchSkills(query?: string, limit: number = 20) {
    const maxLimit = Math.min(limit, 50);

    if (query && query.trim()) {
      return this.db
        .select()
        .from(skills)
        .where(ilike(skills.name, `%${query.trim().toLowerCase()}%`))
        .limit(maxLimit);
    }

    return this.db.select().from(skills).limit(maxLimit);
  }

  async createSkill(name: string, userRole: string, category?: string) {
    if (userRole !== 'ADMIN' && userRole !== 'MODERATOR') {
      throw new ForbiddenException(
        'Only admins and moderators are authorized to create new skills',
      );
    }

    const normalizedName = name.trim().toLowerCase();

    try {
      const [inserted] = await this.db
        .insert(skills)
        .values({
          name: normalizedName,
          category: category ? category.trim() : null,
        })
        .returning();

      return inserted;
    } catch (err: any) {
      if (err.code === '23505' || err.cause?.code === '23505') {
        throw new ConflictException(`Skill '${normalizedName}' already exists`);
      }
      throw err;
    }
  }
}
