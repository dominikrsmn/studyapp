import { InjectFlowProducer, InjectQueue } from '@nestjs/bullmq';
import { Inject, Injectable } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { FlowProducer, Queue } from 'bullmq';
import {
  ProcessingState,
  SourceProcessingStageType,
} from '../../infrastructure/database/generated/enums';
import { ingestionConfig } from './ingestion.config';
import {
  BuildRagChunksJobData,
  EmbedRagChunksJobData,
  FinalizeIngestionJobData,
  IngestionJobData,
  ParseDocumentJobData,
} from './ingestion.types';
import { SourceProcessingStageService } from './source-processing-stage.service';

@Injectable()
export class IngestionQueue {
  constructor(
    @InjectQueue(ingestionConfig().queue.name)
    private readonly queue: Queue<IngestionJobData>,
    @InjectFlowProducer(ingestionConfig().flowProducer.name)
    private readonly flowProducer: FlowProducer,
    @Inject(ingestionConfig.KEY)
    private readonly config: ConfigType<typeof ingestionConfig>,
    private readonly sourceProcessingStageService: SourceProcessingStageService,
  ) {}

  async addParseDocument(sourceId: string): Promise<void> {
    await this.enqueueStage(
      sourceId,
      SourceProcessingStageType.CONVERSION,
      () =>
        this.queue.add(
          this.config.queue.jobs.parse_document,
          {
            sourceId,
          } satisfies ParseDocumentJobData,
          {
            jobId: `${this.config.queue.jobs.parse_document}/${sourceId}`,
          },
        ),
    );
  }

  async addBuildRagChunks(sourceId: string): Promise<void> {
    await this.enqueueStage(
      sourceId,
      SourceProcessingStageType.RAG_INDEXING,
      () =>
        this.queue.add(
          this.config.queue.jobs.build_rag_chunks,
          {
            sourceId,
          } satisfies BuildRagChunksJobData,
          {
            jobId: `${this.config.queue.jobs.build_rag_chunks}/${sourceId}`,
          },
        ),
    );
  }

  async addRagEmbeddingFlow(
    sourceId: string,
    chunkIdBatches: string[][],
  ): Promise<void> {
    if (
      chunkIdBatches.length === 0 ||
      chunkIdBatches.some((chunkIds) => chunkIds.length === 0)
    ) {
      throw new Error('Cannot enqueue empty RAG embedding batches');
    }

    await this.flowProducer.add(
      {
        name: this.config.queue.jobs.finalize_ingestion,
        queueName: this.config.queue.name,
        data: { sourceId } satisfies FinalizeIngestionJobData,
        opts: {
          jobId: `${this.config.queue.jobs.finalize_ingestion}/${sourceId}`,
        },
        children: chunkIdBatches.map((chunkIds, batchIndex) => ({
          name: this.config.queue.jobs.embed_rag_chunks,
          queueName: this.config.queue.name,
          data: { sourceId, chunkIds } satisfies EmbedRagChunksJobData,
          opts: {
            jobId: `${this.config.queue.jobs.embed_rag_chunks}/${sourceId}/${batchIndex}`,
            failParentOnFailure: true,
          },
        })),
      },
      {
        queuesOptions: {
          [this.config.queue.name]: {
            defaultJobOptions: this.config.queue.defaultJobOptions,
          },
        },
      },
    );
  }

  private async enqueueStage(
    sourceId: string,
    stage: SourceProcessingStageType,
    enqueue: () => Promise<unknown>,
  ): Promise<void> {
    await this.sourceProcessingStageService.transition(
      sourceId,
      stage,
      ProcessingState.QUEUED,
    );

    try {
      await enqueue();
    } catch (error) {
      await this.sourceProcessingStageService
        .transition(sourceId, stage, ProcessingState.FAILED, { error })
        .catch(() => undefined);
      throw error;
    }
  }
}
