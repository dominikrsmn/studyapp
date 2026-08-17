import { HttpClient } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { environment } from '../../../environments/environment';
import { CreateModule, ModuleDto } from '@study/contracts';
import { Observable } from 'rxjs';

@Service()
export class ModulesApiService {
  private readonly http = inject(HttpClient);

  findAll(semesterId: string): Observable<ModuleDto[]> {
    return this.http.get<ModuleDto[]>(this.getUrl(semesterId));
  }

  create(semesterId: string, input: CreateModule): Observable<ModuleDto> {
    return this.http.post<ModuleDto>(this.getUrl(semesterId), input);
  }

  delete(semesterId: string, id: string): Observable<ModuleDto> {
    return this.http.delete<ModuleDto>(`${this.getUrl(semesterId)}/${id}`);
  }

  private getUrl(semesterId: String) {
    return `${environment.apiUrl}/semesters/${semesterId}/modules`;
  }
}
