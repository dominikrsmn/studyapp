import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map, Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface AccessTokenResponse {
  accessToken: string;
  refreshTokenExpiresAt: string;
}

export interface AuthSession {
  id: string;
  createdAt: string;
  lastUsedAt: string;
  refreshTokenExpiresAt: string;
  isCurrent: boolean;
}

export interface SessionAvailabilityResponse {
  hasSession: boolean;
}

@Injectable({ providedIn: 'root' })
export class AuthApiService {
  private readonly http = inject(HttpClient);
  private readonly authUrl = `${environment.apiUrl}/auth`;

  requestMagicLink(email: string): Observable<void> {
    return this.http
      .post<void>(`${this.authUrl}/magic-link`, { email })
      .pipe(map(() => undefined));
  }

  verifyMagicLink(token: string): Observable<AccessTokenResponse> {
    return this.http.post<AccessTokenResponse>(
      `${this.authUrl}/magic-link/verify`,
      { token },
      { withCredentials: true },
    );
  }

  refreshAccessToken(): Observable<AccessTokenResponse> {
    return this.http.post<AccessTokenResponse>(
      `${this.authUrl}/refresh`,
      {},
      { withCredentials: true },
    );
  }

  getSessionAvailability(): Observable<SessionAvailabilityResponse> {
    return this.http.get<SessionAvailabilityResponse>(
      `${this.authUrl}/session`,
      { withCredentials: true },
    );
  }

  findSessions(): Observable<AuthSession[]> {
    return this.http.get<AuthSession[]>(`${this.authUrl}/sessions`);
  }

  revokeSession(sessionId: string): Observable<void> {
    return this.http.delete<void>(`${this.authUrl}/sessions/${sessionId}`);
  }

  logout(): Observable<void> {
    return this.http.post<void>(
      `${this.authUrl}/logout`,
      {},
      { withCredentials: true },
    );
  }
}
