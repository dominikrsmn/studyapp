import { Module } from '@nestjs/common';
import { FileStorageService } from './filestorage.service';
import { ConfigModule } from '@nestjs/config';
import { fileStorageConfig } from '../config/filestorage.config';

@Module({
  imports: [ConfigModule.forFeature(fileStorageConfig)],
  providers: [FileStorageService],
  exports: [FileStorageService],
})
export class FileStorageModule {}
