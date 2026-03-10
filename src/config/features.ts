const envFlag = import.meta.env.VITE_SHOW_CAMPAIGN_STAMP;

export const SHOW_CAMPAIGN_STAMP =
  envFlag === undefined ? true : envFlag.toLowerCase() === "true";

