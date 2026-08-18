import { inject, Service, Signal } from '@angular/core';
import { SemesterApiService } from './semester-api.service';
import { toSignal } from '@angular/core/rxjs-interop';
import { SemesterDto } from '@study/contracts';

@Service()
export class SemesterService {
  readonly semesterApiService = inject(SemesterApiService);

  readonly activeSemester: Signal<SemesterDto | undefined> = toSignal(this.semesterApiService.getActive())

}
