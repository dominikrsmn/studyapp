import { Module } from '@nestjs/common';
import { DoclingService } from './docling.service';
import { ConfigModule } from '@nestjs/config';
import { doclingConfig } from '../config/docling.config';

@Module({
  imports: [ConfigModule.forFeature(doclingConfig)],
  providers: [DoclingService],
  exports: [DoclingService],
})
export class DoclingModule {}
