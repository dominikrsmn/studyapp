import { inject, Injectable } from '@angular/core';
import type { Subscriber } from 'rxjs';
import { firstValueFrom, Observable } from 'rxjs';
import type {
  EventSourceMessage} from '@microsoft/fetch-event-source';
import {
  fetchEventSource,
} from '@microsoft/fetch-event-source';
import type { ZodType } from 'zod';
import { AuthRefreshService } from './auth-refresh.service';
import { AuthTokenService } from './auth-token.service';

@Injectable({ providedIn: 'root' })
export class SseAuthService {
  private readonly authTokenService = inject(AuthTokenService);
  private readonly authRefreshService = inject(AuthRefreshService);

  connect<T>(
    url: string,
    schema: ZodType<T>,
    options: SseConnectionOptions = {},
  ): Observable<T> {
    return new Observable<T>((subscriber: Subscriber<T>) => {
      const controller = new AbortController();

      void this.connectInternal(
        url,
        controller,
        (message) => {
          try {
            if (!message.data.trim()) return;
            const data: T = schema.parse(JSON.parse(message.data));
            subscriber.next(data);
          } catch (error) {
            subscriber.error(error);
          }
        },
        options.onOpen,
      ).catch((error) => {
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
    onOpen?: () => void | Promise<void>,
  ): Promise<void> {
    let refreshAttempted = false;

    while (!controller.signal.aborted) {
      try {
        await fetchEventSource(url, {
          signal: controller.signal,
          headers: this.authorizationHeaders(),
          onmessage: onMessage,
          onopen: async (response: Response) => {
            if (response.ok) {
              refreshAttempted = false;
              await onOpen?.();
              return;
            }
            if (response.status === 401) {
              throw new UnauthorizedSseError();
            }
            throw new FatalSseError(
              `SSE connection failed, status: ${response.status}`,
            );
          },
          onclose: () => {
            throw new RetriableSseError();
          },
          onerror: (error: unknown) => {
            if (
              error instanceof UnauthorizedSseError ||
              error instanceof FatalSseError
            ) {
              throw error;
            }
          },
        });
        return;
      } catch (error) {
        if (controller.signal.aborted) {
          return;
        }
        if (!(error instanceof UnauthorizedSseError) || refreshAttempted) {
          throw error;
        }

        refreshAttempted = true;
        await firstValueFrom(this.authRefreshService.refreshAccessToken());
      }
    }
  }

  private authorizationHeaders(): Record<string, string> {
    const accessToken = this.authTokenService.getAccessToken();
    return accessToken ? { Authorization: `Bearer ${accessToken}` } : {};
  }
}

class UnauthorizedSseError extends Error {}
class FatalSseError extends Error {}
class RetriableSseError extends Error {}

export interface SseConnectionOptions {
  onOpen?: () => void | Promise<void>;
}
