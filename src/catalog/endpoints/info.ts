import { axiosInstance } from "../axios-instance";
import { config } from "../config";

/**
 * Interface para itens da tabela info
 */
export interface InfoItem {
  id: string | number;
  titulo: string;
  conteudo: string;
  tipo: "Texto" | "Numeros" | "Telefone" | "Endereço" | "RedeSocial";
  local: "Todos" | "Empresa";
  ordem?: number;
  ativo?: boolean;
  [key: string]: any;
}

export interface ApiInfoResponse {
  success: boolean;
  message?: string;
  data: InfoItem[];
}

export interface InfoQuery {
  tipo?: "Texto" | "Numeros" | "Telefone" | "Endereço" | "RedeSocial";
  titulo?: string;
  local?: "Todos" | "Empresa";
}

/**
 * Lista todos os itens da tabela info
 */
export async function fetchInfo(query?: InfoQuery): Promise<InfoItem[]> {
  try {
    const params = new URLSearchParams();
    
    if (query?.tipo) {
      params.append("tipo", query.tipo);
    }
    
    if (query?.titulo) {
      params.append("titulo", query.titulo);
    }
    
    if (query?.local) {
      params.append("local", query.local);
    }

    const url = `${config.apiBaseUrl}/info.php${params.toString() ? `?${params.toString()}` : ""}`;
    const response = await axiosInstance.get<ApiInfoResponse>(url);

    if (!response.data.success || !response.data.data) {
      console.warn("API retornou sem sucesso ou sem dados");
      return [];
    }

    return response.data.data;
  } catch (error) {
    console.error("Erro ao buscar informações:", error);
    return [];
  }
}

/**
 * Busca informações por tipo
 */
export async function fetchInfoByType(tipo: InfoQuery["tipo"]): Promise<InfoItem[]> {
  return fetchInfo({ tipo });
}

/**
 * Busca informações por título
 */
export async function fetchInfoByTitle(titulo: string): Promise<InfoItem[]> {
  return fetchInfo({ titulo });
}

/**
 * Busca informações por local
 */
export async function fetchInfoByLocal(local: InfoQuery["local"]): Promise<InfoItem[]> {
  return fetchInfo({ local });
}

/**
 * Busca informações combinando múltiplos filtros
 */
export async function fetchInfoCombined(query: InfoQuery): Promise<InfoItem[]> {
  return fetchInfo(query);
}

