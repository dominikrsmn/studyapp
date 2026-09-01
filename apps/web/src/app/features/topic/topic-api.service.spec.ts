import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import type { TopicOverviewDto } from '@study/contracts';
import { environment } from '../../../environments/environment';
import { TopicApiService } from './topic-api.service';

describe('TopicApiService', () => {
  let service: TopicApiService;
  let httpTesting: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(TopicApiService);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpTesting.verify());

  it('loads the topic overview for a module', () => {
    const moduleId = 'f74a46b6-2d6d-4542-a9b8-37a8eef82d8c';
    const topics: TopicOverviewDto[] = [];
    let result: TopicOverviewDto[] | undefined;

    service.findAll(moduleId).subscribe((value) => (result = value));

    const request = httpTesting.expectOne(
      `${environment.apiUrl}/module/${moduleId}/topic`,
    );
    expect(request.request.method).toBe('GET');
    request.flush(topics);

    expect(result).toEqual(topics);
  });
});
