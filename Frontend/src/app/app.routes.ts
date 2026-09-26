import { Routes } from '@angular/router';
import { adminGuard, signedInGuard } from './core/guards/auth.guard';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./features/home/home.component').then((m) => m.HomeComponent),
  },
  {
    path: 'browse',
    loadComponent: () => import('./features/pages/pages.component').then((m) => m.BrowseComponent),
  },
  {
    path: 'browse/:type',
    loadComponent: () => import('./features/pages/pages.component').then((m) => m.BrowseComponent),
  },
  {
    path: 'search',
    loadComponent: () => import('./features/pages/pages.component').then((m) => m.SearchComponent),
  },
  {
    path: 'content/:slug',
    loadComponent: () => import('./features/pages/pages.component').then((m) => m.DetailComponent),
  },
  {
    path: 'watch/:slug/:seasonSegment/:epSegment',
    loadComponent: () => import('./features/pages/pages.component').then((m) => m.PlayerComponent),
  },
  {
    path: 'watch/:slug/:epSegment',
    loadComponent: () => import('./features/pages/pages.component').then((m) => m.PlayerComponent),
  },
  {
    path: 'watch/:slug',
    loadComponent: () => import('./features/pages/pages.component').then((m) => m.PlayerComponent),
  },
  {
    path: 'watch/:seasonSegment/:epSegment',
    loadComponent: () => import('./features/pages/pages.component').then((m) => m.PlayerComponent),
  },
  {
    path: 'watch/:id',
    loadComponent: () => import('./features/pages/pages.component').then((m) => m.PlayerComponent),
  },
  {
    path: 'watch-later',
    loadComponent: () =>
      import('./features/pages/pages.component').then((m) => m.WatchLaterComponent),
  },
  {
    path: 'history',
    loadComponent: () => import('./features/pages/pages.component').then((m) => m.HistoryComponent),
  },
  {
    path: 'login',
    loadComponent: () => import('./features/pages/pages.component').then((m) => m.LoginComponent),
  },
  {
    path: 'register',
    loadComponent: () =>
      import('./features/pages/pages.component').then((m) => m.RegisterComponent),
  },
  {
    path: 'profile',
    loadComponent: () => import('./features/pages/pages.component').then((m) => m.ProfileComponent),
  },
  {
    path: 'admin',
    canActivate: [adminGuard],
    loadChildren: () => import('./features/admin/admin.routes').then((m) => m.ADMIN_ROUTES),
  },
  { path: '**', redirectTo: '' },
];
