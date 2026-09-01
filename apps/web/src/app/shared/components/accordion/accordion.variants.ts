import { cva, type VariantProps } from 'class-variance-authority';

export const accordionItemVariants = cva(
  'flex flex-1 flex-col border-b last:border-b-0',
);

export const accordionTriggerVariants = cva(
  'group flex w-full flex-1 cursor-pointer items-start justify-between gap-4 rounded-md py-2.5 text-left text-sm font-medium outline-none transition-all hover:underline focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50',
);

export const accordionContentVariants = cva('grid text-sm transition-all', {
  variants: {
    isOpen: {
      true: 'grid-rows-[1fr]',
      false: 'grid-rows-[0fr]',
    },
  },
  defaultVariants: {
    isOpen: false,
  },
});

export type ZardAccordionItemVariants = VariantProps<
  typeof accordionItemVariants
>;
export type ZardAccordionTriggerVariants = VariantProps<
  typeof accordionTriggerVariants
>;
export type ZardAccordionContentVariants = VariantProps<
  typeof accordionContentVariants
>;
