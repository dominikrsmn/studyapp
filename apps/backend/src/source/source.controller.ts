import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseFilePipeBuilder,
  ParseUUIDPipe,
  Post,
  Req,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { uploadSourceSchema, type SourceDto } from '@study/contracts';
import { z } from 'zod';
import type { AuthenticatedRequest } from '../auth/authenticated-request';
import { SourceService } from './source.service';

@Controller('source')
export class SourceController {
  constructor(private readonly sourceService: SourceService) {}

  @HttpCode(HttpStatus.CREATED)
  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  uploadSource(
    @Req() request: AuthenticatedRequest,
    @Body() body: unknown,
    @UploadedFile(
      new ParseFilePipeBuilder()
        .addFileTypeValidator({
          fileType: 'application/pdf',
          errorMessage: 'File must be a PDF',
        })
        .addMaxSizeValidator({
          maxSize: 50_000_000, // 50 MB
          errorMessage: "File size can't be >50 MB",
        })
        .build({
          errorHttpStatusCode: HttpStatus.UNPROCESSABLE_ENTITY,
        }),
    )
    file: Express.Multer.File,
  ): Promise<SourceDto> {
    const input = uploadSourceSchema.safeParse(body);
    if (!input.success) {
      throw new BadRequestException(z.treeifyError(input.error));
    }

    return this.sourceService.uploadSource(
      request.userId,
      input.data.moduleId,
      file,
    );
  }

  @Delete(':id')
  deleteSource(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<SourceDto> {
    return this.sourceService.remove(request.userId, id);
  }
}

@Controller('modules/:moduleId/sources')
export class ModuleSourcesController {
  constructor(private readonly sourceService: SourceService) {}

  @Get()
  findAll(
    @Req() request: AuthenticatedRequest,
    @Param('moduleId', ParseUUIDPipe) moduleId: string,
  ): Promise<SourceDto[]> {
    return this.sourceService.findAll(request.userId, moduleId);
  }
}
