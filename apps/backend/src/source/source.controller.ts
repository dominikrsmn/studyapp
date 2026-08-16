import {
  BadRequestException,
  Body,
  Controller,
  FileTypeValidator,
  HttpCode,
  HttpStatus,
  MaxFileSizeValidator,
  ParseFilePipe,
  ParseFilePipeBuilder,
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
import { Public } from '../auth/public.decorator';

@Controller('source')
export class SourceController {
  constructor(private readonly sourceService: SourceService) {}

  @HttpCode(HttpStatus.CREATED)
  @Post('upload')
  @Public()
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
          maxSize: 50_000_000, // 5 MB
          errorMessage: "File size can't be >5 MB",
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
}
