import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
} from '@nestjs/common';
import { createSemesterSchema, type SemesterDto } from '@study/contracts';
import { z } from 'zod';
import type { AuthenticatedRequest } from '../auth/authenticated-request';
import { SemesterService } from './semester.service';

@Controller('semesters')
export class SemesterController {
  constructor(private readonly semestersService: SemesterService) {}

  @Get()
  findAll(@Req() request: AuthenticatedRequest): Promise<SemesterDto[]> {
    return this.semestersService.findAll(request.userId);
  }

  @Get(':id')
  findOne(@Req() request: AuthenticatedRequest, @Param('id', ParseUUIDPipe) id: string): Promise<SemesterDto> {
    return this.semestersService.findOne(request.userId, id)
  }

  @Post()
  create(
    @Req() request: AuthenticatedRequest,
    @Body() body: unknown,
  ): Promise<SemesterDto> {
    const result = createSemesterSchema.safeParse(body);
    if (!result.success) {
      throw new BadRequestException(z.treeifyError(result.error));
    }
    return this.semestersService.create(request.userId, result.data);
  }

  @Delete(':id')
  remove(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<SemesterDto> {
    return this.semestersService.remove(request.userId, id);
  }
}
