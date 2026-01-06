import { axiosInstance } from "../axios-instance";

export interface Vehicle {
  id: string;
  name: string;
  slug: string;
  price: number;
  year: number;
  km: number;
  images: string[]; // Thumbnails (para cards e miniaturas)
  fullImages?: string[]; // Imagens em alta resolução (para galeria)
  marca?: string;
  modelo?: string;
  // Campos adicionais da API
  cor?: string;
  motor?: string;
  combustivel?: string;
  cambio?: string;
  potencia?: string;
  placa?: string;
  portas?: number;
  lugares?: number;
  valor_formatado?: string;
  opcionais?: Array<{ descricao: string }>;
  fotos?: string[]; // Deprecated - usar fullImages ao invés
}

export interface ApiVehicleResponse {
  success: boolean;
  message: string;
  data: Array<{
    id: string;
    marca: string;
    modelo: string;
    ano: number;
    valor: number;
    valor_formatado: string;
    preco_com_troca: number;
    preco_com_troca_formatado: string;
    tem_desconto: number;
    valor_sem_desconto: number | null;
    cor: string;
    motor: string;
    combustivel: string;
    cambio: string;
    potencia: string;
    km: number;
    placa: string;
    chassi: string | null;
    renavam: string | null;
    portas: number;
    lugares: number;
    direcao: string | null;
    ar_condicionado: string | null;
    vidros_eletricos: string | null;
    travas_eletricas: string | null;
    airbag: string | null;
    abs: string | null;
    alarme: string | null;
    som: string | null;
    rodas: string | null;
    pneus: string | null;
    freios: string | null;
    suspensao: string | null;
    motor_status: string | null;
    cambio_status: string | null;
    pintura_status: string | null;
    lataria_status: string | null;
    interior_status: string | null;
    pneus_status: string | null;
    documentacao: string | null;
    observacoes: string | null;
    link: string;
    have_galery: number;
    opcionais: Array<{
      tag: string;
      descricao: string;
    }>;
    imagens: {
      thumb: string[];
      full: string[];
    };
    data_cadastro: string | null;
    data_atualizacao: string | null;
    status: string | null;
    destaque: number;
    promocao: number;
  }>;
  total_results: number;
}

export interface VehiclesQuery {
  marca?: string;
  modelo?: string;
  precoMin?: string;
  precoMax?: string;
  anoMin?: string;
  anoMax?: string;
}

const mockVehicles: Vehicle[] = [
  {
    id: "1",
    name: "Honda Civic 2023",
    slug: "honda-civic-2023",
    price: 125000,
    year: 2023,
    km: 15000,
    images: [
      "https://via.placeholder.com/800x600/6cc4ca/ffffff?text=Honda+Civic+1",
      "https://via.placeholder.com/800x600/6cc4ca/ffffff?text=Honda+Civic+2",
    ],
    marca: "Honda",
    modelo: "Civic",
  },
  {
    id: "2",
    name: "Toyota Corolla 2022",
    slug: "toyota-corolla-2022",
    price: 110000,
    year: 2022,
    km: 25000,
    images: [
      "https://via.placeholder.com/800x600/6cc4ca/ffffff?text=Toyota+Corolla+1",
    ],
    marca: "Toyota",
    modelo: "Corolla",
  },
  {
    id: "3",
    name: "Volkswagen Golf 2021",
    slug: "volkswagen-golf-2021",
    price: 95000,
    year: 2021,
    km: 35000,
    images: [
      "https://via.placeholder.com/800x600/6cc4ca/ffffff?text=Golf+1",
      "https://via.placeholder.com/800x600/6cc4ca/ffffff?text=Golf+2",
    ],
    marca: "Volkswagen",
    modelo: "Golf",
  },
];

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
    return `https://www.netcarmultimarcas.com.br${normalized}`;
  }
  
  // Caso contrário, adiciona o caminho base completo
  return `https://www.netcarmultimarcas.com.br/${normalized}`;
}

