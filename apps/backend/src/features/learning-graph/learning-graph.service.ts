import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/database/prisma/prisma.service';
import { GraphBuildQueue } from './graph-build.queue';
import type { GraphBuildJobData } from './graph-build.types';

@Injectable()
export class LearningGraphService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly graphBuildQueue: GraphBuildQueue,
  ) {}

  async regenerate(moduleId: string): Promise<GraphBuildJobData> {
    const data = await this.prismaService.$transaction(async (transaction) => {
      const module = await transaction.module.update({
        where: { id: moduleId },
        data: { graphVersion: { increment: 1 } },
        select: { graphVersion: true },
      });
      const graph = await transaction.learningGraph.create({
        data: { moduleId, version: module.graphVersion, status: 'QUEUED' },
        select: { id: true },
      });

      return { graphId: graph.id, moduleId, graphVersion: module.graphVersion };
    });

    await this.graphBuildQueue.addEmbeddingFlow(data);
    return data;
  }
}
