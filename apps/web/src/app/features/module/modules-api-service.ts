import { HttpClient } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { environment } from '../../../environments/environment';
import { CreateModule, ModuleDto, UpdateModule } from '@study/contracts';
import { Observable } from 'rxjs';

@Service()
export class ModulesApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/modules`;

  findAll(): Observable<ModuleDto[]> {
    return this.http.get<ModuleDto[]>(this.baseUrl);
  }

  findOne(id: string): Observable<ModuleDto> {
    return this.http.get<ModuleDto>(`${this.baseUrl}/${id}`);
  }

  update(id: string, input: UpdateModule): Observable<ModuleDto> {
    return this.http.patch<ModuleDto>(`${this.baseUrl}/${id}`, input);
  }

  create(input: CreateModule): Observable<ModuleDto> {
    return this.http.post<ModuleDto>(this.baseUrl, input);
  }

  delete(id: string): Observable<ModuleDto> {
    return this.http.delete<ModuleDto>(`${this.baseUrl}/${id}`);
  }
}

