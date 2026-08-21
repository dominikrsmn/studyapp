import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import type {
  QuestionAnsweringRequest,
  QuestionAnsweringResponse,
} from '@study/contracts';
import type { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class AiApiService {
  private readonly http = inject(HttpClient);

  ask(
    moduleId: string,
    request: QuestionAnsweringRequest,
  ): Observable<QuestionAnsweringResponse> {
    return this.http.post<QuestionAnsweringResponse>(
      `${environment.apiUrl}/module/${moduleId}/ai/question`,
      request,
    );
  }
}
