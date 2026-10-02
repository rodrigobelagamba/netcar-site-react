export const HOME_HERO_LIMIT: number;
export function isHomeHeroCandidate(vehicle: unknown): boolean;
export function homeHeroRotationDay(date?: Date): number;
export function selectHomeHeroVehicles<T>(
  vehicles: T[],
  options?: { day?: number; preferredId?: string },
): T[];
