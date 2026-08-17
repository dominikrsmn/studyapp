import { HttpClient } from '@angular/common/http';
import { inject, input, Service } from '@angular/core';
import { environment } from '../../../environments/environment';
import { Observable } from 'rxjs';
import { CreateSemester, SemesterDto } from '@study/contracts';

@Service()
export class SemestersApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/semesters`;

  findAll(): Observable<SemesterDto[]> {
    return this.http.get<SemesterDto[]>(this.baseUrl);
  }

  create(input: CreateSemester): Observable<SemesterDto> {
    return this.http.post<SemesterDto>(this.baseUrl, input);
  }

  delete(id: string): Observable<SemesterDto> {
    return this.http.delete<SemesterDto>(`${this.baseUrl}/${id}`);
  }
}
