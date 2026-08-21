import {
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
  Sse,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { SourceDto } from '@study/contracts';
import type { AuthenticatedRequest } from '../auth/authenticated-request';
import type { SourceService } from './source.service';
import { RequireActiveSemester } from '../auth/active-semester.decorator';
import type { SourceEventService } from './source-event.service';
import { sourceConfig } from './source.config';

@RequireActiveSemester()
@Controller('module/:moduleId/source')
export class SourcesController {
  constructor(
    private readonly sourceService: SourceService,
    private readonly sourceEventService: SourceEventService,
  ) {}

  @HttpCode(HttpStatus.CREATED)
  @Post()
  @UseInterceptors(FileInterceptor('file'))
  uploadSource(
    @Req() request: AuthenticatedRequest,
    @Param('moduleId', ParseUUIDPipe) moduleId: string,
    @UploadedFile(
      new ParseFilePipeBuilder()
        .addFileTypeValidator({
          fileType: sourceConfig().acceptedFileType,
          errorMessage: 'File must be a PDF',
        })
        .build({
          errorHttpStatusCode: HttpStatus.UNPROCESSABLE_ENTITY,
        }),
    )
    file: Express.Multer.File,
  ): Promise<SourceDto> {
    return this.sourceService.uploadSource(request.userId, moduleId, file);
  }

  @Delete(':id')
  deleteSource(
    @Req() request: AuthenticatedRequest,
    @Param('moduleId', ParseUUIDPipe) moduleId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<SourceDto> {
    return this.sourceService.remove(request.userId, id);
  }

  @Get()
  findAll(
    @Req() request: AuthenticatedRequest,
    @Param('moduleId', ParseUUIDPipe) moduleId: string,
  ): Promise<SourceDto[]> {
    return this.sourceService.findAll(request.userId, moduleId);
  }

  @Sse('events')
  stateEvents(
    @Req() request: AuthenticatedRequest,
    @Param('moduleId', ParseUUIDPipe) moduleId: string,
  ) {
    return this.sourceEventService.subscribeToStateChanges(
      request.userId,
      moduleId,
    );
  }
}
