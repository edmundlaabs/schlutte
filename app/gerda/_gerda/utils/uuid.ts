/** Ersatz für das Paket "uuid" (v4). */
export const v4 = (): string => crypto.randomUUID();
