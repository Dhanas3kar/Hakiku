import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  Req,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { InterestsService } from './services/interests.service';
import { CreateInterestDto, QueryTaxonomyDto } from './dto/skill-interest.dto';
import { JwtAuthGuard } from '../networking/guards/jwt-auth.guard';

@Controller('interests')
@UseGuards(JwtAuthGuard)
export class InterestsController {
  constructor(private readonly interestsService: InterestsService) {}

  @Get()
  async searchInterests(@Query() query: QueryTaxonomyDto) {
    return this.interestsService.searchInterests(query.query, query.limit);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createInterest(@Req() req: any, @Body() dto: CreateInterestDto) {
    return this.interestsService.createInterest(dto.name, req.user.role, dto.category);
  }
}
