import { Headphones, Instagram, Facebook } from "lucide-react";
import { Link } from "@tanstack/react-router";
import {
  useBannersLoja1Query,
  useBannersLoja2Query,
  usePhoneQuery,
  useAddressQuery,
  useWhatsAppQuery,
  useScheduleQuery,
} from "@/catalog";
import { formatWhatsAppNumber, buildLojaMapsUrl } from "@/lib/formatters";
import { landingPages, priorityCityPages } from "@/data/seo";
import { emptySeminovosSearch } from "@/lib/seminovos-search";
import logoNetcar from "@/assets/images/logo-netcar.png";
import { optimizeStockImage, stockImageSrcSet } from "@/lib/images";

const menuLinks = [
  { to: "/sobre", label: "Sobre" },
  { to: "/seminovos", label: "Seminovos", search: emptySeminovosSearch },
  { to: "/comparar", label: "Comparar seminovos" },
  { to: "/financiamento", label: "Financiamento" },
  { to: "/move-brasil", label: "Move Brasil" },
  { to: "/compra", label: "Netcar compra" },
  { to: "/regioes-atendidas", label: "Regiões atendidas" },
  { to: "/atendimento-24h", label: "Atendimento 24h" },
  { to: "/blog", label: "Atualidades" },
  { to: "/contato", label: "Contato" },
  {
    to: "https://maps.app.goo.gl/i8uHquE8tNMfoTHr9",
    label: "Localização",
    external: true,
  },
];

