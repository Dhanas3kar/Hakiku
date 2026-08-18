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
import { SkillsService } from './services/skills.service';
import { CreateSkillDto, QueryTaxonomyDto } from './dto/skill-interest.dto';
import { JwtAuthGuard } from '../networking/guards/jwt-auth.guard';

@Controller('skills')
@UseGuards(JwtAuthGuard)
export class SkillsController {
  constructor(private readonly skillsService: SkillsService) {}

  @Get()
  async searchSkills(@Query() query: QueryTaxonomyDto) {
    return this.skillsService.searchSkills(query.query, query.limit);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createSkill(@Req() req: any, @Body() dto: CreateSkillDto) {
    return this.skillsService.createSkill(dto.name, req.user.role, dto.category);
  }
}
