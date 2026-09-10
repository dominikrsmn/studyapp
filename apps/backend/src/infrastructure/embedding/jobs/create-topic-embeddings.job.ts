import { Injectable, Logger } from '@nestjs/common';
import type { CreateTopicEmbeddingsJobData } from '../embedding.types';
import { PrismaService } from '../../database/prisma/prisma.service';
import { EmbeddingService } from '../embedding.service';
import { Prisma, Topic } from '../../database/generated/client';

@Injectable()
export class CreateTopicEmbeddingsJob {
  private readonly logger = new Logger(CreateTopicEmbeddingsJob.name);

  constructor(
    private readonly prismaService: PrismaService,
    private readonly embeddingService: EmbeddingService,
  ) {}

  async process(data: CreateTopicEmbeddingsJobData): Promise<void> {
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
        `Skipping create-topic-embeddings job because graph "${data.graphId}" no longer exists`,
      );
      return;
    }
    const requestedTopicIds = [...new Set(data.topicIds)];
    if (requestedTopicIds.length === 0) {
      throw new Error('Cannot embed an empty topic batch');
    }

    try {
      const topics = await this.prismaService.$queryRaw<
        Array<Pick<Topic, 'id' | 'title' | 'description'>>
      >(
        Prisma.sql`
          SELECT topic."id",
                 topic."title",
                 topic."description"
          FROM "Topic" AS topic
          WHERE topic."moduleId" = ${data.moduleId}
            AND topic."id" IN (${Prisma.join(requestedTopicIds)})
            AND topic."embedding" IS NULL
        `,
      );
      if (topics.length === 0) {
        return;
      }

      const vectors = await this.embeddingService.embedTexts(
        topics.map((topic) => `${topic.title}: ${topic.description}`),
      );
      const embeddingRows = topics.map((topic, index) => {
        const vector = `[${vectors[index].join(',')}]`;
        return Prisma.sql`(${topic.id}::text, ${topic.title}::text, ${topic.description}::text, ${vector}::vector)`;
      });

      await this.prismaService.$executeRaw(
        Prisma.sql`
          UPDATE "Topic" AS topic
          SET "embedding" = incoming."embedding"
          FROM (
            VALUES ${Prisma.join(embeddingRows)}
          ) AS incoming("id", "title", "description", "embedding")
          WHERE topic."id" = incoming."id"
            AND topic."moduleId" = ${data.moduleId}
            AND topic."embedding" IS NULL
            AND topic."title" = incoming."title"
            AND topic."description" = incoming."description"
        `,
      );
    } catch (error) {
      this.logger.error(
        `Error embedding topics for module "${data.moduleId}": ${error}`,
        error instanceof Error ? error.stack : undefined,
      );

      throw error;
    }
  }
}
