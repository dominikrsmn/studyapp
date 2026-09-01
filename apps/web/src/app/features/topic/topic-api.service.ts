import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import type { TopicOverviewDto } from '@study/contracts';
import type { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class TopicApiService {
  private readonly http = inject(HttpClient);

  findAll(moduleId: string): Observable<TopicOverviewDto[]> {
    return this.http.get<TopicOverviewDto[]>(
      `${environment.apiUrl}/module/${moduleId}/topic`,
    );
  }
}
