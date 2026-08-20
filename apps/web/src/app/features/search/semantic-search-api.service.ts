import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import {
  type SemanticSearchRequest,
  type SemanticSearchResult,
} from '@study/contracts';
import type { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class SemanticSearchApiService {
  private readonly http = inject(HttpClient);

  search(
    moduleId: string,
    request: SemanticSearchRequest,
  ): Observable<SemanticSearchResult[]> {
    return this.http.post<SemanticSearchResult[]>(
      `${environment.apiUrl}/module/${moduleId}/search`,
      request,
    );
  }
}
