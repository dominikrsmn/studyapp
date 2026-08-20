import {
  HttpClient,
  provideHttpClient,
  withInterceptors,
} from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { authInterceptor } from './auth.interceptor';
import { AuthRefreshService } from './auth-refresh.service';
import { AuthService } from './auth.service';
import { AuthTokenService } from './auth-token.service';
import { environment } from '../../../environments/environment';

const modulesUrl = `${environment.apiUrl}/module`;
const documentsUrl = `${environment.apiUrl}/documents`;
const refreshUrl = `${environment.apiUrl}/auth/refresh`;
const sessionUrl = `${environment.apiUrl}/auth/session`;
const sourceUploadUrl = `${environment.apiUrl}/modules/module-id/sources`;

describe('authInterceptor', () => {
  let authTokens: AuthTokenService;
  let authRefresh: AuthRefreshService;
  let auth: AuthService;
  let httpTesting: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
      ],
    });

    authTokens = TestBed.inject(AuthTokenService);
    authRefresh = TestBed.inject(AuthRefreshService);
    auth = TestBed.inject(AuthService);
    httpTesting = TestBed.inject(HttpTestingController);
    authTokens.clearAccessToken();
  });

  afterEach(() => {
    vi.useRealTimers();
    authTokens.clearAccessToken();
    httpTesting.verify();
  });

  it('adds the access token to API requests', () => {
    authTokens.setAccessToken('access-token');

    const http = TestBed.inject(HttpClient);
    http.get(modulesUrl).subscribe();

    const request = httpTesting.expectOne(modulesUrl);
    expect(request.request.headers.get('Authorization')).toBe(
      'Bearer access-token',
    );
    request.flush([]);
  });

  it('adds the access token to multipart source uploads', () => {
    authTokens.setAccessToken('access-token');
    const formData = new FormData();
    formData.append('file', new File(['pdf'], 'script.pdf'));

    TestBed.inject(HttpClient).post(sourceUploadUrl, formData).subscribe();

    const request = httpTesting.expectOne(sourceUploadUrl);
    expect(request.request.headers.get('Authorization')).toBe(
      'Bearer access-token',
    );
    expect(request.request.headers.has('Content-Type')).toBe(false);
    expect(request.request.body).toBe(formData);
    request.flush({});
  });

  it('exposes identity and expiry claims from the access token', () => {
    const expiresAt = Math.floor(Date.now() / 1000) + 60;
    const payload = globalThis.btoa(
      JSON.stringify({
        sub: 'user-id',
        sessionId: 'session-id',
        email: 'user@example.com',
        type: 'access',
        exp: expiresAt,
      }),
    );

    authTokens.setAccessToken(`e30.${payload}.signature`);

    expect(authTokens.isAuthenticated()).toBe(true);
    expect(authTokens.email()).toBe('user@example.com');
    expect(authTokens.accessTokenExpiresAt()?.getTime()).toBe(expiresAt * 1000);
  });

  it('refreshes once and retries concurrent unauthorized requests', () => {
    authTokens.setAccessToken('expired-access-token');

    const http = TestBed.inject(HttpClient);
    http.get(modulesUrl).subscribe();
    http.get(documentsUrl).subscribe();

    httpTesting
      .expectOne(modulesUrl)
      .flush(null, { status: 401, statusText: 'Unauthorized' });
    httpTesting
      .expectOne(documentsUrl)
      .flush(null, { status: 401, statusText: 'Unauthorized' });

    const refresh = httpTesting.expectOne(refreshUrl);
    expect(refresh.request.body).toEqual({});
    expect(refresh.request.headers.has('Authorization')).toBe(false);
    expect(refresh.request.withCredentials).toBe(true);
    refresh.flush({
      accessToken: 'new-access-token',
      refreshTokenExpiresAt: '2026-09-14T12:00:00.000Z',
    });

    const moduleRetry = httpTesting.expectOne(modulesUrl);
    const documentRetry = httpTesting.expectOne(documentsUrl);
    expect(moduleRetry.request.headers.get('Authorization')).toBe(
      'Bearer new-access-token',
    );
    expect(documentRetry.request.headers.get('Authorization')).toBe(
      'Bearer new-access-token',
    );
    moduleRetry.flush([]);
    documentRetry.flush([]);

    expect(authTokens.getAccessToken()).toBe('new-access-token');
  });

  it('retries refresh when another tab just rotated the cookie', async () => {
    vi.useFakeTimers();
    const refreshedTokens: string[] = [];

    authRefresh
      .refreshAccessToken()
      .subscribe((accessToken) => refreshedTokens.push(accessToken));

    httpTesting
      .expectOne(refreshUrl)
      .flush(null, { status: 409, statusText: 'Conflict' });
    await vi.advanceTimersByTimeAsync(100);

    httpTesting.expectOne(refreshUrl).flush({
      accessToken: 'access-token-from-rotated-cookie',
      refreshTokenExpiresAt: '2026-09-14T12:00:00.000Z',
    });

    expect(refreshedTokens).toEqual(['access-token-from-rotated-cookie']);
  });

  it('does not refresh on startup when no refresh cookie exists', async () => {
    const restoration = auth.restoreSession();

    httpTesting.expectOne(sessionUrl).flush({ hasSession: false });
    await restoration;

    httpTesting.expectNone(refreshUrl);
    expect(authTokens.isAuthenticated()).toBe(false);
  });

  it('restores the session when the refresh cookie exists', async () => {
    const restoration = auth.restoreSession();

    httpTesting.expectOne(sessionUrl).flush({ hasSession: true });
    await Promise.resolve();
    httpTesting.expectOne(refreshUrl).flush({
      accessToken: createAccessToken(),
      refreshTokenExpiresAt: '2026-09-14T12:00:00.000Z',
    });
    await restoration;

    expect(authTokens.isAuthenticated()).toBe(true);
  });
});

function createAccessToken(): string {
  const payload = globalThis.btoa(
    JSON.stringify({
      sub: 'user-id',
      sessionId: 'session-id',
      email: 'user@example.com',
      type: 'access',
      exp: Math.floor(Date.now() / 1000) + 60,
    }),
  );
  return `e30.${payload}.signature`;
}
