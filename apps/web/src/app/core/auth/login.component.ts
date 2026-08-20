import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
} from '@angular/core';
import {
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { finalize } from 'rxjs';
import { ZardButtonComponent } from '../../shared/components/button';
import { ZardInputComponent } from '../../shared/components/input';
import { AuthTokenService } from './auth-token.service';

@Component({
  selector: 'app-login',
  imports: [ReactiveFormsModule, ZardButtonComponent, ZardInputComponent],
  templateUrl: './login.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LoginComponent {
  private readonly authTokens = inject(AuthTokenService);
  private readonly route = inject(ActivatedRoute);

  readonly form = new FormGroup({
    email: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.email],
    }),
  });
  readonly isSubmitting = signal(false);
  readonly sentTo = signal<string | null>(null);
  readonly errorMessage = signal<string | null>(null);

  submit(): void {
    if (this.form.invalid || this.isSubmitting()) {
      this.form.markAllAsTouched();
      return;
    }

    const email = this.form.controls.email.value.trim();

    this.isSubmitting.set(true);
    this.errorMessage.set(null);
    this.authTokens
      .requestMagicLink(email)
      .pipe(finalize(() => this.isSubmitting.set(false)))
      .subscribe({
        next: () => this.sentTo.set(email),
        error: () =>
          this.errorMessage.set(
            'We could not send the sign-in link. Please try again.',
          ),
      });
  }
}
