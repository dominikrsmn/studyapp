import { inject, Injectable, signal } from '@angular/core';
import { CreateSource, SourceDto } from '@study/contracts';
import { Observable, tap } from 'rxjs';
import { SourcesApiService } from './sources-api-service';

@Injectable({
  providedIn: 'root',
})
export class SourcesService {
  private readonly sourcesApiService = inject(SourcesApiService);

  private readonly _sources = signal<SourceDto[]>([]);

  readonly sources = this._sources.asReadonly();

  loadAll(moduleId: string): Observable<SourceDto[]> {
    return this.sourcesApiService
      .findAll(moduleId)
      .pipe(tap((sources) => this._sources.set(sources)));
  }

  create(moduleId: string, input: CreateSource): Observable<SourceDto> {
    return this.sourcesApiService
      .create(moduleId, input)
      .pipe(tap((source) => this.upsert(source)));
  }

  delete(moduleId: string, id: string): Observable<SourceDto> {
    return this.sourcesApiService.delete(moduleId, id).pipe(
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

  private upsert(source: SourceDto): void {
    this._sources.update((sources) => {
      const index = sources.findIndex((item) => item.id === source.id);

      if (index === -1) {
        return [...sources, source];
      }

      return sources.map((item) => (item.id === source.id ? source : item));
    });
  }
}
