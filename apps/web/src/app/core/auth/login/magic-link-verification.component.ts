import { Component, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthTokenService } from '../auth-token.service';

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
  private readonly authTokens = inject(AuthTokenService);

  readonly errorMessage = signal<string | null>(null);

  ngOnInit(): void {
    const token = this.route.snapshot.queryParamMap.get('token');
    if (!token) {
      this.errorMessage.set('This magic link is invalid.');
      return;
    }

    this.authTokens.verifyMagicLink(token).subscribe({
      next: () => void this.router.navigateByUrl('/workspace'),
      error: () => {
        this.errorMessage.set('This magic link is invalid or has expired.');
      },
    });
  }
}
