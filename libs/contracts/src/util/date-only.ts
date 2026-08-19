import { z } from 'zod';

export const dateOnlySchema = z.iso.date('yyyy-MM-dd').brand<'DateOnly'>();

export type DateOnly = z.infer<typeof dateOnlySchema>;

export const dateOnly = {
  parse(value: string): DateOnly {
    return dateOnlySchema.parse(value);
  },

  toPrisma(value: DateOnly): Date {
    return new Date(`${value}T00:00:00.000Z`);
  },

  fromPrisma(value: Date): DateOnly {
    return dateOnlySchema.parse(value.toISOString().slice(0, 10));
  },
};

export function dateToDateOnly(date: Date): DateOnly {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return dateOnlySchema.parse(`${year}-${month}-${day}`);
}

export function dateOnlyToDate(date: DateOnly): Date {
  const [year, month, day] = date.split('-').map(Number);

  return new Date(year, month - 1, day);
}
