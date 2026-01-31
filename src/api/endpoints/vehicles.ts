import { axiosInstance } from "../axios-instance";
import { config } from "../config";
import { extractVehicleIdFromSlug } from "@/lib/slug";

export interface VehicleImagesSite {
  capa: string | null;
  capa_thumb: string | null;
  capa_opengraph: string | null;
  galeria: string[];
}

export interface Vehicle {
  id: string;
  name: string;
  slug: string;
  price: number;
  year: number; // Ano modelo
  anoFabricacao?: number; // Ano de fabricação
  km: number;
  images: string[]; // Thumbnails (para cards e miniaturas)
  fullImages?: string[]; // Imagens em alta resolução (para galeria)
  imagens_site?: VehicleImagesSite; // Imagens organizadas para uso no site
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
  categoria?: string;
  opcionais?: Array<{ tag: string; descricao: string }>;
  diferenciais?: Array<{ tag: string; descricao: string }>; // Opcionais do tipo Piado (diferenciais)
  pdf?: string; // Nome do arquivo PDF
  pdf_url?: string; // URL relativa do PDF
  fotos?: string[]; // Deprecated - usar fullImages ao invés
}

export interface ApiVehicleResponse {
  success: boolean;
  message: string;
  data: Array<{
    id: string;
    marca: string;
    modelo: string;
    ano: number; // Ano modelo
    ano_fabricacao?: number | null; // Ano de fabricação
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
    imagens_site?: {
      capa: string | null;
      capa_thumb: string | null;
      capa_opengraph: string | null;
      galeria: string[];
    };
    pdf?: string; // Nome do arquivo PDF
    pdf_url?: string; // URL relativa do PDF
    data_cadastro: string | null;
    data_atualizacao: string | null;
    status: string | null;
    destaque: number;
    promocao: number;
    categoria?: string;
    diferenciais?: Array<{
      tag: string;
      descricao: string;
    }>; // Opcionais do tipo Piado (diferenciais)
  }>;
  total_results: number;
  limit?: number;
  offset?: number;
}

