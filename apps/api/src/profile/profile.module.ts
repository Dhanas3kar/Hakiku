import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ProfileController } from './profile.controller';
import { SkillsController } from './skills.controller';
import { InterestsController } from './interests.controller';
import { ProfileService } from './services/profile.service';
import { UsernameService } from './services/username.service';
import { SkillsService } from './services/skills.service';
import { InterestsService } from './services/interests.service';
import { LocalStorageProvider } from './storage/local-storage.provider';
import { JwtAuthGuard } from '../networking/guards/jwt-auth.guard';

@Module({
  imports: [
    JwtModule.register({
      secret: process.env.JWT_SECRET!,
    }),
  ],
  controllers: [ProfileController, SkillsController, InterestsController],
  providers: [
    ProfileService,
    UsernameService,
    SkillsService,
    InterestsService,
    LocalStorageProvider,
    JwtAuthGuard,
  ],
  exports: [
    ProfileService,
    UsernameService,
    SkillsService,
    InterestsService,
    LocalStorageProvider,
  ],
})
export class ProfileModule {}
