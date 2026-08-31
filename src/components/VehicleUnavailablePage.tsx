import { Link, useLocation } from "@tanstack/react-router";
import { ArrowRight, MessageCircle } from "lucide-react";
import { useWhatsAppQuery } from "@/catalog/queries/useSiteQuery";
import { buildWhatsAppUrl, siteWhatsAppMessage } from "@/lib/whatsappMessages";
import { emptySeminovosSearch } from "@/lib/seminovos-search";
import { vehicleNameFromSlug } from "@/lib/slug";
import { useDefaultMetaTags } from "@/hooks/useDefaultMetaTags";

const ATALHOS_ESTOQUE = [
  { landingSlug: "suv", label: "SUVs seminovos" },
  { landingSlug: "hatch", label: "Hatches seminovos" },
  { landingSlug: "sedan", label: "Sedãs seminovos" },
] as const;

const LINK_ATALHO =
  "text-sm font-semibold text-[#00283C] underline decoration-secondary decoration-2 underline-offset-4 hover:text-secondary";

/**
 * Veículo ausente na API (vendido e removido do estoque, ou slug inválido).
 * Antes redirecionava direto para /seminovos, o que apagava o interesse de quem
 * chegou por um link antigo. Agora nomeia o carro e oferece caminhos.
 */
export function VehicleUnavailablePage() {
  const location = useLocation();
  const { data: whatsapp } = useWhatsAppQuery();

  const slug = location.pathname.replace(/^\/veiculo\//, "").replace(/\/$/, "");
  const nome = vehicleNameFromSlug(slug);

  useDefaultMetaTags(
    nome ? `${nome} não está mais disponível` : "Veículo não disponível",
    "Este seminovo saiu do estoque da Netcar Multimarcas, em Esteio/RS. Veja as opções disponíveis agora ou fale com um consultor pelo WhatsApp.",
    { robots: "noindex, follow" },
  );

  const waHref = whatsapp?.numero
    ? buildWhatsAppUrl(
        whatsapp.numero,
        siteWhatsAppMessage(
          nome
            ? `vi o ${nome} no site, mas já foi vendido. Quero ver opções parecidas.`
            : "o carro que eu estava vendo saiu do estoque. Quero ver opções parecidas.",
        ),
      )
    : undefined;

  return (
    <main className="flex-1 bg-white">
      <section className="container-main px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-bold uppercase tracking-wider text-secondary">
            Fora de estoque
          </p>
          <h1 className="mt-3 text-3xl font-black leading-tight text-[#00283C] sm:text-4xl">
            {nome
              ? `${nome} já foi vendido`
              : "Este veículo não está mais disponível"}
          </h1>
          <p className="mt-5 text-base leading-relaxed text-muted-foreground">
            Veja o estoque atual para conferir se há uma opção parecida nas duas
            lojas da Av. Presidente Vargas, em Esteio.
          </p>

          <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              to="/seminovos"
              search={emptySeminovosSearch}
              className="inline-flex w-full items-center justify-center gap-2.5 rounded-full bg-[#00283C] px-8 py-4 text-base font-black uppercase tracking-wider text-white shadow-[0_12px_32px_rgba(0,40,60,0.28)] transition-all hover:bg-[#00435a] active:scale-[0.98] sm:w-auto"
            >
              Ver estoque completo
              <ArrowRight className="h-5 w-5" />
            </Link>
            {waHref && (
              <a
                href={waHref}
                target="_blank"
                rel="noopener noreferrer"
                data-wa-source="vehicle_unavailable"
                data-wa-intent="similar_vehicle"
                data-wa-vehicle-name={nome || undefined}
                className="inline-flex w-full items-center justify-center gap-2.5 rounded-full border-2 border-[#00283C] px-8 py-4 text-base font-black uppercase tracking-wider text-[#00283C] transition-all hover:bg-[#00283C] hover:text-white active:scale-[0.98] sm:w-auto"
              >
                <MessageCircle className="h-5 w-5" />
                Pedir opções parecidas
              </a>
            )}
          </div>

          <nav className="mt-12 flex flex-wrap items-center justify-center gap-x-6 gap-y-3">
            {ATALHOS_ESTOQUE.map((atalho) => (
              <Link
                key={atalho.landingSlug}
                to="/comprar-{$landingSlug}"
                params={{ landingSlug: atalho.landingSlug }}
                className={LINK_ATALHO}
              >
                {atalho.label}
              </Link>
            ))}
            <Link to="/seminovos-automaticos" className={LINK_ATALHO}>
              Seminovos automáticos
            </Link>
          </nav>
        </div>
      </section>
    </main>
  );
}
