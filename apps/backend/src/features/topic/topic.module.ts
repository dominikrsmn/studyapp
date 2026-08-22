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
import { TopicCandidateExtractionService } from './topic-candidate-extraction/topic-candidate-extraction.service';
import { TopicCandidateGroupingService } from './topic-candidate-grouping/topic-candidate-grouping.service';
import { TopicMergingService } from './topic-merging/topic-merging.service';
import { TopicSummaryGenerationService } from './topic-summary-generation/topic-summary-generation.service';
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
    TopicCandidateGroupingService,
    TopicMergingService,
    TopicSummaryGenerationService,
  ],
  exports: [TopicService, TopicAnalysisService, TopicAnalysisQueue],
})
export class TopicModule {}
