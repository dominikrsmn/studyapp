import { Module } from '@nestjs/common';
import { PrismaModule } from '../../infrastructure/database/prisma/prisma.module';
import { SemestersController } from './semesters.controller';
import { SemestersService } from './semesters.service';
import { ActiveSemestersController } from './active-semester.controller';

@Module({
  imports: [PrismaModule],
  controllers: [SemestersController, ActiveSemestersController],
  providers: [SemestersService],
})
export class SemestersModule {}
