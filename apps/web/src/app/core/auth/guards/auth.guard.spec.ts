import { TestBed } from '@angular/core/testing';
import {
  ActivatedRouteSnapshot,
  provideRouter,
  Router,
  RouterStateSnapshot,
  UrlTree,
} from '@angular/router';
import { AuthTokenService } from '../auth-token.service';
import { authGuard } from './auth.guard';
import { appRoutes } from '../../../app.routes';
import { guestGuard } from './guest.guard';

describe('authGuard', () => {
  let authenticated = false;

  beforeEach(() => {
    authenticated = false;
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        {
          provide: AuthTokenService,
          useValue: { isAuthenticated: () => authenticated },
        },
      ],
    });
  });

  it('redirects a guest to login', () => {
    const result = runGuard();
    const router = TestBed.inject(Router);

    expect(result).toBeInstanceOf(UrlTree);
    expect(router.serializeUrl(result as UrlTree)).toBe('/login');
  });

  it('allows an authenticated user to activate private routes', () => {
    authenticated = true;

    expect(runGuard()).toBe(true);
  });

  it('keeps verification public and applies the matching auth guards', () => {
    expect(
      appRoutes.find(({ path }) => path === 'login')?.canActivate,
    ).toContain(guestGuard);
    expect(
      appRoutes.find(({ path }) => path === 'auth/verify')?.canActivate,
    ).toBeUndefined();
    expect(appRoutes.find(({ path }) => path === '')?.canActivate).toContain(
      authGuard,
    );
  });
});

function runGuard(): ReturnType<typeof authGuard> {
  return TestBed.runInInjectionContext(() =>
    authGuard({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot),
  );
}
