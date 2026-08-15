import { DatePipe } from '@angular/common';
import {
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { AuthSession, AuthTokenService } from '../auth/auth-token.service';

@Component({
  selector: 'app-home',
  imports: [DatePipe, ReactiveFormsModule],
  templateUrl: './home.component.html',
  styleUrl: './home.component.css',
})
export class HomeComponent {
  private readonly auth = inject(AuthTokenService);
  private readonly now = signal(Date.now());

  readonly emailControl = new FormControl('', {
    nonNullable: true,
    validators: [Validators.required, Validators.email],
  });
  readonly isAuthenticated = this.auth.isAuthenticated;
  readonly email = this.auth.email;
  readonly sessions = signal<AuthSession[]>([]);
  readonly statusMessage = signal<string | null>(null);
  readonly isSubmitting = signal(false);
  readonly accessTokenRemaining = computed(() =>
    this.formatRemaining(this.auth.accessTokenExpiresAt()),
  );
  readonly refreshTokenRemaining = computed(() =>
    this.formatRemaining(this.auth.refreshTokenExpiresAt()),
  );

  constructor() {
    const intervalId = globalThis.setInterval(
      () => this.now.set(Date.now()),
      1_000,
    );
    inject(DestroyRef).onDestroy(() => globalThis.clearInterval(intervalId));

    effect(() => {
      if (this.isAuthenticated()) {
        this.loadSessions();
      } else {
        this.sessions.set([]);
      }
    });
  }

  requestMagicLink(event: SubmitEvent): void {
    event.preventDefault();
    this.emailControl.markAsTouched();
    if (this.emailControl.invalid || this.isSubmitting()) {
      return;
    }

    this.isSubmitting.set(true);
    this.statusMessage.set(null);
    this.auth.requestMagicLink(this.emailControl.value).subscribe({
      next: () => {
        this.isSubmitting.set(false);
        this.statusMessage.set(
          'Magic link requested. In development, check the backend console.',
        );
      },
      error: () => {
        this.isSubmitting.set(false);
        this.statusMessage.set('Could not request a magic link.');
      },
    });
  }

  revokeSession(session: AuthSession): void {
    this.auth.revokeSession(session.id).subscribe({
      next: () => {
        if (session.isCurrent) {
          this.auth.clearAccessToken();
        } else {
          this.loadSessions();
        }
      },
      error: () => this.statusMessage.set('Could not revoke that session.'),
    });
  }

  logout(): void {
    this.auth.logout().subscribe({
      next: () => this.sessions.set([]),
      error: () => {
        this.sessions.set([]);
        this.statusMessage.set('You were logged out locally.');
      },
    });
  }

  private loadSessions(): void {
    this.auth.findSessions().subscribe({
      next: (sessions) => this.sessions.set(sessions),
      error: () => this.statusMessage.set('Could not load active sessions.'),
    });
  }

  private formatRemaining(expiresAt: Date | null): string {
    this.now();
    if (!expiresAt) {
      return '—';
    }

    const totalSeconds = Math.max(
      0,
      Math.ceil((expiresAt.getTime() - this.now()) / 1_000),
    );
    const days = Math.floor(totalSeconds / 86_400);
    const hours = Math.floor((totalSeconds % 86_400) / 3_600);
    const minutes = Math.floor((totalSeconds % 3_600) / 60);
    const seconds = totalSeconds % 60;

    return [
      days ? `${days}d` : '',
      hours ? `${hours}h` : '',
      minutes ? `${minutes}m` : '',
      `${seconds}s`,
    ]
      .filter(Boolean)
      .join(' ');
  }
}
