import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../environments/environment';

export interface Semester {
  id: string;
  startDate: string;
  endDate: string;
}

export interface StudyModule {
  id: string;
  name: string;
  description: string | null;
}

export interface Source {
  id: string;
  name: string;
  type: 'DOCUMENT' | 'IMAGE' | 'AUDIO' | 'TEXT' | 'WEB';
  mimeType: string;
  status: 'PENDING' | 'PROCESSING' | 'READY' | 'FAILED';
  moduleId: string;
}

@Injectable({ providedIn: 'root' })
export class StudyApiService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = environment.apiUrl;

  findSemesters(): Observable<Semester[]> {
    return this.http.get<Semester[]>(`${this.apiUrl}/semesters`);
  }

  createSemester(startDate: string, endDate: string): Observable<Semester> {
    return this.http.post<Semester>(`${this.apiUrl}/semesters`, {
      startDate: new Date(`${startDate}T00:00:00`).toISOString(),
      endDate: new Date(`${endDate}T00:00:00`).toISOString(),
    });
  }

  deleteSemester(semesterId: string): Observable<Semester> {
    return this.http.delete<Semester>(`${this.apiUrl}/semesters/${semesterId}`);
  }

  findModules(semesterId: string): Observable<StudyModule[]> {
    return this.http.get<StudyModule[]>(
      `${this.apiUrl}/semesters/${semesterId}/modules`,
    );
  }

  createModule(
    semesterId: string,
    name: string,
    description?: string,
  ): Observable<StudyModule> {
    return this.http.post<StudyModule>(
      `${this.apiUrl}/semesters/${semesterId}/modules`,
      { name, ...(description ? { description } : {}) },
    );
  }

  deleteModule(semesterId: string, moduleId: string): Observable<StudyModule> {
    return this.http.delete<StudyModule>(
      `${this.apiUrl}/semesters/${semesterId}/modules/${moduleId}`,
    );
  }

  findSources(moduleId: string): Observable<Source[]> {
    return this.http.get<Source[]>(
      `${this.apiUrl}/modules/${moduleId}/sources`,
    );
  }

  uploadSource(moduleId: string, file: File): Observable<Source> {
    const body = new FormData();
    body.append('file', file);
    return this.http.post<Source>(
      `${this.apiUrl}/modules/${moduleId}/sources`,
      body,
    );
  }

  deleteSource(sourceId: string): Observable<Source> {
    return this.http.delete<Source>(`${this.apiUrl}/sources/${sourceId}`);
  }
}
