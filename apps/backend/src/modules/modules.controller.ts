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
import { ModulesService } from './modules.service';
import {
  createModuleSchema,
  ModuleDto,
  updateModuleSchema,
} from '@study/contracts';
import { z } from 'zod';
import type { AuthenticatedRequest } from '../auth/authenticated-request';

@Controller('modules')
export class ModulesController {
  constructor(private readonly modulesService: ModulesService) {}

  @Post()
  create(
    @Req() request: AuthenticatedRequest,
    @Body() body: unknown,
  ): Promise<ModuleDto> {
    const result = createModuleSchema.safeParse(body);

    if (!result.success) {
      throw new BadRequestException(z.treeifyError(result.error));
    }

    return this.modulesService.create(request.userId, result.data);
  }

  @Get()
  findAll(@Req() request: AuthenticatedRequest): Promise<ModuleDto[]> {
    return this.modulesService.findAll(request.userId);
  }

  @Get(':id')
  findOne(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ModuleDto> {
    return this.modulesService.findOne(request.userId, id);
  }

  @Patch(':id')
  update(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: unknown,
  ): Promise<ModuleDto> {
    const result = updateModuleSchema.safeParse(body);

    if (!result.success) {
      throw new BadRequestException(z.treeifyError(result.error));
    }

    return this.modulesService.update(request.userId, id, result.data);
  }

  @Delete(':id')
  remove(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ModuleDto> {
    return this.modulesService.remove(request.userId, id);
  }
}
