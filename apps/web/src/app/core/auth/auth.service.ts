import { inject, Injectable } from '@angular/core';
import type { Observable} from 'rxjs';
import { firstValueFrom, finalize, map, tap } from 'rxjs';
import { AuthApiService } from './auth-api.service';
import { AuthRefreshService } from './auth-refresh.service';
import { AuthTokenService } from './auth-token.service';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly authApi = inject(AuthApiService);
  private readonly authRefresh = inject(AuthRefreshService);
  private readonly authTokens = inject(AuthTokenService);

  requestMagicLink(email: string): Observable<void> {
    return this.authApi.requestMagicLink(email);
  }

  verifyMagicLink(token: string): Observable<void> {
    return this.authApi.verifyMagicLink(token).pipe(
      tap(({ accessToken }) => this.authTokens.setAccessToken(accessToken)),
      map(() => undefined),
    );
  }

  logout(): Observable<void> {
    return this.authApi
      .logout()
      .pipe(finalize(() => this.authTokens.clearAccessToken()));
  }

  async restoreSession(): Promise<void> {
    try {
      const { hasSession } = await firstValueFrom(
        this.authApi.getSessionAvailability(),
      );
      if (!hasSession) {
        this.authTokens.clearAccessToken();
        return;
      }

      await firstValueFrom(this.authRefresh.refreshAccessToken());
    } catch {
      this.authTokens.clearAccessToken();
    }
  }
}
