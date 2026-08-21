import { Component, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../auth.service';

@Component({
  selector: 'app-magic-link-verification',
  template: `
    @if (errorMessage()) {
      <p role="alert">{{ errorMessage() }}</p>
    } @else {
      <p>Signing you in…</p>
    }
  `,
})
export class MagicLinkVerificationComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);

  readonly errorMessage = signal<string | null>(null);

  ngOnInit(): void {
    const token = this.route.snapshot.queryParamMap.get('token');
    if (!token) {
      this.errorMessage.set('This magic link is invalid.');
      return;
    }

    this.auth.verifyMagicLink(token).subscribe({
      next: () => void this.router.navigateByUrl('/workspace'),
      error: () => {
        this.errorMessage.set('This magic link is invalid or has expired.');
      },
    });
  }
}
