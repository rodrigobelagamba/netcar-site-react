export const SEPTEMBER_CAMPAIGN = {
  id: "acelerou-levou-2026-09",
  name: "Acelerou, Levou",
  startsAt: Date.UTC(2026, 8, 1, 3, 0, 0),
  endsAt: Date.UTC(2026, 9, 1, 3, 0, 0),
  endDateLabel: "30 de setembro, às 23h59",
  assets: {
    banner: "/images/campaigns/acelerou-levou/banner.jpg",
    logo: "/images/campaigns/acelerou-levou/logo.png",
    video: "/images/campaigns/acelerou-levou/campanha.mp4",
    videoPoster: "/images/campaigns/acelerou-levou/video-poster.jpg",
  },
} as const;

export type SeptemberCampaignPhase = "upcoming" | "active" | "ended";

export type CampaignCountdown = {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  totalMilliseconds: number;
};

export function getSeptemberCampaignPhase(
  now = Date.now(),
): SeptemberCampaignPhase {
  if (now < SEPTEMBER_CAMPAIGN.startsAt) return "upcoming";
  if (now >= SEPTEMBER_CAMPAIGN.endsAt) return "ended";
  return "active";
}

export function isSeptemberCampaignActive(now = Date.now()): boolean {
  return getSeptemberCampaignPhase(now) === "active";
}

export function getSeptemberCampaignCountdown(
  now = Date.now(),
): CampaignCountdown {
  const totalMilliseconds = Math.max(0, SEPTEMBER_CAMPAIGN.endsAt - now);
  const totalSeconds = Math.ceil(totalMilliseconds / 1000);

  return {
    days: Math.floor(totalSeconds / 86_400),
    hours: Math.floor((totalSeconds % 86_400) / 3_600),
    minutes: Math.floor((totalSeconds % 3_600) / 60),
    seconds: totalSeconds % 60,
    totalMilliseconds,
  };
}

export function campaignCountdownLabel(countdown: CampaignCountdown): string {
  return `${countdown.days} dias, ${countdown.hours} horas, ${countdown.minutes} minutos e ${countdown.seconds} segundos`;
}
