import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthTokenService } from './auth-token.service';

export const authGuard: CanActivateFn = () => {
  const authTokens = inject(AuthTokenService);
  const router = inject(Router);

  if (authTokens.isAuthenticated()) {
    return true;
  }

  return router.createUrlTree(['/login']);
};
