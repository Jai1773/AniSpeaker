import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, switchMap, throwError } from 'rxjs';
import { AuthService, skipAuthRefresh } from '../services/auth.service';
import { API_BASE_URL } from '../api.config';

export const authInterceptor: HttpInterceptorFn = (request, next) => {
  const auth = inject(AuthService);
  const token = auth.session?.accessToken;

  const isApiUrl =
    request.url.startsWith(API_BASE_URL) || request.url.startsWith('/api');

  if (isApiUrl && token) {
    request = request.clone({
      setHeaders: { Authorization: `Bearer ${token}` },
      withCredentials: true,
    });
  } else if (isApiUrl) {
    request = request.clone({ withCredentials: true });
  }

  return next(request).pipe(
    catchError((error) => {
      if (error.status !== 401 || !isApiUrl || request.context.get(skipAuthRefresh)) {
        return throwError(() => error);
      }

      return auth.refresh().pipe(
        switchMap((session) =>
          next(
            request.clone({
              setHeaders: { Authorization: `Bearer ${session.accessToken}` },
              withCredentials: true,
            }),
          ),
        ),
        catchError((refreshError) => throwError(() => refreshError)),
      );
    }),
  );
};
