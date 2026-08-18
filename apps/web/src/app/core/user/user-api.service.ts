import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { inject, Service } from '@angular/core';
import { UserDto } from '@study/contracts';

@Service()
export class UserApiService {
  private readonly http = inject(HttpClient);

  private readonly baseUrl = `${environment.apiUrl}/user/me`;

  getMe(): Observable<UserDto> {
    return this.http.get<UserDto>(this.baseUrl);
  }
}
