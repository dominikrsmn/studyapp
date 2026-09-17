import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import type {
  GraphBuildStatusDto,
  PublishedLearningGraphDto,
} from '@study/contracts';
import type { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class LearningGraphApiService {
  private readonly http = inject(HttpClient);

  findLatest(moduleId: string): Observable<GraphBuildStatusDto | null> {
    return this.http.get<GraphBuildStatusDto | null>(
      `${environment.apiUrl}/module/${moduleId}/learning-graph/build`,
    );
  }

  regenerate(moduleId: string): Observable<unknown> {
    return this.http.post(
      `${environment.apiUrl}/module/${moduleId}/learning-graph/regenerate`,
      {},
    );
  }

  retryPublication(moduleId: string): Observable<unknown> {
    return this.http.post(
      `${environment.apiUrl}/module/${moduleId}/learning-graph/retry-publication`,
      {},
    );
  }

  findPublished(
    moduleId: string,
  ): Observable<PublishedLearningGraphDto | null> {
    return this.http.get<PublishedLearningGraphDto | null>(
      `${environment.apiUrl}/module/${moduleId}/learning-graph`,
    );
  }
}
