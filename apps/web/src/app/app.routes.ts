import { Route } from '@angular/router';
import { MagicLinkVerificationComponent } from './auth/magic-link-verification.component';

export const appRoutes: Route[] = [
  {
    path: 'auth/verify',
    component: MagicLinkVerificationComponent,
  },
];
