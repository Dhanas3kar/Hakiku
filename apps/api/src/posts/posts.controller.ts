import {
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  Req,
  UseGuards,
  HttpCode,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import { PostsService } from './services/posts.service';
import { LikesService } from './services/likes.service';
import { CommentsService } from './services/comments.service';
import { PostMediaService } from './services/post-media.service';
import {
  CreatePostDto,
  UpdatePostDto,
  CreateCommentDto,
  UpdateCommentDto,
  CommentsQueryDto,
  UserPostsQueryDto,
} from './dto/posts.dto';
import { JwtAuthGuard } from '../networking/guards/jwt-auth.guard';
import type { FastifyRequest } from 'fastify';

@Controller('posts')
@UseGuards(JwtAuthGuard)
export class PostsController {
  constructor(
    private readonly postsService: PostsService,
    private readonly likesService: LikesService,
    private readonly commentsService: CommentsService,
    private readonly postMediaService: PostMediaService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createPost(@Req() req: any, @Body() dto: CreatePostDto) {
    return this.postsService.createPost(req.user.sub, dto);
  }

  @Post('media/upload')
  @HttpCode(HttpStatus.CREATED)
  async uploadMedia(@Req() req: FastifyRequest) {
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
    const userId = (req as any).user.sub;

    return this.postMediaService.uploadMedia(userId, buffer, mimeType);
  }

  @Get(':id')
  async getPost(@Req() req: any, @Param('id') id: string) {
    return this.postsService.getPost(req.user.sub, id);
  }

  @Patch(':id')
  async updatePost(
    @Req() req: any,
    @Param('id') id: string,
    @Body() dto: UpdatePostDto,
  ) {
    return this.postsService.updatePost(req.user.sub, id, dto);
  }

  @Delete(':id')
  async deletePost(@Req() req: any, @Param('id') id: string) {
    return this.postsService.deletePost(req.user.sub, id);
  }

  @Post(':id/like')
  @HttpCode(HttpStatus.OK)
  async likePost(@Req() req: any, @Param('id') id: string) {
    return this.likesService.likePost(req.user.sub, id);
  }

  @Delete(':id/like')
  @HttpCode(HttpStatus.OK)
  async unlikePost(@Req() req: any, @Param('id') id: string) {
    return this.likesService.unlikePost(req.user.sub, id);
  }

  @Post(':id/comments')
  @HttpCode(HttpStatus.CREATED)
  async createComment(
    @Req() req: any,
    @Param('id') id: string,
    @Body() dto: CreateCommentDto,
  ) {
    return this.commentsService.createComment(req.user.sub, id, dto);
  }

  @Get(':id/comments')
  async getPostComments(
    @Req() req: any,
    @Param('id') id: string,
    @Query() query: CommentsQueryDto,
  ) {
    return this.commentsService.getPostComments(req.user.sub, id, query);
  }

  @Patch('comments/:commentId')
  async updateComment(
    @Req() req: any,
    @Param('commentId') commentId: string,
    @Body() dto: UpdateCommentDto,
  ) {
    return this.commentsService.updateComment(req.user.sub, commentId, dto);
  }

  @Delete('comments/:commentId')
  async deleteComment(@Req() req: any, @Param('commentId') commentId: string) {
    return this.commentsService.deleteComment(req.user.sub, commentId);
  }

  @Get('user/:userId')
  async getUserPosts(
    @Req() req: any,
    @Param('userId') userId: string,
    @Query() query: UserPostsQueryDto,
  ) {
    return this.postsService.getUserPosts(req.user.sub, userId, query);
  }
}
