import { HttpClient } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { environment } from '../../../environments/environment';
import type { Observable } from 'rxjs';
import type { CreateSemester, SemesterDto } from '@study/contracts';

@Service()
export class SemesterApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/semester`;
  private readonly activeUrl = `${environment.apiUrl}/active-semester`;

  getActive(): Observable<SemesterDto> {
    return this.http.get<SemesterDto>(this.activeUrl);
  }

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
