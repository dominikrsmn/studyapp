import type { SemesterDto } from '@study/contracts';

export type SemesterLabelFormat = 'short' | 'long';

export function formatSemesterLabel(
  semester: Pick<SemesterDto, 'startDate' | 'endDate'>,
  format: SemesterLabelFormat = 'short',
): string {
  const startYear = new Date(semester.startDate).getFullYear();
  const endYear = new Date(semester.endDate).getFullYear();

  const isWinterSemester = startYear !== endYear;

  if (isWinterSemester) {
    if (format === 'short') {
      return `WiSe ${String(startYear).slice(-2)}/${String(endYear).slice(-2)}`;
    }

    return `Wintersemester ${startYear} / ${endYear}`;
  }

  if (format === 'short') {
    return `SoSe ${String(startYear).slice(-2)}`;
  }

  return `Sommersemester ${startYear}`;
}
