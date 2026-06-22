import { useState } from "react";
import { motion } from "framer-motion";
import { Banknote } from "lucide-react";
import { useWhatsAppQuery } from "@/catalog/queries/useSiteQuery";
import { formatWhatsAppNumber } from "@/lib/formatters";

interface QuickSellFormProps {
  /** Cidade de origem do lead, quando a página é uma landing de cidade */
  cityName?: string;
}

/**
 * Formulário de 3 campos que abre o WhatsApp com a avaliação pré-preenchida.
 * Zero backend: o lead cai direto na conversa do iAN com contexto completo.
 */
export function QuickSellForm({ cityName }: QuickSellFormProps) {
  const { data: whatsapp } = useWhatsAppQuery();
  const [modelo, setModelo] = useState("");
  const [ano, setAno] = useState("");
  const [km, setKm] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!whatsapp?.numero) return;

    const number = formatWhatsAppNumber(whatsapp.numero);
    const parts = ["Oi! Quero avaliar meu carro para venda:"];
    if (modelo.trim()) parts.push(`Modelo: ${modelo.trim()}`);
    if (ano.trim()) parts.push(`Ano: ${ano.trim()}`);
    if (km.trim()) parts.push(`KM: ${km.trim()}`);
    if (cityName) parts.push(`Cidade: ${cityName}`);

    const url = `https://wa.me/${number}?text=${encodeURIComponent(parts.join("\n"))}`;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const inputClass =
    "w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-fg placeholder:text-gray-400 focus:border-secondary focus:outline-none focus:ring-2 focus:ring-secondary/20";

  return (
    <motion.form
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      onSubmit={handleSubmit}
      className="rounded-2xl bg-white p-6 shadow-md border border-gray-100"
    >
      <div className="flex items-center gap-3 mb-1">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary/10">
          <Banknote className="h-5 w-5 text-secondary" />
        </div>
        <h3 className="text-lg font-bold text-fg">Avalie seu carro em minutos</h3>
      </div>
      <p className="text-sm text-gray-500 mb-5">
        Preencha e receba a primeira avaliação direto no WhatsApp — sem cadastro, sem espera.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
        <input
          type="text"
          value={modelo}
          onChange={(e) => setModelo(e.target.value)}
          placeholder="Modelo (ex: Onix LT)"
          aria-label="Modelo do veículo"
          required
          className={inputClass}
        />
        <input
          type="text"
          inputMode="numeric"
          value={ano}
          onChange={(e) => setAno(e.target.value)}
          placeholder="Ano (ex: 2021)"
          aria-label="Ano do veículo"
          required
          className={inputClass}
        />
        <input
          type="text"
          inputMode="numeric"
          value={km}
          onChange={(e) => setKm(e.target.value)}
          placeholder="KM (ex: 45.000)"
          aria-label="Quilometragem do veículo"
          className={inputClass}
        />
      </div>

      <button
        type="submit"
        className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-secondary px-5 py-3.5 text-white font-semibold hover:opacity-90 transition-opacity"
      >
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
        </svg>
        Receber avaliação no WhatsApp
      </button>

      <p className="text-xs text-gray-400 mt-3 text-center">
        Compramos nacionais até 7 anos, origem RS, sem passagem por leilão. Aceitamos financiados.
      </p>
    </motion.form>
  );
}
