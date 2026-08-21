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
  semanticSearchRequestSchema,
  type SemanticSearchResult,
} from '@study/contracts';
import { z } from 'zod';
import { RequireActiveSemester } from '../../auth/active-semester.decorator';
import type { AuthenticatedRequest } from '../../auth/authenticated-request';
import { SemanticSearchService } from './semantic-search.service';

@RequireActiveSemester()
@Controller('module/:moduleId/search')
export class SemanticSearchController {
  constructor(private readonly semanticSearchService: SemanticSearchService) {}

  @Post()
  search(
    @Req() request: AuthenticatedRequest,
    @Param('moduleId', ParseUUIDPipe) moduleId: string,
    @Body() body: unknown,
  ): Promise<SemanticSearchResult[]> {
    const result = semanticSearchRequestSchema.safeParse(body);

    if (!result.success) {
      throw new BadRequestException(z.treeifyError(result.error));
    }

    return this.semanticSearchService.search(
      result.data.query,
      moduleId,
      request.userId,
    );
  }
}
