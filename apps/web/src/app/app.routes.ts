import { Route } from '@angular/router';
import { MagicLinkVerificationComponent } from './core/auth/magic-link-verification.component';
import { WorkspaceComponent } from './features/workspace/workspace.component';

export const appRoutes: Route[] = [
  {
    path: '',
    redirectTo: 'workspace',
    pathMatch: 'full',
  },
  {
    path: 'workspace',
    component: WorkspaceComponent,
  },
  {
    path: 'module/:id',
    loadComponent: () => import('./features/module/module.component'),
  },
  {
    path: 'auth/verify',
    component: MagicLinkVerificationComponent,
  },
];
