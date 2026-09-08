import { Module } from '@nestjs/common';
import { EmbeddingService } from './embedding.service';
import { ConfigModule } from '@nestjs/config';
import { embeddingConfig } from '../config/embedding.config';
import { OpenAiModule } from '../open-ai/open-ai.module';

@Module({
  imports: [ConfigModule.forFeature(embeddingConfig), OpenAiModule],
  providers: [EmbeddingService],
  exports: [EmbeddingService],
})
export class EmbeddingModule {}
