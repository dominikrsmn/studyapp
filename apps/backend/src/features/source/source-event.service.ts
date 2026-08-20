import { Injectable, NotFoundException } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { SourceStateChangedEvent } from '@study/contracts';
import { filter, from, Observable, Subject, switchMap } from 'rxjs';
import { PrismaService } from '../../infrastructure/database/prisma/prisma.service';

@Injectable()
export class SourceEventService {
  private stream$ = new Subject<SourceStateChangedEvent>();

  constructor(private readonly prismaService: PrismaService) {}

  subscribeToStateChanges(
    userId: string,
    sourceId: string,
  ): Observable<SourceStateChangedEvent> {
    return from(
      this.prismaService.source.findFirst({
        where: {
          id: sourceId,
          module: {
            semester: {
              userId: userId,
            },
          },
        },
        select: {
          id: true,
        },
      }),
    ).pipe(
      switchMap((source) => {
        if (!source) {
          throw new NotFoundException('Source not found');
        }
        return this.stream$.pipe(
          filter((event) => event.sourceId === source.id),
        );
      }),
    );
  }

  @OnEvent('source.stateChanged')
  stateChanges(payload: SourceStateChangedEvent): void {
    this.stream$.next(payload);
  }
}
