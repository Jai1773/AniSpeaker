import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter, withViewTransitions, withRouterConfig } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { APP_INITIALIZER } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { routes } from './app.routes';
import { authInterceptor } from './core/interceptors/auth.interceptor';
import { AuthService } from './core/services/auth.service';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(
      routes,
      withViewTransitions(),
      withRouterConfig({ onSameUrlNavigation: 'reload' })
    ),
    provideHttpClient(withInterceptors([authInterceptor])),
    {
      provide: APP_INITIALIZER,
      useFactory: (authService: AuthService) => () => {
        if (authService.isLoggedIn && authService.isTokenExpired()) {
          return firstValueFrom(authService.refresh());
        }
        return Promise.resolve();
      },
      deps: [AuthService],
      multi: true,
    },
  ],
};
