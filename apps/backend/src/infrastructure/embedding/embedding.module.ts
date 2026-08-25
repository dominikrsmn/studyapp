import { Module } from '@nestjs/common';
import { EmbeddingService } from './embedding.service';
import { ConfigModule } from '@nestjs/config';
import { embeddingConfig } from '../config/embedding.config';

@Module({
  imports: [ConfigModule.forFeature(embeddingConfig)],
  providers: [EmbeddingService],
  exports: [EmbeddingService],
})
export class EmbeddingModule {}
