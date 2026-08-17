import { Route } from '@angular/router';
import { MagicLinkVerificationComponent } from './core/auth/magic-link-verification.component';

export const appRoutes: Route[] = [
  {
    path: '',
    pathMatch: 'full',
    //    component: HomeComponent,
  },
  {
    path: 'auth/verify',
    component: MagicLinkVerificationComponent,
  },
];
