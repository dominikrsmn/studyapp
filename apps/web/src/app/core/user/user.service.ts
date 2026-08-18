import { computed, effect, inject, Injectable, Signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { UserApiService } from './user-api.service';
import { tap } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class UserService {
  private readonly userApi = inject(UserApiService);

  readonly user = toSignal(
    this.userApi.getMe()
  );

  readonly activeSemesterId = computed(
    () => this.user()?.activeSemesterId ?? null,
  );

  readonly name = computed(() => {
    const user = this.user();

    if (!user) {
      return "Unknown User";
    }

    return user.name ?? user.email;
  });

}
