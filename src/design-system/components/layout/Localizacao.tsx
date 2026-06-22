import { MapPin, ExternalLink } from "lucide-react";
import { useMemo } from "react";
import { useAddressQuery, usePhoneQuery } from "@/catalog/queries/useSiteQuery";
import { buildMapsUrl, LOJA_COORDS } from "@/lib/formatters";

type LojaData = {
  id: number;
  nome: string;
  tipo: string;
  endereco: string;
  enderecoCompleto: string;
  telefone: string;
  cor: "primary" | "amber-500";
  mapsUrl: string;
  pinPosition: { top: string; left: string };
};

/** Embed estático da região Av. Getúlio Vargas, Esteio — pins CSS por cima */
const MAP_EMBED_URL =
  "https://www.google.com/maps/embed?pb=!1m14!1m12!1m3!1d6914.0!2d-51.171175!3d-29.839405!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!5e0!3m2!1spt-BR!2sbr!4v1704628800000!5m2!1spt-BR!2sbr";

const PIN_POSITIONS: Record<number, { top: string; left: string }> = {
  1: { top: "25%", left: "65%" },
  2: { top: "75%", left: "35%" },
};

function MapPinOverlay({
  label,
  colorClass,
  position,
  delayPing,
}: {
  label: string;
  colorClass: "primary" | "amber-500";
  position: { top: string; left: string };
  delayPing?: boolean;
}) {
  const isPrimary = colorClass === "primary";

  return (
    <div
      className="absolute -translate-x-1/2 -translate-y-1/2 z-10 hover:z-20 group"
      style={{ top: position.top, left: position.left }}
    >
      <div className="relative flex flex-col items-center pointer-events-none">
        <div className="mb-2 bg-white px-3 py-1.5 rounded-lg shadow-md border border-gray-100 flex items-center gap-2 whitespace-nowrap transform transition-transform group-hover:-translate-y-1">
          <span
            className={`w-2 h-2 rounded-full ${isPrimary ? "bg-primary" : "bg-amber-500"}`}
          />
          <p className="text-[11px] font-bold text-gray-800">{label}</p>
        </div>
        <div className="relative">
          <span
            className={`absolute -inset-3 rounded-full ${isPrimary ? "bg-primary" : "bg-amber-500"} opacity-30 animate-ping ${delayPing ? "delay-700" : ""}`}
          />
          <span className="absolute -inset-1 rounded-full bg-white opacity-90" />
          <MapPin
            className={`w-8 h-8 ${isPrimary ? "text-primary" : "text-amber-500"} drop-shadow-lg relative z-10`}
            fill="currentColor"
          />
          <div
            className={`absolute top-full left-1/2 -translate-x-1/2 w-1 h-8 bg-gradient-to-b ${isPrimary ? "from-primary" : "from-amber-500"} to-transparent opacity-50`}
          />
        </div>
      </div>
    </div>
  );
}

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
    const items: LojaData[] = [];

    if (addressLoja1?.address) {
      items.push({
        id: 1,
        nome: "LOJA 1",
        tipo: "Matriz",
        endereco: addressLoja1.address.replace(/ - /g, "\n"),
        enderecoCompleto: `${addressLoja1.address}, Brasil`,
        telefone: phoneLoja1?.telefone || "",
        cor: "primary",
        mapsUrl: buildMapsUrl(addressLoja1.address, LOJA_COORDS.Loja1),
        pinPosition: PIN_POSITIONS[1],
      });
    }

    if (addressLoja2?.address) {
      items.push({
        id: 2,
        nome: "LOJA 2",
        tipo: "Filial",
        endereco: addressLoja2.address.replace(/ - /g, "\n"),
        enderecoCompleto: `${addressLoja2.address}, Brasil`,
        telefone: phoneLoja2?.telefone || "",
        cor: "amber-500",
        mapsUrl: buildMapsUrl(addressLoja2.address, LOJA_COORDS.Loja2),
        pinPosition: PIN_POSITIONS[2],
      });
    }

    return items;
  }, [addressLoja1, addressLoja2, phoneLoja1, phoneLoja2]);

  if (lojas.length === 0) {
    return null;
  }

  return (
    <section
      className="container-main w-full bg-white rounded-[32px] shadow-sm overflow-hidden border border-white relative group"
      aria-labelledby="mapa-lojas-titulo"
    >
      <div className="w-full h-[450px] relative grayscale-[0.1]">
        <iframe
          src={MAP_EMBED_URL}
          width="100%"
          height="100%"
          style={{ border: 0 }}
          allowFullScreen
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
          title="Localização das lojas Netcar"
          className="w-full h-full"
        />

        {lojas.map((loja) => (
          <MapPinOverlay
            key={loja.id}
            label={loja.nome}
            colorClass={loja.cor}
            position={loja.pinPosition}
            delayPing={loja.id === 2}
          />
        ))}

        <UnidadesCard lojas={lojas} />
      </div>
    </section>
  );
}
