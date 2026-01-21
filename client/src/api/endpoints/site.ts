import { axiosInstance } from "../axios-instance";
import { config } from "../config";

export interface SiteInfo {
  nome?: string;
  descricao?: string;
  logo?: string;
  [key: string]: any;
}

export interface Banner {
  id: string | number;
  titulo?: string;
  imagem: string;
  link?: string;
  tipo?: string;
  ordem?: number;
}

export interface Notification {
  id: string | number;
  titulo: string;
  mensagem: string;
  tipo?: string;
  ativo?: boolean;
  data?: string;
}

export interface SubGallery {
  id: string | number;
  titulo?: string;
  imagem: string;
  link?: string;
}

export interface PhoneInfo {
  telefone: string;
  whatsapp?: string;
  loja?: string;
}

export interface AddressInfo {
  endereco: string;
  cidade: string;
  estado: string;
  cep?: string;
  loja?: string;
}

export interface WhatsAppInfo {
  numero: string;
  mensagem?: string;
  link?: string;
}

export interface ScheduleInfo {
  dias_semana?: string;
  sabado?: string;
  domingo?: string;
  feriados?: string;
  [key: string]: any;
}

export interface AboutText {
  titulo: string;
  conteudo: string;
}

export interface Counter {
  titulo: string;
  valor: number;
  icone?: string;
}

export interface News {
  id: string | number;
  titulo: string;
  conteudo: string;
  imagem?: string;
  data?: string;
  link?: string;
}

export interface Video {
  id: string | number;
  titulo?: string;
  url: string;
  thumbnail?: string;
  local?: string;
}

export interface ApiSiteResponse<T> {
  success: boolean;
  message?: string;
  data: T;
}

/**
 * Normaliza URLs de imagens que podem vir com caminhos relativos
 */
function normalizeImageUrl(url: string): string {
  if (!url) return "";
  
  // Remove prefixos relativos como .\/ ou ./
  let normalized = url.replace(/^\.\\?\/+/, "").replace(/\\/g, "/");
  
  // Se já é uma URL completa, retorna como está
  if (normalized.startsWith("http://") || normalized.startsWith("https://")) {
    return normalized;
  }
  
  // Remove espaços e caracteres especiais do nome do arquivo
  normalized = normalized.trim();
  
  // Se começa com /, adiciona o domínio base
  if (normalized.startsWith("/")) {
    const baseDomain = config.apiBaseUrl.replace("/api/v1", "");
    return `${baseDomain}${normalized}`;
  }
  
  // Caso contrário, adiciona o caminho base completo
  const baseDomain = config.apiBaseUrl.replace("/api/v1", "");
  return `${baseDomain}/${normalized}`;
}

/**
 * Retorna informações gerais do site
 */
export async function fetchSiteInfo(): Promise<SiteInfo> {
  try {
    const response = await axiosInstance.get<ApiSiteResponse<SiteInfo>>(
      `${config.apiBaseUrl}/site.php?action=info`
    );

    if (!response.data.success || !response.data.data) {
      console.warn("API retornou sem sucesso ou sem dados");
      return {};
    }

    return response.data.data;
  } catch (error) {
    console.error("Erro ao buscar informações do site:", error);
    return {};
  }
}

/**
 * Retorna banners do site
 */
export async function fetchBanners(): Promise<Banner[]> {
  try {
    const response = await axiosInstance.get<ApiSiteResponse<Banner[]>>(
      `${config.apiBaseUrl}/site.php?action=banners`
    );

    if (!response.data.success || !response.data.data) {
      console.warn("API retornou sem sucesso ou sem dados");
      return [];
    }

    return response.data.data.map((banner) => ({
      ...banner,
      imagem: normalizeImageUrl(banner.imagem),
    }));
  } catch (error) {
    console.error("Erro ao buscar banners:", error);
    return [];
  }
}

/**
 * Retorna banners da Loja 1
 */
