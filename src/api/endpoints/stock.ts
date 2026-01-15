import { axiosInstance } from "../axios-instance";
import { config } from "../config";

export interface StockBrand {
  id: string;
  nome: string;
  slug?: string;
}

export interface StockModel {
  id: string;
  nome: string;
  marca?: string;
  slug?: string;
}

export interface StockYear {
  ano: number;
}

export interface StockColor {
  cor: string;
}

export interface StockMotor {
  motor: string;
}

export interface StockFuel {
  combustivel: string;
}

export interface StockTransmission {
  transmissao: string;
}

export interface StockPriceRange {
  min: number;
  max: number;
}

export interface StockAllData {
  enterprises: StockBrand[];
  cars: StockModel[];
  years: StockYear[];
  colors: StockColor[];
  motors: StockMotor[];
  fuels: StockFuel[];
  transmissions: StockTransmission[];
  prices: StockPriceRange[];
}

export interface ApiStockResponse<T> {
  success: boolean;
  message?: string;
  data: T;
}

/**
 * Lista todas as marcas/montadoras disponíveis
 */
export async function fetchBrands(): Promise<StockBrand[]> {
  try {
    const response = await axiosInstance.get<ApiStockResponse<StockBrand[]>>(
      `${config.apiBaseUrl}/stock.php?action=enterprises`
    );

    if (!response.data.success || !response.data.data) {
      console.warn("API retornou sem sucesso ou sem dados");
      return [];
    }

    return response.data.data;
  } catch (error) {
    console.error("Erro ao buscar marcas:", error);
    return [];
  }
}

/**
 * Lista todos os modelos disponíveis
 */
export async function fetchModels(): Promise<StockModel[]> {
  try {
    const response = await axiosInstance.get<ApiStockResponse<StockModel[]>>(
      `${config.apiBaseUrl}/stock.php?action=cars`
    );

    if (!response.data.success || !response.data.data) {
      console.warn("API retornou sem sucesso ou sem dados");
      return [];
    }

    return response.data.data;
  } catch (error) {
    console.error("Erro ao buscar modelos:", error);
    return [];
  }
}

/**
 * Lista modelos de uma marca específica
 */
export async function fetchModelsByBrand(brand: string): Promise<StockModel[]> {
  try {
    const response = await axiosInstance.get<ApiStockResponse<StockModel[]>>(
      `${config.apiBaseUrl}/stock.php?action=cars_by_brand&brand=${encodeURIComponent(brand)}`
    );

    if (!response.data.success || !response.data.data) {
      console.warn("API retornou sem sucesso ou sem dados");
      return [];
    }

    return response.data.data;
  } catch (error) {
    console.error("Erro ao buscar modelos por marca:", error);
    return [];
  }
}

/**
 * Lista todos os anos disponíveis
 */
export async function fetchYears(): Promise<StockYear[]> {
  try {
    const response = await axiosInstance.get<ApiStockResponse<StockYear[]>>(
      `${config.apiBaseUrl}/stock.php?action=years`
    );

    if (!response.data.success || !response.data.data) {
      console.warn("API retornou sem sucesso ou sem dados");
      return [];
    }

    return response.data.data;
  } catch (error) {
    console.error("Erro ao buscar anos:", error);
    return [];
  }
}

/**
 * Lista todas as cores disponíveis
 */
export async function fetchColors(): Promise<StockColor[]> {
  try {
    const response = await axiosInstance.get<ApiStockResponse<StockColor[]>>(
      `${config.apiBaseUrl}/stock.php?action=colors`
    );

    if (!response.data.success || !response.data.data) {
      console.warn("API retornou sem sucesso ou sem dados");
      return [];
    }

    return response.data.data;
  } catch (error) {
    console.error("Erro ao buscar cores:", error);
    return [];
  }
}

/**
 * Lista todas as motorizações disponíveis
 */
export async function fetchMotors(): Promise<StockMotor[]> {
  try {
    const response = await axiosInstance.get<ApiStockResponse<StockMotor[]>>(
      `${config.apiBaseUrl}/stock.php?action=motors`
    );

    if (!response.data.success || !response.data.data) {
      console.warn("API retornou sem sucesso ou sem dados");
      return [];
    }

    return response.data.data;
  } catch (error) {
    console.error("Erro ao buscar motores:", error);
    return [];
  }
}

/**
 * Lista todos os tipos de combustível disponíveis
 */
export async function fetchFuels(): Promise<StockFuel[]> {
  try {
    const response = await axiosInstance.get<ApiStockResponse<StockFuel[]>>(
      `${config.apiBaseUrl}/stock.php?action=fuels`
    );

    if (!response.data.success || !response.data.data) {
      console.warn("API retornou sem sucesso ou sem dados");
      return [];
    }

    return response.data.data;
  } catch (error) {
    console.error("Erro ao buscar combustíveis:", error);
    return [];
  }
}

/**
 * Lista todos os tipos de transmissão disponíveis
 */
export async function fetchTransmissions(): Promise<StockTransmission[]> {
  try {
    const response = await axiosInstance.get<ApiStockResponse<StockTransmission[]>>(
      `${config.apiBaseUrl}/stock.php?action=transmissions`
    );

    if (!response.data.success || !response.data.data) {
      console.warn("API retornou sem sucesso ou sem dados");
      return [];
    }

    return response.data.data;
  } catch (error) {
    console.error("Erro ao buscar transmissões:", error);
    return [];
  }
}

/**
 * Lista todas as faixas de preço disponíveis
 */
export async function fetchPriceRanges(): Promise<StockPriceRange[]> {
  try {
    const response = await axiosInstance.get<ApiStockResponse<StockPriceRange[]>>(
      `${config.apiBaseUrl}/stock.php?action=prices`
    );

    if (!response.data.success || !response.data.data) {
      console.warn("API retornou sem sucesso ou sem dados");
      return [];
    }

    return response.data.data;
  } catch (error) {
    console.error("Erro ao buscar faixas de preço:", error);
    return [];
  }
}

/**
 * Retorna todos os dados de estoque de uma vez
 */
export async function fetchAllStockData(): Promise<StockAllData> {
  try {
    const response = await axiosInstance.get<ApiStockResponse<StockAllData>>(
      `${config.apiBaseUrl}/stock.php?action=all`
    );

    if (!response.data.success || !response.data.data) {
      console.warn("API retornou sem sucesso ou sem dados");
      return {
        enterprises: [],
        cars: [],
        years: [],
        colors: [],
        motors: [],
        fuels: [],
        transmissions: [],
        prices: [],
      };
    }

    return response.data.data;
  } catch (error) {
    console.error("Erro ao buscar todos os dados de estoque:", error);
    return {
      enterprises: [],
      cars: [],
      years: [],
      colors: [],
      motors: [],
      fuels: [],
      transmissions: [],
      prices: [],
    };
  }
}

