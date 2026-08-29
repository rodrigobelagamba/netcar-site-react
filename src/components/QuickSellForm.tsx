import { useRef, useState } from "react";
import { motion } from "@/design-system/components/utils/StaticMotion";
import { Banknote, CheckCircle2 } from "lucide-react";
import { useWhatsAppQuery } from "@/catalog/queries/useSiteQuery";
import {
  buildWhatsAppUrl,
  quickSellWhatsAppMessage,
} from "@/lib/whatsappMessages";
import { openWhatsApp, trackSellEvaluation } from "@/lib/analytics";
import { cn } from "@/lib/cn";

interface QuickSellFormProps {
  /** Cidade de origem do lead, quando a página é uma landing de cidade */
  cityName?: string;
  /** Evita repetir os critérios quando a página já os apresenta antes do formulário. */
  showCriteria?: boolean;
}

const purchaseCriteria = [
  "No máximo 6 anos de uso",
  "Até 80.000 km rodados",
  "Primeiro emplacamento no Rio Grande do Sul",
  "Sem origem de locadora",
  "Sem leilão, sinistro, furto ou roubo",
] as const;

export function PurchaseCriteriaCard({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "rounded-xl border border-primary/15 bg-primary/[0.04] p-4",
        className,
      )}
    >
      <p className="text-sm font-bold text-fg">
        Para a Netcar comprar o seu carro
      </p>
      <ul className="mt-3 grid gap-2 sm:grid-cols-2">
        {purchaseCriteria.map((criterion) => (
          <li
            key={criterion}
            className="flex items-start gap-2 text-sm leading-relaxed text-gray-600"
          >
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-secondary" />
            <span>{criterion}</span>
          </li>
        ))}
      </ul>
      <p className="mt-3 border-t border-primary/10 pt-3 text-xs leading-relaxed text-gray-500">
        Carro financiado pode ser avaliado; o saldo para quitação entra na
        negociação. Atender aos critérios permite iniciar a análise, mas não
        garante a compra.
      </p>
      <p className="mt-3 rounded-lg bg-secondary/10 px-3 py-2 text-sm leading-relaxed text-fg">
        <strong>Vai usar o carro na troca?</strong> Esses limites não se aplicam.
        O veículo pode ser avaliado dentro da negociação, conforme vistoria e
        documentação.
      </p>
    </div>
  );
}

/**
 * Formulário de 3 campos que abre o WhatsApp com a avaliação pré-preenchida.
 * Zero backend: o lead cai direto na conversa do iAN com contexto completo.
 */
export function QuickSellForm({
  cityName,
  showCriteria = true,
}: QuickSellFormProps) {
  const { data: whatsapp } = useWhatsAppQuery();
  const [modelo, setModelo] = useState("");
  const [ano, setAno] = useState("");
  const [km, setKm] = useState("");
  const [evaluationType, setEvaluationType] = useState<
    "direct_purchase" | "trade_in"
  >("direct_purchase");
  const startedRef = useRef(false);

  const trackStart = () => {
    if (startedRef.current) return;
    startedRef.current = true;
    trackSellEvaluation("start", cityName, evaluationType);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!whatsapp?.numero) return;

    const message = quickSellWhatsAppMessage({
      modelo,
      ano,
      km,
      cityName,
      evaluationType,
    });
    const url = buildWhatsAppUrl(whatsapp.numero, message);
    trackSellEvaluation("completed", cityName, evaluationType);
    openWhatsApp(url, {
      source: "form",
      intent: "sell_evaluation",
      pagePath: window.location.pathname,
    });
  };

  const inputClass =
    "w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-fg placeholder:text-gray-400 focus:border-secondary focus:outline-none focus:ring-2 focus:ring-secondary/20";

  return (
    <motion.form
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      onSubmit={handleSubmit}
      onFocusCapture={trackStart}
      className="rounded-2xl bg-white p-6 shadow-md border border-gray-100"
    >
      <div className="flex items-center gap-3 mb-1">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary/10">
          <Banknote className="h-5 w-5 text-secondary" />
        </div>
        <h3 className="text-lg font-bold text-fg">
          Envie os dados do seu carro
        </h3>
      </div>
      <p className="text-sm text-gray-500 mb-5">
        Modelo, ano e quilometragem já deixam a conversa pronta no WhatsApp.
        Fotos e documentos podem ser enviados na sequência.
      </p>

      <fieldset className="mb-5">
        <legend className="mb-2 text-sm font-bold text-fg">
          O que você pretende fazer?
        </legend>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {[
            {
              value: "direct_purchase" as const,
              label: "Vender para a Netcar",
              description: "Receber uma proposta de compra",
            },
            {
              value: "trade_in" as const,
              label: "Usar o carro na troca",
              description: "Avaliar junto com outro seminovo",
            },
          ].map((option) => {
            const selected = evaluationType === option.value;
            return (
              <label
                key={option.value}
                className={cn(
                  "cursor-pointer rounded-xl border px-4 py-3 transition-colors",
                  selected
                    ? "border-secondary bg-secondary/10 text-fg"
                    : "border-gray-200 bg-white text-gray-600 hover:border-secondary/40",
                )}
              >
                <input
                  type="radio"
                  name="evaluation-type"
                  value={option.value}
                  checked={selected}
                  onChange={() => setEvaluationType(option.value)}
                  className="sr-only"
                />
                <span className="block text-sm font-bold">{option.label}</span>
                <span className="mt-0.5 block text-xs opacity-70">
                  {option.description}
                </span>
              </label>
            );
          })}
        </div>
      </fieldset>

      {showCriteria && evaluationType === "direct_purchase" && (
        <PurchaseCriteriaCard className="mb-5" />
      )}
      {evaluationType === "trade_in" && (
        <p className="mb-5 rounded-xl border border-secondary/20 bg-secondary/10 p-4 text-sm leading-relaxed text-fg">
          Na troca, os limites de idade, quilometragem, primeiro emplacamento e
          histórico da compra direta não se aplicam. O veículo será avaliado na
          negociação, conforme vistoria e documentação.
        </p>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
        <input
          name="vehicle-model"
          autoComplete="off"
          type="text"
          value={modelo}
          onChange={(e) => setModelo(e.target.value)}
          placeholder="Modelo (ex: Onix LT)"
          aria-label="Modelo do veículo"
          required
          className={inputClass}
        />
        <input
          name="vehicle-year"
          autoComplete="off"
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
          name="vehicle-mileage"
          autoComplete="off"
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
        <svg
          className="w-5 h-5"
          viewBox="0 0 24 24"
          fill="currentColor"
          aria-hidden="true"
        >
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
        </svg>
        Enviar dados no WhatsApp
      </button>

      <p className="text-xs text-gray-400 mt-3 text-center">
        A proposta final depende da vistoria, dos documentos e do interesse da
        loja no veículo.
      </p>
    </motion.form>
  );
}
