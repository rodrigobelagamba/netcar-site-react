import assert from "node:assert/strict";
import {
  getSeptemberCampaignCountdown,
  getSeptemberCampaignPhase,
  isSeptemberCampaignActive,
  SEPTEMBER_CAMPAIGN,
} from "../src/features/september-campaign/campaign";

const { startsAt, endsAt } = SEPTEMBER_CAMPAIGN;

assert.equal(getSeptemberCampaignPhase(startsAt - 1), "upcoming");
assert.equal(getSeptemberCampaignPhase(startsAt), "active");
assert.equal(isSeptemberCampaignActive(endsAt - 1), true);
assert.equal(getSeptemberCampaignPhase(endsAt), "ended");
assert.equal(isSeptemberCampaignActive(endsAt), false);

assert.deepEqual(getSeptemberCampaignCountdown(endsAt - 1), {
  days: 0,
  hours: 0,
  minutes: 0,
  seconds: 1,
  totalMilliseconds: 1,
});
assert.equal(
  getSeptemberCampaignCountdown(startsAt).totalMilliseconds,
  30 * 24 * 60 * 60 * 1000,
);

console.log(
  "Campanha Acelerou, Levou validada: ativa durante setembro e encerrada em 01/10 às 00h (Brasília).",
);
