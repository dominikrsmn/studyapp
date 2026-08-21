import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { ModuleService } from './module.service';
import {
  createModuleSchema,
  ModuleDto,
  updateModuleSchema,
} from '@study/contracts';
import { z } from 'zod';
import {
  ActiveSemesterId,
  RequireActiveSemester,
} from '../auth/active-semester.decorator';

@Controller('module')
@RequireActiveSemester()
export class ModuleController {
  constructor(private readonly moduleService: ModuleService) {}

  @Post()
  async create(
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
  async findAll(@ActiveSemesterId() semesterId: string): Promise<ModuleDto[]> {
    return this.moduleService.findAll(semesterId);
  }

  @Get(':id')
  async findOne(
    @ActiveSemesterId() semesterId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ModuleDto> {
    return this.moduleService.findOne(semesterId, id);
  }

  @Patch(':id')
  async update(
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
    @ActiveSemesterId() semesterId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ModuleDto> {
    return this.moduleService.remove(semesterId, id);
  }
}