export interface VehiclesQuery {
  montadora?: string; // Alias para marca (conforme API)
  marca?: string; // Mantido para compatibilidade
  modelo?: string;
  valor_min?: string | number; // Alias para precoMin (conforme API)
  valor_max?: string | number; // Alias para precoMax (conforme API)
  precoMin?: string | number; // Mantido para compatibilidade
  precoMax?: string | number; // Mantido para compatibilidade
  ano_min?: string | number; // Alias para anoMin (conforme API)
  ano_max?: string | number; // Alias para anoMax (conforme API)
  anoMin?: string | number; // Mantido para compatibilidade
  anoMax?: string | number; // Mantido para compatibilidade
  cambio?: string;
  combustivel?: string;
  motor?: string;
  cor?: string;
  categoria?: string;
  opcional?: string; // Tag de um único opcional
  opcionais?: string; // Múltiplas tags separadas por vírgula
  limit?: number; // Número máximo de resultados
  offset?: number; // Número de registros para pular
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

export async function fetchVehicles(query?: VehiclesQuery): Promise<Vehicle[]> {
  try {
    // Constrói os parâmetros da query string
    const params = new URLSearchParams();
    
    // Montadora/Marca
    if (query?.montadora) {
      params.append("montadora", query.montadora);
    } else if (query?.marca) {
      params.append("montadora", query.marca);
    }
    
    // Modelo
    if (query?.modelo) {
      params.append("modelo", query.modelo);
    }
    
    // Preço
    if (query?.valor_min !== undefined) {
      params.append("valor_min", String(query.valor_min));
    } else if (query?.precoMin !== undefined) {
      params.append("valor_min", String(query.precoMin));
    }
    
    if (query?.valor_max !== undefined) {
      params.append("valor_max", String(query.valor_max));
    } else if (query?.precoMax !== undefined) {
      params.append("valor_max", String(query.precoMax));
    }
    
    // Ano
    if (query?.ano_min !== undefined) {
      params.append("ano_min", String(query.ano_min));
    } else if (query?.anoMin !== undefined) {
      params.append("ano_min", String(query.anoMin));
    }
    
    if (query?.ano_max !== undefined) {
      params.append("ano_max", String(query.ano_max));
    } else if (query?.anoMax !== undefined) {
      params.append("ano_max", String(query.anoMax));
    }
    
    // Filtros adicionais
    if (query?.cambio) {
      params.append("cambio", query.cambio);
    }
    
    if (query?.combustivel) {
      params.append("combustivel", query.combustivel);
    }
    
    if (query?.motor) {
      params.append("motor", query.motor);
    }
    
    if (query?.cor) {
      params.append("cor", query.cor);
    }
    
    if (query?.categoria) {
      params.append("categoria", query.categoria);
    }
    
    // Opcionais
    if (query?.opcional) {
      params.append("opcional", query.opcional);
    }
    
    if (query?.opcionais) {
      params.append("opcionais", query.opcionais);
    }
    
    // Paginação - padrão de 100 por página se não especificado
    const limit = query?.limit !== undefined ? query.limit : 100;
    params.append("limit", String(limit));
    
    if (query?.offset !== undefined) {
      params.append("offset", String(query.offset));
    }

    const url = `${config.apiBaseUrl}/veiculos.php${params.toString() ? `?${params.toString()}` : ""}`;
    const response = await axiosInstance.get<ApiVehicleResponse>(url);

    if (!response.data.success || !response.data.data) {
      console.warn("API retornou sem sucesso ou sem dados");
      return [];
    }

    // Mapeia os dados da API para a interface Vehicle
    const vehicles: Vehicle[] = response.data.data.map((apiVehicle) => {
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

      // Normaliza URL do PDF se existir
      let pdfUrl: string | undefined;
      if (apiVehicle.pdf_url) {
        pdfUrl = normalizeImageUrl(apiVehicle.pdf_url);
      } else if (apiVehicle.pdf) {
        // Se só tem o nome do arquivo, constrói o caminho completo
        pdfUrl = normalizeImageUrl(`arquivos/autocheck/${apiVehicle.pdf}`);
      }

      // Normaliza imagens_site se existir
      let imagensSite: VehicleImagesSite | undefined;
      if (apiVehicle.imagens_site) {
        imagensSite = {
          capa: apiVehicle.imagens_site.capa ? normalizeImageUrl(apiVehicle.imagens_site.capa) : null,
          capa_thumb: apiVehicle.imagens_site.capa_thumb ? normalizeImageUrl(apiVehicle.imagens_site.capa_thumb) : null,
          capa_opengraph: apiVehicle.imagens_site.capa_opengraph ? normalizeImageUrl(apiVehicle.imagens_site.capa_opengraph) : null,
          galeria: apiVehicle.imagens_site.galeria?.map(normalizeImageUrl) || [],
        };
      }

      return {
        id: apiVehicle.id,
        name: `${apiVehicle.marca} ${apiVehicle.modelo}`,
        slug: apiVehicle.link || apiVehicle.id,
        price: apiVehicle.valor || 0,
        year: apiVehicle.ano, // Ano modelo
        anoFabricacao: apiVehicle.ano_fabricacao || undefined, // Ano de fabricação
        km: apiVehicle.km,
        images: normalizedThumbs, // Thumbnails para cards
        fullImages: normalizedFullImages, // Imagens em alta resolução para galeria
        imagens_site: imagensSite, // Imagens organizadas para uso no site
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
        categoria: apiVehicle.categoria,
        opcionais: apiVehicle.opcionais?.map((opt) => ({ tag: opt.tag, descricao: opt.descricao })) || [],
        diferenciais: apiVehicle.diferenciais?.map((diff) => ({ tag: diff.tag, descricao: diff.descricao })) || [],
        pdf: apiVehicle.pdf,
        pdf_url: pdfUrl,
      };
    });

    return vehicles;
  } catch (error) {
    console.error("Erro ao buscar veículos:", error);
    return [];
  }
}

export async function fetchVehicleById(id: string | number): Promise<Vehicle> {
  try {
    const response = await axiosInstance.get<ApiVehicleResponse>(
      `${config.apiBaseUrl}/veiculos/id/${id}`
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

    // Normaliza imagens_site se existir
    let imagensSite: VehicleImagesSite | undefined;
    if (apiVehicle.imagens_site) {
      imagensSite = {
        capa: apiVehicle.imagens_site.capa ? normalizeImageUrl(apiVehicle.imagens_site.capa) : null,
        capa_thumb: apiVehicle.imagens_site.capa_thumb ? normalizeImageUrl(apiVehicle.imagens_site.capa_thumb) : null,
        capa_opengraph: apiVehicle.imagens_site.capa_opengraph ? normalizeImageUrl(apiVehicle.imagens_site.capa_opengraph) : null,
        galeria: apiVehicle.imagens_site.galeria?.map(normalizeImageUrl) || [],
      };
    }

    // Normaliza URL do PDF se existir
    let pdfUrl: string | undefined;
    if (apiVehicle.pdf_url) {
      pdfUrl = normalizeImageUrl(apiVehicle.pdf_url);
    } else if (apiVehicle.pdf) {
      pdfUrl = normalizeImageUrl(`arquivos/autocheck/${apiVehicle.pdf}`);
    }

    // Mapeia os dados da API para a interface Vehicle
    return {
      id: String(apiVehicle.id),
      name: `${apiVehicle.marca} ${apiVehicle.modelo}`,
      slug: apiVehicle.link || String(apiVehicle.id),
      price: apiVehicle.valor || 0,
      year: apiVehicle.ano, // Ano modelo
      anoFabricacao: apiVehicle.ano_fabricacao || undefined, // Ano de fabricação
      km: apiVehicle.km,
      images: normalizedThumbs, // Thumbnails para cards
      fullImages: normalizedFullImages, // Imagens em alta resolução para galeria
      imagens_site: imagensSite, // Imagens organizadas para uso no site
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
      categoria: apiVehicle.categoria,
      opcionais: apiVehicle.opcionais?.map((opt) => ({ tag: opt.tag, descricao: opt.descricao })) || [],
      diferenciais: apiVehicle.diferenciais?.map((diff) => ({ tag: diff.tag, descricao: diff.descricao })) || [],
      pdf: apiVehicle.pdf,
      pdf_url: pdfUrl,
    };
    } catch (error) {
      console.error("Error fetching vehicle by ID:", error);
      throw error;
    }
  }

export async function fetchVehicleBySlug(slug: string): Promise<Vehicle> {
  // Extrai o ID do slug (suporta formato amigável ou apenas ID)
  const vehicleId = extractVehicleIdFromSlug(slug);
  
  if (!vehicleId) {
    throw new Error(`ID do veículo não encontrado no slug: ${slug}`);
  }
  
  // Busca o veículo por ID
  return fetchVehicleById(vehicleId);
}

/**
 * Interface para opcionais disponíveis
 */
export interface Optional {
  tag: string;
  descricao: string;
}

export interface ApiOpcionaisResponse {
  success: boolean;
  message?: string;
  data: Optional[];
}

/**
 * Lista todos os opcionais disponíveis para veículos
 */
export async function fetchOpcionais(): Promise<Optional[]> {
  try {
    const response = await axiosInstance.get<ApiOpcionaisResponse>(
      `${config.apiBaseUrl}/veiculos.php?action=opcionais`
    );

    if (!response.data.success || !response.data.data) {
      console.warn("API retornou sem sucesso ou sem dados");
      return [];
    }

    return response.data.data;
  } catch (error) {
    console.error("Erro ao buscar opcionais:", error);
    return [];
  }
}
