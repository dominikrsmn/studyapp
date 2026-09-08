import { AsyncLocalStorage } from 'node:async_hooks';

export const jobCostContext = new AsyncLocalStorage<string>();
