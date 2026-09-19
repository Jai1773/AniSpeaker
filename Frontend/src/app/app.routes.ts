import { Routes } from '@angular/router';
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
    loadChildren: () => import('./features/admin/admin.routes').then((m) => m.ADMIN_ROUTES),
  },
  { path: '**', redirectTo: '' },
];
