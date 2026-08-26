import { Logger, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import { analysisConfig } from './analysis.config';
import { PrismaModule } from '../../../infrastructure/database/prisma/prisma.module';
import { IngestionModule } from '../../source/ingestion/ingestion.module';
import { AnalysisProcessor } from './analysis.processor';
import { AnalysisQueue } from './analysis.queue';
import { PrepareTopicAnalysisJob } from './jobs/prepare-topic-analysis.job';
import { DetectBoundariesJob } from './jobs/detect-boundaries.job';
import { OpenAiModule } from '../../../infrastructure/open-ai/open-ai.module';
import { MergeBoundariesJob } from './jobs/merge-boundaries.job';
import { ExtractSourceTopicsJob } from './jobs/extract-source-topics.job';

@Module({
  imports: [
    ConfigModule.forFeature(analysisConfig),
    BullModule.registerQueue({
      name: analysisConfig().queue.name,
      defaultJobOptions: analysisConfig().queue.defaultJobOptions,
    }),
    BullModule.registerFlowProducer({
      name: analysisConfig().flowProducer.name,
    }),
    PrismaModule,
    OpenAiModule,
    IngestionModule,
  ],
  providers: [
    AnalysisProcessor,
    AnalysisQueue,
    Logger,
    PrepareTopicAnalysisJob,
    DetectBoundariesJob,
    MergeBoundariesJob,
    ExtractSourceTopicsJob,
  ],
  exports: [AnalysisQueue],
})
export class AnalysisModule {}
