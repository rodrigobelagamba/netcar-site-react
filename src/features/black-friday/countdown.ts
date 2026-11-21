import { BLACK_FRIDAY_START } from "./campaign";

export const BRAZIL_UTC_OFFSET_HOURS = -3;
const BRAZIL_UTC_OFFSET_MS = BRAZIL_UTC_OFFSET_HOURS * 60 * 60 * 1000;

export interface StoreScheduleInput {
  dias_semana?: string | null;
  sabado?: string | null;
  domingo?: string | null;
}

export interface StoreClosingTime {
  hour: number;
  minute: number;
}

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

const DEFAULT_WEEKDAY_CLOSING: StoreClosingTime = { hour: 18, minute: 0 };
const DEFAULT_SATURDAY_CLOSING: StoreClosingTime = { hour: 16, minute: 30 };

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

/**
 * Extrai o horário de fechamento de textos como:
 * "Seg a Sex: 9h às 18h", "9h às 16h30", "09:00 - 18:00" ou "Fechado".
 */
export function parseStoreClosingTime(raw?: string | null): StoreClosingTime | null {
  if (!raw || typeof raw !== "string") return null;
  const normalized = raw.trim().toLowerCase();
  if (!normalized || normalized.includes("fechado") || normalized.includes("sem expediente")) {
    return null;
  }

  const timeMatches = [...normalized.matchAll(/(\d{1,2})\s*(?:h|:)\s*(\d{2})?/g)];
  if (timeMatches.length === 0) return null;

  const lastMatch = timeMatches[timeMatches.length - 1];
  const hour = Number(lastMatch[1]);
  const minute = lastMatch[2] ? Number(lastMatch[2]) : 0;

  if (!Number.isInteger(hour) || hour < 0 || hour > 23) return null;
  if (!Number.isInteger(minute) || minute < 0 || minute > 59) return null;

  return { hour, minute };
}

export function formatClosingTimeLabel({ hour, minute }: StoreClosingTime): string {
  return minute > 0 ? `${hour}h${pad2(minute)}` : `${hour}h`;
}

function getClosingTimeForWeekday(
  dayOfWeek: number,
  schedule?: StoreScheduleInput | null,
): StoreClosingTime | null {
  if (dayOfWeek === 0) {
    return schedule?.domingo ? parseStoreClosingTime(schedule.domingo) : null;
  }
  if (dayOfWeek === 6) {
    if (schedule?.sabado !== undefined && schedule?.sabado !== null && schedule.sabado.trim() !== "") {
      return parseStoreClosingTime(schedule.sabado);
    }
    return DEFAULT_SATURDAY_CLOSING;
  }
  if (schedule?.dias_semana !== undefined && schedule?.dias_semana !== null && schedule.dias_semana.trim() !== "") {
    return parseStoreClosingTime(schedule.dias_semana) ?? DEFAULT_WEEKDAY_CLOSING;
  }
  return DEFAULT_WEEKDAY_CLOSING;
}

/**
 * Calcula o encerramento da Black Friday no último dia aberto do mês
 * (novembro/2026 por padrão), contando até o horário de fechamento da loja em UTC-3.
 */
export function resolveBlackFridayClosingTarget(options?: {
  year?: number;
  month?: number;
  schedule?: StoreScheduleInput | null;
}): BlackFridayClosingTarget {
  const year = options?.year ?? 2026;
  const month = options?.month ?? 11;
  const schedule = options?.schedule;
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();

  let selectedDay = daysInMonth;
  let selectedDayOfWeek = new Date(Date.UTC(year, month - 1, daysInMonth)).getUTCDay();
  let closingTime: StoreClosingTime = DEFAULT_WEEKDAY_CLOSING;

  for (let day = daysInMonth; day >= 1; day -= 1) {
    const dayOfWeek = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
    const candidate = getClosingTimeForWeekday(dayOfWeek, schedule);
    if (candidate) {
      selectedDay = day;
      selectedDayOfWeek = dayOfWeek;
      closingTime = candidate;
      break;
    }
  }

  const isoString = `${year}-${pad2(month)}-${pad2(selectedDay)}T${pad2(closingTime.hour)}:${pad2(closingTime.minute)}:00-03:00`;
  const targetMs =
    Date.UTC(year, month - 1, selectedDay, closingTime.hour, closingTime.minute, 0, 0) -
    BRAZIL_UTC_OFFSET_MS;

  const weekdayLabel = WEEKDAY_LABELS[selectedDayOfWeek];
  const weekdayShort = WEEKDAY_SHORTS[selectedDayOfWeek];
  const dateLabel = `${pad2(selectedDay)}/${pad2(month)}`;
  const fullDateLabel = `${dateLabel}/${year}`;
  const timeLabel = formatClosingTimeLabel(closingTime);

  return {
    targetMs,
    isoString,
    year,
    month,
    day: selectedDay,
    dayOfWeek: selectedDayOfWeek,
    weekdayLabel,
    weekdayShort,
    dateLabel,
    fullDateLabel,
    timeLabel,
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
