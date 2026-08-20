import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../../environments/environment';
import { SemanticSearchApiService } from './semantic-search-api.service';

describe('SemanticSearchApiService', () => {
  let service: SemanticSearchApiService;
  let httpTesting: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(SemanticSearchApiService);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpTesting.verify());

  it('searches within a module', () => {
    const results = [{ content: 'Relevant notes' }];
    let actual: typeof results | undefined;

    service
      .search('module-id', { query: 'exam topics' })
      .subscribe((response) => (actual = response));

    const request = httpTesting.expectOne(
      `${environment.apiUrl}/module/module-id/search`,
    );
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({ query: 'exam topics' });
    request.flush(results);

    expect(actual).toEqual(results);
  });
});
