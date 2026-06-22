import { MapPin, ExternalLink } from "lucide-react";
import { useMemo } from "react";
import { useAddressQuery, usePhoneQuery } from "@/catalog/queries/useSiteQuery";
import { buildMapsUrl, LOJA_COORDS } from "@/lib/formatters";
import { LojasMap } from "./LojasMap";

type LojaData = {
  id: number;
  nome: string;
  tipo: string;
  endereco: string;
  telefone: string;
  cor: "primary" | "amber-500";
  mapsUrl: string;
};

const DEFAULT_LOJAS = {
  1: {
    nome: "LOJA 1",
    tipo: "Matriz",
    address: "Av. Getúlio Vargas, 740 - Centro - Esteio/RS",
    telefone: "(51) 3473-7900",
    cor: "primary" as const,
  },
  2: {
    nome: "LOJA 2",
    tipo: "Filial",
    address: "Av. Getúlio Vargas, 1106 - Centro - Esteio/RS",
    telefone: "(51) 3033-3900",
    cor: "amber-500" as const,
  },
};

function UnidadesCard({ lojas }: { lojas: LojaData[] }) {
  return (
    <div className="absolute top-6 right-6 md:top-8 md:right-8 bg-white/95 backdrop-blur-md rounded-2xl shadow-xl p-6 border border-white/50 hidden md:block max-w-[340px] z-30">
      <h5
        id="mapa-lojas-titulo"
        className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-6 flex items-center gap-2"
      >
        <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
        Nossas Unidades
      </h5>

      {lojas.map((loja, index) => (
        <a
          key={loja.id}
          href={loja.mapsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={`flex items-start gap-4 ${index < lojas.length - 1 ? "mb-6 relative" : ""} group/item hover:bg-gray-50/50 p-2 -mx-2 rounded-lg transition-colors`}
        >
          {index < lojas.length - 1 && (
            <div className="absolute left-[17px] top-10 bottom-[-16px] w-[2px] border-l-2 border-dotted border-gray-200" />
          )}
          <div className="relative mt-1 shrink-0">
            <div
              className={`relative w-5 h-5 rounded-full ${loja.cor === "primary" ? "bg-primary" : "bg-amber-500"} flex items-center justify-center text-white shadow-sm z-10`}
            >
              <MapPin className="w-3 h-3" strokeWidth={3} />
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <p className="font-bold text-gray-800 text-sm">{loja.nome}</p>
              <span className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded font-bold uppercase">
                {loja.tipo}
              </span>
            </div>
            <p className="text-[13px] text-gray-500 leading-snug whitespace-pre-line">
              {loja.endereco}
            </p>
            {loja.telefone && (
              <p className="text-[12px] text-primary font-medium mt-1">{loja.telefone}</p>
            )}
          </div>
        </a>
      ))}

      <div className="mt-6 pt-4 border-t border-gray-100">
        <a
          href={buildMapsUrl("Netcar Multimarcas Esteio RS")}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 text-xs font-bold text-primary hover:opacity-80 transition-colors group/link"
        >
          ABRIR NO GOOGLE MAPS
          <ExternalLink className="w-3 h-3 group-hover/link:translate-x-0.5 transition-transform" />
        </a>
      </div>
    </div>
  );
}

export function Localizacao() {
  const { data: addressLoja1 } = useAddressQuery("Loja1");
  const { data: addressLoja2 } = useAddressQuery("Loja2");
  const { data: phoneLoja1 } = usePhoneQuery("Loja1");
  const { data: phoneLoja2 } = usePhoneQuery("Loja2");

  const lojas = useMemo(() => {
    return ([1, 2] as const).map((id) => {
      const defaults = DEFAULT_LOJAS[id];
      const addressApi = id === 1 ? addressLoja1 : addressLoja2;
      const phoneApi = id === 1 ? phoneLoja1 : phoneLoja2;
      const address = addressApi?.address || defaults.address;

      return {
        id,
        nome: defaults.nome,
        tipo: defaults.tipo,
        endereco: address.replace(/ - /g, "\n"),
        telefone: phoneApi?.telefone || defaults.telefone,
        cor: defaults.cor,
        mapsUrl: buildMapsUrl(address, LOJA_COORDS[`Loja${id}`]),
      };
    });
  }, [addressLoja1, addressLoja2, phoneLoja1, phoneLoja2]);

  return (
    <section
      className="container-main w-full bg-white rounded-[32px] shadow-sm overflow-hidden border border-white relative group"
      aria-labelledby="mapa-lojas-titulo"
    >
      <div className="w-full h-[450px] relative">
        <LojasMap
          lojas={lojas.map((loja) => ({
            id: loja.id as 1 | 2,
            nome: loja.nome,
            cor: loja.cor,
            mapsUrl: loja.mapsUrl,
          }))}
        />

        <UnidadesCard lojas={lojas} />
      </div>
    </section>
  );
}
