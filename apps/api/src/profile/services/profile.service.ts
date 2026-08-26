import { db } from '../../db/index';
import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ConflictException,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { eq, and, or, ilike, sql, desc } from 'drizzle-orm';
import {
  profiles,
  users,
  skills,
  interests,
  profileSkills,
  profileInterests,
  connections,
  blocks,
} from '../../db/schema';
import * as schema from '../../db/schema';
import {
  CreateProfileDto,
  UpdateProfileDto,
  SearchProfilesQueryDto,
  ProfileVisibility,
} from '../dto/profile.dto';
import { UsernameService } from './username.service';
import { LocalStorageProvider } from '../storage/local-storage.provider';
import { randomUUID } from 'crypto';

@Injectable()
export class ProfileService {
  private db;

  constructor(
    private readonly usernameService: UsernameService,
    private readonly storageProvider: LocalStorageProvider,
  ) {
    const connectionString =
      process.env.DATABASE_URL ||
      'postgres://srm_admin:srm_password@localhost:5432/srm_connect';
    this.db = db;
  }

  // Calculate completion percentage & completion status
  calculateCompletion(profile: {
    username?: string;
    displayName?: string;
    campus?: string;
    department?: string;
    degreeProgram?: string;
    batchYear?: number;
    graduationYear?: number;
    bio?: string;
    avatarKey?: string;
    hasSkills?: boolean;
    hasInterests?: boolean;
  }): { completionPercentage: number; isProfileCompleted: boolean } {
    const hasRequired =
      Boolean(profile.username) &&
      Boolean(profile.displayName) &&
      Boolean(profile.campus) &&
      Boolean(profile.department) &&
      Boolean(profile.degreeProgram) &&
      Boolean(profile.batchYear) &&
      Boolean(profile.graduationYear);

    let score = 0;
    if (hasRequired) score += 70; // 70% for required fields
    if (profile.bio && profile.bio.trim().length > 0) score += 10;
    if (profile.avatarKey && profile.avatarKey.trim().length > 0) score += 10;
    if (profile.hasSkills && profile.hasInterests) score += 10;

    return {
      completionPercentage: score,
      isProfileCompleted: hasRequired,
    };
  }

  private async checkUserAccountStatus(userId: string): Promise<void> {
    const [user] = await this.db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user) {
      throw new UnauthorizedException('User account not found or session invalid');
    }

    if (!user.isVerified) {
      throw new ForbiddenException(
        'Please verify your SRM email address before accessing profile features',
      );
    }

