import {
  HttpErrorResponse,
  HttpInterceptorFn,
  HttpRequest,
} from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, switchMap, throwError } from 'rxjs';
import { environment } from '../../environments/environment';
import { AuthTokenService } from './auth-token.service';

const refreshUrl = `${environment.apiUrl}/auth/refresh`;

export const authInterceptor: HttpInterceptorFn = (request, next) => {
  const authTokens = inject(AuthTokenService);

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

      return authTokens.refreshAccessToken().pipe(
        switchMap((newAccessToken) =>
          next(withBearerToken(request, newAccessToken)),
        ),
        catchError((refreshError: unknown) => {
          authTokens.clearAccessToken();
          return throwError(() => refreshError);
        }),
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
