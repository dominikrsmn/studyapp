import { inject, Injectable, signal } from '@angular/core';
import {
  CreateSource,
  SourceDto,
  SourceStateChangedEvent,
} from '@study/contracts';
import { defer, firstValueFrom, Observable, tap } from 'rxjs';
import { SourceApiService } from './source-api-service';
import { SourceEventsService } from './source-events.service';

@Injectable({
  providedIn: 'root',
})
export class SourceService {
  private readonly sourceApiService = inject(SourceApiService);
  private readonly sourceEventsService = inject(SourceEventsService);

  private readonly _sources = signal<SourceDto[]>([]);
  private latestLoadId = 0;

  readonly sources = this._sources.asReadonly();

  loadAll(moduleId: string): Observable<SourceDto[]> {
    return defer(() => {
      const loadId = ++this.latestLoadId;

      return this.sourceApiService.findAll(moduleId).pipe(
        tap((sources) => {
          if (loadId === this.latestLoadId) {
            this._sources.set(sources);
          }
        }),
      );
    });
  }

  create(moduleId: string, input: CreateSource): Observable<SourceDto> {
    return this.sourceApiService
      .create(moduleId, input)
      .pipe(tap((source) => this.upsert(source)));
  }

  delete(moduleId: string, id: string): Observable<SourceDto> {
    return this.sourceApiService.delete(moduleId, id).pipe(
      tap(() => {
        this._sources.update((sources) =>
          sources.filter((source) => source.id !== id),
        );
      }),
    );
  }

  findById(id: string): SourceDto | undefined {
    return this._sources().find((source) => source.id === id);
  }

  watchStateChanges(moduleId: string): Observable<SourceStateChangedEvent> {
    return this.sourceEventsService
      .stateChanges(moduleId, {
        onOpen: async () => {
          await firstValueFrom(this.loadAll(moduleId));
        },
      })
      .pipe(
        tap((event) => {
          this._sources.update((sources) =>
            this.applyProcessingStateChange(sources, event),
          );
        }),
      );
  }

  private upsert(source: SourceDto): void {
    this._sources.update((sources) => {
      const index = sources.findIndex((item) => item.id === source.id);

      if (index === -1) {
        return [...sources, source];
      }

      return sources.map((item) => (item.id === source.id ? source : item));
    });
  }

  private applyProcessingStateChange(
    sources: SourceDto[],
    event: SourceStateChangedEvent,
  ): SourceDto[] {
    return sources.map((source) =>
      source.id === event.sourceId
        ? {
            ...source,
            status: event.processingState,
          }
        : source,
    );
  }
}
