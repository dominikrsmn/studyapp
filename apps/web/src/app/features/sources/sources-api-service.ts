import { HttpClient } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { environment } from '../../../environments/environment';
import { CreateSource, SourceDto } from '@study/contracts';
import { Observable } from 'rxjs';

@Service()
export class SourcesApiService {
  private readonly http = inject(HttpClient);

  findAll(moduleId: string): Observable<SourceDto[]> {
    return this.http.get<SourceDto[]>(this.getUrl(moduleId));
  }

  create(moduleId: string, input: CreateSource): Observable<SourceDto> {
    const body = new FormData();
    body.append('file', input.file);
    return this.http.post<SourceDto>(this.getUrl(moduleId), body);
  }

  delete(moduleId: string, id: string): Observable<SourceDto> {
    return this.http.delete<SourceDto>(`${this.getUrl(moduleId)}/${id}`);
  }

  private getUrl(moduleId: string) {
    return `${environment.apiUrl}/module/${moduleId}/sources`;
  }
}
