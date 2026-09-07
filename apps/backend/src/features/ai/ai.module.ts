import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { OpenAiModule } from '../../infrastructure/open-ai/open-ai.module';
import { RetrievalModule } from '../retrieval/retrieval.module';
import { AiController } from './ai.controller';
import { AnswerGenerationService } from './answer-generation.service';
import { QuestionAnsweringService } from './question-answering.service';
import { aiConfig } from './ai.config';

@Module({
  imports: [ConfigModule.forFeature(aiConfig), RetrievalModule, OpenAiModule],
  controllers: [AiController],
  providers: [AnswerGenerationService, QuestionAnsweringService],
})
export class AiModule {}
