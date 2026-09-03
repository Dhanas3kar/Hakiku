import { Module } from '@nestjs/common';
import { PostsController } from './posts.controller';
import { PostsService } from './services/posts.service';
import { PostAccessService } from './services/post-access.service';
import { PostMediaService } from './services/post-media.service';
import { LikesService } from './services/likes.service';
import { CommentsService } from './services/comments.service';
import { LocalStorageProvider } from '../profile/storage/local-storage.provider';
import { JwtAuthGuard } from '../networking/guards/jwt-auth.guard';

@Module({
  imports: [],
  controllers: [PostsController],
  providers: [
    PostsService,
    PostAccessService,
    PostMediaService,
    LikesService,
    CommentsService,
    LocalStorageProvider,
    JwtAuthGuard,
  ],
  exports: [
    PostsService,
    PostAccessService,
    PostMediaService,
    LikesService,
    CommentsService,
  ],
})
export class PostsModule {}
