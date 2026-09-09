import { Injectable } from '@nestjs/common';
import { Prisma } from '../../../infrastructure/database/generated/client';
import { PrismaService } from '../../../infrastructure/database/prisma/prisma.service';
import { GraphBuildQueue } from '../graph-build.queue';
import type {
  DispatchCandidatesJobData,
  FindCandidatesJobData,
} from '../graph-build.types';

@Injectable()
export class DispatchCandidatesJob {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly graphBuildQueue: GraphBuildQueue,
  ) {}

  async process(data: DispatchCandidatesJobData): Promise<void> {
    const inputs = await this.prismaService.$transaction(
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
          Array<{ topicId: string; embedding: number[] }>
        >(Prisma.sql`
        SELECT topic."id" AS "topicId", topic."embedding"::text::json AS "embedding"
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
        if (topics.length === 0) return null;

        const evidence = await transaction.$queryRaw<
          FindCandidatesJobData['evidence']
        >(Prisma.sql`
        SELECT source_topic."topicId", evidence."id", evidence."embedding"::text::json AS "embedding"
        FROM "TopicEvidence" AS evidence
        JOIN "SourceTopic" AS source_topic ON source_topic."id" = evidence."sourceTopicId"
        JOIN "SourceProcessingStage" AS stage ON stage."sourceId" = source_topic."sourceId"
        WHERE source_topic."topicId" IN (${Prisma.join(topics.map(({ topicId }) => topicId))})
          AND stage."stage" = 'TOPIC_ANALYSIS'
          AND stage."state" = 'COMPLETED'
        ORDER BY evidence."id"
      `);
        return { topics, evidence };
      },
      { isolationLevel: 'RepeatableRead' },
    );

    if (!inputs) return;

    await this.graphBuildQueue.addFindCandidates(
      inputs.topics.map(({ topicId, embedding }) => ({
        ...data,
        topicId,
        embedding,
        evidence: inputs.evidence.filter(
          (evidence) => evidence.topicId !== topicId,
        ),
      })),
    );
  }
}
