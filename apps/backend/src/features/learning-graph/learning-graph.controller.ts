import { Controller, Get, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import type { PublishedLearningGraphDto } from '@study/contracts';
import {
  ActiveSemesterId,
  RequireActiveSemester,
} from '../auth/active-semester.decorator';
import { LearningGraphService } from './learning-graph.service';

@Controller('module/:moduleId/learning-graph')
@RequireActiveSemester()
export class LearningGraphController {
  constructor(private readonly learningGraphService: LearningGraphService) {}

  @Get('build')
  findLatest(
    @ActiveSemesterId() semesterId: string,
    @Param('moduleId', ParseUUIDPipe) moduleId: string,
  ) {
    return this.learningGraphService.findLatest(semesterId, moduleId);
  }

  @Post('regenerate')
  regenerate(
    @ActiveSemesterId() semesterId: string,
    @Param('moduleId', ParseUUIDPipe) moduleId: string,
  ) {
    return this.learningGraphService.requestBuild(semesterId, moduleId);
  }

  @Post('retry-publication')
  retryPublication(
    @ActiveSemesterId() semesterId: string,
    @Param('moduleId', ParseUUIDPipe) moduleId: string,
  ) {
    return this.learningGraphService.retryPublication(semesterId, moduleId);
  }

  @Post('retry-grouping')
  retryGrouping(
    @ActiveSemesterId() semesterId: string,
    @Param('moduleId', ParseUUIDPipe) moduleId: string,
  ) {
    return this.learningGraphService.retryGrouping(semesterId, moduleId);
  }

  @Get()
  findPublished(
    @ActiveSemesterId() semesterId: string,
    @Param('moduleId', ParseUUIDPipe) moduleId: string,
  ): Promise<PublishedLearningGraphDto | null> {
    return this.learningGraphService.findPublished(semesterId, moduleId);
  }
}
