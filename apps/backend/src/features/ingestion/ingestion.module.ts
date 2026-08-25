import { Logger, Module } from '@nestjs/common';
import { FileStorageModule } from '../../infrastructure/filestorage/filestorage.module';
import { PrismaModule } from '../../infrastructure/database/prisma/prisma.module';
import { OpenAiModule } from '../../infrastructure/open-ai/open-ai.module';
import { ConfigModule } from '@nestjs/config';
import { ingestionConfig } from './ingestion.config';
import { BullModule } from '@nestjs/bullmq';
import { IngestionQueue } from './ingestion.queue';
import { IngestionProcessor } from './ingestion.processor';
import { TopicModule } from '../topic/topic.module';
import { EmbeddingModule } from '../../infrastructure/embedding/embedding.module';
import { ParseDocumentJob } from './jobs/parse-document.job';
import { DoclingModule } from '../../infrastructure/docling/docling.module';
import { SourceProcessingStageService } from './source-processing-stage.service';
import { BuildRagChunksJob } from './jobs/build-rag-chunks.job';

@Module({
  imports: [
    ConfigModule.forFeature(ingestionConfig),
    BullModule.registerQueue({
      name: ingestionConfig().queue.name,
      defaultJobOptions: ingestionConfig().queue.defaultJobOptions,
    }),
    FileStorageModule,
    PrismaModule,
    OpenAiModule,
    TopicModule,
    EmbeddingModule,
    DoclingModule,
  ],
  providers: [
    IngestionQueue,
    IngestionProcessor,
    Logger,
    ParseDocumentJob,
    BuildRagChunksJob,
    SourceProcessingStageService,
  ],
  exports: [IngestionQueue, SourceProcessingStageService],
})
export class IngestionModule {}
