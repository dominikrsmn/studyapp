import { inject, Service } from '@angular/core';
import { SseAuthService } from '../../core/auth/sse-auth.service';
import type { Observable } from 'rxjs';
import type {
  SourceStateChangedEvent} from '@study/contracts';
import {
  sourceStateChangedEventSchema,
} from '@study/contracts';
import { environment } from '../../../environments/environment';

export interface SourceEventConnectionOptions {
  onOpen?: () => void | Promise<void>;
}

@Service()
export class SourceEventsService {
  private readonly sse = inject(SseAuthService);

  stateChanges(
    moduleId: string,
    options: SourceEventConnectionOptions = {},
  ): Observable<SourceStateChangedEvent> {
    return this.sse.connect<SourceStateChangedEvent>(
      `${environment.apiUrl}/module/${moduleId}/source/events`,
      sourceStateChangedEventSchema,
      options,
    );
  }
}
