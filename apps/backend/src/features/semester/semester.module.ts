import { Module } from '@nestjs/common';
import { PrismaModule } from '../../infrastructure/database/prisma/prisma.module';
import { SemesterController } from './semester.controller';
import { SemesterService } from './semester.service';
import { ActiveSemestersController } from './active-semester.controller';

@Module({
  imports: [PrismaModule],
  controllers: [SemesterController, ActiveSemestersController],
  providers: [SemesterService],
})
export class SemesterModule {}
