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
import { AuthTokenService } from './auth-token.service';
import { environment } from '../../environments/environment';

const modulesUrl = `${environment.apiUrl}/modules`;
const documentsUrl = `${environment.apiUrl}/documents`;
const refreshUrl = `${environment.apiUrl}/auth/refresh`;

describe('authInterceptor', () => {
  let authTokens: AuthTokenService;
  let httpTesting: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
      ],
    });

    authTokens = TestBed.inject(AuthTokenService);
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

    authTokens
      .refreshAccessToken()
      .subscribe((accessToken) => refreshedTokens.push(accessToken));

    httpTesting
      .expectOne(refreshUrl)
      .flush(null, { status: 409, statusText: 'Conflict' });
    await vi.advanceTimersByTimeAsync(100);

    httpTesting.expectOne(refreshUrl).flush({
      accessToken: 'access-token-from-rotated-cookie',
    });

    expect(refreshedTokens).toEqual(['access-token-from-rotated-cookie']);
  });
});
