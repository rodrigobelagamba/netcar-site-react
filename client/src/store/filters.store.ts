import { create } from "zustand";

interface FiltersState {
  marca: string;
  modelo: string;
  precoMin: string;
  precoMax: string;
  anoMin: string;
  anoMax: string;
  setMarca: (marca: string) => void;
  setModelo: (modelo: string) => void;
  setPrecoMin: (precoMin: string) => void;
  setPrecoMax: (precoMax: string) => void;
  setAnoMin: (anoMin: string) => void;
  setAnoMax: (anoMax: string) => void;
  reset: () => void;
}

export const useFiltersStore = create<FiltersState>((set) => ({
  marca: "",
  modelo: "",
  precoMin: "",
  precoMax: "",
  anoMin: "",
  anoMax: "",
  setMarca: (marca) => set({ marca }),
  setModelo: (modelo) => set({ modelo }),
  setPrecoMin: (precoMin) => set({ precoMin }),
  setPrecoMax: (precoMax) => set({ precoMax }),
  setAnoMin: (anoMin) => set({ anoMin }),
  setAnoMax: (anoMax) => set({ anoMax }),
  reset: () =>
    set({
      marca: "",
      modelo: "",
      precoMin: "",
      precoMax: "",
      anoMin: "",
      anoMax: "",
    }),
}));
