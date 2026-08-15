import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import {
  firstValueFrom,
  Observable,
  finalize,
  map,
  retry,
  shareReplay,
  tap,
  throwError,
  timer,
} from 'rxjs';
import { environment } from '../../environments/environment';

export interface AccessTokenResponse {
  accessToken: string;
}

@Injectable({ providedIn: 'root' })
export class AuthTokenService {
  private readonly http = inject(HttpClient);
  private accessToken: string | null = null;
  private refreshInFlight?: Observable<string>;

  getAccessToken(): string | null {
    return this.accessToken;
  }

  setAccessToken(accessToken: string): void {
    this.accessToken = accessToken;
  }

  clearAccessToken(): void {
    this.accessToken = null;
  }

  verifyMagicLink(token: string): Observable<void> {
    return this.http
      .post<AccessTokenResponse>(
        `${environment.apiUrl}/auth/magic-link/verify`,
        { token },
        { withCredentials: true },
      )
      .pipe(
        tap(({ accessToken }) => this.setAccessToken(accessToken)),
        map(() => undefined),
      );
  }

  refreshAccessToken(): Observable<string> {
    if (this.refreshInFlight) {
      return this.refreshInFlight;
    }

    this.refreshInFlight = this.http
      .post<AccessTokenResponse>(
        `${environment.apiUrl}/auth/refresh`,
        {},
        { withCredentials: true },
      )
      .pipe(
        retry({
          count: 3,
          delay: (error: unknown, retryCount) => {
            if (error instanceof HttpErrorResponse && error.status === 409) {
              return timer(retryCount * 100);
            }
            return throwError(() => error);
          },
        }),
        tap(({ accessToken }) => this.setAccessToken(accessToken)),
        map(({ accessToken }) => accessToken),
        finalize(() => {
          this.refreshInFlight = undefined;
        }),
        shareReplay({ bufferSize: 1, refCount: false }),
      );

    return this.refreshInFlight;
  }

  async restoreSession(): Promise<void> {
    try {
      await firstValueFrom(this.refreshAccessToken());
    } catch {
      this.clearAccessToken();
    }
  }

  logout(): Observable<void> {
    return this.http
      .post<void>(
        `${environment.apiUrl}/auth/logout`,
        {},
        { withCredentials: true },
      )
      .pipe(finalize(() => this.clearAccessToken()));
  }
}
