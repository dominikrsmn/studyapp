import { TestBed } from '@angular/core/testing';
import { firstValueFrom, of, throwError } from 'rxjs';
import { AuthApiService } from './auth-api.service';
import { AuthRefreshService } from './auth-refresh.service';
import { AuthService } from './auth.service';
import { AuthTokenService } from './auth-token.service';

describe('AuthService', () => {
  const authApi = {
    requestMagicLink: vi.fn(),
    verifyMagicLink: vi.fn(),
    getSessionAvailability: vi.fn(),
    logout: vi.fn(),
  };
  const authRefresh = {
    refreshAccessToken: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    TestBed.configureTestingModule({
      providers: [
        { provide: AuthApiService, useValue: authApi },
        { provide: AuthRefreshService, useValue: authRefresh },
      ],
    });
  });

  it('stores the access token after magic-link verification', async () => {
    authApi.verifyMagicLink.mockReturnValue(
      of({
        accessToken: 'access-token',
        refreshTokenExpiresAt: '2026-09-14T12:00:00.000Z',
      }),
    );

    await firstValueFrom(TestBed.inject(AuthService).verifyMagicLink('token'));

    expect(TestBed.inject(AuthTokenService).getAccessToken()).toBe(
      'access-token',
    );
  });

  it('clears local authentication even when logout fails', async () => {
    const tokens = TestBed.inject(AuthTokenService);
    tokens.setAccessToken('access-token');
    authApi.logout.mockReturnValue(throwError(() => new Error('offline')));

    await expect(
      firstValueFrom(TestBed.inject(AuthService).logout()),
    ).rejects.toThrow('offline');
    expect(tokens.getAccessToken()).toBeNull();
  });

  it('restores a server-side session through the shared refresh service', async () => {
    authApi.getSessionAvailability.mockReturnValue(of({ hasSession: true }));
    authRefresh.refreshAccessToken.mockReturnValue(of('access-token'));

    await TestBed.inject(AuthService).restoreSession();

    expect(authRefresh.refreshAccessToken).toHaveBeenCalledTimes(1);
  });
});
