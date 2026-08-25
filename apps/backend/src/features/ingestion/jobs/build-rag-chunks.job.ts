import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import type { ChunkedDocumentResultItem } from 'docling-sdk';
import { embeddingConfig } from '../../../infrastructure/config/embedding.config';
import {
  ProcessingState,
  SourceProcessingStageType,
} from '../../../infrastructure/database/generated/enums';
import { PrismaService } from '../../../infrastructure/database/prisma/prisma.service';
import { DoclingService } from '../../../infrastructure/docling/docling.service';
import { ingestionConfig } from '../ingestion.config';
import { IngestionQueue } from '../ingestion.queue';
import { BuildRagChunksJobData } from '../ingestion.types';
import { SourceProcessingStageService } from '../source-processing-stage.service';

type SourceChunkData = {
  chunkIndex: number;
  content: string;
  headingPath: string[];
  pageStart: number | null;
  pageEnd: number | null;
  startRef: string | null;
  endRef: string | null;
  tokenCount: number | null;
};

@Injectable()
export class BuildRagChunksJob {
  private readonly logger = new Logger(BuildRagChunksJob.name);

  constructor(
    private readonly doclingService: DoclingService,
    private readonly prismaService: PrismaService,
    private readonly ingestionQueue: IngestionQueue,
    private readonly sourceProcessingStageService: SourceProcessingStageService,
    @Inject(ingestionConfig.KEY)
    private readonly config: ConfigType<typeof ingestionConfig>,
    @Inject(embeddingConfig.KEY)
    private readonly embedding: ConfigType<typeof embeddingConfig>,
  ) {}

  async process({ sourceId }: BuildRagChunksJobData): Promise<void> {
    let indexingStarted = false;

    try {
      const source = await this.prismaService.source.findUnique({
        where: { id: sourceId },
        select: { document: true },
      });

      if (!source) {
        this.logger.warn(
          `Skipping build-rag-chunks job because source "${sourceId}" no longer exists`,
        );
        return;
      }

      await this.sourceProcessingStageService.transition(
        sourceId,
        SourceProcessingStageType.RAG_INDEXING,
        ProcessingState.PROCESSING,
      );
      indexingStarted = true;

      if (source.document === null) {
        throw new Error('Source has no converted Docling document');
      }

      const chunking = await this.doclingService.client.chunks.chunkHybridSync(
        Buffer.from(JSON.stringify(source.document)),
        `${sourceId}.json`,
        {
          from_formats: ['json_docling'],
          abort_on_error: true,
          chunking_include_raw_text: true,
          chunking_max_tokens: this.config.rag.chunking.maxTokens,
          chunking_tokenizer: this.config.rag.chunking.tokenizer,
          chunking_merge_peers: this.config.rag.chunking.mergePeers,
          chunking_use_markdown_tables:
            this.config.rag.chunking.useMarkdownTables,
        },
      );

      // TODO: test if docling does these things automatically and if yes, remove
      const chunks = [...chunking.chunks]
        .sort((left, right) => left.chunk_index - right.chunk_index)
        .map((chunk, chunkIndex) => this.toSourceChunk(chunk, chunkIndex));

      if (chunks.length === 0) {
        throw new Error('Docling HybridChunker returned no chunks');
      }

      const persistedChunks = await this.prismaService.$transaction(
        async (transaction) => {
          const persisted: { id: string; chunkIndex: number }[] = [];

          for (const chunk of chunks) {
            persisted.push(
              await transaction.sourceChunk.upsert({
                where: {
                  sourceId_chunkIndex: {
                    sourceId,
                    chunkIndex: chunk.chunkIndex,
                  },
                },
                create: { sourceId, ...chunk },
                update: chunk,
                select: { id: true, chunkIndex: true },
              }),
            );
          }

          await transaction.sourceChunk.deleteMany({
            where: {
              sourceId,
              chunkIndex: { gte: chunks.length },
            },
          });

          return persisted;
        },
      );

      const chunkIds = persistedChunks
        .sort((left, right) => left.chunkIndex - right.chunkIndex)
        .map(({ id }) => id);

      for (
        let offset = 0;
        offset < chunkIds.length;
        offset += this.embedding.batchSize
      ) {
        await this.ingestionQueue.addEmbedRagChunks(
          sourceId,
          chunkIds.slice(offset, offset + this.embedding.batchSize),
        );
      }
    } catch (error) {
      this.logger.error(
        `Error building RAG chunks for source "${sourceId}": ${error}`,
        error instanceof Error ? error.stack : undefined,
      );

      if (indexingStarted) {
        await this.sourceProcessingStageService
          .transition(
            sourceId,
            SourceProcessingStageType.RAG_INDEXING,
            ProcessingState.FAILED,
            { error },
          )
          .catch((stageUpdateError: unknown) => {
            this.logger.error(
              `Failed to record RAG indexing failure for source "${sourceId}"`,
              stageUpdateError instanceof Error
                ? stageUpdateError.stack
                : undefined,
            );
          });
      }

      throw error;
    }
  }

  private toSourceChunk(
    chunk: ChunkedDocumentResultItem,
    chunkIndex: number,
  ): SourceChunkData {
    const content = chunk.text.trim();
    if (!content) {
      throw new Error(
        `Docling chunk ${chunk.chunk_index} has no readable text`,
      );
    }

    const pageNumbers = (chunk.page_numbers ?? []).filter(Number.isFinite);
    const docItems = chunk.doc_items ?? [];

    return {
      chunkIndex,
      content,
      headingPath: chunk.headings ?? [],
      pageStart: pageNumbers.length > 0 ? Math.min(...pageNumbers) : null,
      pageEnd: pageNumbers.length > 0 ? Math.max(...pageNumbers) : null,
      startRef: docItems[0] ?? null,
      endRef: docItems[docItems.length - 1] ?? null,
      tokenCount: chunk.num_tokens ?? null,
    };
  }
}
