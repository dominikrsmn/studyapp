import { Module } from '@nestjs/common';
import { FileStorageService } from './filestorage.service';

@Module({
  providers: [FileStorageService],
  exports: [FileStorageService],
})
export class FileStorageModule {}
