import { Controller, Get, Param, ParseUUIDPipe } from '@nestjs/common';
import type { TopicOverviewDto } from '@study/contracts';
import {
  ActiveSemesterId,
  RequireActiveSemester,
} from '../auth/active-semester.decorator';
import { TopicService } from './topic.service';

@Controller('module/:moduleId/topic')
@RequireActiveSemester()
export class TopicController {
  constructor(private readonly topicService: TopicService) {}

  @Get()
  findAll(
    @ActiveSemesterId() semesterId: string,
    @Param('moduleId', ParseUUIDPipe) moduleId: string,
  ): Promise<TopicOverviewDto[]> {
    return this.topicService.findAll(semesterId, moduleId);
  }
}
