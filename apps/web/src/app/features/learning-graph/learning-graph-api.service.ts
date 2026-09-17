import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import type { PublishedLearningGraphDto } from '@study/contracts';
import type { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class LearningGraphApiService {
  private readonly http = inject(HttpClient);

  findPublished(
    moduleId: string,
  ): Observable<PublishedLearningGraphDto | null> {
    return this.http.get<PublishedLearningGraphDto | null>(
      `${environment.apiUrl}/module/${moduleId}/learning-graph`,
    );
  }
}
