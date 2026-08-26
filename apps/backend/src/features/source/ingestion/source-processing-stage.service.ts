import { Injectable } from '@nestjs/common';
import {
  type SourceStateChangedEvent,
  sourceStateChangedEventSchema,
} from '@study/contracts';
import type {
  Prisma,
  SourceProcessingStage,
} from '../../../infrastructure/database/generated/client';
import {
  ProcessingState,
  SourceProcessingStageType,
} from '../../../infrastructure/database/generated/enums';
import { PrismaService } from '../../../infrastructure/database/prisma/prisma.service';
import { SourceEventService } from '../source-event.service';

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
  constructor(
    private readonly prismaService: PrismaService,
    private readonly sourceEventService: SourceEventService,
  ) {}

  async initialize(sourceId: string): Promise<SourceProcessingStage[]> {
    return Promise.all(
      Object.values(SourceProcessingStageType).map((stage) =>
        this.transition(sourceId, stage, ProcessingState.NOT_STARTED),
      ),
    );
  }

  async transition(
    sourceId: string,
    stage: SourceProcessingStageType,
    state: ProcessingState,
    options: TransitionOptions = {},
  ): Promise<SourceProcessingStage> {
    const client = options.transaction ?? this.prismaService;
    const data = this.transitionData(state, options.error);

    const processingStage = await client.sourceProcessingStage.upsert({
      where: { sourceId_stage: { sourceId, stage } },
      create: { sourceId, stage, ...data },
      update: data,
      include: {
        source: {
          select: { moduleId: true },
        },
      },
    });

    const event: SourceStateChangedEvent = sourceStateChangedEventSchema.parse({
      sourceId,
      moduleId: processingStage.source.moduleId,
      processingStage: stage,
      processingState: state,
      ...(processingStage.errorMessage
        ? { info: processingStage.errorMessage }
        : {}),
    });
    this.sourceEventService.stateChanges(event);

    return processingStage;
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
