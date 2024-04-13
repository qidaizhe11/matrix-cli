export const isString = (val: unknown): val is string =>
  typeof val === 'string';

export const isObject = (obj: unknown): obj is Record<string, any> =>
  !!obj && typeof obj === 'object';
