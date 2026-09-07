import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '../../infrastructure/database/prisma/prisma.module';
import { EmbeddingModule } from '../../infrastructure/embedding/embedding.module';
import { retrievalConfig } from './retrieval.config';
import { SemanticSearchController } from './semantic-search.controller';
import { SemanticSearchService } from './semantic-search.service';

@Module({
  imports: [
    ConfigModule.forFeature(retrievalConfig),
    PrismaModule,
    EmbeddingModule,
  ],
  controllers: [SemanticSearchController],
  providers: [SemanticSearchService],
  exports: [SemanticSearchService],
})
export class RetrievalModule {}
