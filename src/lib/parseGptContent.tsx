import { type ReactNode } from "react";

/**
 * Interface para seção de acordeão
 */
export interface AccordionSection {
  title: string;
  content: ReactNode | {
    introducao?: ReactNode;
    itens: Array<{ label?: string; texto: ReactNode }>;
  };
}

/**
 * Interface para o conteúdo parseado do GPT
 */
export interface ParsedGptContent {
  apresentacao?: ReactNode; // [APRESENTAÇÃO DO MODELO] - texto introdutório (já processado)
  accordions: AccordionSection[]; // Seções dinâmicas do acordeão (todos os outros colchetes)
}

/**
 * Processa texto convertendo asteriscos grudados em negrito
 * Suporta:
 * - *texto* (padrão)
 * - *palavra (começa com asterisco mas não termina)
 * - **texto* (dois asteriscos no início, um no final)
 */
export function processBoldText(text: string): ReactNode[] {
  if (!text || typeof text !== "string") return [text];
  
  // O texto já vem com ** substituído por * após o decode
  let processedText = text;
  
  let key = 0;
  
  // Array para armazenar os matches encontrados com suas posições
  const matches: Array<{ start: number; end: number; text: string }> = [];
  
  // Agora processa apenas casos *texto* (padrão) já que ** foi convertido para *
  const standardRegex = /\*([^*]+)\*/g;
  standardRegex.lastIndex = 0;
  
  let match: RegExpExecArray | null;
  while ((match = standardRegex.exec(processedText)) !== null) {
    const boldText = match[1].trim();
    if (boldText) {
      matches.push({
        start: match.index,
        end: match.index + match[0].length,
        text: boldText
      });
    }
  }
  
  // 2. Processa casos *palavra (começa com asterisco mas não termina)
  // Procura por * seguido de uma palavra (letras, números, acentos) até encontrar espaço ou fim
  const singleAsteriskRegex = /\*([a-zA-ZÀ-ÿ0-9]+)(?=\s|$|[.,;:!?])/g;
  singleAsteriskRegex.lastIndex = 0;
  
  match = null;
  while ((match = singleAsteriskRegex.exec(processedText)) !== null) {
    // Verifica se não está dentro de um match já processado
    const isInsideMatch = matches.some(m => 
      match!.index >= m.start && match!.index < m.end
    );
    
    if (!isInsideMatch) {
      const boldText = match[1].trim();
      if (boldText) {
        matches.push({
          start: match.index,
          end: match.index + match[0].length,
          text: boldText
        });
      }
    }
  }
  
  // Ordena matches por posição
  matches.sort((a, b) => a.start - b.start);
  
  // Reconstrói o texto substituindo os matches por placeholders únicos
  const replacements: Array<{ placeholder: string; text: string }> = [];
  
  // Processa de trás para frente para não alterar índices
  for (let i = matches.length - 1; i >= 0; i--) {
    const m = matches[i];
    const placeholder = `__BOLD_${key++}__`;
    processedText = processedText.substring(0, m.start) + 
                   placeholder + 
                   processedText.substring(m.end);
    replacements.unshift({ placeholder, text: m.text });
  }
  
  // Agora reconstrói o resultado final substituindo placeholders por elementos React
  const finalParts: ReactNode[] = [];
  const placeholderRegex = /__BOLD_\d+__/g;
  let lastIndex = 0;
  let replacementIndex = 0;
  placeholderRegex.lastIndex = 0;
  
  while ((match = placeholderRegex.exec(processedText)) !== null) {
    // Adiciona texto antes do placeholder
    if (match.index > lastIndex) {
      const beforeText = processedText.substring(lastIndex, match.index);
      if (beforeText) {
        finalParts.push(beforeText);
      }
    }
    
    // Adiciona o texto em negrito
    if (replacementIndex < replacements.length) {
      const replacement = replacements[replacementIndex++];
      finalParts.push(<strong key={`bold-${key++}`}>{replacement.text}</strong>);
    }
    
    lastIndex = match.index + match[0].length;
  }
  
  // Adiciona texto restante
  if (lastIndex < processedText.length) {
    const remainingText = processedText.substring(lastIndex);
    if (remainingText) {
      finalParts.push(remainingText);
    }
  }
  
  return finalParts.length > 0 ? finalParts : [text];
}

/**
 * Decodifica base64 para string UTF-8 corretamente
 */
