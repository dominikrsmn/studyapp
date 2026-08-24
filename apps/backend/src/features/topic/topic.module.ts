import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '../../infrastructure/database/prisma/prisma.module';
import { topicAnalysisConfig } from './analysis/topic-analysis.config';
import { TopicService } from './topic.service';

import { OpenAiModule } from '../../infrastructure/open-ai/open-ai.module';

@Module({
  imports: [
    ConfigModule.forFeature(topicAnalysisConfig),
    BullModule.registerQueue({ name: topicAnalysisConfig().queue.queueName }),
    PrismaModule,
    OpenAiModule,
  ],
  providers: [TopicService],
  exports: [TopicService],
})
export class TopicModule {}
