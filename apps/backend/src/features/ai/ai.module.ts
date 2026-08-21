import { Module } from '@nestjs/common';
import { PrismaModule } from '../../infrastructure/database/prisma/prisma.module';
import { IngestionModule } from '../ingestion/ingestion.module';
import { AiController } from './ai.controller';
import { AnswerGenerationService } from './answer-generation.service';
import { QuestionAnsweringService } from './question-answering.service';
import { SemanticSearchController } from './semantic-search/semantic-search.controller';
import { SemanticSearchService } from './semantic-search/semantic-search.service';

@Module({
  imports: [IngestionModule, PrismaModule],
  controllers: [AiController, SemanticSearchController],
  providers: [
    AnswerGenerationService,
    QuestionAnsweringService,
    SemanticSearchService,
  ],
})
export class AiModule {}
