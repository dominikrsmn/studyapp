import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  ParseUUIDPipe,
  BadRequestException,
  NotFoundException,
  Req,
} from '@nestjs/common';
import { ModulesService } from './modules.service';
import {
  createModuleSchema,
  ModuleDto,
  updateModuleSchema,
} from '@study/contracts';
import { z } from 'zod';
import type { AuthenticatedRequest } from '../auth/authenticated-request';
import { PrismaService } from '../../infrastructure/database/prisma/prisma.service';

@Controller('semesters/:semesterId/modules')
export class ModulesController {
  constructor(
    private readonly modulesService: ModulesService,
    private readonly prisma: PrismaService,
  ) {}

  @Post()
  async create(
    @Req() request: AuthenticatedRequest,
    @Param('semesterId', ParseUUIDPipe) semesterId: string,
    @Body() body: unknown,
  ): Promise<ModuleDto> {
    await this.assertSemesterOwnership(request.userId, semesterId);

    const result = createModuleSchema.safeParse(body);

    if (!result.success) {
      throw new BadRequestException(z.treeifyError(result.error));
    }

    return this.modulesService.create(semesterId, result.data);
  }

  @Get()
  async findAll(
    @Req() request: AuthenticatedRequest,
    @Param('semesterId', ParseUUIDPipe) semesterId: string,
  ): Promise<ModuleDto[]> {
    await this.assertSemesterOwnership(request.userId, semesterId);

    return this.modulesService.findAll(semesterId);
  }

  @Get(':id')
  async findOne(
    @Req() request: AuthenticatedRequest,
    @Param('semesterId', ParseUUIDPipe) semesterId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ModuleDto> {
    await this.assertSemesterOwnership(request.userId, semesterId);

    return this.modulesService.findOne(semesterId, id);
  }

  @Patch(':id')
  async update(
    @Req() request: AuthenticatedRequest,
    @Param('semesterId', ParseUUIDPipe) semesterId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: unknown,
  ): Promise<ModuleDto> {
    await this.assertSemesterOwnership(request.userId, semesterId);

    const result = updateModuleSchema.safeParse(body);

    if (!result.success) {
      throw new BadRequestException(z.treeifyError(result.error));
    }

    return this.modulesService.update(semesterId, id, result.data);
  }

  @Delete(':id')
  async remove(
    @Req() request: AuthenticatedRequest,
    @Param('semesterId', ParseUUIDPipe) semesterId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ModuleDto> {
    await this.assertSemesterOwnership(request.userId, semesterId);

    return this.modulesService.remove(semesterId, id);
  }

  private async assertSemesterOwnership(
    userId: string,
    semesterId: string,
  ): Promise<void> {
    const semester = await this.prisma.semester.findFirst({
      where: { id: semesterId, userId },
      select: { id: true },
    });

    if (!semester) {
      throw new NotFoundException(
        `Semester with id "${semesterId}" was not found`,
      );
    }
  }
}
