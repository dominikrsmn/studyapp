import {
  Controller,
  Get,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Put,
  Req,
} from '@nestjs/common';
import { type SemesterDto } from '@study/contracts';
import type { AuthenticatedRequest } from '../auth/authenticated-request';
import { SemestersService } from './semesters.service';
import { CurrentUser } from '../auth/current-user.decorator';
import { User } from '../../infrastructure/database/generated/client';

@Controller('active-semester')
export class ActiveSemestersController {
  constructor(private readonly semestersService: SemestersService) {}


  @Get()
  getActiveSemester(@Req() request: AuthenticatedRequest, @CurrentUser() user: User): Promise<SemesterDto> {
    if(!user.activeSemesterId) {
      throw new NotFoundException('No active semester is set');
    }
    return this.semestersService.findOne(request.userId, user.activeSemesterId)
  }

  @Put(':id')
  SetActiveSemester(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<SemesterDto> {
    return this.semestersService.setActiveSemester(request.userId, id);
  }
}
