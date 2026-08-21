import {
  Injectable,
  Logger,
  NotFoundException,
  PayloadTooLargeException,
} from '@nestjs/common';
import { FileStorageService } from '../../infrastructure/filestorage/filestorage.service';
import { PdfTextExtractorService } from './pdf-text-extractor/pdf-text-extractor.service';
import { TextChunkerService } from './text-chunker/text-chunker.service';
import { EmbeddingService } from './embedding/embedding.service';
import type { PageTextResult } from 'pdf-parse';
import { PrismaService } from '../../infrastructure/database/prisma/prisma.service';
import type { Sql } from '@prisma/client/runtime/client';
import { Prisma } from '../../infrastructure/database/generated/client';
import { randomUUID } from 'node:crypto';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  SourceStateChangedEvent,
  sourceStateChangedEventSchema,
} from '@study/contracts';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../../infrastructure/config/env.schema';

export type Chunk = {
  content: string;
  page: number;
};

export type EmbeddedChunk = Chunk & {
  embedding: number[];
  index: number;
};
@Injectable()
export class IngestionService {
  private readonly logger = new Logger(IngestionService.name);
  private readonly batchSize: number;
  private readonly maxPages: number;
  private readonly maxTextCharacters: number;

  constructor(
    private readonly prismaService: PrismaService,
    private readonly fileStorageService: FileStorageService,
    private readonly pdfTextExtractor: PdfTextExtractorService,
    private readonly textChunker: TextChunkerService,
    private readonly embeddingService: EmbeddingService,
    private readonly eventEmitter: EventEmitter2,
    config: ConfigService<Env, true>,
  ) {
    this.batchSize = config.get('INGESTION_BATCH_SIZE', { infer: true });
    this.maxPages = config.get('INGESTION_MAX_PAGES', { infer: true });
    this.maxTextCharacters = config.get('INGESTION_MAX_TEXT_CHARACTERS', {
      infer: true,
    });
  }

  async ingest(sourceId: string, moduleId: string): Promise<void> {
    try {
      const source = await this.prismaService.source.update({
        where: {
          id: sourceId,
          module: {
            id: moduleId,
          },
        },
        data: {
          status: 'PROCESSING',
        },
        select: {
          storageKey: true,
          module: {
            select: {
              id: true,
              semester: {
                select: {
                  userId: true,
                },
              },
            },
          },
        },
      });
      let event: SourceStateChangedEvent = sourceStateChangedEventSchema.parse({
        sourceId: sourceId,
        moduleId: source.module.id,
        processingState: 'PROCESSING',
      });

      this.eventEmitter.emit('source.stateChanged', event);

      if (!source.storageKey) {
        throw new NotFoundException('Source was not found');
      }

      const file: Buffer = await this.fileStorageService.read(
        source.storageKey,
      );

      const pages: PageTextResult[] = await this.pdfTextExtractor.extract(file);

      this.validateDocumentSize(pages);
      await this.processPages(pages, sourceId, source.module.semester.userId);

      await this.prismaService.source.update({
        where: { id: sourceId },
        data: {
          status: 'READY',
        },
      });

      event = sourceStateChangedEventSchema.parse({
        sourceId: sourceId,
        moduleId: source.module.id,
        processingState: 'READY',
      });

      this.eventEmitter.emit('source.stateChanged', event);
    } catch (error) {
      await this.deletePartialChunks(sourceId);
      await this.markFailed(sourceId, moduleId);
      this.logger.error(
        `Ingestion failed for source "${sourceId}"`,
        error instanceof Error ? error.stack : undefined,
      );
      throw error;
    }
  }

  private async deletePartialChunks(sourceId: string): Promise<void> {
    try {
      await this.prismaService.sourceChunk.deleteMany({ where: { sourceId } });
    } catch (error) {
      this.logger.error(
        `Failed to delete partial chunks for source "${sourceId}"`,
        error instanceof Error ? error.stack : undefined,
      );
    }
  }

  private async markFailed(sourceId: string, moduleId: string): Promise<void> {
    try {
      // updatemany to not throw 404 error, when source was deleted in the process
      await this.prismaService.source.updateMany({
        where: { id: sourceId },
        data: { status: 'FAILED' },
      });

      const event: SourceStateChangedEvent =
        sourceStateChangedEventSchema.parse({
          sourceId: sourceId,
          moduleId: moduleId,
          processingState: 'FAILED',
        });

      this.eventEmitter.emit('source.stateChanged', event);
    } catch (error) {
      this.logger.error(
        `Failed to mark source "${sourceId}" as failed (gg)`,
        error instanceof Error ? error.stack : undefined,
      );
    }
  }

  private async persistChunks(
    embeddedChunks: EmbeddedChunk[],
    sourceId: string,
  ) {
    const rows: Sql[] = [];
    for (let i = 0; i < embeddedChunks.length; i++) {
      const embeddedChunk = embeddedChunks[i];
      const vector = `[${embeddedChunk.embedding.join(',')}]`;
      rows.push(Prisma.sql`
        (
        ${randomUUID()},
        ${embeddedChunk.content},
        ${sourceId},
        ${embeddedChunk.index},
        ${embeddedChunk.page},
        ${embeddedChunk.page},
        ${vector}::vector
    )
        `);
    }

    await this.prismaService.$executeRaw`
  INSERT INTO "SourceChunk"
    ("id", "content", "sourceId", "chunkIndex", "pageEnd", "pageStart", "embedding")
  VALUES ${Prisma.join(rows, ',')}
    `;
  }

  private validateDocumentSize(pages: PageTextResult[]): void {
    if (pages.length > this.maxPages) {
      throw new PayloadTooLargeException(
        `PDF can't have more than ${this.maxPages} pages`,
      );
    }

    let characterCount = 0;
    for (const page of pages) {
      characterCount += page.text.length;
      if (characterCount > this.maxTextCharacters) {
        throw new PayloadTooLargeException(
          `Extracted PDF text can't exceed ${this.maxTextCharacters} characters`,
        );
      }
    }
  }

  private async processPages(
    pages: PageTextResult[],
    sourceId: string,
    userId: string,
  ): Promise<void> {
    let batch: Chunk[] = [];
    let chunkIndex = 0;

    for (const page of pages) {
      const pageChunks = this.textChunker.chunk(page.text);

      for (const content of pageChunks) {
        batch.push({
          page: page.num,
          content,
        });

        if (batch.length === this.batchSize) {
          await this.embedAndPersistBatch(batch, sourceId, userId, chunkIndex);
          chunkIndex += batch.length;
          batch = [];
        }
      }
    }

    if (batch.length > 0) {
      await this.embedAndPersistBatch(batch, sourceId, userId, chunkIndex);
    }
  }

  private async embedAndPersistBatch(
    chunks: Chunk[],
    sourceId: string,
    userId: string,
    startIndex: number,
  ): Promise<void> {
    const embeddedChunks = await this.embeddingService.embedChunks(
      { id: sourceId, userId },
      chunks,
      startIndex,
    );

    await this.persistChunks(embeddedChunks, sourceId);
  }
}
