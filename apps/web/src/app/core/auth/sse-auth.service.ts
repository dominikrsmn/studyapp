import { inject, Injectable } from '@angular/core';
import { AuthTokenService } from './auth-token.service';
import { Observable, Subscriber } from 'rxjs';
import {
  EventSourceMessage,
  fetchEventSource,
} from '@microsoft/fetch-event-source';
import { ZodType } from 'zod';

@Injectable({ providedIn: 'root' })
export class SseAuthService {
  private readonly authTokenService = inject(AuthTokenService);

  connect<T>(url: string, schema: ZodType<T>): Observable<T> {
    return new Observable<T>((subscriber: Subscriber<T>) => {
      const controller = new AbortController();

      void this.connectInternal(url, controller, (message) => {
        try {
          const data: T = schema.parse(JSON.parse(message.data));
          subscriber.next(data);
        } catch (error) {
          subscriber.error(error);
        }
      }).catch((error) => {
        if (!controller.signal.aborted) {
          subscriber.error(error);
        }
      });
      return () => {
        controller.abort();
      };
    });
  }

  private async connectInternal(
    url: string,
    controller: AbortController,
    onMessage: (message: EventSourceMessage) => void,
  ): Promise<void> {
    await fetchEventSource(url, {
      signal: controller.signal,

      headers: {
        Authorization: `Bearer ${this.authTokenService.getAccessToken()}`,
      },

      onmessage: onMessage,

      onopen: async (response: Response) => {
        if (response.ok) return;
        if (response.status === 401) throw new UnauthorizedSseError();
        throw new Error('SSE connection failed, status: ' + response.status);
      },
    });
  }
}

class UnauthorizedSseError extends Error {}
