import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, tap } from 'rxjs';
import { API_BASE_URL } from '../api.config';

export interface Session { accessToken: string; email: string; displayName: string; role: string; }

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly key = 'anispeaker.session';
  private readonly subject = new BehaviorSubject<Session | null>(this.read());
  readonly session$ = this.subject.asObservable();
  get session(): Session | null { return this.subject.value; }
  get isLoggedIn(): boolean { return !!this.session; }
  get isAdmin(): boolean { return this.session?.role === 'Admin'; }
  constructor(private readonly http: HttpClient) {}
  login(email: string, password: string): Observable<Session> { return this.http.post<Session>(`${API_BASE_URL}/api/auth/login`, { email, password }, { withCredentials: true }).pipe(tap(x => this.save(x))); }
  register(displayName: string, email: string, password: string): Observable<Session> { return this.http.post<Session>(`${API_BASE_URL}/api/auth/register`, { displayName, email, password }, { withCredentials: true }).pipe(tap(x => this.save(x))); }
  logout(): void { localStorage.removeItem(this.key); this.subject.next(null); }
  private save(value: Session): void { localStorage.setItem(this.key, JSON.stringify(value)); this.subject.next(value); }
  private read(): Session | null { try { return JSON.parse(localStorage.getItem(this.key) ?? 'null'); } catch { return null; } }
}