function decodeBase64(base64: string): string {
  try {
    // Se não começar com data: ou não parecer base64, retorna como está
    if (!base64 || base64.length < 10) return base64;
    
    // Tenta decodificar base64 com suporte UTF-8
    if (typeof window !== "undefined" && typeof atob !== "undefined") {
      // Decodifica base64 para bytes
      const binaryString = atob(base64);
      
      // Converte para array de bytes
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      
      // Decodifica como UTF-8 usando TextDecoder
      if (typeof TextDecoder !== "undefined") {
        const decoder = new TextDecoder("utf-8");
        return decoder.decode(bytes);
      }
      
      // Fallback: tenta decodificar manualmente
      return decodeURIComponent(
        binaryString
          .split("")
          .map((char) => "%" + ("00" + char.charCodeAt(0).toString(16)).slice(-2))
          .join("")
      );
    }
    
    // Fallback para Node.js
    if (typeof Buffer !== "undefined") {
      return Buffer.from(base64, "base64").toString("utf-8");
    }
    
    return base64;
  } catch (error) {
    console.warn("Erro ao decodificar base64:", error);
    return base64; // Retorna o texto original se falhar
  }
}

/**
 * Processa texto convertendo asteriscos em negrito
 * Exemplo: "*Motor* 1.6 Flex" → { label: "Motor", texto: "1.6 Flex" }
 */
function parseBoldText(text: string): { label?: string; texto: string } {
  // Procura por texto em negrito entre asteriscos (*texto*)
  const boldMatch = text.match(/\*([^*]+)\*/);
  
  if (boldMatch) {
    const label = boldMatch[1].trim();
    const texto = text.replace(/\*[^*]+\*/, "").trim();
    return { label, texto: texto || text };
  }
  
  return { texto: text };
}

/**
 * Processa itens de lista que podem ter formatação especial
 * Exemplo: "*Motor* 1.6 Flex" ou "• *Central Multimídia* com tela"
 */
function parseListItem(item: string): { label?: string; texto: string } {
  let cleaned = item.trim();
  
  // Remove apenas marcadores de lista no início (•, -)
  // NÃO remove asteriscos grudados (*texto*) - eles serão processados pelo parseBoldText
  if (/^[•\-]\s/.test(cleaned)) {
    // Remove marcador de lista (• ou -) seguido de espaço
    cleaned = cleaned.replace(/^[•\-]\s*/, "").trim();
  } else if (/^\*\s/.test(cleaned)) {
    // Remove asterisco solto no início (seguido de espaço, não parte de *texto*)
    // Verifica se não é parte de *texto* verificando se há outro asterisco próximo
    if (!cleaned.match(/^\*\w+\*/)) {
      cleaned = cleaned.replace(/^\*\s*/, "").trim();
    }
  }
  
  return parseBoldText(cleaned);
}

/**
 * Extrai parágrafo introdutório de uma seção
 */
function extractIntro(text: string): { intro?: string; rest: string } {
  // Procura por dois pontos seguidos de espaço ou quebra de linha
  const colonIndex = text.indexOf(":");
  if (colonIndex > 0 && colonIndex < text.length - 1) {
    const beforeColon = text.substring(0, colonIndex).trim();
    const afterColon = text.substring(colonIndex + 1).trim();
    
    // Se o texto antes dos dois pontos parece ser uma introdução
    // E depois dos dois pontos tem conteúdo (lista ou texto)
    if (beforeColon.length > 10 && beforeColon.length < 200 && afterColon.length > 0) {
      return {
        intro: beforeColon + ":", // Inclui os dois pontos na introdução
        rest: afterColon,
      };
    }
  }
  
  return { rest: text };
}


/**
 * Parse do conteúdo GPT estruturado
 */
