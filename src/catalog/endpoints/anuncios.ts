import { axiosInstance } from "../axios-instance";
import { config } from "../config";

/**
 * Interface para resposta da API de Anúncios
 */
export interface ApiAnuncioResponse {
  success: boolean;
  message: string;
  data: {
    id: string;
    marca: string;
    modelo: string;
    ano: number;
    anuncio: string; // Conteúdo do anúncio (campo GPT)
  };
  timestamp?: string;
}

/**
 * Interface para resposta de erro da API de Anúncios
 */
export interface ApiAnuncioErrorResponse {
  success: false;
  message: string;
  error_code: number;
  timestamp?: string;
}

/**
 * Busca o anúncio (campo GPT) de um veículo específico por ID
 * @param vehicleId - ID do veículo
 * @returns O conteúdo do anúncio ou null se não encontrado
 */
export async function fetchAnuncioByVehicleId(vehicleId: string | number): Promise<string | null> {
  try {
    const response = await axiosInstance.get<ApiAnuncioResponse | ApiAnuncioErrorResponse>(
      `${config.apiBaseUrl}/anuncio.php?id=${vehicleId}`
    );

    if (!response.data.success) {
      // Se retornar erro 404 ou success: false, retorna null
      return null;
    }

    const anuncioData = response.data as ApiAnuncioResponse;
    return anuncioData.data?.anuncio || null;
  } catch (error) {
    console.error("Erro ao buscar anúncio:", error);
    return null;
  }
}
