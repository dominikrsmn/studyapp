import { Injectable, Logger } from '@nestjs/common';
import type { CreateEvidenceEmbeddingsJobData } from '../embedding.types';
import { PrismaService } from '../../database/prisma/prisma.service';
import { EmbeddingService } from '../embedding.service';
import { EmbeddingBatchingService } from '../embedding-batching.service';
import { Prisma, TopicEvidence } from '../../database/generated/client';

@Injectable()
export class CreateEvidenceEmbeddingsJob {
  private readonly logger = new Logger(CreateEvidenceEmbeddingsJob.name);

  constructor(
    private readonly prismaService: PrismaService,
    private readonly embeddingService: EmbeddingService,
    private readonly embeddingBatchingService: EmbeddingBatchingService,
  ) {}

  async process(data: CreateEvidenceEmbeddingsJobData): Promise<void> {
    const requestedEvidenceIds = [...new Set(data.topicEvidenceIds)];
    if (requestedEvidenceIds.length === 0) {
      throw new Error('Cannot embed an empty evidence batch');
    }

    try {
      const graph = await this.prismaService.learningGraph.findUnique({
        where: {
          id: data.graphId,
          moduleId: data.moduleId,
          module: { graphVersion: data.graphVersion },
          version: data.graphVersion,
        },
      });
      if (!graph) {
        this.logger.warn(
          `Skipping create-evidence-embeddings job because graph "${data.buildId}" no longer exists or its module revision changed`,
        );
        return;
      }

      const evidence = await this.prismaService.$queryRaw<
        Array<Pick<TopicEvidence, 'id' | 'content'>>
      >(
        Prisma.sql`
          SELECT evidence."id", evidence."content"
          FROM "TopicEvidence" AS evidence
          JOIN "SourceTopic" AS source_topic
            ON source_topic."id" = evidence."sourceTopicId"
          JOIN "Source" AS source
            ON source."id" = source_topic."sourceId"
          WHERE source."moduleId" = ${data.moduleId}
            AND evidence."id" IN (${Prisma.join(requestedEvidenceIds)})
            AND evidence."embedding" IS NULL
        `,
      );

      for (const batch of this.embeddingBatchingService.batch(evidence)) {
        const vectors = await this.embeddingService.embedTexts(
          batch.map((item) => item.content),
        );
        const embeddingRows = batch.map((item, index) => {
          const vector = `[${vectors[index].join(',')}]`;
          return Prisma.sql`(${item.id}::text, ${vector}::vector)`;
        });

        await this.prismaService.$executeRaw(
          Prisma.sql`
            UPDATE "TopicEvidence" AS evidence
            SET "embedding" = incoming."embedding"
            FROM (
              VALUES ${Prisma.join(embeddingRows)}
            ) AS incoming("id", "embedding"),
            "SourceTopic" AS source_topic,
            "Source" AS source
            WHERE evidence."id" = incoming."id"
              AND source_topic."id" = evidence."sourceTopicId"
              AND source."id" = source_topic."sourceId"
              AND source."moduleId" = ${data.moduleId}
              AND evidence."embedding" IS NULL
          `,
        );
      }
    } catch (error) {
      this.logger.error(
        `Error embedding evidence for module "${data.moduleId}": ${error}`,
        error instanceof Error ? error.stack : undefined,
      );

      throw error;
    }
  }
}
