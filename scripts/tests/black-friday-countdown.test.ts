import assert from "node:assert/strict";
import { test } from "node:test";
import {
  getBlackFridayCountdownSnapshot,
  parseStoreClosingTime,
  resolveBlackFridayClosingTarget,
} from "../../src/features/black-friday/countdown";

test("parseStoreClosingTime extracts closing hour and minute from Netcar schedule formats", () => {
  assert.deepEqual(parseStoreClosingTime("Seg a Sex: 9h às 18h"), { hour: 18, minute: 0 });
  assert.deepEqual(parseStoreClosingTime("Sábado: 9h às 16h30"), { hour: 16, minute: 30 });
  assert.deepEqual(parseStoreClosingTime("09:00 - 19:15"), { hour: 19, minute: 15 });
  assert.equal(parseStoreClosingTime("Fechado"), null);
  assert.equal(parseStoreClosingTime(""), null);
});

test("November 2026 ends on Monday 30/11 at weekday store closing (18h BRT)", () => {
  const target = resolveBlackFridayClosingTarget({ year: 2026, month: 11 });
  assert.equal(target.isoString, "2026-11-30T18:00:00-03:00");
  assert.equal(target.targetMs, Date.parse("2026-11-30T18:00:00-03:00"));
  assert.equal(target.weekdayShort, "segunda");
  assert.equal(target.dateLabel, "30/11");
  assert.equal(target.timeLabel, "18h");
  assert.equal(target.closingSummary, "segunda, 30/11 às 18h");
});

test("month ending on Sunday automatically falls back to Saturday closing time (16h30 BRT)", () => {
  // 30/11/2025 is a Sunday; last open day is Saturday 29/11/2025 at 16h30
  const target = resolveBlackFridayClosingTarget({ year: 2025, month: 11 });
  assert.equal(target.isoString, "2025-11-29T16:30:00-03:00");
  assert.equal(target.weekdayShort, "sábado");
  assert.equal(target.dateLabel, "29/11");
  assert.equal(target.timeLabel, "16h30");
  assert.equal(target.closingSummary, "sábado, 29/11 às 16h30");
});

test("respects dynamic store schedule from API including custom closing hours and closed days", () => {
  const extended = resolveBlackFridayClosingTarget({
    year: 2026,
    month: 11,
    schedule: { dias_semana: "Seg a Sex: 9h às 19h30", sabado: "9h às 16h30" },
  });
  assert.equal(extended.isoString, "2026-11-30T19:30:00-03:00");
  assert.equal(extended.timeLabel, "19h30");

  const satClosed = resolveBlackFridayClosingTarget({
    year: 2025,
    month: 11,
    schedule: { dias_semana: "9h às 18h", sabado: "Fechado", domingo: "Fechado" },
  });
  assert.equal(satClosed.isoString, "2025-11-28T18:00:00-03:00");
  assert.equal(satClosed.weekdayShort, "sexta");
});

test("countdown snapshot computes exact breakdown, urgency states, progress and expiry", () => {
  const target = resolveBlackFridayClosingTarget({ year: 2026, month: 11 });

  const mid = getBlackFridayCountdownSnapshot(Date.parse("2026-11-21T13:55:10-03:00"), target);
  assert.equal(mid.days, 9);
  assert.equal(mid.hours, 4);
  assert.equal(mid.minutes, 4);
  assert.equal(mid.seconds, 50);
  assert.equal(mid.daysText, "09");
  assert.equal(mid.hoursText, "04");
  assert.equal(mid.minutesText, "04");
  assert.equal(mid.secondsText, "50");
  assert.equal(mid.expired, false);
  assert.equal(mid.isLastDay, false);
  assert.equal(mid.isFinalHours, false);
  assert.ok(mid.progressPercent > 50 && mid.progressPercent < 60);

  const lastDay = getBlackFridayCountdownSnapshot(Date.parse("2026-11-30T09:00:00-03:00"), target);
  assert.equal(lastDay.days, 0);
  assert.equal(lastDay.hours, 9);
  assert.equal(lastDay.isLastDay, true);
  assert.equal(lastDay.isFinalHours, false);

  const finalHours = getBlackFridayCountdownSnapshot(Date.parse("2026-11-30T15:30:00-03:00"), target);
  assert.equal(finalHours.isLastDay, true);
  assert.equal(finalHours.isFinalHours, true);

  const expired = getBlackFridayCountdownSnapshot(Date.parse("2026-11-30T18:00:00-03:00"), target);
  assert.equal(expired.expired, true);
  assert.equal(expired.daysText, "00");
  assert.equal(expired.hoursText, "00");
  assert.equal(expired.minutesText, "00");
  assert.equal(expired.secondsText, "00");
  assert.equal(expired.progressPercent, 100);
});
