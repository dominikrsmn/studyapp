import {
  BadRequestException,
  Body,
  Controller,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
} from '@nestjs/common';
import {
  questionAnsweringRequestSchema,
  type QuestionAnsweringResponse,
} from '@study/contracts';
import { z } from 'zod';
import { RequireActiveSemester } from '../auth/active-semester.decorator';
import type { AuthenticatedRequest } from '../auth/authenticated-request';
import type { QuestionAnsweringService } from './question-answering.service';

@RequireActiveSemester()
@Controller('module/:moduleId/ai')
export class AiController {
  constructor(
    private readonly questionAnsweringService: QuestionAnsweringService,
  ) {}

  @Post('question')
  answerQuestion(
    @Req() request: AuthenticatedRequest,
    @Param('moduleId', ParseUUIDPipe) moduleId: string,
    @Body() body: unknown,
  ): Promise<QuestionAnsweringResponse> {
    const result = questionAnsweringRequestSchema.safeParse(body);

    if (!result.success) {
      throw new BadRequestException(z.treeifyError(result.error));
    }

    return this.questionAnsweringService.answerQuestion(
      result.data.question,
      moduleId,
      request.userId,
    );
  }
}
