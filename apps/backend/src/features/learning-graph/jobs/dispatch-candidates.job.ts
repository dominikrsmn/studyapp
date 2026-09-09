import { Injectable } from '@nestjs/common';
import { Prisma } from '../../../infrastructure/database/generated/client';
import { PrismaService } from '../../../infrastructure/database/prisma/prisma.service';
import { GraphBuildQueue } from '../graph-build.queue';
import type { DispatchCandidatesJobData } from '../graph-build.types';

@Injectable()
export class DispatchCandidatesJob {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly graphBuildQueue: GraphBuildQueue,
  ) {}

  async process(data: DispatchCandidatesJobData): Promise<void> {
    const topics = await this.prismaService.$transaction(
      async (transaction) => {
        const graph = await transaction.learningGraph.findUnique({
          where: {
            id: data.graphId,
            moduleId: data.moduleId,
            version: data.graphVersion,
            module: { graphVersion: data.graphVersion },
          },
          select: { id: true },
        });
        if (!graph) return null;

        const topics = await transaction.$queryRaw<
          Array<{ topicId: string }>
        >(Prisma.sql`
        SELECT topic."id" AS "topicId"
        FROM "Topic" AS topic
        WHERE topic."moduleId" = ${data.moduleId}
          AND topic."state" != 'REJECTED'
          AND EXISTS (
            SELECT 1 FROM "SourceTopic" AS source_topic
            JOIN "SourceProcessingStage" AS stage ON stage."sourceId" = source_topic."sourceId"
            WHERE source_topic."topicId" = topic."id"
              AND stage."stage" = 'TOPIC_ANALYSIS'
              AND stage."state" = 'COMPLETED'
          )
        ORDER BY topic."id"
      `);
        return topics;
      },
      { isolationLevel: 'RepeatableRead' },
    );

    if (!topics) return;

    await this.graphBuildQueue.addGraphFlow(
      data,
      topics.map(({ topicId }) => topicId),
    );
  }
}
