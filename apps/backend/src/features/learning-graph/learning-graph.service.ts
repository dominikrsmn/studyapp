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

  async regenerate(
    moduleId: string,
    graphVersion: number,
  ): Promise<GraphBuildJobData | null> {
    const build = await this.prismaService.$transaction(async (transaction) => {
      // Serialize requests for this version with input changes and publication.
      const modules = await transaction.$queryRaw<
        Array<{ id: string }>
      >`SELECT "id" FROM "Module"
          WHERE "id" = ${moduleId} AND "graphVersion" = ${graphVersion}
          FOR UPDATE`;
      if (modules.length === 0) return null;

      const existing = await transaction.learningGraph.findFirst({
        where: { moduleId, version: graphVersion },
        select: { id: true, status: true },
      });
      const graph =
        existing ??
        (await transaction.learningGraph.create({
          data: { moduleId, version: graphVersion, status: 'QUEUED' },
          select: { id: true, status: true },
        }));
      return {
        data: { graphId: graph.id, moduleId, graphVersion },
        queued: graph.status === 'QUEUED',
      };
    });

    if (!build) return null;
    // The queue uses stable job IDs, so a failed enqueue can be retried.
    if (build.queued) await this.graphBuildQueue.addEmbeddingFlow(build.data);
    return build.data;
  }
}