export function Footer() {
  const { data: bannersLoja1 } = useBannersLoja1Query();
  const { data: bannersLoja2 } = useBannersLoja2Query();
  const { data: phoneLoja1 } = usePhoneQuery("Loja1");
  const { data: phoneLoja2 } = usePhoneQuery("Loja2");
  const { data: addressLoja1 } = useAddressQuery("Loja1");
  const { data: addressLoja2 } = useAddressQuery("Loja2");
  const { data: whatsapp } = useWhatsAppQuery();
  const { data: schedule } = useScheduleQuery();
  const loja1Phone = phoneLoja1?.telefone || "5134737900";
  const loja2Phone = phoneLoja2?.telefone || "5130333900";

  const getFachadaImage = (
    banners: Array<{ titulo?: string; imagem: string }> | undefined,
    fallback: string,
  ): string => {
    if (!banners || banners.length === 0) return fallback;
    const fachada = banners.find(
      (banner) => banner.titulo?.toLowerCase() === "fachada",
    );
    if (fachada?.imagem) return fachada.imagem;
    return banners[0]?.imagem || fallback;
  };

  const imagemLoja1 = getFachadaImage(bannersLoja1, "/images/loja1.webp");
  const imagemLoja2 = getFachadaImage(bannersLoja2, "/images/loja2.webp");

  const formatPhone = (phone?: string) => {
    if (!phone) return "";
    const cleaned = phone.replace(/\D/g, "");
    if (cleaned.length === 11) {
      return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2, 7)}-${cleaned.slice(7)}`;
    }
    if (cleaned.length === 10) {
      return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2, 6)}-${cleaned.slice(6)}`;
    }
    return phone;
  };

  const phoneHref = (phone?: string) => {
    const digits = phone?.replace(/\D/g, "") ?? "";
    if (!digits) return "#";
    return `tel:+${digits.startsWith("55") ? digits : `55${digits}`}`;
  };

  return (
    <footer className="w-full font-sans antialiased text-muted-foreground bg-muted py-0 px-4 md:px-8">
      <section className="container-main w-full bg-white rounded-[32px] shadow-sm border border-white pt-10 pb-8 px-4 sm:px-6 lg:px-8 xl:px-12 2xl:px-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-[220px_1fr_140px_120px] gap-x-10 gap-y-10 mb-10">
          {/* Coluna 1: Contato & Nethelp */}
          <div className="flex flex-col space-y-6 items-start">
            <img
              src={logoNetcar}
              alt="Netcar"
              width={149}
              height={38}
              className="h-8 w-auto object-contain"
              loading="lazy"
              decoding="async"
            />

            {whatsapp?.numero && (
              <div>
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1">
                  WhatsApp Vendas
                </p>
                <a
                  href={
                    whatsapp.link ||
                    `https://wa.me/${formatWhatsAppNumber(whatsapp.numero)}`
                  }
                  className="text-base text-[#00616A] font-bold hover:underline"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {formatPhone(whatsapp.numero)}
                </a>
              </div>
            )}

            <div>
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-2">
                Atendimento
              </p>
              <div className="text-sm font-semibold text-fg space-y-1">
                <p>
                  Seg a Sex:{" "}
                  <span className="text-[#00616A]">
                    {schedule?.dias_semana || "9h às 18h"}
                  </span>
                </p>
                <p>
                  Sábado:{" "}
                  <span className="text-[#8A5200]">
                    {schedule?.sabado || "9h às 16h30"}
                  </span>
                </p>
                <p>
                  Jan-Fev (Sáb):{" "}
                  <span className="text-[#8A5200]">9h às 13h30</span>
                </p>
                <p className="text-xs text-muted-foreground font-medium pt-1">
                  Não fechamos ao meio-dia
                </p>
              </div>
            </div>

            <a
              href="https://wa.me/5551995109169?text=Olá!%20Preciso%20de%20suporte%20Nethelp."
              target="_blank"
              rel="noopener noreferrer"
              className="bg-gradient-to-b from-tertiary to-blue-dark rounded-xl p-4 text-white shadow-md hover:-translate-y-0.5 transition-transform duration-300"
            >
              <div className="flex items-center gap-2 mb-1.5">
                <div className="p-1 bg-white/20 rounded-lg">
                  <Headphones className="w-4 h-4" />
                </div>
                <span className="font-bold text-sm text-primary">Nethelp</span>
              </div>
              <p className="text-xs leading-snug opacity-90">
                Suporte exclusivo para veículos em período de garantia legal.
              </p>
            </a>
          </div>

          {/* Coluna 2: Lojas */}
          <div>
            <h2 className="text-[10px] font-bold text-muted-foreground mb-5 uppercase tracking-widest">
              Nossas Lojas
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {/* Loja 1 */}
              <article className="group">
                <a
                  href={buildLojaMapsUrl("Loja1")}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Abrir localização da Loja 1 (Matriz) no Google Maps"
                  title="Abrir no Google Maps"
                  className="block cursor-pointer hover:opacity-95 transition-opacity"
                >
                  <div className="aspect-[16/10] rounded-xl overflow-hidden mb-3 relative">
                    <div className="absolute top-2 left-2 bg-primary/90 backdrop-blur px-2.5 py-1 rounded text-[9px] font-bold text-white uppercase tracking-wide z-10">
                      Matriz
                    </div>
                    <img
                      src={optimizeStockImage(imagemLoja1, 640)}
                      srcSet={stockImageSrcSet(imagemLoja1, [320, 480, 640])}
                      sizes="(max-width: 639px) 100vw, 320px"
                      width={640}
                      height={400}
                      loading="lazy"
                      decoding="async"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      alt="Loja 1"
                      onError={(e) => {
                        if (
                          !e.currentTarget.src.endsWith("/images/loja1.webp")
                        ) {
                          e.currentTarget.srcset = "";
                          e.currentTarget.src = "/images/loja1.webp";
                        }
                      }}
                    />
                  </div>
                  <h3 className="font-bold text-fg text-sm mb-1 group-hover:text-primary transition-colors">
                    Loja 1
                  </h3>
                  {addressLoja1?.address && (
                    <p
                      className="text-xs text-muted-foreground leading-relaxed mb-2"
                      dangerouslySetInnerHTML={{
                        __html: addressLoja1.address.replace(/ - /g, "<br/>"),
                      }}
                    />
                  )}
                </a>
                {loja1Phone && (
                  <a
                    href={phoneHref(loja1Phone)}
                    data-phone-source="footer_store_1"
                    className="mt-2 inline-flex text-sm font-semibold text-fg hover:text-primary hover:underline"
                  >
                    {formatPhone(loja1Phone)}
                  </a>
                )}
              </article>

              {/* Loja 2 */}
              <article className="group">
                <a
                  href={buildLojaMapsUrl("Loja2")}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Abrir localização da Loja 2 (Filial) no Google Maps"
                  title="Abrir no Google Maps"
                  className="block cursor-pointer hover:opacity-95 transition-opacity"
                >
                  <div className="aspect-[16/10] rounded-xl overflow-hidden mb-3 relative">
                    <div className="absolute top-2 left-2 bg-amber-500/90 backdrop-blur px-2.5 py-1 rounded text-[9px] font-bold text-white uppercase tracking-wide z-10">
                      Filial
                    </div>
                    <img
                      src={optimizeStockImage(imagemLoja2, 640)}
                      srcSet={stockImageSrcSet(imagemLoja2, [320, 480, 640])}
                      sizes="(max-width: 639px) 100vw, 320px"
                      width={640}
                      height={400}
                      loading="lazy"
                      decoding="async"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      alt="Loja 2"
                      onError={(e) => {
                        if (
                          !e.currentTarget.src.endsWith("/images/loja2.webp")
                        ) {
                          e.currentTarget.srcset = "";
                          e.currentTarget.src = "/images/loja2.webp";
                        }
                      }}
                    />
                  </div>
                  <h3 className="font-bold text-fg text-sm mb-1 group-hover:text-primary transition-colors">
                    Loja 2
                  </h3>
                  {addressLoja2?.address && (
                    <p
                      className="text-xs text-muted-foreground leading-relaxed mb-2"
                      dangerouslySetInnerHTML={{
                        __html: addressLoja2.address.replace(/ - /g, "<br/>"),
                      }}
                    />
                  )}
                </a>
                {loja2Phone && (
                  <a
                    href={phoneHref(loja2Phone)}
                    data-phone-source="footer_store_2"
                    className="mt-2 inline-flex text-sm font-semibold text-fg hover:text-primary hover:underline"
                  >
                    {formatPhone(loja2Phone)}
                  </a>
                )}
              </article>
            </div>
          </div>

          {/* Coluna 3: Menu */}
          <div>
            <h2 className="text-[10px] font-bold text-muted-foreground mb-5 uppercase tracking-widest">
              Menu
            </h2>
            <ul className="space-y-2.5">
              {menuLinks.map((link) => (
                <li key={link.to}>
                  {link.external ? (
                    <a
                      href={link.to}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-muted-foreground hover:text-primary transition-colors"
                    >
                      {link.label}
                    </a>
                  ) : (
                    <Link
                      to={link.to}
                      search={"search" in link ? link.search : undefined}
                      className="text-sm text-muted-foreground hover:text-primary transition-colors"
                    >
                      {link.label}
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          </div>

          {/* Coluna 4: Social */}
          <div>
            <h2 className="text-[10px] font-bold text-muted-foreground mb-5 uppercase tracking-widest">
              Conecte-se
            </h2>
            <div className="flex gap-2">
              <a
                href="https://instagram.com/netcar_rc"
                aria-label="Instagram da Netcar"
                target="_blank"
                rel="noopener noreferrer"
                className="w-10 h-10 flex items-center justify-center rounded-lg border border-border text-muted-foreground hover:border-primary hover:text-primary transition-colors"
              >
                <Instagram className="w-4 h-4" />
              </a>
              <a
                href="https://www.facebook.com/NetcarRC"
                aria-label="Facebook da Netcar"
                target="_blank"
                rel="noopener noreferrer"
                className="w-10 h-10 flex items-center justify-center rounded-lg border border-border text-muted-foreground hover:border-primary hover:text-primary transition-colors"
              >
                <Facebook className="w-4 h-4" />
              </a>
            </div>
          </div>
        </div>

        {/* O hub concentra a arquitetura regional; o rodapé destaca só mercados próximos. */}
        <div className="border-t border-border pt-6 pb-2">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
              Atendimento regional
            </h2>
            <div className="flex flex-wrap gap-4 text-xs font-semibold">
              <Link
                to="/regioes-atendidas"
                className="text-[#00616A] hover:underline"
              >
                Ver todas as regiões
              </Link>
              <Link to="/compra" className="text-[#00616A] hover:underline">
                Vender meu carro
              </Link>
            </div>
          </div>
          <ul className="flex flex-wrap gap-x-5 gap-y-2">
            {priorityCityPages.map((city) => (
              <li key={city.slug}>
                <Link
                  to="/seminovos-{$citySlug}"
                  params={{ citySlug: city.slug }}
                  className="text-sm text-muted-foreground hover:text-primary transition-colors"
                >
                  Seminovos perto de {city.name}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        {/* Seminovos por marca/categoria (gerado do estoque real) */}
        {landingPages.length > 0 && (
          <div className="border-t border-border pt-6 pb-2">
            <h2 className="text-[10px] font-bold text-muted-foreground mb-4 uppercase tracking-widest">
              Seminovos por marca e categoria
            </h2>
            <ul className="flex flex-wrap gap-x-5 gap-y-2">
              {landingPages.map((landing) => (
                <li key={landing.slug}>
                  <Link
                    to="/comprar-{$landingSlug}"
                    params={{ landingSlug: landing.slug }}
                    className="text-sm text-muted-foreground hover:text-primary transition-colors"
                  >
                    {landing.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="border-t border-border pt-6 pb-4">
          <p className="text-xs text-muted-foreground leading-relaxed">
            Netcar Multimarcas — seminovos revisados e compra de usados em
            Esteio/RS. Atendimento remoto para Grande Porto Alegre, Vale do
            Paranhana e Serra Gaúcha; lojas físicas somente na Av. Presidente
            Vargas, em Esteio.
          </p>
        </div>

        {/* Texto Legal */}
        <div className="border-t border-border pt-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <p className="text-[10px] text-muted-foreground leading-relaxed flex-1">
            <span className="font-bold block mb-1">
              R&C VEÍCULOS LTDA - CNPJ: 02.237.969/0001-06
            </span>
            Política de Reserva: devido à grande rotatividade de nosso estoque e
            dinâmica da nossa equipe comercial, informamos que só será aceita
            reserva de veículo mediante pagamento de sinal de negócio e aceite
            do Termo de Sinal de Negócio.
          </p>

          <a
            href="https://app.zapsign.com.br/verificar/sustentabilidade/netcar"
            target="_blank"
            rel="noopener noreferrer"
            className="flex-shrink-0 hover:opacity-80 transition-opacity"
          >
            <img
              src={optimizeStockImage(
                "/images/selo-sustentabilidade.webp",
                200,
              )}
              alt="Selo Sustentabilidade"
              width={160}
              height={64}
              loading="lazy"
              decoding="async"
              className="h-16 w-auto object-contain"
              onError={(e) => {
                e.currentTarget.style.display = "none";
              }}
            />
          </a>
        </div>
      </section>
    </footer>
  );
}
