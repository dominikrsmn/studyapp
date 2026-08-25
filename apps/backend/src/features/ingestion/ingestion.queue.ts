import { InjectQueue } from '@nestjs/bullmq';
import { Inject, Injectable } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { Queue } from 'bullmq';
import { ingestionConfig } from './ingestion.config';
import {
  BuildRagChunksJobData,
  EmbedRagChunksJobData,
  FinalizeIngestionJobData,
  IngestionJobData,
  ParseDocumentJobData,
} from './ingestion.types';

@Injectable()
export class IngestionQueue {
  constructor(
    @InjectQueue(ingestionConfig().queue.name)
    private readonly queue: Queue<IngestionJobData>,
    @Inject(ingestionConfig.KEY)
    private readonly config: ConfigType<typeof ingestionConfig>,
  ) {}

  async addParseDocument(sourceId: string): Promise<void> {
    await this.queue.add(
      this.config.queue.jobs.parse_document,
      {
        sourceId,
      } satisfies ParseDocumentJobData,
      {
        jobId: `parse-document/${sourceId}`,
      },
    );
  }

  async addBuildRagChunks(sourceId: string): Promise<void> {
    await this.queue.add(
      this.config.queue.jobs.build_rag_chunks,
      {
        sourceId,
      } satisfies BuildRagChunksJobData,
      {
        jobId: `build-rag-chunks/${sourceId}`,
      },
    );
  }

  async addEmbedRagChunks(sourceId: string, chunkIds: string[]): Promise<void> {
    if (chunkIds.length === 0) {
      throw new Error('Cannot enqueue an empty RAG embedding batch');
    }

    await this.queue.add(
      this.config.queue.jobs.embed_rag_chunks,
      {
        sourceId,
        chunkIds,
      } satisfies EmbedRagChunksJobData,
      {
        jobId: `embed-rag-chunks/${sourceId}/${chunkIds[0]}`,
      },
    );
  }

  async addFinalizeIngestion(sourceId: string): Promise<void> {
    await this.queue.add(
      this.config.queue.jobs.finalize_ingestion,
      {
        sourceId,
      } satisfies FinalizeIngestionJobData,
      {
        jobId: `finalize-ingestion/${sourceId}`,
      },
    );
  }
}
