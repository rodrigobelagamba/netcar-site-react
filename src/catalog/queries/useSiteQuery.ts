import { useQuery } from "@tanstack/react-query";
import {
  fetchSiteInfo,
  fetchBanners,
  fetchBannersLoja1,
  fetchBannersLoja2,
  fetchNotifications,
  fetchSubGallery,
  fetchPhone,
  fetchAddress,
  fetchWhatsApp,
  fetchSchedule,
  fetchAboutText,
  fetchCounters,
  fetchNews,
  fetchVideos,
  checkMobile,
} from "../endpoints/site";

/**
 * Hook para buscar informações gerais do site
 */
export function useSiteInfoQuery() {
  return useQuery({
    queryKey: ["site", "info"],
    queryFn: () => fetchSiteInfo(),
    staleTime: 1000 * 60 * 30, // 30 minutos
  });
}

/**
 * Hook para buscar banners do site
 */
export function useBannersQuery() {
  return useQuery({
    queryKey: ["site", "banners"],
    queryFn: () => fetchBanners(),
    staleTime: 1000 * 60 * 30, // 30 minutos
  });
}

/**
 * Hook para buscar banners da Loja 1
 */
export function useBannersLoja1Query() {
  return useQuery({
    queryKey: ["site", "banners", "loja1"],
    queryFn: () => fetchBannersLoja1(),
    staleTime: 1000 * 60 * 30, // 30 minutos
  });
}

/**
 * Hook para buscar banners da Loja 2
 */
export function useBannersLoja2Query() {
  return useQuery({
    queryKey: ["site", "banners", "loja2"],
    queryFn: () => fetchBannersLoja2(),
    staleTime: 1000 * 60 * 30, // 30 minutos
  });
}

/**
 * Hook para buscar notificações do site
 */
export function useNotificationsQuery() {
  return useQuery({
    queryKey: ["site", "notifications"],
    queryFn: () => fetchNotifications(),
    staleTime: 1000 * 60 * 10, // 10 minutos
  });
}

/**
 * Hook para buscar subgaleria do site
 */
export function useSubGalleryQuery() {
  return useQuery({
    queryKey: ["site", "subgallery"],
    queryFn: () => fetchSubGallery(),
    staleTime: 1000 * 60 * 30, // 30 minutos
  });
}

/**
 * Hook para buscar telefone de uma loja
 */
export function usePhoneQuery(loja: "Loja1" | "Loja2") {
  return useQuery({
    queryKey: ["site", "phone", loja],
    queryFn: () => fetchPhone(loja),
    enabled: !!loja,
    staleTime: 1000 * 60 * 60, // 1 hora
  });
}

/**
 * Hook para buscar endereço de uma loja
 */
export function useAddressQuery(loja: "Loja1" | "Loja2") {
  return useQuery({
    queryKey: ["site", "address", loja],
    queryFn: () => fetchAddress(loja),
    enabled: !!loja,
    staleTime: 1000 * 60 * 60, // 1 hora
  });
}

/**
 * Hook para buscar informações do WhatsApp
 */
export function useWhatsAppQuery() {
  return useQuery({
    queryKey: ["site", "whatsapp"],
    queryFn: () => fetchWhatsApp(),
    staleTime: 1000 * 60 * 60, // 1 hora
  });
}

/**
 * Hook para buscar horário de atendimento
 */
export function useScheduleQuery() {
  return useQuery({
    queryKey: ["site", "schedule"],
    queryFn: () => fetchSchedule(),
    staleTime: 1000 * 60 * 60, // 1 hora
  });
}

/**
 * Hook para buscar texto sobre a empresa
 */
export function useAboutTextQuery(titulo: string) {
  return useQuery({
    queryKey: ["site", "about", titulo],
    queryFn: () => fetchAboutText(titulo),
    enabled: !!titulo,
    staleTime: 1000 * 60 * 60, // 1 hora
  });
}

/**
 * Hook para buscar contadores da empresa
 */
export function useCountersQuery(titulo: string) {
  return useQuery({
    queryKey: ["site", "counters", titulo],
    queryFn: () => fetchCounters(titulo),
    enabled: !!titulo,
    staleTime: 1000 * 60 * 60, // 1 hora
  });
}

/**
 * Hook para buscar feed de notícias
 */
export function useNewsQuery() {
  return useQuery({
    queryKey: ["site", "news"],
    queryFn: () => fetchNews(),
    staleTime: 1000 * 60 * 15, // 15 minutos
  });
}

/**
 * Hook para buscar vídeos
 */
export function useVideosQuery(local?: string) {
  return useQuery({
    queryKey: ["site", "videos", local],
    queryFn: () => fetchVideos(local),
    staleTime: 1000 * 60 * 30, // 30 minutos
  });
}

/**
 * Hook para verificar se é dispositivo mobile
 */
export function useMobileCheckQuery() {
  return useQuery({
    queryKey: ["site", "mobileCheck"],
    queryFn: () => checkMobile(),
    staleTime: Infinity, // Não muda durante a sessão
  });
}

