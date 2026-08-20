import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { AuthTokenService } from './auth-token.service';
import { LoginComponent } from './login.component';

describe('LoginComponent', () => {
  const authTokens = {
    requestMagicLink: vi.fn(),
  };
  let fixture: ComponentFixture<LoginComponent>;
  let component: LoginComponent;

  beforeEach(async () => {
    authTokens.requestMagicLink.mockReset();
    await TestBed.configureTestingModule({
      imports: [LoginComponent],
      providers: [{ provide: AuthTokenService, useValue: authTokens }],
    }).compileComponents();

    fixture = TestBed.createComponent(LoginComponent);
    component = fixture.componentInstance;
  });

  it('requests a magic link that carries the guarded destination', () => {
    authTokens.requestMagicLink.mockReturnValue(of(undefined));
    component.form.controls.email.setValue('student@example.com');

    component.submit();

    expect(authTokens.requestMagicLink).toHaveBeenCalledWith(
      'student@example.com',
      '/module/module-id?tab=sources',
    );
    expect(component.sentTo()).toBe('student@example.com');
    expect(component.isSubmitting()).toBe(false);
  });

  it('shows a retryable error when the request fails', () => {
    authTokens.requestMagicLink.mockReturnValue(
      throwError(() => new Error('network error')),
    );
    component.form.controls.email.setValue('student@example.com');

    component.submit();

    expect(component.errorMessage()).toContain('Please try again');
    expect(component.isSubmitting()).toBe(false);
  });
});
