import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../../environments/environment';
import { AiApiService } from './ai-api.service';

describe('AiApiService', () => {
  let service: AiApiService;
  let httpTesting: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(AiApiService);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpTesting.verify());

  it('asks a question about a module', () => {
    let answer: string | undefined;

    service
      .ask('module-id', { question: 'Explain integration' })
      .subscribe((response) => (answer = response.answer));

    const request = httpTesting.expectOne(
      `${environment.apiUrl}/module/module-id/ai/question`,
    );
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({ question: 'Explain integration' });
    request.flush({ answer: 'Integration finds accumulated change.' });

    expect(answer).toBe('Integration finds accumulated change.');
  });
});