export function parseGptContent(gptContent: string | null | undefined): ParsedGptContent | null {
  if (!gptContent) return null;

  try {
    // Decodifica base64 se necessário
    let text = gptContent;
    
    // Tenta decodificar base64 (verifica se parece base64)
    if (gptContent.length > 50 && !gptContent.includes("[") && !gptContent.includes("]")) {
      text = decodeBase64(gptContent);
    }
    
    // Logo após o decode, substitui ** por *
    text = text.replace(/\*\*/g, '*');

    const result: ParsedGptContent = {
      accordions: [],
    };

    // Regex para encontrar seções entre colchetes
    const sectionRegex = /\[([^\]]+)\]\s*([^\[]*?)(?=\[|$)/gs;
    const matches = Array.from(text.matchAll(sectionRegex));

    for (const match of matches) {
      const sectionTitle = match[1].trim();
      const sectionContent = match[2].trim();

      const upperTitle = sectionTitle.toUpperCase().trim();

      // [TÍTULO] e [SUBTÍTULO] - descarta completamente, não usa
      // Verifica variações com e sem acentos, com espaços extras
      const normalizedTitle = upperTitle.replace(/\s+/g, " ").trim();
      
      // Verifica se é TÍTULO ou SUBTÍTULO (com várias variações)
      const isTitulo = normalizedTitle === "TÍTULO" || normalizedTitle === "TITULO" ||
                       normalizedTitle.startsWith("TÍTULO") || normalizedTitle.startsWith("TITULO");
      const isSubtitulo = normalizedTitle === "SUBTÍTULO" || normalizedTitle === "SUBTITULO" ||
                          normalizedTitle.startsWith("SUBTÍTULO") || normalizedTitle.startsWith("SUBTITULO");
      
      if (isTitulo || isSubtitulo) {
        // Descarta completamente essas seções
        continue;
      }
      // [APRESENTAÇÃO DO MODELO] ou [APRESENTACAO DO MODELO] - texto introdutório (não vai para acordeon)
      else if (upperTitle === "APRESENTAÇÃO DO MODELO" || upperTitle === "APRESENTACAO DO MODELO") {
        result.apresentacao = processBoldText(sectionContent);
      }
      // Todos os outros colchetes são títulos de accordion
      else {
        // Verifica se tem introdução (texto antes de lista)
        const intro = extractIntro(sectionContent);
        
        // Verifica se há marcadores de lista no INÍCIO de linhas (•, -, *)
        // Verifica se começa com marcador OU se tem múltiplas linhas começando com marcador
        const restLines = intro.rest.split(/\n/).filter((line) => line.trim().length > 0);
        const hasListMarkers = restLines.some((line) => /^[•\-\*]\s/.test(line.trim())) ||
                               /^[•\-\*]\s/.test(intro.rest.trim());
        
        // Se tem introdução e lista identificada por marcadores no início
        if (intro.intro && hasListMarkers) {
          // Separa os itens da lista (pode estar tudo em uma linha ou em múltiplas linhas)
          let listText = intro.rest;
          
          // Se não tem quebras de linha mas tem marcadores no início, separa por marcadores
          // IMPORTANTE: Não separa por asteriscos que estão grudados em palavras (*texto*)
          if (!listText.includes("\n")) {
            // Primeiro, protege asteriscos grudados (*texto*) substituindo temporariamente
            const protectedMarkers: string[] = [];
            let protectedIndex = 0;
            
            // Substitui *texto* por marcadores temporários
            listText = listText.replace(/\*([^*]+)\*/g, (match) => {
              const marker = `__PROTECTED_BOLD_${protectedIndex}__`;
              protectedMarkers[protectedIndex] = match;
              protectedIndex++;
              return marker;
            });
            
            // Agora separa por marcadores de lista reais (•, -) ou asterisco solto seguido de espaço
            listText = listText.replace(/([•\-])\s+/g, "\n$1 ");
            // Asterisco solto (não protegido) seguido de espaço
            listText = listText.replace(/\*\s+/g, "\n* ");
            
            // Restaura os asteriscos protegidos
            protectedMarkers.forEach((marker, index) => {
              listText = listText.replace(`__PROTECTED_BOLD_${index}__`, marker);
            });
          }
          
          const listItems = listText
            .split(/\n/)
            .filter((line) => line.trim().length > 0)
            .map(parseListItem)
            .map(item => ({
              label: item.label,
              texto: processBoldText(item.texto)
            }));
          
          result.accordions.push({
            title: sectionTitle,
            content: {
              introducao: processBoldText(intro.intro),
              itens: listItems,
            },
          });
        } 
        // Se tem múltiplas linhas mas não tem introdução clara
        else if (sectionContent.split(/\n/).filter((line) => line.trim().length > 0).length > 1) {
          const lines = sectionContent.split(/\n/).filter((line) => line.trim().length > 0);
          // Verifica se são realmente itens de lista (começam com marcador)
          const areListItems = lines.some((line) => /^[•\-\*]\s/.test(line.trim()));
          
          if (areListItems) {
            const listItems = lines.map(parseListItem)
              .map(item => ({
                label: item.label,
                texto: processBoldText(item.texto)
              }));
            result.accordions.push({
              title: sectionTitle,
              content: {
                itens: listItems,
              },
            });
          } else {
            // Múltiplas linhas mas não são lista, trata como texto simples
            result.accordions.push({
              title: sectionTitle,
              content: processBoldText(sectionContent),
            });
          }
        } 
        // Apenas texto simples
        else {
          result.accordions.push({
            title: sectionTitle,
            content: processBoldText(sectionContent),
          });
        }
      }
    }

    return result;
  } catch (error) {
    console.error("Erro ao fazer parse do conteúdo GPT:", error);
    return null;
  }
}
