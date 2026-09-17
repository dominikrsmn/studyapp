import { Controller, Get, Param, ParseUUIDPipe } from '@nestjs/common';
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

  @Get()
  findPublished(
    @ActiveSemesterId() semesterId: string,
    @Param('moduleId', ParseUUIDPipe) moduleId: string,
  ): Promise<PublishedLearningGraphDto | null> {
    return this.learningGraphService.findPublished(semesterId, moduleId);
  }
}
