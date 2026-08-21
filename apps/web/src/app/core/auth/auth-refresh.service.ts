import { HttpErrorResponse } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import {
  catchError,
  finalize,
  map,
  Observable,
  retry,
  shareReplay,
  tap,
  throwError,
  timer,
} from 'rxjs';
import { AuthApiService } from './auth-api.service';
import { AuthTokenService } from './auth-token.service';

@Injectable({ providedIn: 'root' })
export class AuthRefreshService {
  private readonly authApi = inject(AuthApiService);
  private readonly authTokens = inject(AuthTokenService);
  private refreshInFlight: Observable<string> | null = null;

  refreshAccessToken(): Observable<string> {
    if (this.refreshInFlight) {
      return this.refreshInFlight;
    }

    this.refreshInFlight = this.authApi.refreshAccessToken().pipe(
      retry({
        count: 3,
        delay: (error: unknown, retryCount) => {
          if (error instanceof HttpErrorResponse && error.status === 409) {
            return timer(retryCount * 100);
          }
          return throwError(() => error);
        },
      }),
      tap(({ accessToken }) => this.authTokens.setAccessToken(accessToken)),
      map(({ accessToken }) => accessToken),
      catchError((error: unknown) => {
        this.authTokens.clearAccessToken();
        return throwError(() => error);
      }),
      finalize(() => {
        this.refreshInFlight = null;
      }),
      shareReplay({ bufferSize: 1, refCount: false }),
    );

    return this.refreshInFlight;
  }
}
