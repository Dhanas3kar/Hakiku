import {
  Controller,
  Post,
  Get,
  Patch,
  Body,
  Param,
  Query,
  Req,
  UseGuards,
  HttpCode,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import { ProfileService } from './services/profile.service';
import {
  CreateProfileDto,
  UpdateProfileDto,
  SearchProfilesQueryDto,
} from './dto/profile.dto';
import { JwtAuthGuard } from '../networking/guards/jwt-auth.guard';
import type { FastifyRequest } from 'fastify';

@Controller('profile')
@UseGuards(JwtAuthGuard)
export class ProfileController {
  constructor(private readonly profileService: ProfileService) {}

  @Post('onboarding')
  @HttpCode(HttpStatus.CREATED)
  async createProfile(@Req() req: any, @Body() dto: CreateProfileDto) {
    return this.profileService.createProfile(req.user.sub, dto);
  }

  @Get('me')
  async getMyProfile(@Req() req: any) {
    return this.profileService.getMyProfile(req.user.sub);
  }

  @Patch('me')
  async updateProfile(@Req() req: any, @Body() dto: UpdateProfileDto) {
    return this.profileService.updateProfile(req.user.sub, dto);
  }

  @Post('me/avatar')
  @HttpCode(HttpStatus.OK)
  async uploadAvatar(@Req() req: FastifyRequest) {
    let buffer: Buffer;
    if (Buffer.isBuffer(req.body)) {
      buffer = req.body;
    } else {
      const chunks: Buffer[] = [];
      await new Promise<void>((resolve, reject) => {
        req.raw.on('data', (chunk) => chunks.push(chunk));
        req.raw.on('end', () => resolve());
        req.raw.on('error', (err) => reject(err));
      });
      buffer = Buffer.concat(chunks);
    }
    const mimeType = (req.headers['content-type'] as string) || 'image/jpeg';

    return this.profileService.uploadAvatar(
      (req as any).user.sub,
      buffer,
      mimeType,
    );
  }

  @Post('me/cover')
  @HttpCode(HttpStatus.OK)
  async uploadCover(@Req() req: FastifyRequest) {
    let buffer: Buffer;
    if (Buffer.isBuffer(req.body)) {
      buffer = req.body;
    } else {
      const chunks: Buffer[] = [];
      await new Promise<void>((resolve, reject) => {
        req.raw.on('data', (chunk) => chunks.push(chunk));
        req.raw.on('end', () => resolve());
        req.raw.on('error', (err) => reject(err));
      });
      buffer = Buffer.concat(chunks);
    }
    const mimeType = (req.headers['content-type'] as string) || 'image/jpeg';

    return this.profileService.uploadCover(
      (req as any).user.sub,
      buffer,
      mimeType,
    );
  }

  @Get('search')
  async searchProfiles(
    @Req() req: any,
    @Query() query: SearchProfilesQueryDto,
  ) {
    return this.profileService.searchProfiles(req.user.sub, query);
  }

  @Get('username/:username')
  async getProfileByUsername(
    @Req() req: any,
    @Param('username') username: string,
  ) {
    return this.profileService.getProfileByUsername(req.user.sub, username);
  }

  @Get('id/:userId')
  async getProfileByUserId(@Req() req: any, @Param('userId') userId: string) {
    return this.profileService.getProfileByUserId(req.user.sub, userId);
  }
}
