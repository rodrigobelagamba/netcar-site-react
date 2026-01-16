/**
 * Mascara a placa do veículo para exibição
 * Formato: ABC-1234 ou ABC1D23 → ABC-xx34 ou ABC-xx23
 * Mostra os 3 primeiros caracteres, depois "-xx" e os 2 últimos dígitos
 */
export function maskPlate(placa: string): string {
  if (!placa) return "";
  
  // Remove espaços e converte para maiúsculo
  const cleanPlaca = placa.replace(/\s/g, "").toUpperCase();
  
  // Remove hífen se existir (formato antigo ABC-1234)
  const placaSemHifen = cleanPlaca.replace(/-/g, "");
  
  // Se tiver menos de 5 caracteres, retorna como está
  if (placaSemHifen.length < 5) {
    return cleanPlaca;
  }
  
  // Pega os 3 primeiros caracteres
  const prefixo = placaSemHifen.substring(0, 3);
  
  // Pega os 2 últimos dígitos (números)
  const sufixo = placaSemHifen.match(/\d/g);
  const ultimosDigitos = sufixo && sufixo.length >= 2 
    ? sufixo.slice(-2).join("")
    : placaSemHifen.slice(-2);
  
  // Retorna no formato: ABC-xx34
  return `${prefixo}-xx${ultimosDigitos}`;
}

/**
 * Gera um slug amigável para URLs de detalhes de veículos
 * Formato: {modelo}-{ano}-{placa-mascarada}-{id}
 * Exemplo: crossfox-2012-ISP-xx94-19591
 */
export function generateVehicleSlug(vehicle: {
  modelo?: string;
  marca?: string;
  year?: number;
  placa?: string;
  id: string;
}): string {
  const parts: string[] = [];
  
  // Adiciona modelo (remove marca se estiver no início)
  if (vehicle.modelo) {
    let modelo = vehicle.modelo.trim();
    // Remove marca do início do modelo se presente
    if (vehicle.marca && modelo.toLowerCase().startsWith(vehicle.marca.toLowerCase())) {
      modelo = modelo.substring(vehicle.marca.length).trim();
    }
    // Normaliza o modelo para slug
    const modeloSlug = modelo
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Remove acentos
      .replace(/[^a-z0-9\s-]/g, '') // Remove caracteres especiais
      .replace(/\s+/g, '-') // Substitui espaços por hífens
      .replace(/-+/g, '-') // Remove hífens duplicados
      .replace(/^-|-$/g, ''); // Remove hífens do início/fim
    
    if (modeloSlug) {
      parts.push(modeloSlug);
    }
  }
  
  // Adiciona ano
  if (vehicle.year) {
    parts.push(String(vehicle.year));
  }
  
  // Adiciona placa mascarada (normalizada para slug)
  if (vehicle.placa) {
    const placaMascarada = maskPlate(vehicle.placa);
    const placaSlug = placaMascarada.toLowerCase();
    
    if (placaSlug) {
      parts.push(placaSlug);
    }
  }
  
  // Adiciona ID no final
  parts.push(vehicle.id);
  
  // Junta tudo com hífens
  return parts.join('-');
}

/**
 * Extrai o ID do veículo de um slug
 * Aceita formatos:
 * - /veiculo/{slug}-{id}
 * - veiculo/{slug}-{id}
 * - {slug}-{id}
 * - {id} (apenas número)
 */
export function extractVehicleIdFromSlug(slug: string): string {
  try {
    if (!slug || slug.trim() === '') {
      return '';
    }
    
    let cleanSlug = slug.trim();
    
    // Remove "/veiculo/" do início se presente
    cleanSlug = cleanSlug.replace(/^\/?veiculo\//, '');
    
    // Remove "detalhe-" do início se presente (compatibilidade com URLs antigas)
    const lowerSlug = cleanSlug.toLowerCase();
    if (lowerSlug.startsWith('detalhe-')) {
      cleanSlug = cleanSlug.substring(8); // Remove "detalhe-"
    }
    
    // Se for apenas um número, retorna ele mesmo
    const numericId = Number(cleanSlug);
    if (!isNaN(numericId) && numericId > 0 && cleanSlug === String(numericId)) {
      return String(numericId);
    }
    
    // Tenta extrair o ID do final do slug (último segmento após o último hífen)
    const parts = cleanSlug.split('-');
    
    if (parts.length > 0) {
      // O ID sempre é o ÚLTIMO segmento numérico válido
      // Procura de trás para frente e pega o primeiro número válido encontrado
      // (que será o último número no slug, que é o ID)
      for (let i = parts.length - 1; i >= 0; i--) {
        const part = parts[i];
        const partNum = Number(part);
        
        // Verifica se é um número válido e se o segmento é exatamente esse número
        // IDs geralmente são números grandes (mais de 4 dígitos), mas aceitamos qualquer número válido
        if (!isNaN(partNum) && partNum > 0 && part === String(partNum)) {
          return String(partNum);
        }
      }
    }
    
    // Se não conseguir extrair, retorna o slug original (pode ser um ID string)
    return cleanSlug;
  } catch (error) {
    console.error("Erro ao extrair ID do slug:", error);
    return slug;
  }
}

