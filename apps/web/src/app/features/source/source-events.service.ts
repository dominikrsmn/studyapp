import { inject, Service } from '@angular/core';
import { SseAuthService } from '../../core/auth/sse-auth.service';
import { Observable } from 'rxjs';
import {
  SourceStateChangedEvent,
  sourceStateChangedEventSchema,
} from '@study/contracts';
import { environment } from '../../../environments/environment';

@Service()
export class SourceEventsService {
  private readonly sse = inject(SseAuthService);

  stateChanges(moduleId: string): Observable<SourceStateChangedEvent> {
    return this.sse.connect<SourceStateChangedEvent>(
      `${environment.apiUrl}/modules/${moduleId}/source/events`,
      sourceStateChangedEventSchema,
    );
  }
}
