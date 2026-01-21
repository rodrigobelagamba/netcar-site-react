import { axiosInstance } from "../axios-instance";
import { config } from "../config";

export interface Depoimento {
  id: string | number;
  nome: string;
  texto: string;
  imagem?: string;
  cargo?: string;
  empresa?: string;
  avaliacao?: number;
  data?: string;
}

export interface DepoimentoGallery {
  id: string | number;
  imagem: string;
  nome?: string;
  texto?: string;
}

export interface ApiDepoimentosListResponse {
  success: boolean;
  message?: string;
  data: Depoimento[];
  total_results?: number;
  limit?: number;
  offset?: number;
}

export interface ApiDepoimentoSingleResponse {
  success: boolean;
  message?: string;
  data: Depoimento;
}

export interface ApiDepoimentosGalleryResponse {
  success: boolean;
  message?: string;
  data: DepoimentoGallery[];
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
 * Lista todos os depoimentos com paginação
 */
export async function fetchDepoimentos(
  limit?: number,
  offset?: number
): Promise<Depoimento[]> {
  try {
    const params = new URLSearchParams();
    params.append("action", "list");
    if (limit) params.append("limit", limit.toString());
    if (offset) params.append("offset", offset.toString());

    const response = await axiosInstance.get<ApiDepoimentosListResponse>(
      `${config.apiBaseUrl}/depoimentos.php?${params.toString()}`
    );

    if (!response.data.success || !response.data.data) {
      console.warn("API retornou sem sucesso ou sem dados");
      return [];
    }

    return response.data.data.map((depoimento) => ({
      ...depoimento,
      imagem: depoimento.imagem ? normalizeImageUrl(depoimento.imagem) : undefined,
    }));
  } catch (error) {
    console.error("Erro ao buscar depoimentos:", error);
    return [];
  }
}

/**
 * Busca um depoimento específico por ID
 */
export async function fetchDepoimentoById(
  id: string | number
): Promise<Depoimento> {
  try {
    const response = await axiosInstance.get<ApiDepoimentoSingleResponse>(
      `${config.apiBaseUrl}/depoimentos.php?action=single&id=${id}`
    );

    if (!response.data.success || !response.data.data) {
      throw new Error("Depoimento não encontrado");
    }

    return {
      ...response.data.data,
      imagem: response.data.data.imagem
        ? normalizeImageUrl(response.data.data.imagem)
        : undefined,
    };
  } catch (error) {
    console.error("Erro ao buscar depoimento por ID:", error);
    throw error;
  }
}

/**
 * Retorna galeria de depoimentos
 */
export async function fetchDepoimentosGallery(): Promise<DepoimentoGallery[]> {
  try {
    const response = await axiosInstance.get<ApiDepoimentosGalleryResponse>(
      `${config.apiBaseUrl}/depoimentos.php?action=gallery`
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
    console.error("Erro ao buscar galeria de depoimentos:", error);
    return [];
  }
}

/**
 * Lista depoimentos com links de imagens
 */
export async function fetchDepoimentosWithImages(): Promise<Depoimento[]> {
  try {
    const response = await axiosInstance.get<ApiDepoimentosListResponse>(
      `${config.apiBaseUrl}/depoimentos.php?action=list_with_images`
    );

    if (!response.data.success || !response.data.data) {
      console.warn("API retornou sem sucesso ou sem dados");
      return [];
    }

    return response.data.data.map((depoimento) => ({
      ...depoimento,
      imagem: depoimento.imagem ? normalizeImageUrl(depoimento.imagem) : undefined,
    }));
  } catch (error) {
    console.error("Erro ao buscar depoimentos com imagens:", error);
    return [];
  }
}

/**
 * Método alternativo para listar depoimentos
 */
export async function fetchDepoimentosAlt(): Promise<Depoimento[]> {
  try {
    const response = await axiosInstance.get<ApiDepoimentosListResponse>(
      `${config.apiBaseUrl}/depoimentos.php?action=depoiments`
    );

    if (!response.data.success || !response.data.data) {
      console.warn("API retornou sem sucesso ou sem dados");
      return [];
    }

    return response.data.data.map((depoimento) => ({
      ...depoimento,
      imagem: depoimento.imagem ? normalizeImageUrl(depoimento.imagem) : undefined,
    }));
  } catch (error) {
    console.error("Erro ao buscar depoimentos (método alternativo):", error);
    return [];
  }
}

