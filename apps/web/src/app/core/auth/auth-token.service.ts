import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { computed, inject, Injectable, signal } from '@angular/core';
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
import { environment } from '../../../environments/environment';

export interface AccessTokenResponse {
  accessToken: string;
  refreshTokenExpiresAt: string;
}

export interface AccessTokenClaims {
  sub: string;
  sessionId: string;
  email: string;
  type: 'access';
  exp: number;
}

export interface AuthSession {
  id: string;
  createdAt: string;
  lastUsedAt: string;
  refreshTokenExpiresAt: string;
  isCurrent: boolean;
}

interface SessionAvailabilityResponse {
  hasSession: boolean;
}

@Injectable({ providedIn: 'root' })
export class AuthTokenService {
  private readonly http = inject(HttpClient);
  private readonly accessTokenState = signal<string | null>(null);
  private readonly refreshTokenExpiresAtState = signal<Date | null>(null);
  private refreshInFlight?: Observable<string>;

  readonly accessTokenClaims = computed(() =>
    decodeAccessToken(this.accessTokenState()),
  );
  readonly isAuthenticated = computed(() => this.accessTokenClaims() !== null);
  readonly email = computed(() => this.accessTokenClaims()?.email ?? null);
  readonly sessionId = computed(
    () => this.accessTokenClaims()?.sessionId ?? null,
  );
  readonly accessTokenExpiresAt = computed(() => {
    const expiresAt = this.accessTokenClaims()?.exp;
    return expiresAt ? new Date(expiresAt * 1000) : null;
  });
  readonly refreshTokenExpiresAt = this.refreshTokenExpiresAtState.asReadonly();

  getAccessToken(): string | null {
    return this.accessTokenState();
  }

  setAccessToken(accessToken: string): void {
    this.accessTokenState.set(accessToken);
  }

  clearAccessToken(): void {
    this.accessTokenState.set(null);
    this.refreshTokenExpiresAtState.set(null);
  }

  requestMagicLink(email: string): Observable<void> {
    return this.http
      .post<void>(`${environment.apiUrl}/auth/magic-link`, { email })
      .pipe(map(() => undefined));
  }

  verifyMagicLink(token: string): Observable<void> {
    return this.http
      .post<AccessTokenResponse>(
        `${environment.apiUrl}/auth/magic-link/verify`,
        { token },
        { withCredentials: true },
      )
      .pipe(
        tap((response) => this.setAuthenticatedSession(response)),
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
        tap((response) => this.setAuthenticatedSession(response)),
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
      const { hasSession } = await firstValueFrom(
        this.http.get<SessionAvailabilityResponse>(
          `${environment.apiUrl}/auth/session`,
          { withCredentials: true },
        ),
      );
      if (!hasSession) {
        this.clearAccessToken();
        return;
      }

      await firstValueFrom(this.refreshAccessToken());
    } catch {
      this.clearAccessToken();
    }
  }

  findSessions(): Observable<AuthSession[]> {
    return this.http.get<AuthSession[]>(`${environment.apiUrl}/auth/sessions`);
  }

  revokeSession(sessionId: string): Observable<void> {
    return this.http.delete<void>(
      `${environment.apiUrl}/auth/sessions/${sessionId}`,
    );
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

  private setAuthenticatedSession(response: AccessTokenResponse): void {
    this.accessTokenState.set(response.accessToken);
    this.refreshTokenExpiresAtState.set(
      new Date(response.refreshTokenExpiresAt),
    );
  }
}

function decodeAccessToken(token: string | null): AccessTokenClaims | null {
  if (!token) {
    return null;
  }

  try {
    const encodedPayload = token.split('.')[1];
    if (!encodedPayload) {
      return null;
    }

    const base64 = encodedPayload.replace(/-/g, '+').replace(/_/g, '/');
    const paddedBase64 = base64.padEnd(
      base64.length + ((4 - (base64.length % 4)) % 4),
      '=',
    );
    const binaryPayload = globalThis.atob(paddedBase64);
    const payloadBytes = Uint8Array.from(binaryPayload, (character) =>
      character.charCodeAt(0),
    );
    const payload = JSON.parse(
      new TextDecoder().decode(payloadBytes),
    ) as Partial<AccessTokenClaims>;

    if (
      payload.type !== 'access' ||
      typeof payload.sub !== 'string' ||
      typeof payload.sessionId !== 'string' ||
      typeof payload.email !== 'string' ||
      typeof payload.exp !== 'number'
    ) {
      return null;
    }

    return payload as AccessTokenClaims;
  } catch {
    return null;
  }
}
