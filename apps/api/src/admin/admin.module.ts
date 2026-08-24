import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminService } from './services/admin.service';
import { PostsModule } from '../posts/posts.module';
import { ProfileModule } from '../profile/profile.module';
import { MetricsModule } from '../metrics/metrics.module';

@Module({
  imports: [PostsModule, ProfileModule, MetricsModule],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
