import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { environment } from '../../environments/environment';
import { HomeComponent } from './home.component';

describe('HomeComponent', () => {
  let fixture: ComponentFixture<HomeComponent>;
  let httpTesting: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HomeComponent],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    fixture = TestBed.createComponent(HomeComponent);
    httpTesting = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
  });

  afterEach(() => {
    fixture.destroy();
    httpTesting.verify();
  });

  it('prevents native navigation and requests a magic link', () => {
    fixture.componentInstance.emailControl.setValue('user@example.com');
    const form = fixture.nativeElement.querySelector('form') as HTMLFormElement;
    const submitEvent = new SubmitEvent('submit', {
      bubbles: true,
      cancelable: true,
    });

    form.dispatchEvent(submitEvent);

    expect(submitEvent.defaultPrevented).toBe(true);
    const request = httpTesting.expectOne(
      `${environment.apiUrl}/auth/magic-link`,
    );
    expect(request.request.body).toEqual({ email: 'user@example.com' });
    request.flush(null);
    expect(fixture.componentInstance.statusMessage()).toContain(
      'Magic link requested',
    );
  });
});
