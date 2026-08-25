import { Injectable } from '@nestjs/common';
import type {
  Prisma,
  SourceProcessingStage,
} from '../../infrastructure/database/generated/client';
import {
  ProcessingState,
  SourceProcessingStageType,
} from '../../infrastructure/database/generated/enums';
import { PrismaService } from '../../infrastructure/database/prisma/prisma.service';

type TransitionOptions = {
  error?: unknown;
  transaction?: Prisma.TransactionClient;
};

type TransitionData = {
  state: ProcessingState;
  startedAt?: Date | null;
  completedAt?: Date | null;
  errorMessage?: string | null;
};

@Injectable()
export class SourceProcessingStageService {
  constructor(private readonly prismaService: PrismaService) {}

  transition(
    sourceId: string,
    stage: SourceProcessingStageType,
    state: ProcessingState,
    options: TransitionOptions = {},
  ): Promise<SourceProcessingStage> {
    const client = options.transaction ?? this.prismaService;
    const data = this.transitionData(state, options.error);

    return client.sourceProcessingStage.upsert({
      where: { sourceId_stage: { sourceId, stage } },
      create: { sourceId, stage, ...data },
      update: data,
    });
  }

  private transitionData(
    state: ProcessingState,
    error?: unknown,
  ): TransitionData {
    switch (state) {
      case ProcessingState.NOT_STARTED:
      case ProcessingState.QUEUED:
        return {
          state,
          startedAt: null,
          completedAt: null,
          errorMessage: null,
        };
      case ProcessingState.PROCESSING:
        return {
          state,
          startedAt: new Date(),
          completedAt: null,
          errorMessage: null,
        };
      case ProcessingState.COMPLETED:
        return {
          state,
          completedAt: new Date(),
          errorMessage: null,
        };
      case ProcessingState.FAILED:
        return {
          state,
          completedAt: new Date(),
          errorMessage: this.errorMessage(error),
        };
    }
  }

  private errorMessage(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }

    return typeof error === 'string' ? error : String(error);
  }
}