export async function fetchBannersLoja1(): Promise<Banner[]> {
  try {
    const response = await axiosInstance.get<ApiSiteResponse<Banner[]>>(
      `${config.apiBaseUrl}/site.php?action=loja1`
    );

    if (!response.data.success || !response.data.data) {
      console.warn("API retornou sem sucesso ou sem dados");
      return [];
    }

    return response.data.data.map((banner) => ({
      ...banner,
      imagem: normalizeImageUrl(banner.imagem),
    }));
  } catch (error) {
    console.error("Erro ao buscar banners da Loja 1:", error);
    return [];
  }
}

/**
 * Retorna banners da Loja 2
 */
export async function fetchBannersLoja2(): Promise<Banner[]> {
  try {
    const response = await axiosInstance.get<ApiSiteResponse<Banner[]>>(
      `${config.apiBaseUrl}/site.php?action=loja2`
    );

    if (!response.data.success || !response.data.data) {
      console.warn("API retornou sem sucesso ou sem dados");
      return [];
    }

    return response.data.data.map((banner) => ({
      ...banner,
      imagem: normalizeImageUrl(banner.imagem),
    }));
  } catch (error) {
    console.error("Erro ao buscar banners da Loja 2:", error);
    return [];
  }
}

/**
 * Retorna notificações do site
 */
export async function fetchNotifications(): Promise<Notification[]> {
  try {
    const response = await axiosInstance.get<ApiSiteResponse<Notification[]>>(
      `${config.apiBaseUrl}/site.php?action=notifications`
    );

    if (!response.data.success || !response.data.data) {
      console.warn("API retornou sem sucesso ou sem dados");
      return [];
    }

    return response.data.data;
  } catch (error) {
    console.error("Erro ao buscar notificações:", error);
    return [];
  }
}

/**
 * Retorna subgaleria do site
 */
export async function fetchSubGallery(): Promise<SubGallery[]> {
  try {
    const response = await axiosInstance.get<ApiSiteResponse<SubGallery[]>>(
      `${config.apiBaseUrl}/site.php?action=subgallery`
    );

    if (!response.data.success || !response.data.data) {
      console.warn("API retornou sem sucesso ou sem dados");
      return [];
    }

    return response.data.data.map((item) => ({
      ...item,
      imagem: normalizeImageUrl(item.imagem),
    }));
  } catch (error) {
    console.error("Erro ao buscar subgaleria:", error);
    return [];
  }
}

/**
 * Retorna telefone de uma loja específica
 */
export async function fetchPhone(loja: "Loja1" | "Loja2"): Promise<PhoneInfo> {
  try {
    const response = await axiosInstance.get<ApiSiteResponse<PhoneInfo>>(
      `${config.apiBaseUrl}/site.php?action=phone&loja=${loja}`
    );

    if (!response.data.success || !response.data.data) {
      console.warn("API retornou sem sucesso ou sem dados");
      return { telefone: "" };
    }

    return response.data.data;
  } catch (error) {
    console.error("Erro ao buscar telefone:", error);
    return { telefone: "" };
  }
}

/**
 * Retorna endereço de uma loja específica
 */
export async function fetchAddress(
  loja: "Loja1" | "Loja2"
): Promise<AddressInfo> {
  try {
    const response = await axiosInstance.get<ApiSiteResponse<AddressInfo>>(
      `${config.apiBaseUrl}/site.php?action=address&loja=${loja}`
    );

    if (!response.data.success || !response.data.data) {
      console.warn("API retornou sem sucesso ou sem dados");
      return { endereco: "", cidade: "", estado: "" };
    }

    return response.data.data;
  } catch (error) {
    console.error("Erro ao buscar endereço:", error);
    return { endereco: "", cidade: "", estado: "" };
  }
}

/**
 * Retorna informações do WhatsApp
 */
export async function fetchWhatsApp(): Promise<WhatsAppInfo> {
  try {
    const response = await axiosInstance.get<ApiSiteResponse<WhatsAppInfo>>(
      `${config.apiBaseUrl}/site.php?action=whatsapp`
    );

    console.log("WhatsApp API Response:", response.data);

    if (!response.data.success) {
      console.warn("API retornou sem sucesso:", response.data);
      return { numero: "" };
    }

    // Verifica se os dados existem
    if (!response.data.data) {
      console.warn("API retornou sem dados");
      return { numero: "" };
    }

    const data = response.data.data;
    
    // Aceita tanto 'numero' quanto 'whatsapp' como campo
    const numero = data.numero || (data as any).whatsapp || "";
    
    // Garante que temos pelo menos um número
    if (!numero || numero.trim() === "") {
      console.warn("WhatsApp sem número válido:", data);
      return { numero: "" };
    }

    return {
      numero,
      mensagem: data.mensagem,
      link: data.link,
    };
  } catch (error) {
    console.error("Erro ao buscar WhatsApp:", error);
    return { numero: "" };
  }
}

