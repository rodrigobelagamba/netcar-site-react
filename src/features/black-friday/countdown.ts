import { BLACK_FRIDAY_END, BLACK_FRIDAY_START } from "./campaign";

export const BRAZIL_UTC_OFFSET_HOURS = -3;
const BRAZIL_UTC_OFFSET_MS = BRAZIL_UTC_OFFSET_HOURS * 60 * 60 * 1000;

export interface BlackFridayClosingTarget {
  targetMs: number;
  isoString: string;
  year: number;
  month: number;
  day: number;
  dayOfWeek: number;
  weekdayLabel: string;
  weekdayShort: string;
  dateLabel: string;
  fullDateLabel: string;
  timeLabel: string;
  closingSummary: string;
}

export interface BlackFridayCountdownSnapshot {
  totalSeconds: number;
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  daysText: string;
  hoursText: string;
  minutesText: string;
  secondsText: string;
  expired: boolean;
  isLastDay: boolean;
  isFinalHours: boolean;
  progressPercent: number;
  accessibleSummary: string;
}

const WEEKDAY_LABELS = [
  "domingo",
  "segunda-feira",
  "terça-feira",
  "quarta-feira",
  "quinta-feira",
  "sexta-feira",
  "sábado",
] as const;

const WEEKDAY_SHORTS = [
  "domingo",
  "segunda",
  "terça",
  "quarta",
  "quinta",
  "sexta",
  "sábado",
] as const;

function pad2(value: number): string {
  return String(Math.max(0, Math.floor(value))).padStart(2, "0");
}

/** Usa o mesmo limite comercial do PHP e do predicado de campanha. */
export function resolveBlackFridayClosingTarget(): BlackFridayClosingTarget {
  const targetMs = Date.parse(BLACK_FRIDAY_END);
  const local = new Date(targetMs + BRAZIL_UTC_OFFSET_MS);
  const year = local.getUTCFullYear();
  const month = local.getUTCMonth() + 1;
  const day = local.getUTCDate();
  const dayOfWeek = local.getUTCDay();
  const hour = local.getUTCHours();
  const minute = local.getUTCMinutes();
  const weekdayLabel = WEEKDAY_LABELS[dayOfWeek];
  const weekdayShort = WEEKDAY_SHORTS[dayOfWeek];
  const dateLabel = `${pad2(day)}/${pad2(month)}`;
  const fullDateLabel = `${dateLabel}/${year}`;
  const timeLabel = minute ? `${hour}h${pad2(minute)}` : `${hour}h`;

  return {
    targetMs, isoString: BLACK_FRIDAY_END, year, month, day, dayOfWeek,
    weekdayLabel, weekdayShort, dateLabel, fullDateLabel, timeLabel,
    closingSummary: `${weekdayShort}, ${dateLabel} às ${timeLabel}`,
  };
}

export function getBlackFridayCountdownSnapshot(
  nowMs: number,
  target: BlackFridayClosingTarget,
  startMs = Date.parse(BLACK_FRIDAY_START),
): BlackFridayCountdownSnapshot {
  const safeNow = Number.isFinite(nowMs) ? nowMs : Date.now();
  const remainingMs = Math.max(0, target.targetMs - safeNow);
  const expired = remainingMs <= 0;
  const totalSeconds = Math.floor(remainingMs / 1000);

  const days = Math.floor(totalSeconds / 86_400);
  const hours = Math.floor((totalSeconds % 86_400) / 3_600);
  const minutes = Math.floor((totalSeconds % 3_600) / 60);
  const seconds = totalSeconds % 60;

  const spanMs = Math.max(1, target.targetMs - startMs);
  const elapsedMs = Math.min(spanMs, Math.max(0, safeNow - startMs));
  const progressPercent = Math.round((elapsedMs / spanMs) * 1000) / 10;

  const isLastDay = !expired && totalSeconds < 86_400;
  const isFinalHours = !expired && totalSeconds < 6 * 3_600;

  const accessibleSummary = expired
    ? `A Black Friday Netcar encerrou em ${target.closingSummary}.`
    : `Faltam ${days} ${days === 1 ? "dia" : "dias"}, ${hours} ${hours === 1 ? "hora" : "horas"} e ${minutes} ${minutes === 1 ? "minuto" : "minutos"} para o encerramento da Black Friday Netcar em ${target.closingSummary}.`;

  return {
    totalSeconds,
    days,
    hours,
    minutes,
    seconds,
    daysText: pad2(days),
    hoursText: pad2(hours),
    minutesText: pad2(minutes),
    secondsText: pad2(seconds),
    expired,
    isLastDay,
    isFinalHours,
    progressPercent,
    accessibleSummary,
  };
}
