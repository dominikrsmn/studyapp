import { Injectable } from '@nestjs/common';
import { Prisma } from '../../../infrastructure/database/generated/client';
import { PrismaService } from '../../../infrastructure/database/prisma/prisma.service';
import { graphBuildConfig } from '../graph-build.config';
import type {
  GetPrerequisitesJobData,
  GetPrerequisitesJobResult,
} from '../graph-build.types';

@Injectable()
export class GetPrerequisitesJob {
  constructor(private readonly prismaService: PrismaService) {}

  async process(
    data: GetPrerequisitesJobData,
  ): Promise<GetPrerequisitesJobResult | void> {
    const graph = await this.prismaService.learningGraph.findUnique({
      where: {
        id: data.graphId,
        moduleId: data.moduleId,
        version: data.graphVersion,
        module: { graphVersion: data.graphVersion },
      },
      select: { id: true },
    });
    if (!graph) return;
    if (data.candidateTopicIds.length === 0) {
      return { topicId: data.topicId, candidates: [] };
    }

    const [topics, evidence] = await Promise.all([
      this.prismaService.$queryRaw<Array<{ embedding: number[] }>>(Prisma.sql`
        SELECT "embedding"::text::json AS "embedding"
        FROM "Topic"
        WHERE "id" = ${data.topicId} AND "moduleId" = ${data.moduleId}
      `),
      this.prismaService.$queryRaw<
        Array<{ topicId: string; embedding: number[] }>
      >(Prisma.sql`
        SELECT source_topic."topicId", evidence."embedding"::text::json AS "embedding"
        FROM "TopicEvidence" AS evidence
        JOIN "SourceTopic" AS source_topic ON source_topic."id" = evidence."sourceTopicId"
        JOIN "SourceProcessingStage" AS stage ON stage."sourceId" = source_topic."sourceId"
        WHERE source_topic."topicId" IN (${Prisma.join(data.candidateTopicIds)})
          AND stage."stage" = 'TOPIC_ANALYSIS'
          AND stage."state" = 'COMPLETED'
        ORDER BY evidence."id"
      `),
    ]);

    const evidenceByTopic = new Map<string, number[][]>();
    for (const item of evidence) {
      const embeddings = evidenceByTopic.get(item.topicId);
      if (embeddings) embeddings.push(item.embedding);
      else evidenceByTopic.set(item.topicId, [item.embedding]);
    }

    const candidates = data.candidateTopicIds
      .map((topicId) => ({
        topicId,
        score: this.calculateCandidateScore(
          topics[0].embedding,
          evidenceByTopic.get(topicId) ?? [],
        ),
      }))
      .sort((a, b) => b.score - a.score || a.topicId.localeCompare(b.topicId))
      .slice(0, graphBuildConfig().candidateCount);

    // TODO: Ask the LLM for prerequisites using these candidates.
    return { topicId: data.topicId, candidates };
  }

  private calculateCandidateScore(
    embedding: number[],
    evidenceEmbeddings: number[][],
  ): number {
    if (evidenceEmbeddings.length === 0) return 0;

    const topicLength = Math.sqrt(
      embedding.reduce((sum, value) => sum + value ** 2, 0),
    );
    const nearestDistances = evidenceEmbeddings
      .map((evidence) => {
        const evidenceLength = Math.sqrt(
          evidence.reduce((sum, value) => sum + value ** 2, 0),
        );
        const scalarProduct = evidence.reduce(
          (sum, value, index) => sum + value * embedding[index],
          0,
        );
        return 1 - scalarProduct / (topicLength * evidenceLength);
      })
      .sort((a, b) => a - b)
      .slice(0, 2);
    const averageDistance =
      nearestDistances.reduce((sum, distance) => sum + distance, 0) /
      nearestDistances.length;

    return Math.max(0, Math.min(1, 1 - averageDistance / 2));
  }
}
