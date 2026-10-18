export const READING_NUMBERS = [1, 2, 3] as const;
export type Reading = (typeof READING_NUMBERS)[number];