/**
 * Retorna horário de atendimento
 */
export async function fetchSchedule(): Promise<ScheduleInfo> {
  try {
    const response = await axiosInstance.get<ApiSiteResponse<ScheduleInfo>>(
      `${config.apiBaseUrl}/site.php?action=schedule`
    );

    if (!response.data.success || !response.data.data) {
      console.warn("API retornou sem sucesso ou sem dados");
      return {};
    }

    return response.data.data;
  } catch (error) {
    console.error("Erro ao buscar horário de atendimento:", error);
    return {};
  }
}

/**
 * Retorna texto sobre a empresa por título
 */
export async function fetchAboutText(titulo: string): Promise<AboutText> {
  try {
    const response = await axiosInstance.get<ApiSiteResponse<AboutText>>(
      `${config.apiBaseUrl}/site.php?action=about&titulo=${encodeURIComponent(titulo)}`
    );

    if (!response.data.success || !response.data.data) {
      console.warn("API retornou sem sucesso ou sem dados");
      return { titulo: "", conteudo: "" };
    }

    return response.data.data;
  } catch (error) {
    console.error("Erro ao buscar texto sobre:", error);
    return { titulo: "", conteudo: "" };
  }
}

/**
 * Retorna contadores da empresa por título
 */
export async function fetchCounters(titulo: string): Promise<Counter[]> {
  try {
    const response = await axiosInstance.get<ApiSiteResponse<Counter[]>>(
      `${config.apiBaseUrl}/site.php?action=counters&titulo=${encodeURIComponent(titulo)}`
    );

    if (!response.data.success || !response.data.data) {
      console.warn("API retornou sem sucesso ou sem dados");
      return [];
    }

    return response.data.data;
  } catch (error) {
    console.error("Erro ao buscar contadores:", error);
    return [];
  }
}

/**
 * Retorna feed de notícias
 */
export async function fetchNews(): Promise<News[]> {
  try {
    const response = await axiosInstance.get<ApiSiteResponse<News[]>>(
      `${config.apiBaseUrl}/site.php?action=news`
    );

    if (!response.data.success || !response.data.data) {
      console.warn("API retornou sem sucesso ou sem dados");
      return [];
    }

    return response.data.data.map((news) => ({
      ...news,
      imagem: news.imagem ? normalizeImageUrl(news.imagem) : undefined,
    }));
  } catch (error) {
    console.error("Erro ao buscar notícias:", error);
    return [];
  }
}

/**
 * Retorna vídeos por local
 */
export async function fetchVideos(local?: string): Promise<Video[]> {
  try {
    const params = new URLSearchParams();
    params.append("action", "videos");
    if (local) params.append("local", local);

    const response = await axiosInstance.get<ApiSiteResponse<Video[]>>(
      `${config.apiBaseUrl}/site.php?${params.toString()}`
    );

    if (!response.data.success || !response.data.data) {
      console.warn("API retornou sem sucesso ou sem dados");
      return [];
    }

    return response.data.data.map((video) => ({
      ...video,
      thumbnail: video.thumbnail ? normalizeImageUrl(video.thumbnail) : undefined,
    }));
  } catch (error) {
    console.error("Erro ao buscar vídeos:", error);
    return [];
  }
}

/**
 * Verifica se é dispositivo mobile
 */
export async function checkMobile(): Promise<boolean> {
  try {
    const response = await axiosInstance.get<ApiSiteResponse<{ is_mobile: boolean }>>(
      `${config.apiBaseUrl}/site.php?action=mobile_check`
    );

    if (!response.data.success || !response.data.data) {
      return false;
    }

    return response.data.data.is_mobile || false;
  } catch (error) {
    console.error("Erro ao verificar dispositivo mobile:", error);
    return false;
  }
}

