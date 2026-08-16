import { Module } from '@nestjs/common';
import { SourceService } from './source.service';
import {
  ModuleSourcesController,
  SourceController,
} from './source.controller';
import { PrismaModule } from '../database/prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  providers: [SourceService],
  controllers: [SourceController, ModuleSourcesController],
})
export class SourceModule {}
