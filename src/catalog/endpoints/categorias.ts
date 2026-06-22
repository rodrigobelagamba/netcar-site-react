import { axiosInstance } from "../axios-instance";
import { config } from "../config";

export interface ApiCategoriaResponse {
  success: boolean;
  message: string;
  data: string[]; // Lista de categorias únicas
  total_results: number;
  timestamp?: string;
}

/**
 * Lista todas as categorias de veículos disponíveis
 * Retorna apenas categorias de veículos com valor diferente de zero
 * As categorias são ordenadas alfabeticamente
 */
export async function fetchCategorias(): Promise<string[]> {
  try {
    const response = await axiosInstance.get<ApiCategoriaResponse>(
      `${config.apiBaseUrl}/categorias.php`
    );

    if (!response.data.success || !response.data.data) {
      console.warn("API retornou sem sucesso ou sem dados");
      return [];
    }

    return response.data.data;
  } catch (error) {
    console.error("Erro ao buscar categorias:", error);
    return [];
  }
}
