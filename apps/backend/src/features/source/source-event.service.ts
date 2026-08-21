import type { MessageEvent} from '@nestjs/common';
import { Injectable, NotFoundException } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import type { SourceStateChangedEvent } from '@study/contracts';
import type { Observable} from 'rxjs';
import { filter, from, map, Subject, switchMap } from 'rxjs';
import type { PrismaService } from '../../infrastructure/database/prisma/prisma.service';
import { sourceConfig } from './source.config';

@Injectable()
export class SourceEventService {
  private stream$ = new Subject<SourceStateChangedEvent>();

  constructor(private readonly prismaService: PrismaService) {}

  subscribeToStateChanges(
    userId: string,
    moduleId: string,
  ): Observable<MessageEvent> {
    return from(
      this.prismaService.module.findFirst({
        where: {
          id: moduleId,
          semester: {
            userId: userId,
          },
        },
        select: {
          id: true,
        },
      }),
    ).pipe(
      switchMap((module) => {
        if (!module) {
          throw new NotFoundException('Module not found');
        }
        return this.stream$.pipe(
          filter((event) => event.moduleId === module.id),
          map((event): MessageEvent => ({ data: event })),
        );
      }),
    );
  }

  @OnEvent(sourceConfig().stateChangedEventName)
  stateChanges(payload: SourceStateChangedEvent): void {
    this.stream$.next(payload);
  }
}
