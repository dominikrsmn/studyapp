import {
  Injectable,
  Logger,
  LoggerService,
  NotFoundException,
} from '@nestjs/common';
import { FileStorageService } from '../filestorage/filestorage.service';
import { PdfTextExtractorService } from './pdf-text-extractor/pdf-text-extractor.service';
import { TextChunkerService } from './text-chunker/text-chunker.service';
import { EmbeddingService } from './embedding/embedding.service';
import { PageTextResult } from 'pdf-parse';
import { PrismaService } from '../database/prisma/prisma.service';

export type Chunk = {
  index: number;
  content: string;
  page: number;
};

export type EmbeddedChunk = Chunk & {
  embedding: number[];
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
    this.logger.log('Starting Ingestion of sourceId ' + sourceId);
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

    this.logger.log('Found source of user ' + source.module.semester.userId);

    const file: Buffer = await this.fileStorageService.read(source.storageKey);

    this.logger.log('Loaded file ' + source.storageKey + ' in memory');

    const pages: PageTextResult[] = await this.pdfTextExtractor.extract(file);

    this.logger.log('Extracted text of ' + pages.length + ' pages');

    const chunks: Chunk[] = [];

    for (let i = 0; i < pages.length; i++) {
      const page = pages[i];
      const pageChunks = this.textChunker.chunk(page.text);

      for (let j = 0; j < pageChunks.length; j++) {
        chunks.push({
          index: j,
          page: page.num,
          content: pageChunks[i],
        });
      }
    }

    this.logger.log('Text divided into ' + chunks.length + ' chunks');

    const embeddings = await this.embeddingService.embed(
      {
        id: sourceId,
        userId: source.module.semester.userId,
      },
      chunks,
    );

    this.logger.log(
      'successfully created ' +
        embeddings +
        ' embeddings in the DB. Ingestion finished',
    );
  }
}
