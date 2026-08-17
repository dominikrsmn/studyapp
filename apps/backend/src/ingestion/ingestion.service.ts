import { Injectable, NotFoundException } from '@nestjs/common';
import { FileStorageService } from '../filestorage/filestorage.service';
import { PdfTextExtractorService } from './pdf-text-extractor/pdf-text-extractor.service';
import { TextChunkerService } from './text-chunker/text-chunker.service';
import { EmbeddingService } from './embedding/embedding.service';
import { PageTextResult } from 'pdf-parse';
import { SourceChunk } from '../database/generated/client';
import { PrismaService } from '../database/prisma/prisma.service';

@Injectable()
export class IngestionService {
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
      },
    });

    if (!source || !source.storageKey) {
      throw new NotFoundException('Source was not found');
    }

    const file: Buffer = await this.fileStorageService.read(source.storageKey);

    const pages: PageTextResult[] = await this.pdfTextExtractor.extract(file);

    const chunks = pages.flatMap((page) => this.textChunker.chunk(page.text));

    const embeddings = chunks.flatMap((chunk) =>
      this.embeddingService.embed(sourceId, chunk),
    );
  }
}
