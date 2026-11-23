import assert from "node:assert/strict";
import { test } from "node:test";
import {
  getBlackFridayCountdownSnapshot,
  resolveBlackFridayClosingTarget,
} from "../../src/features/black-friday/countdown";

test("November 2026 ends on Monday 30/11 at the fixed campaign cutoff (18h BRT)", () => {
  const target = resolveBlackFridayClosingTarget();
  assert.equal(target.isoString, "2026-11-30T18:00:00-03:00");
  assert.equal(target.targetMs, Date.parse("2026-11-30T18:00:00-03:00"));
  assert.equal(target.weekdayShort, "segunda");
  assert.equal(target.dateLabel, "30/11");
  assert.equal(target.timeLabel, "18h");
  assert.equal(target.closingSummary, "segunda, 30/11 às 18h");
});

test("countdown snapshot computes exact breakdown, urgency states, progress and expiry", () => {
  const target = resolveBlackFridayClosingTarget();

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