    if (user.status !== 'ACTIVE') {
      throw new ForbiddenException(
        `Account is ${(user.status || '').toLowerCase()} and cannot perform profile actions`,
      );
    }
  }

  async createProfile(userId: string, dto: CreateProfileDto) {
    await this.checkUserAccountStatus(userId);

    // Check if profile already exists
    const [existing] = await this.db
      .select()
      .from(profiles)
      .where(eq(profiles.userId, userId))
      .limit(1);
    if (existing) {
      throw new ConflictException('Profile already exists for this user');
    }

    const normalizedUsername = this.usernameService.validateUsername(
      dto.username,
    );

    const hasSkills = Boolean(dto.skillIds && dto.skillIds.length > 0);
    const hasInterests = Boolean(dto.interestIds && dto.interestIds.length > 0);

    const { completionPercentage, isProfileCompleted } =
      this.calculateCompletion({
        ...dto,
        username: normalizedUsername,
        hasSkills,
        hasInterests,
      });

    try {
      return await this.db.transaction(async (tx: any) => {
        const [newProfile] = await tx
          .insert(profiles)
          .values({
            userId,
            username: normalizedUsername,
            displayName: dto.displayName?.trim() || '',
            campus: dto.campus?.trim() || '',
            department: dto.department?.trim() || '',
            degreeProgram: dto.degreeProgram?.trim() || '',
            batchYear: dto.batchYear,
            graduationYear: dto.graduationYear,
            bio: dto.bio ? dto.bio.trim() : null,
            visibility: dto.visibility || 'PUBLIC',
            completionPercentage,
            isProfileCompleted,
          })
          .returning();

        if (dto.skillIds && dto.skillIds.length > 0) {
          await tx.insert(profileSkills).values(
            dto.skillIds.map((skillId) => ({
              profileId: newProfile.id,
              skillId,
            })),
          );
        }

        if (dto.interestIds && dto.interestIds.length > 0) {
          await tx.insert(profileInterests).values(
            dto.interestIds.map((interestId) => ({
              profileId: newProfile.id,
              interestId,
            })),
          );
        }

        return newProfile;
      });
    } catch (err: any) {
      if (err.code === '23505' || err.cause?.code === '23505') {
        throw new ConflictException(
          `Username '${normalizedUsername}' is already taken`,
        );
      }
      throw err;
    }
  }

  async getMyProfile(userId: string) {
    await this.checkUserAccountStatus(userId);


    const [profile] = await this.db
      .select()
      .from(profiles)
      .where(eq(profiles.userId, userId))
      .limit(1);
    if (!profile) {
      throw new NotFoundException(
        'Profile not found. Please complete onboarding first.',
      );
    }

    const userSkills = await this.db
      .select({ id: skills.id, name: skills.name, category: skills.category })
      .from(profileSkills)
      .innerJoin(skills, eq(profileSkills.skillId, skills.id))
      .where(eq(profileSkills.profileId, profile.id));

    const userInterests = await this.db
      .select({
        id: interests.id,
        name: interests.name,
        category: interests.category,
      })
      .from(profileInterests)
      .innerJoin(interests, eq(profileInterests.interestId, interests.id))
      .where(eq(profileInterests.profileId, profile.id));

    const baseUrl = process.env.BASE_URL || 'http://localhost:3001';
    return {
      ...profile,
      avatarUrl: profile.avatarKey
        ? `${baseUrl}/uploads/${profile.avatarKey}`
        : null,
      coverUrl: profile.coverKey
        ? `${baseUrl}/uploads/${profile.coverKey}`
        : null,
      skills: userSkills,
      interests: userInterests,
    };
  }

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    await this.checkUserAccountStatus(userId);

    const [existing] = await this.db
      .select()
      .from(profiles)
      .where(eq(profiles.userId, userId))
      .limit(1);
    if (!existing) {
      throw new NotFoundException('Profile not found');
    }

    let normalizedUsername = existing.username;
    if (dto.username && dto.username !== existing.username) {
      normalizedUsername = this.usernameService.validateUsername(dto.username);
    }

    return await this.db.transaction(async (tx: any) => {
      if (dto.skillIds) {
        await tx
          .delete(profileSkills)
          .where(eq(profileSkills.profileId, existing.id));
        if (dto.skillIds.length > 0) {
          await tx.insert(profileSkills).values(
            dto.skillIds.map((skillId) => ({
              profileId: existing.id,
              skillId,
            })),
          );
        }
      }

      if (dto.interestIds) {
        await tx
          .delete(profileInterests)
          .where(eq(profileInterests.profileId, existing.id));
        if (dto.interestIds.length > 0) {
          await tx.insert(profileInterests).values(
            dto.interestIds.map((interestId) => ({
              profileId: existing.id,
              interestId,
            })),
          );
        }
      }

      const updatedSkills = await tx
        .select()
        .from(profileSkills)
        .where(eq(profileSkills.profileId, existing.id));
      const updatedInterests = await tx
        .select()
        .from(profileInterests)
        .where(eq(profileInterests.profileId, existing.id));

      const mergedProfile = {
        ...existing,
        ...dto,
        username: normalizedUsername,
        hasSkills: updatedSkills.length > 0,
        hasInterests: updatedInterests.length > 0,
      };

      const { completionPercentage, isProfileCompleted } =
        this.calculateCompletion({
          ...mergedProfile,
          bio: mergedProfile.bio ?? undefined,
          avatarKey: mergedProfile.avatarKey ?? undefined,
        });

      try {
        const [updated] = await tx
          .update(profiles)
          .set({
            username: normalizedUsername,
            displayName: dto.displayName
              ? dto.displayName.trim()
              : existing.displayName,
            campus: dto.campus ? dto.campus.trim() : existing.campus,
            department: dto.department
              ? dto.department.trim()
              : existing.department,
            degreeProgram: dto.degreeProgram
              ? dto.degreeProgram.trim()
              : existing.degreeProgram,
            batchYear: dto.batchYear ?? existing.batchYear,
            graduationYear: dto.graduationYear ?? existing.graduationYear,
            bio:
              dto.bio !== undefined
                ? dto.bio
                  ? dto.bio.trim()
                  : null
                : existing.bio,
            visibility: dto.visibility || existing.visibility,
            completionPercentage,
            isProfileCompleted,
            updatedAt: new Date(),
          })
          .where(eq(profiles.id, existing.id))
          .returning();

        return updated;
      } catch (err: any) {
        if (err.code === '23505' || err.cause?.code === '23505') {
          throw new ConflictException(
            `Username '${normalizedUsername}' is already taken`,
          );
        }
        throw err;
      }
    });
  }

  async uploadAvatar(userId: string, fileBuffer: Buffer, mimeType: string) {
    await this.checkUserAccountStatus(userId);

    const [existing] = await this.db
      .select()
      .from(profiles)
      .where(eq(profiles.userId, userId))
      .limit(1);
    if (!existing) {
      throw new NotFoundException(
        'Profile not found. Please complete onboarding first.',
      );
    }

    const ext = mimeType.split('/')[1] || 'webp';
    const storageKey = `users/${userId}/profile/avatar/${randomUUID()}.${ext}`;

    const meta = await this.storageProvider.uploadFile(
      fileBuffer,
      storageKey,
      mimeType,
    );

    // Remove old avatar file if present
    if (existing.avatarKey) {
      await this.storageProvider.deleteFile(existing.avatarKey);
    }

    const { completionPercentage, isProfileCompleted } =
      this.calculateCompletion({
        ...existing,
        bio: existing.bio ?? undefined,
        avatarKey: meta.key,
      });

    await this.db
      .update(profiles)
      .set({
        avatarKey: meta.key,
        completionPercentage,
        isProfileCompleted,
        updatedAt: new Date(),
      })
      .where(eq(profiles.id, existing.id));

    return meta;
  }

  async uploadCover(userId: string, fileBuffer: Buffer, mimeType: string) {
    await this.checkUserAccountStatus(userId);

    const [existing] = await this.db
      .select()
      .from(profiles)
      .where(eq(profiles.userId, userId))
      .limit(1);
    if (!existing) {
      throw new NotFoundException(
        'Profile not found. Please complete onboarding first.',
      );
    }

    const ext = mimeType.split('/')[1] || 'webp';
    const storageKey = `users/${userId}/profile/cover/${randomUUID()}.${ext}`;

    const meta = await this.storageProvider.uploadFile(
      fileBuffer,
      storageKey,
      mimeType,
    );

    if (existing.coverKey) {
      await this.storageProvider.deleteFile(existing.coverKey);
    }

    await this.db
      .update(profiles)
      .set({
        coverKey: meta.key,
        updatedAt: new Date(),
      })
      .where(eq(profiles.id, existing.id));

    return meta;
  }

  async getProfileByUsername(viewerUserId: string, targetUsername: string) {
    const normalized = targetUsername.trim().toLowerCase();

    const [result] = await this.db
      .select({
        profile: profiles,
        userStatus: users.status,
      })
      .from(profiles)
      .innerJoin(users, eq(profiles.userId, users.id))
      .where(sql`lower(${profiles.username}) = ${normalized}`)
      .limit(1);

    if (!result || result.userStatus !== 'ACTIVE') {
      throw new NotFoundException('Profile not found');
    }

    return this.evaluateProfilePrivacy(viewerUserId, result.profile);
  }

  async getProfileByUserId(viewerUserId: string, targetUserId: string) {
    const [result] = await this.db
      .select({
        profile: profiles,
        userStatus: users.status,
      })
      .from(profiles)
      .innerJoin(users, eq(profiles.userId, users.id))
      .where(eq(profiles.userId, targetUserId))
      .limit(1);

    if (!result || result.userStatus !== 'ACTIVE') {
      throw new NotFoundException('Profile not found');
    }

    return this.evaluateProfilePrivacy(viewerUserId, result.profile);
  }

  private async evaluateProfilePrivacy(
    viewerUserId: string,
    targetProfile: any,
  ) {
    const isOwner = viewerUserId === targetProfile.userId;

    // 1. Block Privacy Check: If target has blocked viewer -> 404 Not Found
    const blockedByTarget = await this.db
      .select()
      .from(blocks)
      .where(
        and(
          eq(blocks.blockerId, targetProfile.userId),
          eq(blocks.blockedId, viewerUserId),
        ),
      )
      .limit(1);

    if (blockedByTarget.length > 0) {
      throw new NotFoundException('Profile not found');
    }

    // If viewer blocked target -> Return masked basic card
    const blockedByMe = await this.db
      .select()
      .from(blocks)
      .where(
        and(
          eq(blocks.blockerId, viewerUserId),
          eq(blocks.blockedId, targetProfile.userId),
        ),
      )
      .limit(1);

    const baseUrl = process.env.BASE_URL || 'http://localhost:3001';
    const avatarUrl = targetProfile.avatarKey
      ? `${baseUrl}/uploads/${targetProfile.avatarKey}`
      : null;
    const coverUrl = targetProfile.coverKey
      ? `${baseUrl}/uploads/${targetProfile.coverKey}`
      : null;

    if (blockedByMe.length > 0) {
      return {
        id: targetProfile.id,
        username: targetProfile.username,
        displayName: targetProfile.displayName,
        avatarUrl,
        campus: targetProfile.campus,
        department: targetProfile.department,
        isBlockedByMe: true,
        isRestricted: true,
      };
    }

    if (isOwner || targetProfile.visibility === 'PUBLIC') {
      return this.enrichFullProfile(targetProfile, avatarUrl, coverUrl);
    }

    if (targetProfile.visibility === 'CONNECTIONS_ONLY') {
      const minId =
        viewerUserId < targetProfile.userId
          ? viewerUserId
          : targetProfile.userId;
      const maxId =
        viewerUserId < targetProfile.userId
          ? targetProfile.userId
          : viewerUserId;

      const conn = await this.db
        .select()
        .from(connections)
        .where(
          and(eq(connections.userAId, minId), eq(connections.userBId, maxId)),
        )
        .limit(1);

      if (conn.length > 0) {
        return this.enrichFullProfile(targetProfile, avatarUrl, coverUrl);
      }
    }

    // Restricted Summary Card for Non-connected / PRIVATE profiles
    return {
      id: targetProfile.id,
      username: targetProfile.username,
      displayName: targetProfile.displayName,
      avatarUrl,
      campus: targetProfile.campus,
      department: targetProfile.department,
      visibility: targetProfile.visibility,
      isRestricted: true,
    };
  }

  private async enrichFullProfile(
    profile: any,
    avatarUrl: string | null,
    coverUrl: string | null,
  ) {
    const userSkills = await this.db
      .select({ id: skills.id, name: skills.name, category: skills.category })
      .from(profileSkills)
      .innerJoin(skills, eq(profileSkills.skillId, skills.id))
      .where(eq(profileSkills.profileId, profile.id));

    const userInterests = await this.db
      .select({
        id: interests.id,
        name: interests.name,
        category: interests.category,
      })
      .from(profileInterests)
      .innerJoin(interests, eq(profileInterests.interestId, interests.id))
      .where(eq(profileInterests.profileId, profile.id));

    return {
      ...profile,
      avatarUrl,
      coverUrl,
      skills: userSkills,
      interests: userInterests,
      isRestricted: false,
    };
  }

  async searchProfiles(viewerUserId: string, queryDto: SearchProfilesQueryDto) {
    const limit = Math.min(queryDto.limit || 20, 50);

    // Get all user IDs blocked by viewer or who blocked viewer
    const blockedRows = await this.db
      .select()
      .from(blocks)
      .where(
        or(
          eq(blocks.blockerId, viewerUserId),
          eq(blocks.blockedId, viewerUserId),
        ),
      );

    const blockedUserIds = new Set<string>();
    blockedRows.forEach((r: any) => {
      blockedUserIds.add(
        r.blockerId === viewerUserId ? r.blockedId : r.blockerId,
      );
    });

    const conditions = [eq(users.status, 'ACTIVE')];

    if (queryDto.campus) {
      conditions.push(eq(profiles.campus, queryDto.campus.trim()));
    }
    if (queryDto.department) {
      conditions.push(eq(profiles.department, queryDto.department.trim()));
    }
    if (queryDto.batchYear) {
      conditions.push(eq(profiles.batchYear, queryDto.batchYear));
    }
    if (queryDto.query && queryDto.query.trim()) {
      const q = `%${queryDto.query.trim().toLowerCase()}%`;
      const searchOr = or(
        ilike(profiles.displayName, q),
        ilike(profiles.username, q),
        ilike(profiles.department, q),
        ilike(profiles.campus, q),
      );
      if (searchOr) {
        conditions.push(searchOr);
      }
    }

    const rows = await this.db
      .select({
        profile: profiles,
      })
      .from(profiles)
      .innerJoin(users, eq(profiles.userId, users.id))
      .where(and(...conditions))
      .orderBy(desc(profiles.createdAt), desc(profiles.id))
      .limit(limit * 2); // Fetch extra to account for blocked filter

    const filtered = rows
      .filter((r: any) => !blockedUserIds.has(r.profile.userId))
      .slice(0, limit);

    const baseUrl = process.env.BASE_URL || 'http://localhost:3001';
    const data = filtered.map((r: any) => ({
      id: r.profile.id,
      userId: r.profile.userId,
      username: r.profile.username,
      displayName: r.profile.displayName,
      avatarUrl: r.profile.avatarKey
        ? `${baseUrl}/uploads/${r.profile.avatarKey}`
        : null,
      campus: r.profile.campus,
      department: r.profile.department,
      batchYear: r.profile.batchYear,
    }));

    return { data };
  }
}
