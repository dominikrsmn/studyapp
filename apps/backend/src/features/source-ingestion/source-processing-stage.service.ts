import { LearningGraphService } from '../learning-graph/learning-graph.service';
import { Injectable } from '@nestjs/common';
import {
  type SourceStateChangedEvent,
  sourceStateChangedEventSchema,
} from '@study/contracts';
import type {
  Prisma,
  SourceProcessingStage,
} from '../../infrastructure/database/generated/client';
import {
  ProcessingState,
  SourceProcessingStageType,
} from '../../infrastructure/database/generated/enums';
import { PrismaService } from '../../infrastructure/database/prisma/prisma.service';
import { SourceEventService } from '../source/source-event.service';

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
    private readonly learningGraphService: LearningGraphService,
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
    options?: { error?: unknown; transaction?: never },
  ): Promise<SourceProcessingStage>;
  async transition(
    sourceId: string,
    stage: Exclude<SourceProcessingStageType, 'TOPIC_ANALYSIS'>,
    state: ProcessingState,
    options: TransitionOptions,
  ): Promise<SourceProcessingStage>;
  async transition(
    sourceId: string,
    stage: SourceProcessingStageType,
    state: ProcessingState,
    options: TransitionOptions = {},
  ): Promise<SourceProcessingStage> {
    const data = this.transitionData(state, options.error);

    const persist = async (client: Prisma.TransactionClient) => {
      const previous =
        stage === SourceProcessingStageType.TOPIC_ANALYSIS
          ? await client.sourceProcessingStage.findUnique({
              where: { sourceId_stage: { sourceId, stage } },
              select: { state: true },
            })
          : null;
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

      let graphVersion: number | undefined;
      if (
        stage === SourceProcessingStageType.TOPIC_ANALYSIS &&
        (previous?.state === ProcessingState.COMPLETED) !==
          (state === ProcessingState.COMPLETED)
      ) {
        const module = await client.module.update({
          where: { id: processingStage.source.moduleId },
          data: { graphVersion: { increment: 1 } },
          select: { graphVersion: true },
        });
        graphVersion = module.graphVersion;
      }
      return { processingStage, graphVersion };
    };
    const { processingStage, graphVersion } = options.transaction
      ? await persist(options.transaction)
      : stage === SourceProcessingStageType.TOPIC_ANALYSIS
        ? await this.prismaService.$transaction(persist, {
            isolationLevel: 'Serializable',
          })
        : await persist(this.prismaService);

    if (graphVersion !== undefined) {
      await this.learningGraphService.regenerate(
        processingStage.source.moduleId,
        graphVersion,
      );
    }

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
