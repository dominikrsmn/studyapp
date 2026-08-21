import { TestBed } from '@angular/core/testing';
import { Subject } from 'rxjs';
import type { AccessTokenResponse} from './auth-api.service';
import { AuthApiService } from './auth-api.service';
import { AuthRefreshService } from './auth-refresh.service';
import { AuthTokenService } from './auth-token.service';

describe('AuthRefreshService', () => {
  const refreshResponse = new Subject<AccessTokenResponse>();
  const authApi = {
    refreshAccessToken: vi.fn(() => refreshResponse),
  };

  beforeEach(() => {
    authApi.refreshAccessToken.mockClear();
    TestBed.configureTestingModule({
      providers: [{ provide: AuthApiService, useValue: authApi }],
    });
  });

  it('shares exactly one refresh between concurrent consumers', () => {
    const service = TestBed.inject(AuthRefreshService);
    const tokens = TestBed.inject(AuthTokenService);
    const firstResult: string[] = [];
    const secondResult: string[] = [];

    service.refreshAccessToken().subscribe((token) => firstResult.push(token));
    service.refreshAccessToken().subscribe((token) => secondResult.push(token));

    expect(authApi.refreshAccessToken).toHaveBeenCalledTimes(1);

    refreshResponse.next({
      accessToken: 'new-access-token',
      refreshTokenExpiresAt: '2026-09-14T12:00:00.000Z',
    });
    refreshResponse.complete();

    expect(firstResult).toEqual(['new-access-token']);
    expect(secondResult).toEqual(['new-access-token']);
    expect(tokens.getAccessToken()).toBe('new-access-token');
  });
});
