import { Module } from '@nestjs/common';
import { PrismaModule } from '../../infrastructure/database/prisma/prisma.module';
import { IngestionModule } from '../ingestion/ingestion.module';
import { AiController } from './ai.controller';
import { AnswerGenerationService } from './answer-generation.service';
import { QuestionAnsweringService } from './question-answering.service';
import { SemanticSearchController } from './semantic-search/semantic-search.controller';
import { SemanticSearchService } from './semantic-search/semantic-search.service';
import { OpenAiModule } from '../../infrastructure/open-ai/open-ai.module';
import { ConfigModule } from '@nestjs/config';
import { aiConfig } from './ai.config';
import { EmbeddingModule } from '../../infrastructure/embedding/embedding.module';

@Module({
  imports: [
    ConfigModule.forFeature(aiConfig),
    IngestionModule,
    PrismaModule,
    EmbeddingModule,
    OpenAiModule,
  ],
  controllers: [AiController, SemanticSearchController],
  providers: [
    AnswerGenerationService,
    QuestionAnsweringService,
    SemanticSearchService,
  ],
})
export class AiModule {}
