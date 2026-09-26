import { Injectable } from '@angular/core';
import { HttpContext, HttpClient, HttpContextToken } from '@angular/common/http';
import { BehaviorSubject, Observable, shareReplay, tap } from 'rxjs';
import { API_BASE_URL } from '../api.config';

export const skipAuthRefresh = new HttpContextToken<boolean>(() => false);

export interface Session {
  accessToken: string;
  email: string;
  displayName: string;
  role: string;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly key = 'anispeaker.session';
  private readonly subject = new BehaviorSubject<Session | null>(this.read());
  private refreshInFlight$: Observable<Session> | null = null;
  readonly session$ = this.subject.asObservable();

  get session(): Session | null {
    return this.subject.value;
  }

  get isLoggedIn(): boolean {
    return !!this.session;
  }

  get isAdmin(): boolean {
    if (!this.session) return false;

    // 1. Direct role property check (case-insensitive)
    const directRole = (this.session.role || '').trim().toLowerCase();
    if (directRole === 'admin') return true;

    // 2. Fallback: inspect claims in JWT accessToken
    try {
      if (this.session.accessToken) {
        const parts = this.session.accessToken.split('.');
        if (parts.length === 3) {
          const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
          const tokenRole = (
            payload.role ||
            payload['http://schemas.microsoft.com/ws/2008/06/identity/claims/role'] ||
            ''
          )
            .trim()
            .toLowerCase();
          if (tokenRole === 'admin') return true;
        }
      }
    } catch {
      // Ignore parsing errors
    }

    return false;
  }

  constructor(private readonly http: HttpClient) {}

  login(email: string, password: string): Observable<Session> {
    return this.http
      .post<Session>(`${API_BASE_URL}/api/auth/login`, { email, password }, { withCredentials: true })
      .pipe(tap((x) => this.save(x)));
  }

  register(displayName: string, email: string, password: string): Observable<Session> {
    return this.http
      .post<Session>(
        `${API_BASE_URL}/api/auth/register`,
        { displayName, email, password },
        { withCredentials: true }
      )
      .pipe(tap((x) => this.save(x)));
  }

  refresh(): Observable<Session> {
    if (!this.refreshInFlight$) {
      this.refreshInFlight$ = this.http
        .post<Session>(`${API_BASE_URL}/api/auth/refresh`, {}, {
          context: new HttpContext().set(skipAuthRefresh, true),
          withCredentials: true,
        })
        .pipe(
          tap((x) => this.save(x)),
          shareReplay(1),
        );
      this.refreshInFlight$.subscribe({
        next: () => (this.refreshInFlight$ = null),
        error: () => {
          this.refreshInFlight$ = null;
          this.logout();
        },
      });
    }

    return this.refreshInFlight$;
  }

  logout(): void {
    this.http.post(`${API_BASE_URL}/api/auth/logout`, {}, {
      context: new HttpContext().set(skipAuthRefresh, true),
      withCredentials: true,
    }).subscribe({ error: () => undefined });
    localStorage.removeItem(this.key);
    this.subject.next(null);
  }

  private save(value: Session): void {
    localStorage.setItem(this.key, JSON.stringify(value));
    this.subject.next(value);
  }

  private read(): Session | null {
    try {
      return JSON.parse(localStorage.getItem(this.key) ?? 'null');
    } catch {
      return null;
    }
  }
}
