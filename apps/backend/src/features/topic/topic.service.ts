import { Injectable, NotFoundException } from '@nestjs/common';
import type { TopicOverviewDto } from '@study/contracts';
import {
  ProcessingState,
  SourceProcessingStageType,
  TopicState,
} from '../../infrastructure/database/generated/enums';
import { PrismaService } from '../../infrastructure/database/prisma/prisma.service';

const completedTopicAnalysis = {
  processingStages: {
    some: {
      stage: SourceProcessingStageType.TOPIC_ANALYSIS,
      state: ProcessingState.COMPLETED,
    },
  },
} as const;

@Injectable()
export class TopicService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(
    semesterId: string,
    moduleId: string,
  ): Promise<TopicOverviewDto[]> {
    if (
      !(await this.prisma.module.findFirst({
        where: { id: moduleId, semesterId },
        select: { id: true },
      }))
    ) {
      throw new NotFoundException(`Module with id "${moduleId}" was not found`);
    }

    return this.prisma.topic.findMany({
      where: {
        moduleId,
        state: { not: TopicState.REJECTED },
        sourceTopics: { some: { source: completedTopicAnalysis } },
      },
      orderBy: { title: 'asc' },
      select: {
        id: true,
        title: true,
        description: true,
        summary: true,
        sourceTopics: {
          where: { source: completedTopicAnalysis },
          orderBy: [{ source: { createdAt: 'desc' } }, { spanIndex: 'asc' }],
          select: {
            id: true,
            title: true,
            description: true,
            pageStart: true,
            pageEnd: true,
            source: { select: { id: true, name: true } },
          },
        },
      },
    });
  }
}
