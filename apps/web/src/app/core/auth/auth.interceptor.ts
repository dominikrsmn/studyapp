import {
  HttpErrorResponse,
  HttpInterceptorFn,
  HttpRequest,
} from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, switchMap, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuthRefreshService } from './auth-refresh.service';
import { AuthTokenService } from './auth-token.service';

const refreshUrl = `${environment.apiUrl}/auth/refresh`;

export const authInterceptor: HttpInterceptorFn = (request, next) => {
  const authTokens = inject(AuthTokenService);
  const authRefresh = inject(AuthRefreshService);

  const url = request.url.split('?')[0];
  const isApiRequest =
    url === environment.apiUrl || url.startsWith(`${environment.apiUrl}/`);

  const unauthenticatedAuthUrls = [
    refreshUrl,
    `${environment.apiUrl}/auth/logout`,
    `${environment.apiUrl}/auth/magic-link`,
    `${environment.apiUrl}/auth/magic-link/verify`,
    `${environment.apiUrl}/auth/session`,
  ];

  if (!isApiRequest || unauthenticatedAuthUrls.includes(url)) {
    return next(request);
  }

  const accessToken = authTokens.getAccessToken();
  const authenticatedRequest = accessToken
    ? withBearerToken(request, accessToken)
    : request;

  return next(authenticatedRequest).pipe(
    catchError((error: unknown) => {
      if (!(error instanceof HttpErrorResponse) || error.status !== 401) {
        return throwError(() => error);
      }

      return authRefresh
        .refreshAccessToken()
        .pipe(
          switchMap((newAccessToken) =>
            next(withBearerToken(request, newAccessToken)),
          ),
        );
    }),
  );
};

function withBearerToken(
  request: HttpRequest<unknown>,
  accessToken: string,
): HttpRequest<unknown> {
  return request.clone({
    setHeaders: { Authorization: `Bearer ${accessToken}` },
  });
}
