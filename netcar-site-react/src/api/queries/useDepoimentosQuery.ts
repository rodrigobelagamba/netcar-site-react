import { useQuery } from "@tanstack/react-query";
import {
  fetchDepoimentos,
  fetchDepoimentoById,
  fetchDepoimentosGallery,
  fetchDepoimentosWithImages,
  fetchDepoimentosAlt,
} from "../endpoints/depoimentos";

export interface DepoimentosQueryOptions {
  limit?: number;
  offset?: number;
}

/**
 * Hook para buscar todos os depoimentos
 */
export function useDepoimentosQuery(options?: DepoimentosQueryOptions) {
  return useQuery({
    queryKey: ["depoimentos", "list", options],
    queryFn: () => fetchDepoimentos(options?.limit, options?.offset),
  });
}

/**
 * Hook para buscar um depoimento específico por ID
 */
export function useDepoimentoQuery(id: string | number) {
  return useQuery({
    queryKey: ["depoimento", id],
    queryFn: () => fetchDepoimentoById(id),
    enabled: !!id,
  });
}

/**
 * Hook para buscar galeria de depoimentos
 */
export function useDepoimentosGalleryQuery() {
  return useQuery({
    queryKey: ["depoimentos", "gallery"],
    queryFn: () => fetchDepoimentosGallery(),
  });
}

/**
 * Hook para buscar depoimentos com imagens
 */
export function useDepoimentosWithImagesQuery() {
  return useQuery({
    queryKey: ["depoimentos", "withImages"],
    queryFn: () => fetchDepoimentosWithImages(),
  });
}

/**
 * Hook para buscar depoimentos (método alternativo)
 */
export function useDepoimentosAltQuery() {
  return useQuery({
    queryKey: ["depoimentos", "alt"],
    queryFn: () => fetchDepoimentosAlt(),
  });
}

