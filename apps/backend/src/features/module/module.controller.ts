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
  Req,
} from '@nestjs/common';
import { ModuleService } from './module.service';
import {
  createModuleSchema,
  ModuleDto,
  updateModuleSchema,
} from '@study/contracts';
import { z } from 'zod';
import type { AuthenticatedRequest } from '../auth/authenticated-request';
import { CurrentUser } from '../auth/current-user.decorator';
import { User } from '../../infrastructure/database/generated/client';
import { ActiveSemesterId, RequireActiveSemester } from '../auth/active-semester.decorator';

@Controller('module')
@RequireActiveSemester()
export class ModuleController {
  constructor(
    private readonly moduleService: ModuleService,
  ) {}

  @Post()
  async create(
    @Req() request: AuthenticatedRequest,
    @CurrentUser() user: User,
    @ActiveSemesterId() semesterId: string,
    @Body() body: unknown,
  ): Promise<ModuleDto> {
    const result = createModuleSchema.safeParse(body);

    if (!result.success) {
      throw new BadRequestException(z.treeifyError(result.error));
    }

    return this.moduleService.create(semesterId, result.data);
  }

  @Get()
  async findAll(
    @Req() request: AuthenticatedRequest,
    @ActiveSemesterId() semesterId: string,
    @CurrentUser() user: User
  ): Promise<ModuleDto[]> {
    return this.moduleService.findAll(semesterId);
  }

  @Get(':id')
  async findOne(
    @Req() request: AuthenticatedRequest,
    @ActiveSemesterId() semesterId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ModuleDto> {
    return this.moduleService.findOne(semesterId, id);
  }

  @Patch(':id')
  async update(
    @Req() request: AuthenticatedRequest,
    @ActiveSemesterId() semesterId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: unknown,
  ): Promise<ModuleDto> {
    const result = updateModuleSchema.safeParse(body);

    if (!result.success) {
      throw new BadRequestException(z.treeifyError(result.error));
    }

    return this.moduleService.update(semesterId, id, result.data);
  }

  @Delete(':id')
  async remove(
    @Req() request: AuthenticatedRequest,
    @ActiveSemesterId() semesterId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ModuleDto> {
    return this.moduleService.remove(semesterId, id);
  }

}
