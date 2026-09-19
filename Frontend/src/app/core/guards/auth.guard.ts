import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
export const signedInGuard: CanActivateFn = () => inject(AuthService).isLoggedIn || inject(Router).createUrlTree(['/login']);
export const adminGuard: CanActivateFn = () => inject(AuthService).isAdmin || inject(Router).createUrlTree(['/']);
