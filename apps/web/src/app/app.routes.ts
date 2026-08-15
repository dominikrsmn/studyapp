import { Route } from '@angular/router';
import { MagicLinkVerificationComponent } from './auth/magic-link-verification.component';
import { HomeComponent } from './home/home.component';

export const appRoutes: Route[] = [
  {
    path: '',
    pathMatch: 'full',
    component: HomeComponent,
  },
  {
    path: 'auth/verify',
    component: MagicLinkVerificationComponent,
  },
];
