import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '../../infrastructure/database/prisma/prisma.module';
import { topicAnalysisConfig } from './topic-analysis.config';
import { TopicAnalysisProcessor } from './topic-analysis.processor';
import { TopicAnalysisQueue } from './topic-analysis.queue';
import { TopicAnalysisService } from './topic-analysis.service';
import { TopicService } from './topic.service';
import { TextProcessingModule } from '../../shared/text-processing/text-processing.module';
import { TopicCandidateExtractionService } from './topic-candidate-extractor/topic-candidate-extraction.service';
import { TopicCandidateConsolidationService } from './topic-candidate-consolidator/topic-candidate-consolidation.service';
import { TopicReconciliationService } from './topic-reconciler/topic-reconciliation.service';
import { TopicSummaryGeneratorService } from './topic-summary-generator/topic-summary-generator.service';
import { OpenAiModule } from '../../infrastructure/open-ai/open-ai.module';

@Module({
  imports: [
    ConfigModule.forFeature(topicAnalysisConfig),
    BullModule.registerQueue({ name: topicAnalysisConfig().queue.queueName }),
    PrismaModule,
    TextProcessingModule,
    OpenAiModule,
  ],
  providers: [
    TopicService,
    TopicAnalysisService,
    TopicAnalysisQueue,
    TopicAnalysisProcessor,
    TopicCandidateExtractionService,
    TopicCandidateConsolidationService,
    TopicReconciliationService,
    TopicSummaryGeneratorService,
  ],
  exports: [TopicService, TopicAnalysisService, TopicAnalysisQueue],
})
export class TopicModule {}
