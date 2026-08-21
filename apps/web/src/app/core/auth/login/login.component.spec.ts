import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { AuthService } from '../auth.service';
import { LoginComponent } from './login.component';

describe('LoginComponent', () => {
  const auth = {
    requestMagicLink: vi.fn(),
  };
  let fixture: ComponentFixture<LoginComponent>;
  let component: LoginComponent;

  beforeEach(async () => {
    auth.requestMagicLink.mockReset();
    await TestBed.configureTestingModule({
      imports: [LoginComponent],
      providers: [{ provide: AuthService, useValue: auth }],
    }).compileComponents();

    fixture = TestBed.createComponent(LoginComponent);
    component = fixture.componentInstance;
  });

  it('requests a magic link that carries the guarded destination', () => {
    auth.requestMagicLink.mockReturnValue(of(undefined));
    component.form.controls.email.setValue('student@example.com');

    component.submit();

    expect(auth.requestMagicLink).toHaveBeenCalledWith('student@example.com');
    expect(component.sentTo()).toBe('student@example.com');
    expect(component.isSubmitting()).toBe(false);
  });

  it('shows a retryable error when the request fails', () => {
    auth.requestMagicLink.mockReturnValue(
      throwError(() => new Error('network error')),
    );
    component.form.controls.email.setValue('student@example.com');

    component.submit();

    expect(component.errorMessage()).toContain('Please try again');
    expect(component.isSubmitting()).toBe(false);
  });
});
