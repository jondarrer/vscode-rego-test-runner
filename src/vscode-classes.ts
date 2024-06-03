//
// https://stackoverflow.com/a/45983481
/* new T() */
export type Newable<T> = { new (...args: any[]): T };
