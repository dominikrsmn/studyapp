import { InjectFlowProducer } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { FlowProducer } from 'bullmq';
import { Prisma } from '../../infrastructure/database/generated/client';
import { PrismaService } from '../../infrastructure/database/prisma/prisma.service';
import { EmbeddingBatchingService } from '../../infrastructure/embedding/embedding-batching.service';
import { embeddingConfig } from '../../infrastructure/config/embedding.config';
import type {
  CreateTopicEmbeddingsJobData,
  CreateEvidenceEmbeddingsJobData,
} from '../../infrastructure/embedding/embedding.types';
import { graphBuildConfig } from './graph-build.config';
import type {
  GraphBuildJobData,
  GetPrerequisitesJobData,
} from './graph-build.types';

@Injectable()
export class GraphBuildQueue {
  constructor(
    @InjectFlowProducer(graphBuildConfig().flowProducer.name)
    private readonly flowProducer: FlowProducer,
    private readonly prismaService: PrismaService,
    private readonly embeddingBatchingService: EmbeddingBatchingService,
  ) {}

  async addEmbeddingFlow(data: GraphBuildJobData): Promise<void> {
    // Batch every input so retries retain the same job IDs and payloads as embeddings finish.
    const [topics, evidence] = await Promise.all([
      this.prismaService.$queryRaw<Array<{ id: string }>>(Prisma.sql`
        SELECT "id" FROM "Topic"
        WHERE "moduleId" = ${data.moduleId}
        ORDER BY "id"
      `),
      this.prismaService.$queryRaw<Array<{ id: string }>>(Prisma.sql`
        SELECT evidence."id" FROM "TopicEvidence" AS evidence
        JOIN "SourceTopic" AS source_topic
          ON source_topic."id" = evidence."sourceTopicId"
        JOIN "Source" AS source ON source."id" = source_topic."sourceId"
        WHERE source."moduleId" = ${data.moduleId}
        ORDER BY evidence."id"
      `),
    ]);
    const graphQueue = graphBuildConfig().queue;
    const embeddingQueue = embeddingConfig().queue;
    const buildId = `${data.graphId}/${data.graphVersion}`;
    const topicBatches = this.embeddingBatchingService.batch(
      topics.map(({ id }) => id),
    );
    const evidenceBatches = this.embeddingBatchingService.batch(
      evidence.map(({ id }) => id),
    );

    await this.flowProducer.add({
      name: graphQueue.jobs.dispatch_candidates,
      queueName: graphQueue.name,
      data,
      opts: {
        jobId: `${graphQueue.jobs.dispatch_candidates}/${buildId}`,
      },
      children: [
        ...topicBatches.map((topicIds, index) => ({
          name: embeddingQueue.jobs.create_topic_embeddings,
          queueName: embeddingQueue.name,
          data: { ...data, topicIds } satisfies CreateTopicEmbeddingsJobData,
          opts: {
            jobId: `${embeddingQueue.jobs.create_topic_embeddings}/${buildId}/${index}`,
            failParentOnFailure: true,
          },
        })),
        ...evidenceBatches.map((topicEvidenceIds, index) => ({
          name: embeddingQueue.jobs.create_evidence_embeddings,
          queueName: embeddingQueue.name,
          data: {
            ...data,
            topicEvidenceIds,
          } satisfies CreateEvidenceEmbeddingsJobData,
          opts: {
            jobId: `${embeddingQueue.jobs.create_evidence_embeddings}/${buildId}/${index}`,
            failParentOnFailure: true,
          },
        })),
      ],
    });
  }

  async addGraphFlow(
    data: GraphBuildJobData,
    topicIds: string[],
  ): Promise<void> {
    const { name: queueName, jobs } = graphBuildConfig().queue;
    const buildId = `${data.graphId}/${data.graphVersion}`;

    await this.flowProducer.add({
      name: jobs.refine_graph,
      queueName,
      data,
      opts: { jobId: `${jobs.refine_graph}/${buildId}` },
      children: [
        {
          name: jobs.detect_cycles,
          queueName,
          data,
          opts: {
            jobId: `${jobs.detect_cycles}/${buildId}`,
            failParentOnFailure: true,
          },
          children: topicIds.map((topicId) => ({
            name: jobs.get_prerequisites,
            queueName,
            data: {
              ...data,
              topicId,
              candidateTopicIds: topicIds.filter((id) => id !== topicId),
            } satisfies GetPrerequisitesJobData,
            opts: {
              jobId: `${jobs.get_prerequisites}/${buildId}/${topicId}`,
              failParentOnFailure: true,
            },
          })),
        },
      ],
    });
  }
}
