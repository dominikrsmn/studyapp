import {
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { FileStorageService } from '../../infrastructure/filestorage/filestorage.service';
import { PdfTextExtractorService } from './pdf-text-extractor/pdf-text-extractor.service';
import { TextChunkerService } from './text-chunker/text-chunker.service';
import { EmbeddingService } from './embedding/embedding.service';
import { PageTextResult } from 'pdf-parse';
import { PrismaService } from '../../infrastructure/database/prisma/prisma.service';
import { Sql } from '@prisma/client/runtime/client';
import { Prisma } from '../../infrastructure/database/generated/client';
import { randomUUID } from 'node:crypto';

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
  ) {}

  async ingest(sourceId: string): Promise<void> {
    const source = await this.prismaService.source.findUnique({
      where: {
        id: sourceId,
      },
      select: {
        storageKey: true,
        module: {
          select: {
            semester: {
              select: {
                userId: true,
              },
            },
          },
        },
      },
    });

    if (!source || !source.storageKey) {
      throw new NotFoundException('Source was not found');
    }

    const file: Buffer = await this.fileStorageService.read(source.storageKey);

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

    this.logger.log(
      'successfully created ' +
        embeddedChunks.length +
        ' embeddings in the DB. Ingestion finished',
    );
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
