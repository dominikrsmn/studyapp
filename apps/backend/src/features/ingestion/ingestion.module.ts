import { Logger, Module } from '@nestjs/common';
import { IngestionService } from './ingestion.service';
import { FileStorageModule } from '../../infrastructure/filestorage/filestorage.module';
import { PdfTextExtractorService } from './pdf-text-extractor/pdf-text-extractor.service';
import { TextChunkerService } from './text-chunker/text-chunker.service';
import { EmbeddingService } from './embedding/embedding.service';
import { PrismaModule } from '../../infrastructure/database/prisma/prisma.module';
import { OpenAiModule } from '../../infrastructure/open-ai/open-ai.module';
import { ConfigModule } from '@nestjs/config';
import { ingestionConfig } from './ingestion.config';
import { BullModule } from '@nestjs/bullmq';
import { sourceIngestionConfig } from './source-ingestion.config';
import { SourceIngestionQueue } from './source-ingestion.queue';
import { SourceIngestionProcessor } from './source-ingestion.processor';
import { TopicModule } from '../topic/topic.module';

@Module({
  imports: [
    ConfigModule.forFeature(ingestionConfig),
    ConfigModule.forFeature(sourceIngestionConfig),
    BullModule.registerQueue({ name: sourceIngestionConfig().queueName }),
    FileStorageModule,
    PrismaModule,
    OpenAiModule,
    TopicModule,
  ],
  providers: [
    IngestionService,
    PdfTextExtractorService,
    TextChunkerService,
    EmbeddingService,
    SourceIngestionQueue,
    SourceIngestionProcessor,
    Logger,
  ],
  exports: [IngestionService, EmbeddingService, SourceIngestionQueue],
})
export class IngestionModule {}
