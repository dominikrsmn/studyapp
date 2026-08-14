import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  ParseUUIDPipe,
  Query,
  BadRequestException,
} from '@nestjs/common';
import { ModulesService } from './modules.service';
import {
  createModuleSchema,
  ModuleDto,
  updateModuleSchema,
} from '@study/contracts';
import { z } from 'zod';

@Controller('modules')
export class ModulesController {
  constructor(private readonly modulesService: ModulesService) {}

  @Post()
  create(@Body() body: unknown): Promise<ModuleDto> {
    const result = createModuleSchema.safeParse(body);

    if (!result.success) {
      throw new BadRequestException(z.treeifyError(result.error));
    }

    return this.modulesService.create(result.data);
  }

  @Get()
  findAll(
    @Query('userId', ParseUUIDPipe) userId: string,
  ): Promise<ModuleDto[]> {
    return this.modulesService.findAll({ userId });
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string): Promise<ModuleDto> {
    return this.modulesService.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: unknown,
  ): Promise<ModuleDto> {
    const result = updateModuleSchema.safeParse(body);

    if (!result.success) {
      throw new BadRequestException(z.treeifyError(result.error));
    }

    return this.modulesService.update(id, result.data);
  }

  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe) id: string): Promise<ModuleDto> {
    return this.modulesService.remove(id);
  }
}
