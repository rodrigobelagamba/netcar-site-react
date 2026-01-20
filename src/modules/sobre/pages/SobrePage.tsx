import { motion, AnimatePresence } from "framer-motion";
import { useAboutTextQuery, useCountersQuery } from "@/api/queries/useSiteQuery";
import { useBannersLoja1Query, useBannersLoja2Query, useAddressQuery, usePhoneQuery, useWhatsAppQuery } from "@/api/queries/useSiteQuery";
import { useVehiclesQuery } from "@/api/queries/useVehiclesQuery";
import { Link, useNavigate } from "@tanstack/react-router";
import { cn } from "@/lib/cn";
import { useDefaultMetaTags } from "@/hooks/useDefaultMetaTags";
import { useState, useEffect, useMemo } from "react";
import { formatPrice, formatYear } from "@/lib/formatters";
import { generateVehicleSlug } from "@/lib/slug";
import { ChevronLeft, ChevronRight, CheckCircle2, Shield, Award, MapPin, Phone } from "lucide-react";

export function SobrePage() {
  const navigate = useNavigate();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [direction, setDirection] = useState(0);
  
  // Busca dados da API
  const { data: essencia } = useAboutTextQuery("Essência");
  const { data: counters } = useCountersQuery("Sobre");
  const { data: vehicles } = useVehiclesQuery();
  const { data: bannersLoja1 } = useBannersLoja1Query();
  const { data: bannersLoja2 } = useBannersLoja2Query();
  const { data: addressLoja1 } = useAddressQuery("Loja1");
  const { data: addressLoja2 } = useAddressQuery("Loja2");
  const { data: phoneLoja1 } = usePhoneQuery("Loja1");
  const { data: phoneLoja2 } = usePhoneQuery("Loja2");
  const { data: whatsapp } = useWhatsAppQuery();
  const { data: historia } = useAboutTextQuery("História");
  const { data: valores } = useAboutTextQuery("Valores");

  useDefaultMetaTags(
    "Sobre Nós",
    "Desde 1997, a Netcar seleciona carros com histórico, qualidade e transparência. Conheça nossa história e valores."
  );

  // Prepara veículos para o mini carousel
  const heroVehicles = useMemo(() => {
    if (!vehicles) return [];
    return vehicles
      .filter(vehicle => {
        const pngImages = vehicle.images?.filter(img => 
          img && (img.toLowerCase().endsWith('.png') || img.includes('.png'))
        ) || [];
        return pngImages.length > 0;
      })
      .slice(0, 4)
      .map(vehicle => {
        const pngImages = vehicle.images?.filter(img => 
          img && (img.toLowerCase().endsWith('.png') || img.includes('.png'))
        ) || [];
        return {
          id: vehicle.id,
          brand: vehicle.marca || vehicle.name?.split(' ')[0] || '',
          model: vehicle.modelo || vehicle.name || '',
          year: vehicle.year,
          price: vehicle.price,
          image: pngImages[0] || "/images/semcapa.png",
          marca: vehicle.marca,
          modelo: vehicle.modelo,
          placa: vehicle.placa,
        };
      });
  }, [vehicles]);

  const currentVehicle = heroVehicles[currentIndex] || null;

  const nextSlide = () => {
    if (heroVehicles.length === 0) return;
    setDirection(1);
    setCurrentIndex((prev) => (prev + 1) % heroVehicles.length);
  };
  
  const prevSlide = () => {
    if (heroVehicles.length === 0) return;
    setDirection(-1);
    setCurrentIndex((prev) => (prev - 1 + heroVehicles.length) % heroVehicles.length);
  };

  useEffect(() => {
    if (heroVehicles.length === 0) return;
    const timer = setInterval(() => {
      setDirection(1);
      setCurrentIndex((prev) => (prev + 1) % heroVehicles.length);
    }, 5000);
    return () => clearInterval(timer);
  }, [heroVehicles.length]);

  const handleVehicleClick = () => {
    if (!currentVehicle) return;
    const slug = generateVehicleSlug({
      modelo: currentVehicle.modelo || currentVehicle.model,
      marca: currentVehicle.marca || currentVehicle.brand,
      year: currentVehicle.year,
      placa: currentVehicle.placa,
      id: currentVehicle.id,
    });
    navigate({ to: `/veiculo/${slug}` });
  };
  
  // Imagem da fachada para cada loja
  const getFachadaImage = (banners?: Array<{ titulo?: string; imagem: string }>) => {
    if (!banners || banners.length === 0) return "";
    const fachada = banners.find(b => b.titulo?.toLowerCase() === "fachada");
    return fachada?.imagem || banners[0]?.imagem || "";
  };

  const loja1Image = getFachadaImage(bannersLoja1) || "/images/loja1.jpg";
  const loja2Image = getFachadaImage(bannersLoja2) || "/images/loja2.jpg";

  // Formata endereço
  const formatAddress = (address?: { endereco?: string; cidade?: string; estado?: string }) => {
    if (!address) return "";
    const parts = [address.endereco, address.cidade, address.estado].filter(Boolean);
    return parts.join(", ");
  };

  // Formata telefone
  const formatPhone = (phone?: { telefone?: string }) => {
    if (!phone?.telefone) return "";
    return phone.telefone;
  };

  // Timeline items (pode vir da API ou ser estático)
  const timelineItems = [
    { year: "1997", title: "Início em Esteio", description: "Nasce a Netcar com foco em confiança e relacionamento." },
    { year: "2010", title: "Curadoria reforçada", description: "Processos de avaliação e seleção ganham rigor e padronização." },
    { year: "2018", title: "Fábrica de Valor", description: "Preparo técnico estruturado para entrega de qualidade." },
    { year: "2024", title: "Segunda loja", description: "Expansão do showroom e atendimento em dois endereços." },
  ];

  // Equipe (mock - pode vir da API futuramente)
  const team = [
    { name: "Marcelo Marchis", role: "Gestão & Relacionamento" },
    { name: "Gilnei", role: "Consultor Comercial" },
    { name: "Bruno", role: "Consultor Comercial" },
    { name: "Tiago", role: "Consultor Comercial" },
  ];

  return (
    <main className="flex-1 overflow-x-hidden max-w-full bg-gradient-to-b from-white via-gray-50/50 to-white">
      {/* Hero Section */}
      <header className="relative py-24 md:py-32 text-center overflow-hidden">
        <div className="absolute inset-0 -z-10 pointer-events-none">
          <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-primary/5 rounded-full blur-3xl" />
          <div className="absolute bottom-0 right-1/4 w-[400px] h-[400px] bg-primary/8 rounded-full blur-3xl" />
        </div>
        <motion.div 
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="max-w-[1200px] mx-auto px-6"
        >
          <motion.span 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="text-primary text-xs font-semibold tracking-widest uppercase mb-6 block"
          >
            Sobre a Netcar
          </motion.span>
          <h1 className="text-4xl md:text-5xl lg:text-[56px] font-bold leading-tight mb-6 bg-gradient-to-r from-fg via-fg to-primary bg-clip-text">
            Desde 1997, curadoria e<br className="hidden md:block" /> procedência em seminovos.
          </h1>
          <p className="max-w-[680px] mx-auto text-muted-foreground text-lg md:text-xl leading-relaxed">
            Há quase três décadas selecionando carros com histórico, qualidade e transparência.
          </p>
          <div className="flex flex-wrap justify-center gap-6 mt-10">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <CheckCircle2 className="w-5 h-5 text-primary" />
              <span>Procedência comprovada</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <CheckCircle2 className="w-5 h-5 text-primary" />
              <span>Checklist técnico</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <CheckCircle2 className="w-5 h-5 text-primary" />
              <span>Entrega sem surpresa</span>
            </div>
          </div>
        </motion.div>
      </header>

      {/* Nossa essência */}
      <section className="py-16 md:py-20">
        <div className="max-w-[1200px] mx-auto px-6">
          <div className="grid grid-cols-1 lg:grid-cols-[1.25fr_1fr] gap-8 items-center">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.7 }}
              className="relative bg-white rounded-[24px] p-8 md:p-10 shadow-sm hover:shadow-md transition-all overflow-hidden"
            >
              <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-primary via-primary/50 to-transparent" />
              <span className="text-primary text-xs font-semibold uppercase tracking-widest mb-3 block">Nossa essência</span>
              <h2 className="text-2xl md:text-[30px] font-bold mb-4 leading-tight">Curadoria com propósito</h2>
              <p className="text-muted-foreground mb-6 leading-relaxed">
                {essencia?.conteudo || "Selecionamos cada veículo com critérios objetivos de quilometragem, histórico e procedência. O preparo e a transparência fazem parte do processo, para você comprar certo."}
              </p>
              <div className="space-y-3">
                {[
                  { icon: CheckCircle2, text: "Curadoria de estoque com procedência comprovada" },
                  { icon: CheckCircle2, text: "Checklist técnico e histórico de manutenção" },
                  { icon: CheckCircle2, text: "Laudos e documentação quando aplicável" },
                  { icon: CheckCircle2, text: "Atendimento próximo e experiente" },
                ].map((item, idx) => (
                  <div key={idx} className="flex items-start gap-3 group">
                    <item.icon className="w-5 h-5 text-primary flex-shrink-0 mt-0.5 group-hover:scale-110 transition-transform" />
                    <span className="text-muted-foreground text-sm">{item.text}</span>
                  </div>
                ))}
              </div>
            </motion.div>
            {currentVehicle ? (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.7, delay: 0.1 }}
                className="relative h-[320px] rounded-[20px] overflow-hidden border border-border bg-gradient-to-br from-[#F6F6F6] to-[#E8E8E8] cursor-pointer group"
                onClick={handleVehicleClick}
              >
                <AnimatePresence mode="wait" initial={false}>
                  <motion.div
                    key={currentVehicle.id}
                    initial={{ opacity: 0, x: direction > 0 ? 50 : -50 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: direction > 0 ? -50 : 50 }}
                    transition={{ duration: 0.4 }}
                    className="absolute inset-0 flex flex-col"
                  >
                    <div className="flex-1 flex items-center justify-center p-4">
                      <img
                        src={currentVehicle.image}
                        alt={currentVehicle.model}
                        className="max-h-[180px] w-auto object-contain drop-shadow-lg group-hover:scale-105 transition-transform"
                      />
                    </div>
                    <div className="bg-white/90 backdrop-blur-sm p-4 border-t border-border">
                      <div className="text-xs text-primary font-semibold uppercase tracking-wider">{currentVehicle.brand}</div>
                      <div className="text-lg font-bold text-fg truncate">{currentVehicle.model}</div>
                      <div className="flex items-center justify-between mt-1">
                        <span className="text-sm text-muted-foreground">{formatYear(currentVehicle.year)}</span>
                        <span className="text-primary font-bold">{formatPrice(currentVehicle.price)}</span>
                      </div>
                    </div>
                  </motion.div>
                </AnimatePresence>
                
                {heroVehicles.length > 1 && (
                  <>
                    <button
                      onClick={(e) => { e.stopPropagation(); prevSlide(); }}
                      className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/80 hover:bg-white flex items-center justify-center shadow-md transition-all z-10"
                    >
                      <ChevronLeft className="w-4 h-4 text-fg" />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); nextSlide(); }}
                      className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/80 hover:bg-white flex items-center justify-center shadow-md transition-all z-10"
                    >
                      <ChevronRight className="w-4 h-4 text-fg" />
                    </button>
                    <div className="absolute bottom-20 left-1/2 -translate-x-1/2 flex gap-1.5 z-10">
                      {heroVehicles.map((_, idx) => (
                        <button
                          key={idx}
                          onClick={(e) => { e.stopPropagation(); setDirection(idx > currentIndex ? 1 : -1); setCurrentIndex(idx); }}
                          className={cn(
                            "w-2 h-2 rounded-full transition-all",
                            idx === currentIndex ? "bg-primary w-4" : "bg-gray-300 hover:bg-gray-400"
                          )}
                        />
                      ))}
                    </div>
                  </>
                )}
              </motion.div>
            ) : (
              <motion.figure
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.7, delay: 0.1 }}
                className="relative h-[320px] rounded-[20px] overflow-hidden border border-border"
              >
                <img
                  src="/images/loja1.jpg"
                  alt="Showroom da Netcar"
                  className="w-full h-full object-cover transition-transform hover:scale-105"
                />
              </motion.figure>
            )}
          </div>
        </div>
      </section>

      {/* Nossos números */}
      <section className="py-16 md:py-20">
        <div className="max-w-[1200px] mx-auto px-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7 }}
            className="relative bg-gradient-to-br from-[#00283C] to-[#004560] rounded-[32px] p-8 md:p-12 shadow-2xl overflow-hidden"
          >
            <div className="absolute top-0 right-0 w-[300px] h-[300px] bg-primary/20 rounded-full blur-3xl" />
            <div className="absolute bottom-0 left-0 w-[200px] h-[200px] bg-white/5 rounded-full blur-2xl" />
            <div className="relative z-10">
              <div className="text-center mb-10">
                <h2 className="text-2xl md:text-[32px] font-bold mb-2 text-white">Nossos números</h2>
                <p className="text-white/70 max-w-lg mx-auto">Resultados consistentes construídos com relacionamento e transparência.</p>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
                {counters && counters.length > 0 ? (
                  counters.slice(0, 4).map((counter, index) => (
                    <motion.div
                      key={index}
                      initial={{ opacity: 0, scale: 0.9 }}
                      whileInView={{ opacity: 1, scale: 1 }}
                      viewport={{ once: true }}
                      transition={{ duration: 0.5, delay: index * 0.1 }}
                      className="bg-white/10 backdrop-blur-sm border border-white/10 rounded-[20px] p-6 text-center hover:bg-white/15 transition-all hover:-translate-y-1"
                    >
                      <div className="text-3xl md:text-4xl lg:text-[44px] font-bold mb-2 text-white">
                        {counter.valor.toLocaleString("pt-BR")}
                      </div>
                      <div className="text-white/60 text-sm">{counter.titulo}</div>
                    </motion.div>
                  ))
                ) : (
                  <>
                    {[
                      { value: "1997", label: "Desde" },
                      { value: "+2.500", label: "Clientes atendidos" },
                      { value: "2", label: "Lojas em Esteio/RS" },
                      { value: "100%", label: "Estoque com procedência" },
                    ].map((item, index) => (
                      <motion.div
                        key={index}
                        initial={{ opacity: 0, scale: 0.9 }}
                        whileInView={{ opacity: 1, scale: 1 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.5, delay: index * 0.1 }}
                        className="bg-white/10 backdrop-blur-sm border border-white/10 rounded-[20px] p-6 text-center hover:bg-white/15 transition-all hover:-translate-y-1"
                      >
                        <div className="text-3xl md:text-4xl lg:text-[44px] font-bold mb-2 text-white">{item.value}</div>
                        <div className="text-white/60 text-sm">{item.label}</div>
                      </motion.div>
                    ))}
                  </>
                )}
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Nossas lojas */}
      <section className="py-16 md:py-20">
        <div className="max-w-[1200px] mx-auto px-6">
          <div className="mb-10">
            <span className="text-primary text-xs font-semibold uppercase tracking-widest mb-3 block">Onde estamos</span>
            <h2 className="text-2xl md:text-[32px] font-bold mb-2">Nossas lojas</h2>
            <p className="text-muted-foreground max-w-lg">Dois endereços em Esteio/RS para melhor atendê-lo.</p>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 md:gap-8">
            {/* Loja 1 */}
            <motion.article
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.7 }}
              className="relative bg-white rounded-[20px] overflow-hidden shadow-sm hover:shadow-md transition-all group"
            >
              <div className="relative h-[240px] overflow-hidden">
                <img
                  src={loja1Image}
                  alt="Fachada da Loja 1"
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                  onError={(e) => {
                    e.currentTarget.src = "/images/loja1.jpg";
                  }}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                <div className="absolute bottom-4 left-6 right-6">
                  <span className="inline-block px-3 py-1 bg-primary text-white text-xs font-bold rounded-full mb-2">Matriz</span>
                  <h3 className="text-xl font-bold text-white">Loja 1 — Centro</h3>
                </div>
              </div>
              <div className="p-6 space-y-4">
                <div className="flex items-start gap-3">
                  <MapPin className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                  <span className="text-muted-foreground text-sm">{formatAddress(addressLoja1) || "Av. Presidente Vargas, 740, Esteio/RS"}</span>
                </div>
                <div className="flex items-start gap-3">
                  <Phone className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                  <span className="text-muted-foreground text-sm">{formatPhone(phoneLoja1) || "(51) 3473‑7900"}</span>
                </div>
                <p className="text-muted-foreground text-sm pt-2 border-t border-gray-100">Showroom amplo, atendimento personalizado e test‑drive.</p>
              </div>
            </motion.article>

            {/* Loja 2 */}
            <motion.article
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.7, delay: 0.1 }}
              className="relative bg-white rounded-[20px] overflow-hidden shadow-sm hover:shadow-md transition-all group"
            >
              <div className="relative h-[240px] overflow-hidden">
                <img
                  src={loja2Image}
                  alt="Fachada da Loja 2"
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                  onError={(e) => {
                    e.currentTarget.src = "/images/loja2.jpg";
                  }}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                <div className="absolute bottom-4 left-6 right-6">
                  <span className="inline-block px-3 py-1 bg-fg text-white text-xs font-bold rounded-full mb-2">Filial</span>
                  <h3 className="text-xl font-bold text-white">Loja 2 — Centro</h3>
                </div>
              </div>
              <div className="p-6 space-y-4">
                <div className="flex items-start gap-3">
                  <MapPin className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                  <span className="text-muted-foreground text-sm">{formatAddress(addressLoja2) || "Av. Presidente Vargas, 1106, Esteio/RS"}</span>
                </div>
                <div className="flex items-start gap-3">
                  <Phone className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                  <span className="text-muted-foreground text-sm">{formatPhone(phoneLoja2) || "(51) 3033‑3900"}</span>
                </div>
                <p className="text-muted-foreground text-sm pt-2 border-t border-gray-100">Seleção de seminovos e condições especiais de financiamento.</p>
              </div>
            </motion.article>
          </div>
        </div>
      </section>

      {/* Linha do tempo + Valores */}
      <section className="py-16 md:py-20">
        <div className="max-w-[1200px] mx-auto px-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 md:gap-8 items-stretch">
            {/* Nossa história */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.7 }}
              className="relative bg-white rounded-[24px] p-8 md:p-10 shadow-sm h-full overflow-hidden"
            >
              <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-primary via-primary/50 to-transparent" />
              <span className="text-primary text-xs font-semibold uppercase tracking-widest mb-3 block">Trajetória</span>
              <h2 className="text-2xl md:text-[28px] font-bold mb-4">Nossa história</h2>
              {historia?.conteudo ? (
                <div
                  className="text-muted-foreground"
                  dangerouslySetInnerHTML={{ __html: historia.conteudo }}
                />
              ) : (
                <div className="relative pl-6">
                  <div className="absolute top-0 bottom-0 left-2 w-0.5 bg-gradient-to-b from-primary to-transparent opacity-40" />
                  {timelineItems.map((item, index) => (
                    <motion.div 
                      key={index} 
                      className="relative pl-4 pb-4 transition-transform hover:translate-x-1"
                      initial={{ opacity: 0, x: -10 }}
                      whileInView={{ opacity: 1, x: 0 }}
                      viewport={{ once: true }}
                      transition={{ duration: 0.5, delay: index * 0.1 }}
                    >
                      <motion.div 
                        className="absolute left-[-2px] top-5 w-2.5 h-2.5 rounded-full bg-primary"
                        animate={{
                          boxShadow: [
                            "0 0 0 0 rgba(108, 196, 202, 0.7)",
                            "0 0 0 8px rgba(108, 196, 202, 0)",
                            "0 0 0 0 rgba(108, 196, 202, 0)",
                          ],
                        }}
                        transition={{
                          duration: 2,
                          repeat: Infinity,
                          delay: index * 0.5,
                        }}
                      />
                      <h4 className="font-semibold mb-1">{item.year} — {item.title}</h4>
                      <p className="text-muted-foreground text-sm">{item.description}</p>
                    </motion.div>
                  ))}
                </div>
              )}
            </motion.div>

            {/* Nossos valores */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.7, delay: 0.1 }}
              className="relative bg-white rounded-[24px] p-8 md:p-10 shadow-sm h-full overflow-hidden"
            >
              <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-primary via-primary/50 to-transparent" />
              <span className="text-primary text-xs font-semibold uppercase tracking-widest mb-3 block">Princípios</span>
              <h2 className="text-2xl md:text-[28px] font-bold mb-4">Nossos valores</h2>
              {valores?.conteudo ? (
                <div
                  className="text-muted-foreground"
                  dangerouslySetInnerHTML={{ __html: valores.conteudo }}
                />
              ) : (
                <div className="space-y-4">
                  {[
                    { icon: Shield, title: "Transparência", description: "Informação clara em cada etapa da compra." },
                    { icon: CheckCircle2, title: "Procedência", description: "Histórico e documentação verificados." },
                    { icon: Award, title: "Experiência", description: "Desde 1997 no mercado de seminovos." },
                  ].map((valor, index) => (
                    <motion.div
                      key={index}
                      initial={{ opacity: 0, x: -10 }}
                      whileInView={{ opacity: 1, x: 0 }}
                      viewport={{ once: true }}
                      transition={{ duration: 0.5, delay: index * 0.1 }}
                      className="flex items-start gap-4 py-4 border-b border-gray-100 last:border-0 hover:pl-2 transition-all group"
                    >
                      <valor.icon className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                      <div>
                        <h4 className="font-semibold mb-0.5 group-hover:text-primary transition-colors">{valor.title}</h4>
                        <p className="text-muted-foreground text-sm">{valor.description}</p>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </motion.div>
          </div>
        </div>
      </section>

      {/* Equipe */}
      <section className="py-16 md:py-20 bg-gray-50/50">
        <div className="max-w-[1200px] mx-auto px-6">
          <div className="text-center mb-10">
            <span className="text-primary text-xs font-semibold uppercase tracking-widest mb-3 block">Quem faz acontecer</span>
            <h2 className="text-2xl md:text-[32px] font-bold mb-2">Nossa equipe</h2>
            <p className="text-muted-foreground max-w-lg mx-auto">Experiência, cuidado e atenção a cada detalhe.</p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
            {team.map((person, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                className="text-center group"
              >
                <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-gradient-to-br from-gray-100 to-gray-50 flex items-center justify-center transition-all group-hover:from-primary/10 group-hover:to-primary/5">
                  <span className="text-2xl font-bold text-gray-300 group-hover:text-primary transition-colors">
                    {person.name.charAt(0)}
                  </span>
                </div>
                <h5 className="font-semibold text-fg">{person.name}</h5>
                <p className="text-muted-foreground text-sm">{person.role}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Estoque */}
      <section className="py-16 md:py-20">
        <div className="max-w-[1200px] mx-auto px-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7 }}
            className="relative bg-gradient-to-br from-[#00283C] to-[#004560] rounded-[32px] text-center p-10 md:p-16 shadow-2xl overflow-hidden"
          >
            <div className="absolute top-0 left-0 w-[400px] h-[400px] bg-primary/20 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2" />
            <div className="absolute bottom-0 right-0 w-[300px] h-[300px] bg-white/5 rounded-full blur-3xl translate-x-1/2 translate-y-1/2" />
            <div className="relative z-10">
              <h3 className="text-3xl md:text-4xl font-bold mb-4 text-white">Quer ver nosso estoque qualificado?</h3>
              <p className="text-white/70 mb-8 max-w-lg mx-auto text-lg">Fale com a equipe ou explore as ofertas atualizadas nas duas lojas.</p>
              <div className="flex flex-wrap gap-4 justify-center">
                <Link
                  to="/seminovos"
                  search={{
                    marca: undefined,
                    modelo: undefined,
                    precoMin: undefined,
                    precoMax: undefined,
                    anoMin: undefined,
                    anoMax: undefined,
                    cambio: undefined,
                    cor: undefined,
                  }}
                  className={cn(
                    "px-8 py-4 rounded-xl font-bold tracking-wide text-lg",
                    "bg-primary text-white shadow-lg transition-all",
                    "hover:-translate-y-1 hover:shadow-xl hover:bg-primary/90"
                  )}
                >
                  Ver estoque
                </Link>
                {whatsapp?.link && (
                  <a
                    href={whatsapp.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={cn(
                      "px-8 py-4 rounded-xl font-bold tracking-wide text-lg",
                      "bg-white/10 text-white border border-white/20 backdrop-blur-sm transition-all",
                      "hover:-translate-y-1 hover:bg-white/20"
                    )}
                  >
                    Chamar no WhatsApp
                  </a>
                )}
              </div>
            </div>
          </motion.div>
        </div>
      </section>
    </main>
  );
}
