import { Injectable, Logger, NotFoundException } from '@nestjs/common';
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

  constructor(
    private readonly prismaService: PrismaService,
    private readonly fileStorageService: FileStorageService,
    private readonly pdfTextExtractor: PdfTextExtractorService,
    private readonly textChunker: TextChunkerService,
    private readonly embeddingService: EmbeddingService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

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

      const chunks: Chunk[] = this.chunkPages(pages);

      const embeddedChunks = await this.embeddingService.embed(
        {
          id: sourceId,
          userId: source.module.semester.userId,
        },
        chunks,
      );

      await this.persistChunks(embeddedChunks, sourceId);

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
      await this.markFailed(sourceId, moduleId);
      this.logger.error(
        `Ingestion failed for source "${sourceId}"`,
        error instanceof Error ? error.stack : undefined,
      );
      throw error;
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

  private chunkPages(pages: PageTextResult[]) {
    const chunks: Chunk[] = [];

    for (let i = 0; i < pages.length; i++) {
      const page = pages[i];
      const pageChunks = this.textChunker.chunk(page.text);

      for (let j = 0; j < pageChunks.length; j++) {
        chunks.push({
          page: page.num,
          content: pageChunks[j],
        });
      }
    }
    return chunks;
  }
}
