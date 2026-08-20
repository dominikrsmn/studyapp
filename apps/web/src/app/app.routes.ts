import { Route } from '@angular/router';
import { authGuard } from './core/auth/auth.guard';
import { MagicLinkVerificationComponent } from './core/auth/magic-link-verification.component';
import { LayoutComponent } from './core/layout/layout.component';
import { WorkspaceComponent } from './features/workspace/workspace.component';

export const appRoutes: Route[] = [
  {
    path: 'login',
    loadComponent: () =>
      import('./core/auth/login.component').then(
        ({ LoginComponent }) => LoginComponent,
      ),
  },
  {
    path: 'auth/verify',
    component: MagicLinkVerificationComponent,
  },
  {
    path: '',
    component: LayoutComponent,
    canActivate: [authGuard],
    children: [
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
        path: '**',
        redirectTo: 'workspace',
      },
    ],
  },
];
