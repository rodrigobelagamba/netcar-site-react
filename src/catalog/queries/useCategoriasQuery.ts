import { useQuery } from "@tanstack/react-query";
import { fetchCategorias } from "../endpoints/categorias";

/**
 * Hook para buscar todas as categorias de veículos disponíveis
 * 
 * @returns Query result com lista de categorias (ex: ["Hatchback", "Sedan", "SUV"])
 */
export function useCategoriasQuery() {
  return useQuery({
    queryKey: ["categorias"],
    queryFn: fetchCategorias,
    staleTime: 1000 * 60 * 30, // 30 minutos
    gcTime: 1000 * 60 * 60, // 1 hora
  });
}
