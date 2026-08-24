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
import { EmbeddingService } from '../../infrastructure/embedding/embedding.service';

@Module({
  imports: [
    ConfigModule.forFeature(ingestionConfig),
    BullModule.registerQueue({ name: ingestionConfig().queue.name }),
    FileStorageModule,
    PrismaModule,
    OpenAiModule,
    TopicModule,
    EmbeddingService,
  ],
  providers: [IngestionQueue, IngestionProcessor, Logger],
  exports: [IngestionQueue],
})
export class IngestionModule {}
