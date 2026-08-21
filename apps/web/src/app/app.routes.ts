import type { Route } from '@angular/router';
import { authGuard } from './core/auth/guards/auth.guard';
import { MagicLinkVerificationComponent } from './core/auth/login/magic-link-verification.component';
import { LayoutComponent } from './core/layout/layout.component';
import { WorkspaceComponent } from './features/workspace/workspace.component';
import { guestGuard } from './core/auth/guards/guest.guard';

const loadModuleComponent = () => import('./features/module/module.component');

export const appRoutes: Route[] = [
  {
    path: 'login',
    loadComponent: () =>
      import('./core/auth/login/login.component').then(
        ({ LoginComponent }) => LoginComponent,
      ),
    canActivate: [guestGuard],
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
        path: 'module/:id/sources',
        loadComponent: loadModuleComponent,
        data: { moduleTab: 'sources' },
      },
      {
        path: 'module/:id/practice',
        loadComponent: loadModuleComponent,
        data: { moduleTab: 'practice' },
      },
      {
        path: 'module/:id/exam-prep',
        loadComponent: loadModuleComponent,
        data: { moduleTab: 'exam-prep' },
      },
      {
        path: 'module/:id',
        loadComponent: loadModuleComponent,
        data: { moduleTab: 'overview' },
      },
      {
        path: '**',
        redirectTo: 'workspace',
      },
    ],
  },
];