export async function fetchVehicles(query?: VehiclesQuery): Promise<Vehicle[]> {
  try {
    const response = await axiosInstance.get<ApiVehicleResponse>(
      "https://www.netcarmultimarcas.com.br/api/v1/veiculos"
    );

    if (!response.data.success || !response.data.data) {
      console.warn("API retornou sem sucesso ou sem dados");
      return [];
    }

    // Mapeia os dados da API para a interface Vehicle
    let vehicles: Vehicle[] = response.data.data.map((apiVehicle) => {
      // Normaliza as URLs das imagens thumbnails (para cards)
      const thumbUrls = apiVehicle.imagens?.thumb?.length 
        ? apiVehicle.imagens.thumb 
        : apiVehicle.imagens?.full?.length 
        ? apiVehicle.imagens.full 
        : [];
      const normalizedThumbs = thumbUrls.map(normalizeImageUrl);
      
      // Normaliza as URLs das imagens em alta resolução (para galeria)
      const fullUrls = apiVehicle.imagens?.full?.length 
        ? apiVehicle.imagens.full 
        : apiVehicle.imagens?.thumb?.length 
        ? apiVehicle.imagens.thumb 
        : [];
      const normalizedFullImages = fullUrls.map(normalizeImageUrl);

      return {
        id: apiVehicle.id,
        name: `${apiVehicle.marca} ${apiVehicle.modelo}`,
        slug: apiVehicle.link || apiVehicle.id,
        price: apiVehicle.valor || 0,
        year: apiVehicle.ano,
        km: apiVehicle.km,
        images: normalizedThumbs, // Thumbnails para cards
        fullImages: normalizedFullImages, // Imagens em alta resolução para galeria
        marca: apiVehicle.marca,
        modelo: apiVehicle.modelo,
        cor: apiVehicle.cor,
        motor: apiVehicle.motor,
        combustivel: apiVehicle.combustivel,
        cambio: apiVehicle.cambio,
        potencia: apiVehicle.potencia,
        placa: apiVehicle.placa,
        portas: apiVehicle.portas,
        lugares: apiVehicle.lugares,
        valor_formatado: apiVehicle.valor_formatado,
        opcionais: apiVehicle.opcionais?.map((opt) => ({ descricao: opt.descricao })) || [],
      };
    });

    // Aplica filtros se fornecidos
    if (query?.marca) {
      vehicles = vehicles.filter((v) =>
        v.marca?.toLowerCase().includes(query.marca!.toLowerCase())
      );
    }

    if (query?.modelo) {
      vehicles = vehicles.filter((v) =>
        v.modelo?.toLowerCase().includes(query.modelo!.toLowerCase())
      );
    }

    if (query?.precoMin) {
      const min = Number(query.precoMin);
      vehicles = vehicles.filter((v) => v.price >= min);
    }

    if (query?.precoMax) {
      const max = Number(query.precoMax);
      vehicles = vehicles.filter((v) => v.price <= max);
    }

    if (query?.anoMin) {
      const min = Number(query.anoMin);
      vehicles = vehicles.filter((v) => v.year >= min);
    }

    if (query?.anoMax) {
      const max = Number(query.anoMax);
      vehicles = vehicles.filter((v) => v.year <= max);
    }

    return vehicles;
  } catch (error) {
    console.error("Erro ao buscar veículos:", error);
    // Em caso de erro, retorna array vazio ou pode retornar dados mockados como fallback
    return [];
  }
}

export async function fetchVehicleById(id: string | number): Promise<Vehicle> {
  try {
    const response = await axiosInstance.get<ApiVehicleResponse>(
      `https://www.netcarmultimarcas.com.br/api/v1/veiculos/id/${id}`
    );

    if (!response.data.success || !response.data.data || response.data.data.length === 0) {
      throw new Error("Vehicle not found");
    }

    const apiVehicle = response.data.data[0];

    // Normaliza as URLs das imagens thumbnails (para cards e miniaturas)
    const thumbUrls = apiVehicle.imagens?.thumb?.length 
      ? apiVehicle.imagens.thumb 
      : apiVehicle.imagens?.full?.length 
      ? apiVehicle.imagens.full 
      : [];
    const normalizedThumbs = thumbUrls.map(normalizeImageUrl);
    
    // Normaliza as URLs das imagens em alta resolução (para galeria)
    const fullUrls = apiVehicle.imagens?.full?.length 
      ? apiVehicle.imagens.full 
      : apiVehicle.imagens?.thumb?.length 
      ? apiVehicle.imagens.thumb 
      : [];
    const normalizedFullImages = fullUrls.map(normalizeImageUrl);

    // Mapeia os dados da API para a interface Vehicle
    return {
      id: String(apiVehicle.id),
      name: `${apiVehicle.marca} ${apiVehicle.modelo}`,
      slug: apiVehicle.link || String(apiVehicle.id),
      price: apiVehicle.valor || 0,
      year: apiVehicle.ano,
      km: apiVehicle.km,
      images: normalizedThumbs, // Thumbnails para cards
      fullImages: normalizedFullImages, // Imagens em alta resolução para galeria
      marca: apiVehicle.marca,
      modelo: apiVehicle.modelo,
      cor: apiVehicle.cor,
      motor: apiVehicle.motor,
      combustivel: apiVehicle.combustivel,
      cambio: apiVehicle.cambio,
      potencia: apiVehicle.potencia,
      placa: apiVehicle.placa,
      portas: apiVehicle.portas,
      lugares: apiVehicle.lugares,
      valor_formatado: apiVehicle.valor_formatado,
      opcionais: apiVehicle.opcionais?.map((opt) => ({ descricao: opt.descricao })) || [],
    };
  } catch (error) {
    console.error("Error fetching vehicle by ID:", error);
    throw error;
  }
}

export async function fetchVehicleBySlug(slug: string): Promise<Vehicle> {
  // Se o slug for um número (ID), busca por ID
  const numericId = Number(slug);
  if (!isNaN(numericId) && numericId > 0) {
    try {
      return await fetchVehicleById(numericId);
    } catch (error) {
      console.error("Erro ao buscar veículo por ID:", error);
      throw error;
    }
  }

  // Se não for um ID numérico, tenta buscar por ID como string
  if (slug && slug.trim() !== "") {
    try {
      return await fetchVehicleById(slug);
    } catch (error) {
      console.warn("Falha ao buscar por ID string, tentando fallback");
    }
  }

  // Fallback para dados mockados apenas se não for um ID válido
  await new Promise((resolve) => setTimeout(resolve, 300));

  const vehicle = mockVehicles.find((v) => v.slug === slug || v.id === slug);

  if (!vehicle) {
    throw new Error("Vehicle not found");
  }

  return vehicle;
}
