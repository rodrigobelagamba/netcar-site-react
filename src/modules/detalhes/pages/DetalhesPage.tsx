import { useParams, useLocation } from "@tanstack/react-router";
import { motion, AnimatePresence } from "framer-motion";
import {
  MessageCircleMore,
  X,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Download,
  Phone,
  CheckSquare,
  LucideIcon,
} from "lucide-react";
import React, { useState, useMemo } from "react";
import { useVehicleQuery } from "@/api/queries/useVehicleQuery";
import { useVehiclesQuery } from "@/api/queries/useVehiclesQuery";
import { useWhatsAppQuery } from "@/api/queries/useSiteQuery";
import { useAnuncioQuery } from "@/api/queries/useAnuncioQuery";
import { formatWhatsAppNumber } from "@/lib/formatters";
import iCheckLogo from "@/assets/images/i-check-ogo.svg";
import icon1 from "@/assets/images/icon-1.svg";
import { VehicleCard } from "@/design-system/components/patterns/VehicleCard";
import { FabricaDeValor } from "@/design-system/components/patterns/FabricaDeValor";
import { EmbedSocialSection } from "@/design-system/components/patterns/EmbedSocialSection";
import { Localizacao } from "@/design-system/components/layout/Localizacao";
import { IanBot } from "@/design-system/components/layout/IanBot";
import { maskPlate } from "@/lib/slug";
import { useMetaTags } from "@/hooks/useMetaTags";
import { VehicleSchemaOrg } from "@/components/seo/VehicleSchemaOrg";
import { parseGptContent, AccordionSection } from "@/lib/parseGptContent";

// Constantes de animação
const ANIMATION_EASING = [0.25, 0.1, 0.25, 1] as const;
const ANIMATION_DURATION = {
  fast: 0.3,
  normal: 0.7,
  slow: 0.8,
} as const;

// Constantes de imagem
const CAR_COVERED_PLACEHOLDER_URL = "/images/semcapa.png";
const PROBLEMATIC_IMAGE_PATTERN = "271_131072img_8213";

interface Badge {
  text: string;
  variant: "success" | "purple";
  icon?: boolean;
}

function Badge({ text, variant, icon }: Badge) {
  const bgColor = variant === "success" ? "bg-secondary" : "bg-purple";
  const textColor =
    variant === "success"
      ? "text-secondary-foreground"
      : "text-primary-foreground";

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: ANIMATION_DURATION.normal, ease: ANIMATION_EASING }}
      className={`${bgColor} ${textColor} rounded-[45px] flex items-center uppercase font-bold tracking-wide info-badge`}
    >
      {icon && (
        <div className="flex-shrink-0">
          <CheckSquare className="w-full h-full text-fg" />
    </div>
      )}
      <span className="whitespace-nowrap">{text}</span>
    </motion.div>
  );
}

interface CTAButtonProps {
  text: string;
  icon?: LucideIcon;
  borderColor?: string;
  textColor?: string;
  hoverBgColor?: string;
  className?: string;
  initialAnimation?: boolean;
  onClick?: () => void;
  disabled?: boolean;
}

function CTAButton({
  text,
  icon: Icon,
  borderColor = "border-green",
  textColor = "text-green",
  hoverBgColor = "bg-green-dark",
  className = "",
  initialAnimation = false,
  onClick,
  disabled = false,
}: CTAButtonProps) {
  const [isHovered, setIsHovered] = useState(false);

  const animationProps = initialAnimation
    ? {
        initial: { opacity: 0 },
        whileInView: { opacity: 1 },
        viewport: { once: true },
        transition: {
          duration: ANIMATION_DURATION.slow,
          delay: 0.25,
          ease: ANIMATION_EASING,
        },
      }
    : {};

  return (
    <motion.button
      {...animationProps}
      onHoverStart={() => setIsHovered(true)}
      onHoverEnd={() => setIsHovered(false)}
      onClick={onClick}
      disabled={disabled}
      className={`relative border ${borderColor} rounded-[65px] flex items-center justify-center uppercase font-bold tracking-wide overflow-hidden ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'} ${className}`}
    >
      <motion.div
        className={`absolute inset-0 ${hoverBgColor} rounded-[65px]`}
        initial={{ opacity: 0 }}
        animate={{ opacity: isHovered ? 1 : 0 }}
        transition={{ duration: ANIMATION_DURATION.fast, ease: ANIMATION_EASING }}
      />

      <div className="relative flex items-center h-full">
        <div className="relative overflow-hidden h-full flex items-center">
            <motion.span
              className={`${textColor} whitespace-nowrap relative z-10`}
              initial={{ y: 0, opacity: 1 }}
              animate={{ y: isHovered ? -40 : 0, opacity: isHovered ? 0 : 1 }}
              transition={{ duration: ANIMATION_DURATION.fast, ease: ANIMATION_EASING }}
            >
              {text}
            </motion.span>
            <motion.span
              className="text-white whitespace-nowrap absolute left-0 top-0 h-full flex items-center z-10 info-contact-button"
              initial={{ y: 40, opacity: 0 }}
              animate={{ y: isHovered ? 0 : 40, opacity: isHovered ? 1 : 0 }}
              transition={{ duration: ANIMATION_DURATION.fast, ease: ANIMATION_EASING }}
            >
              {text}
            </motion.span>
        </div>

        {Icon && (
          <div className="relative flex-shrink-0 z-10">
            <Icon
              className={`w-full h-full transition-colors duration-300 ${
                isHovered ? "text-white" : textColor
              }`}
            />
          </div>
        )}
      </div>
    </motion.button>
  );
}

interface ContactButtonProps {
  modeloCompleto?: string;
}

function ContactButton({ modeloCompleto }: ContactButtonProps) {
  const { data: whatsapp } = useWhatsAppQuery();

  const getWhatsAppLink = () => {
    if (!whatsapp?.numero) return "#";
    
    // Mensagem formatada com o modelo do carro
    const message = modeloCompleto 
      ? `Oi gostaria de saber mais sobre o ${modeloCompleto}!`
      : "Oi gostaria de saber mais informações!";
    
    // Se a API já retornou um link, usa ele mas substitui a mensagem
    if (whatsapp.link) {
      // Extrai o número do link existente ou usa o número da API
      const formattedNumber = formatWhatsAppNumber(whatsapp.numero);
      return `https://wa.me/${formattedNumber}?text=${encodeURIComponent(message)}`;
    }
    
    // Senão, gera o link do WhatsApp
    const formattedNumber = formatWhatsAppNumber(whatsapp.numero);
    return `https://wa.me/${formattedNumber}?text=${encodeURIComponent(message)}`;
  };

  const handleClick = () => {
    const link = getWhatsAppLink();
    if (link !== "#") {
      window.open(link, "_blank", "noopener,noreferrer");
    }
  };

  return (
    <CTAButton
      text="Solicitar contato"
      icon={MessageCircleMore}
      borderColor="border-secondary"
      textColor="text-secondary"
      hoverBgColor="bg-secondary"
      className="w-full info-contact-button-wrapper"
      initialAnimation={true}
      onClick={handleClick}
      disabled={!whatsapp?.numero}
    />
  );
}


interface AccordionItemProps {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}

function AccordionItem({
  title,
  children,
  defaultOpen = false,
}: AccordionItemProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: ANIMATION_DURATION.normal, ease: ANIMATION_EASING }}
      className="border-b border-border pb-4 mb-4"
    >
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between text-left group"
      >
        <h3 className="text-primary text-[17px] sm:text-[18px] lg:text-[19px] font-medium pr-4">
          {title}
        </h3>
        <motion.div
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ duration: ANIMATION_DURATION.fast, ease: ANIMATION_EASING }}
          className="flex-shrink-0"
        >
          <ChevronDown className="w-6 h-6 text-muted-foreground" />
        </motion.div>
      </button>

      <motion.div
        initial={false}
        animate={{
          height: isOpen ? "auto" : 0,
          opacity: isOpen ? 1 : 0,
          marginTop: isOpen ? 16 : 0,
        }}
        transition={{ duration: ANIMATION_DURATION.fast, ease: ANIMATION_EASING }}
        className="overflow-hidden"
      >
        {children}
      </motion.div>
    </motion.div>
  );
}

interface SpecBadgeProps {
  label: string;
  value: string;
  index?: number;
}

function SpecBadge({ label, value, index = 0 }: SpecBadgeProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{
        duration: 0.6,
        delay: index * 0.05,
        ease: [0.25, 0.1, 0.25, 1],
      }}
      className="border border-purple rounded-[45px] px-4 h-[26px] flex items-center justify-center whitespace-nowrap"
    >
      <p className="text-purple text-[14px] sm:text-[15px] lg:text-[16px] font-bold uppercase">
        <span>{label} </span>
        <span className="font-light">{value}</span>
      </p>
    </motion.div>
  );
}

interface OptionalItemProps {
  text: string;
}

function OptionalItem({ text }: OptionalItemProps) {
  return (
    <div className="flex items-center gap-2">
      <div className="w-6 h-6 flex-shrink-0 text-primary">
        <svg className="block size-full" fill="none" viewBox="0 0 24 24">
          <mask
            height="24"
            id="mask0_19_234"
            maskUnits="userSpaceOnUse"
            style={{ maskType: "alpha" }}
            width="24"
            x="0"
            y="0"
          >
            <rect fill="hsl(var(--color-muted-foreground))" height="24" width="24" />
          </mask>
          <g mask="url(#mask0_19_234)">
            <path d="M10 17V7L15 12L10 17Z" fill="currentColor" />
          </g>
        </svg>
      </div>
      <span className="text-fg text-[14px] sm:text-[15px] leading-[29px]">
        {text}
      </span>
    </div>
  );
}

interface CTASidebarProps {
  vehicle?: any;
  modeloCompleto?: string;
}

function CTASidebar({ vehicle, modeloCompleto }: CTASidebarProps) {
  const { data: whatsapp } = useWhatsAppQuery();

  const handleDownloadPDF = () => {
    if (!vehicle?.pdf_url && !vehicle?.pdf) {
      console.warn("PDF não disponível para este veículo");
      return;
    }

    // Obtém a URL do PDF (já deve estar normalizada pela API)
    let pdfUrl = vehicle.pdf_url;
    
    // Se não tiver pdf_url mas tiver pdf, constrói a URL
    if (!pdfUrl && vehicle.pdf) {
      const baseDomain = typeof window !== "undefined" 
        ? window.location.origin 
        : "https://www.netcarmultimarcas.com.br";
      pdfUrl = `${baseDomain}/arquivos/autocheck/${vehicle.pdf}`;
    }

    if (!pdfUrl) {
      console.warn("Não foi possível determinar a URL do PDF");
      return;
    }

    // Garante que a URL é absoluta
    if (!pdfUrl.startsWith("http://") && !pdfUrl.startsWith("https://")) {
      const baseDomain = typeof window !== "undefined" 
        ? window.location.origin 
        : "https://www.netcarmultimarcas.com.br";
      pdfUrl = pdfUrl.startsWith("/") 
        ? `${baseDomain}${pdfUrl}` 
        : `${baseDomain}/${pdfUrl}`;
    }

    // Cria um link temporário para fazer o download
    const link = document.createElement("a");
    link.href = pdfUrl;
    link.download = vehicle.pdf || `relatorio-${vehicle.placa || vehicle.id}.pdf`;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    
    // Adiciona ao DOM, clica e remove
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getWhatsAppLink = () => {
    if (!whatsapp?.numero) return "#";
    
    // Mensagem formatada com o modelo do carro
    const message = modeloCompleto 
      ? `Oi gostaria de saber mais sobre o ${modeloCompleto}!`
      : "Oi gostaria de saber mais informações!";
    
    // Se a API já retornou um link, usa ele mas substitui a mensagem
    if (whatsapp.link) {
      // Extrai o número do link existente ou usa o número da API
      const formattedNumber = formatWhatsAppNumber(whatsapp.numero);
      return `https://wa.me/${formattedNumber}?text=${encodeURIComponent(message)}`;
    }
    
    // Senão, gera o link do WhatsApp
    const formattedNumber = formatWhatsAppNumber(whatsapp.numero);
    return `https://wa.me/${formattedNumber}?text=${encodeURIComponent(message)}`;
  };

  const handleWhatsAppClick = () => {
    const link = getWhatsAppLink();
    if (link !== "#") {
      window.open(link, "_blank", "noopener,noreferrer");
    }
  };

  const handleTradeInClick = () => {
    if (!whatsapp?.numero) return;
    
    // Mensagem específica para avaliação de troca com nome do veículo
    const vehicleName = modeloCompleto ? modeloCompleto.toUpperCase() : "";
    const message = vehicleName 
      ? `Oi, gostaria que meu veículo fosse avaliado na troca deste ${vehicleName}.`
      : "Oi, gostaria que meu veículo fosse avaliado na troca.";
    
    // Gera o link do WhatsApp com a mensagem de troca
    const formattedNumber = formatWhatsAppNumber(whatsapp.numero);
    const link = `https://wa.me/${formattedNumber}?text=${encodeURIComponent(message)}`;
    
    window.open(link, "_blank", "noopener,noreferrer");
  };

  const hasPDF = vehicle?.pdf_url || vehicle?.pdf;

  return (
    <div className="space-y-4 lg:space-y-6">
      {/* I-Check Card - Só exibe se houver PDF */}
      {hasPDF && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: ANIMATION_DURATION.normal, ease: ANIMATION_EASING }}
          className="border border-border p-6 sm:p-8 flex flex-col items-center"
        >
          <div className="w-full max-w-[246px] h-[148px] mb-6 overflow-hidden">
            <img
              src={iCheckLogo}
              alt="i-Check"
              className="w-full h-full object-contain"
            />
          </div>

          <div className="w-full max-w-[300px]">
            <CTAButton
              text="Baixe o relatório"
              icon={Download}
              borderColor="border-green"
              textColor="text-green"
              hoverBgColor="bg-green"
              className="w-full bg-green/10"
              onClick={handleDownloadPDF}
            />
          </div>
        </motion.div>
      )}

      {/* Help Card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5, delay: 0.1 }}
        className="border border-border p-6 sm:p-8 flex flex-col items-center"
      >
        <h3 className="text-primary text-[20px] sm:text-[22px] lg:text-[24px] font-bold mb-2 text-center">
          Ficou com dúvidas?
        </h3>
        <p className="text-fg text-[17px] sm:text-[18px] lg:text-[19px] mb-6 text-center">
          Nós te ajudamos
        </p>

        {/* WhatsApp Button */}
        <div className="mb-3 w-full max-w-[300px]">
          <CTAButton
            text="Fale conosco agora"
            icon={Phone}
            borderColor="border-green"
            textColor="text-green"
            hoverBgColor="bg-green"
            className="w-full"
            onClick={handleWhatsAppClick}
            disabled={!whatsapp?.numero}
          />
        </div>

        {/* Trade-in Button */}
        <div className="w-full max-w-[300px]">
          <CTAButton
            text="Avalie seu carro na troca"
            borderColor="border-primary"
            textColor="text-primary"
            hoverBgColor="bg-primary"
            className="w-full"
            onClick={handleTradeInClick}
            disabled={!whatsapp?.numero}
          />
        </div>
      </motion.div>
    </div>
  );
}

interface LightboxProps {
  images: string[];
  currentIndex: number;
  onClose: () => void;
  vehicleName: string;
}

function Lightbox({
  images,
  currentIndex,
  onClose,
  vehicleName,
}: LightboxProps) {
  const [index, setIndex] = useState(currentIndex);

  const handlePrev = () => {
    setIndex((prev) => (prev === 0 ? images.length - 1 : prev - 1));
  };

  const handleNext = () => {
    setIndex((prev) => (prev === images.length - 1 ? 0 : prev + 1));
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-black flex items-center justify-center"
        onClick={onClose}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 sm:top-6 sm:right-6 text-white hover:text-gray-300 transition-colors z-10"
        >
          <X className="w-8 h-8 sm:w-10 sm:h-10" />
        </button>

        {/* Image Counter */}
        <div className="absolute top-4 left-4 sm:top-6 sm:left-6 text-white text-sm sm:text-base font-bold z-10">
          {index + 1} / {images.length}
        </div>

        {/* Main Image */}
        <motion.div
          key={index}
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3 }}
          className="relative w-full h-full flex items-center justify-center"
          onClick={(e) => e.stopPropagation()}
        >
          <img
            src={images[index]}
            alt={`${vehicleName} - Foto ${index + 1} de ${images.length} - Netcar Multimarcas`}
            className="w-full h-full max-w-full object-contain"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = "none";
            }}
          />
        </motion.div>

        {/* Navigation Arrows */}
        {images.length > 1 && (
          <>
            <button
              onClick={(e) => {
                e.stopPropagation();
                handlePrev();
              }}
              className="absolute left-2 sm:left-4 top-1/2 -translate-y-1/2 text-white hover:text-gray-300 transition-colors p-2 sm:p-3 bg-black/50 rounded-full z-10"
            >
              <ChevronLeft className="w-6 h-6 sm:w-8 sm:h-8" />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleNext();
              }}
              className="absolute right-2 sm:right-4 top-1/2 -translate-y-1/2 text-white hover:text-gray-300 transition-colors p-2 sm:p-3 bg-black/50 rounded-full z-10"
            >
              <ChevronRight className="w-6 h-6 sm:w-8 sm:h-8" />
            </button>
          </>
        )}
      </motion.div>
    </AnimatePresence>
  );
}

interface GalleryItemProps {
  image: string;
  index: number;
  onClick: () => void;
  alt: string;
}

function GalleryItem({ image, index, onClick, alt }: GalleryItemProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-50px" }}
      transition={{
        duration: 0.7,
        delay: index * 0.04,
        ease: [0.25, 0.1, 0.25, 1],
      }}
      className="relative overflow-hidden cursor-pointer bg-gray-200 group aspect-[1920/1441]"
      onClick={onClick}
    >
      <div className="relative w-full h-full">
        <img
          src={image}
          alt={alt}
          className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 ease-out group-hover:scale-105"
          onError={(e) => {
            (e.target as HTMLImageElement).style.display = "none";
          }}
        />
        {/* Overlay on hover */}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors duration-500 ease-out" />
      </div>
    </motion.div>
  );
}


function RelatedVehiclesSection({
  currentVehicleId,
  currentCategory,
  currentPrice,
}: {
  currentVehicleId: string;
  currentCategory?: string;
  currentPrice?: number;
}) {
  const { data: vehicles, isLoading } = useVehiclesQuery();

  // Filtrar veículos relacionados
  const relatedVehicles = useMemo(() => {
    if (!vehicles) return [];
    
    // Primeiro filtra veículos básicos (com foto, preço válido, não é o atual)
    const filtered = vehicles
      .filter((v) => {
        // Exclui o veículo atual
        if (String(v.id) === String(currentVehicleId)) return false;
        
        // Filtra apenas carros com preço maior que zero (carro vendido tem valor = 0)
        const price = typeof v.price === 'number' ? v.price : Number(v.price);
        if (!price || isNaN(price) || price <= 0) return false;
        
        // Filtra apenas veículos com foto (images válidas e não vazias)
        const imagesArray = v.images || v.fotos || v.fullImages || [];
        const hasValidImages = imagesArray.length > 0 && 
                               imagesArray.some(img => img && typeof img === 'string' && img.trim().length > 0);
        if (!hasValidImages) return false;
        
        return true;
      })
      .map((v) => {
        const price = typeof v.price === 'number' ? v.price : Number(v.price);
        const vehicleCategory = v.categoria?.toUpperCase() || '';
        const targetCategory = currentCategory?.toUpperCase() || '';
        const sameCategory = currentCategory ? vehicleCategory === targetCategory : false;
        
        return {
          ...v,
          priceDifference: currentPrice ? Math.abs(price - currentPrice) : Infinity,
          sameCategory,
        };
      });

    // Separa veículos da mesma categoria e de outras categorias
    const sameCategoryVehicles = filtered.filter(v => v.sameCategory);
    const otherVehicles = filtered.filter(v => !v.sameCategory);

    // Ordena cada grupo por diferença de preço (mais próximo primeiro)
    const sortByPrice = (a: typeof filtered[0], b: typeof filtered[0]) => {
      if (currentPrice) {
        return a.priceDifference - b.priceDifference;
      }
      // Se não tem preço de referência, ordena por ID maior primeiro (mais recentes)
      const idA = parseInt(a.id) || 0;
      const idB = parseInt(b.id) || 0;
      return idB - idA;
    };

    const sortedSameCategory = sameCategoryVehicles.sort(sortByPrice);
    const sortedOther = otherVehicles.sort(sortByPrice);

    // Combina: primeiro os da mesma categoria, depois completa com os mais próximos de outras categorias
    const result = [...sortedSameCategory];
    
    // Se não tem 4 veículos, completa com os mais próximos de outras categorias
    if (result.length < 4) {
      const needed = 4 - result.length;
      result.push(...sortedOther.slice(0, needed));
    }

    return result.slice(0, 4);
  }, [vehicles, currentVehicleId, currentCategory, currentPrice]);

  if (isLoading || relatedVehicles.length === 0) {
    return null;
  }

  return (
    <section className="w-full py-8 sm:py-12 lg:py-16">
      <div className="container-main px-4 sm:px-6 lg:px-8 xl:px-12 2xl:px-16">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: ANIMATION_DURATION.normal, ease: ANIMATION_EASING }}
          className="mb-8 sm:mb-10 lg:mb-12"
        >
          <div className="flex items-center gap-3 mb-6">
            <div className="w-[26px] h-[26px] sm:w-[28px] sm:h-[28px] lg:w-[30px] lg:h-[30px]">
              <img src={icon1} alt="" className="block size-full" />
            </div>
            <h2 className="section-heading">
              Você também pode gostar
            </h2>
          </div>

          {/* Divider Line */}
          <div className="h-[1px] bg-primary w-full"></div>
        </motion.div>

        {/* Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 3xl:grid-cols-5 gap-6 lg:gap-8 xl:gap-10 overflow-visible">
          {relatedVehicles.map((vehicle) => (
            <VehicleCard
              key={vehicle.id}
              id={String(vehicle.id)}
              name={vehicle.modelo || vehicle.name}
              price={vehicle.price || 0}
              valor_formatado={vehicle.valor_formatado}
              year={vehicle.year || new Date().getFullYear()}
              km={vehicle.km || 0}
              images={vehicle.images || vehicle.fotos || vehicle.fullImages || []}
              marca={vehicle.marca}
              modelo={vehicle.modelo}
              placa={vehicle.placa}
            />
          ))}
        </div>
      </div>
    </section>
  );
}


function PriceWithShimmer({ price }: { price: string }) {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{
        duration: 0.7,
        delay: 0.3,
        ease: [0.25, 0.1, 0.25, 1],
      }}
      className="flex-shrink-0"
    >
      <p
        className={`font-bold whitespace-nowrap cursor-pointer text-secondary leading-tight info-price info-price-shimmer ${
          isHovered ? "info-price-shimmer-hover" : ""
        }`}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        dangerouslySetInnerHTML={{ __html: price }}
      />
    </motion.div>
  );
}

export function DetalhesPage() {
  const { slug: paramSlug } = useParams({ from: "/veiculo/$slug" });
  const location = useLocation();
  const slug = paramSlug || location.pathname.replace(/^\/veiculo\//, "") || "";
  
  const { data: vehicle, isLoading, error } = useVehicleQuery(slug);
  
  // Busca o anúncio (campo GPT) separadamente usando o novo endpoint
  const { data: anuncio } = useAnuncioQuery(vehicle?.id);
  
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  const vehicleData = useMemo(() => {
    if (!vehicle) return null;
    return {
      marca: vehicle.marca || vehicle.name?.split(" ")[0] || "",
      modeloCompleto: vehicle.modelo || vehicle.name || "",
      price:
        vehicle.valor_formatado ||
        (vehicle.price ? `R$ ${vehicle.price.toLocaleString("pt-BR")}` : ""),
      year: vehicle.year ? `${vehicle.year} / ${vehicle.year + 1}` : "",
      combustivel: vehicle.combustivel || "",
      cambio: vehicle.cambio || "",
      images: vehicle.fullImages || vehicle.fotos || vehicle.images || [],
    };
  }, [vehicle]);

  const marca = vehicleData?.marca || "";
  const modeloCompleto = vehicleData?.modeloCompleto || "";
  const price = vehicleData?.price || "";
  const year = vehicleData?.year || "";
  const combustivel = vehicleData?.combustivel || "";
  const cambio = vehicleData?.cambio || "";
  const images = vehicleData?.images || [];
  
  // Filtra apenas imagens AVIF para a galeria
  const avifImages = useMemo(() => {
    return images.filter(
      (img) =>
        img &&
        (img.toLowerCase().endsWith(".avif") || img.toLowerCase().includes(".avif"))
    );
  }, [images]);
  
  const mainImage = useMemo(() => {
    if (!images.length) return CAR_COVERED_PLACEHOLDER_URL;

    const pngImages = images.filter(
      (img) =>
        img &&
        (img.toLowerCase().endsWith(".png") || img.toLowerCase().includes(".png"))
    );

    const firstPng = pngImages[0];
    const isProblematic =
      firstPng?.toLowerCase().includes(PROBLEMATIC_IMAGE_PATTERN);

    return pngImages.length > 0 && !isProblematic && firstPng
      ? firstPng
      : CAR_COVERED_PLACEHOLDER_URL;
  }, [images]);

  // Converte imagem para URL absoluta para metatags
  const absoluteImageUrl = useMemo(() => {
    if (!mainImage) return "";
    if (mainImage.startsWith("http://") || mainImage.startsWith("https://")) {
      return mainImage;
    }
    const baseUrl = typeof window !== "undefined" ? window.location.origin : "";
    return mainImage.startsWith("/")
      ? `${baseUrl}${mainImage}`
      : `${baseUrl}/${mainImage}`;
  }, [mainImage]);

  // Configura metatags para compartilhamento
  const metaTags = useMemo(() => {
    if (!vehicle) return null;

    const titleParts = [
      marca,
      modeloCompleto,
      vehicle.year ? String(vehicle.year) : "",
    ].filter(Boolean);

    const descriptionParts = [
      marca,
      modeloCompleto,
      vehicle.year ? `${vehicle.year} seminovo` : "seminovo",
      vehicle.km ? `com ${vehicle.km.toLocaleString("pt-BR")}km` : "",
      cambio ? `${cambio}` : "",
      combustivel ? `${combustivel}` : "",
      vehicle.price ? `Preço: R$ ${vehicle.price.toLocaleString("pt-BR")}` : "",
    ].filter(Boolean);

    return {
      title: titleParts.length > 0 ? `${titleParts.join(" ")} | Netcar` : "Veículo | Netcar",
      description: descriptionParts.length > 0 
        ? `${descriptionParts.join(". ")}.` 
        : `${marca} ${modeloCompleto} seminovo com garantia, vistoriado e financiamento facilitado.`,
      image: absoluteImageUrl,
      url: typeof window !== "undefined" ? window.location.href : "",
      type: "article" as const,
      imageWidth: 1200,
      imageHeight: 900,
      productBrand: marca,
      productAvailability: "in stock" as const,
      productCondition: "used_like_new" as const,
      productPriceAmount: vehicle.price || 0,
      productPriceCurrency: "BRL" as const,
      productRetailerItemId: vehicle.placa
        ? maskPlate(vehicle.placa).toLowerCase()
        : "",
    };
  }, [vehicle, marca, modeloCompleto, cambio, combustivel, absoluteImageUrl]);

  useMetaTags(
    metaTags || {
      title: "veículo",
      description: "Seminovo é na Netcar",
      image: "",
      url: "",
    }
  );

  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <p className="text-muted-foreground">Carregando...</p>
      </div>
    );
  }

  if (error || !vehicle) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="text-center">
          <p className="text-fg mb-2">Veículo não encontrado</p>
          <p className="text-muted-foreground text-sm mb-2">Slug recebido: {slug || "não fornecido"}</p>
          <p className="text-muted-foreground text-sm mb-2">URL completa: {window.location.pathname}</p>
          {error && (
            <p className="text-red-500 text-sm mb-4">
              Erro: {error instanceof Error ? error.message : String(error)}
            </p>
          )}
          <button onClick={() => window.history.back()}>Voltar</button>
        </div>
      </div>
    );
  }

  // Badges
  const badges: Badge[] = [
    { text: "Vistoriado e aprovado", variant: "success", icon: true },
    { text: "Retire hoje", variant: "purple" },
  ];

  return (
    <main className="overflow-x-hidden max-w-full">
      {vehicle && (
        <VehicleSchemaOrg
          marca={marca}
          modelo={modeloCompleto}
          ano={vehicle.year}
          km={vehicle.km}
          combustivel={combustivel}
          cambio={cambio}
          cor={vehicle.cor}
          images={images}
          price={vehicle.price || 0}
          placa={vehicle.placa}
        />
      )}
      {/* Hero Section */}
      <section className="w-full py-0 pt-0 lg:pt-0 pb-0 relative overflow-hidden max-w-full min-h-[calc(100vh+8vh)] lg:min-h-[calc(100vh+3vh)] 
      xl:min-h-[calc(100vh+1vh)] 2xl:min-h-[95vh] 4xl:min-h-[75vh]">
        {/* Mobile Image - Aparece primeiro no mobile, acima das informações */}
        <div className="lg:hidden w-full mb-6">
          {mainImage && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: ANIMATION_DURATION.normal, ease: ANIMATION_EASING }}
              className="w-full h-[300px] sm:h-[400px] flex items-center justify-center bg-gray-50"
            >
              <img
                src={mainImage}
                alt={`${marca} ${modeloCompleto} ${vehicle.year || ''} - Frente - Netcar Multimarcas`}
                className="w-full h-full max-w-full object-contain"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = "none";
                }}
              />
            </motion.div>
          )}
        </div>

        {/* Left Content - 50% com posicionamento absoluto */}
        <div className="container-main px-4 sm:px-6 lg:px-8 xl:px-12 2xl:px-16 relative">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: ANIMATION_DURATION.slow, ease: ANIMATION_EASING }}
            className="w-full lg:absolute 
            lg:w-[25%] lg:left-[10%] lg:top-[20%]
            xl:w-[25%] xl:left-[5rem] xl:top-[1rem]
            2xl:w-[30%] 2xl:left-[5rem] 2xl:top-[2rem]
            3xl:w-[30%] 3xl:left-[5rem] 3xl:top-[3rem]
            4xl:w-[600px] 4xl:left-[-15rem] 4xl:top-[10rem]
            5xl:w-[50%] 5xl:left-[-50rem] 5xl:top-[20rem] 
            6xl:w-[65%] 6xl:left-[-70rem] 6xl:top-[25rem] 
            pt-2 sm:py-6 lg:py-4 lg:py-6 flex flex-col relative lg:relative z-10
            border border-none"
          >
            {/* Brand */}
            <motion.p
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              transition={{
                duration: 0.8,
                delay: 0.15,
                ease: [0.25, 0.1, 0.25, 1],
              }}
              className="text-muted-foreground uppercase tracking-[0.15em] font-semibold mb-1 sm:mb-1.5 info-brand"
            >
              {marca}
            </motion.p>

            {/* Model */}
            <motion.h1
              initial={{ opacity: 0, y: 15 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{
                duration: 0.8,
                delay: 0.2,
                ease: [0.25, 0.1, 0.25, 1],
              }}
              className="text-fg font-bold leading-[1.15] mb-6 sm:mb-8 max-w-full  break-words info-model"
            >
              {modeloCompleto}
            </motion.h1>

            {/* Badges */}
            <div className="flex flex-wrap gap-1.5 sm:gap-2 mb-4 sm:mb-5">
              {badges.map((badge, idx) => (
                <Badge key={idx} {...badge} />
              ))}
            </div>

            {/* Details Grid - Melhorado */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3 mb-4 sm:mb-5 pb-3 sm:pb-4 border-b border-border/60">
              {year && (
                <div className="flex flex-col">
                  <span className="text-muted-foreground uppercase tracking-wider mb-0.5 font-medium info-label">
                    Modelo
                  </span>
                  <span className="text-fg font-semibold info-value">
                    {year}
                  </span>
                </div>
              )}
              {combustivel && (
                <div className="flex flex-col">
                  <span className="text-muted-foreground uppercase tracking-wider mb-0.5 font-medium info-label">
                    Combustível
                  </span>
                  <span className="text-fg font-semibold uppercase info-value">
                    FLEX
                  </span>
                </div>
              )}
              {cambio && (
                <div className="flex flex-col">
                  <span className="text-muted-foreground uppercase tracking-wider mb-1.5 font-medium info-label">
                    Câmbio
                  </span>
                  <span className="text-fg font-semibold info-value">
                    {cambio}
                  </span>
                </div>
              )}
            </div>

            {/* Price & CTA - Melhorado */}
            <div className="flex flex-col items-center gap-3 w-full">
              <div className="w-full flex justify-center items-center">
                <PriceWithShimmer price={price} />
              </div>
              <div className="w-full">
                <ContactButton modeloCompleto={modeloCompleto} />
              </div>
            </div>
          </motion.div>
        </div>

        {/* Desktop Image - Posicionamento absoluto apenas no desktop - Vindo da direita - Sem limite */}
        <motion.div
          initial={{ opacity: 0, x: 100 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          transition={{ duration: ANIMATION_DURATION.slow, ease: ANIMATION_EASING }}
          className="desktop-hero-image hidden lg:block absolute pointer-events-none select-none z-[2]
                     lg:w-[70vw] lg:top-[-3rem] lg:right-[-15%] lg:translate-x-0
                     xl:w-[70vw] xl:top-[-10rem] xl:right-[-5rem]
                     2xl:w-[70vw] 2xl:top-[-15rem] 2xl:right-[-25rem]
                     3xl:w-[70vw] 3xl:top-[-15rem] 3xl:right-[-30rem]
                     4xl:w-[70vw] 4xl:top-[-20rem] 4xl:right-[-30rem]
                     5xl:w-[70vw] 5xl:top-[-35rem] 5xl:right-[-30rem]"
        >
          {mainImage && (
            <div className="w-full h-full flex items-start justify-center overflow-visible">
              <img
                src={mainImage}
                alt={`${marca} ${modeloCompleto} ${vehicle.year || ''} - Frente - Netcar Multimarcas`}
                className="w-full h-auto object-contain"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = "none";
                }}
              />
            </div>
          )}
        </motion.div>
      </section>

      {/* Gallery Section */}
      {avifImages.length > 0 && (
        <section className="w-full py-8 sm:py-12 lg:py-16">
          <div className="container-main px-4 sm:px-6 lg:px-8 xl:px-12 2xl:px-16">
          </div>
          {/* Grid Container - Ocupa toda a largura sem padding */}
          <div className="w-full grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 3xl:grid-cols-6 4xl:grid-cols-7 5xl:grid-cols-8 gap-1 sm:gap-2">
            {avifImages.map((image, index) => (
              <GalleryItem
                key={index}
                image={image}
                index={index}
                alt={`${marca} ${modeloCompleto} ${vehicle.year || ''} - Foto ${index + 1} - Netcar Multimarcas`}
                onClick={() => {
                  setLightboxIndex(index);
                  setLightboxOpen(true);
                }}
              />
            ))}
          </div>
        </section>
      )}

      {/* Lightbox Modal */}
      {lightboxOpen && (
        <Lightbox
          images={avifImages}
          currentIndex={lightboxIndex}
          onClose={() => setLightboxOpen(false)}
          vehicleName={modeloCompleto}
        />
      )}

      {/* Details Section */}
      <DetailsSection vehicle={vehicle} anuncio={anuncio || null} />

      {/* Fábrica de Valor Section */}
      <section className="w-full pt-4 pb-8 sm:pt-6 sm:pb-12 lg:pt-8 lg:pb-16 bg-surface">
        <div className="container-main px-4 sm:px-6 lg:px-8 xl:px-12 2xl:px-16">
          <FabricaDeValor />
        </div>
      </section>

      {/* Related Vehicles Section */}
      <RelatedVehiclesSection 
        currentVehicleId={String(vehicle.id)} 
        currentCategory={vehicle.categoria}
        currentPrice={vehicle.price}
      />

      {/* Social Embeds Section (deve ser a última sessão) */}
      <EmbedSocialSection />

      <div className="w-full font-sans antialiased text-muted-foreground bg-muted py-12 px-4 md:px-8 space-y-8">
        <Localizacao />
        <IanBot />
      </div>
    </main>
  );
}

interface DetailsSectionProps {
  vehicle: any;
  anuncio?: string | null;
}

function DetailsSection({ vehicle, anuncio }: DetailsSectionProps) {
  const [showMoreOptionals, setShowMoreOptionals] = useState(false);

  const marca = vehicle.marca || vehicle.name?.split(" ")[0] || "";
  const modeloCompleto = vehicle.modelo || vehicle.name || "";
  const year = vehicle.year || 0;

  // Parse do conteúdo do anúncio (vem do endpoint separado)
  const gptContent = useMemo(() => parseGptContent(anuncio || null), [anuncio]);

  const specifications = [
    vehicle.year && { label: "Ano:", value: `${year}` },
    vehicle.cor && { label: "Cor:", value: vehicle.cor },
    vehicle.portas && { label: "Portas:", value: `${vehicle.portas}` },
    vehicle.placa && { label: "Placa:", value: maskPlate(vehicle.placa) },
    vehicle.motor && { label: "Motor:", value: vehicle.motor },
    vehicle.potencia && { label: "Potência:", value: `${vehicle.potencia} cv` },
    vehicle.combustivel && {
      label: "Combustível:",
      value: vehicle.combustivel,
    },
    vehicle.cambio && { label: "Câmbio:", value: vehicle.cambio },
  ].filter(Boolean) as Array<{ label: string; value: string }>;

  // Mapeamento de tags para pesos (peso menor = maior prioridade)
  const OPTIONAL_PRIORITY_MAP: Record<string, number> = {
    "sete_lugares": 1,           // 7 Lugares
    "teto_panoramico": 2,        // Teto Panorâmico
    "teto_solar": 3,             // Teto Solar (somente se panorâmico não estiver presente)
    "multimidia": 4,             // Central Multimídia
    "bancos_de_couro": 5,       // Bancos em Couro
    "piloto_adaptativo": 6,      // Piloto Automático Adaptativo
    "piloto_automatico": 7,     // Piloto Automático (somente se adaptativo não estiver presente)
    "botao": 8,                  // Botão de Partida
  };

  // Peso padrão para opcionais não listados
  const DEFAULT_PRIORITY = 999;

  // Função para ordenar opcionais por prioridade usando tags
  const sortOptionals = (
    optionals: Array<{ tag?: string; descricao?: string } | string>
  ): Array<{ tag?: string; descricao?: string } | string> => {
    // Converte para formato padronizado
    const normalizedOptionals = optionals.map((op) => {
      if (typeof op === "string") {
        return { tag: "", descricao: op };
      }
      return { tag: op.tag || "", descricao: op.descricao || "" };
    });

    // Verifica se existe teto solar panorâmico na lista
    const hasPanoramicSunroof = normalizedOptionals.some(
      (opt) => opt.tag === "teto_panoramico"
    );

    // Verifica se existe piloto automático adaptativo na lista
    const hasAdaptiveCruise = normalizedOptionals.some(
      (opt) => opt.tag === "piloto_adaptativo"
    );

    // Função para obter o peso de um opcional usando a tag
    const getPriority = (optional: { tag: string; descricao: string }): number => {
      const tag = optional.tag.toLowerCase().trim();

      // Verifica se a tag está no mapeamento de prioridades
      if (OPTIONAL_PRIORITY_MAP[tag] !== undefined) {
        // Casos especiais com lógica condicional
        if (tag === "teto_solar") {
          // Teto solar só tem peso 3 se não houver panorâmico
          return hasPanoramicSunroof ? DEFAULT_PRIORITY : OPTIONAL_PRIORITY_MAP[tag];
        }

        if (tag === "piloto_automatico") {
          // Piloto automático só tem peso 7 se não houver adaptativo
          return hasAdaptiveCruise ? DEFAULT_PRIORITY : OPTIONAL_PRIORITY_MAP[tag];
        }

        // Para os outros, retorna o peso direto do mapa
        return OPTIONAL_PRIORITY_MAP[tag];
      }

      return DEFAULT_PRIORITY;
    };

    // Ordena por prioridade (menor peso primeiro)
    return normalizedOptionals.sort((a, b) => {
      const priorityA = getPriority(a as { tag: string; descricao: string });
      const priorityB = getPriority(b as { tag: string; descricao: string });

      // Se as prioridades forem iguais, mantém a ordem original
      if (priorityA === priorityB) {
        return 0;
      }

      return priorityA - priorityB;
    });
  };

  // Extrai opcionais do veículo (pode ser string ou objeto com tag/descricao)
  const rawOptionals =
    vehicle.opcionais?.map((op: any) =>
      typeof op === "string" ? op : { tag: op.tag || "", descricao: op.descricao || op.nome || "" }
    ) || [];

  // Aplica ordenação por prioridade usando tags
  const sortedOptionals = sortOptionals(rawOptionals);

  // Converte de volta para strings (descrição) para renderização
  const optionals = sortedOptionals.map((op) =>
    typeof op === "string" ? op : op.descricao || ""
  );

  // SVG Icon Component
  const SpecIcon = ({ className }: { className?: string }) => (
    <div
      className={
        className ||
        "w-[26px] h-[26px] sm:w-[28px] sm:h-[28px] lg:w-[30px] lg:h-[30px]"
      }
    >
      <img src={icon1} alt="" className="block size-full" />
    </div>
  );

  return (
    <section className="w-full py-8 sm:py-12 lg:py-16">
      <div className="container-main px-4 sm:px-6 lg:px-8 xl:px-12 2xl:px-16">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_410px] gap-8 lg:gap-10">
          {/* Main Content */}
          <div className="order-1 lg:order-1">
            {/* Specifications Section */}
                <motion.div
              initial={{ opacity: 0, y: 15 }}
                  whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: ANIMATION_DURATION.normal, ease: ANIMATION_EASING }}
              className="mb-12"
            >
              <div className="flex items-center gap-3 mb-6 pb-4 border-b border-primary">
                      <SpecIcon />
                <h2 className="section-heading">
                        Especificações
                      </h2>
                    </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">
                      {specifications.map((spec, index) => (
                  <SpecBadge
                          key={index}
                    label={spec.label}
                    value={spec.value}
                    index={index}
                  />
                ))}
                  </div>
                </motion.div>

            {/* Optionals Section */}
            {optionals.length > 0 && (
                  <motion.div
                initial={{ opacity: 0, y: 15 }}
                    whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: ANIMATION_DURATION.normal, ease: ANIMATION_EASING }}
                className="mb-12"
              >
                <div className="flex items-center gap-3 mb-6 pb-4 border-b border-primary">
                        <SpecIcon />
                  <h2 className="section-heading">
                          Opcionais
                        </h2>
                      </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {optionals
                    .slice(0, showMoreOptionals ? optionals.length : 15)
                    .map((optional: string, index: number) => (
                    <motion.div
                        key={index}
                        initial={{ opacity: 0, y: 10 }}
                      whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                      transition={{
                          duration: 0.3,
                        delay: index * 0.05,
                        }}
                      >
                        <OptionalItem text={optional} />
                        </motion.div>
                    ))}
                </div>

                {!showMoreOptionals && optionals.length > 15 && (
                  <motion.button
                    initial={{ opacity: 0 }}
                    whileInView={{ opacity: 1 }}
                    viewport={{ once: true }}
                    onClick={() => setShowMoreOptionals(true)}
                    className="mt-4 text-primary text-[14px] sm:text-[15px] font-bold underline hover:text-primary/80 transition-colors"
                  >
                    Carregar mais informações [+]
                  </motion.button>
                )}
                    </motion.div>
            )}

            {/* Header with Icon */}
              <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
              transition={{ duration: ANIMATION_DURATION.normal, ease: ANIMATION_EASING }}
              className="flex items-start gap-3 mb-6"
            >
              <SpecIcon className="w-[36px] h-[36px] sm:w-[40px] sm:h-[40px] lg:w-[42px] lg:h-[42px] flex-shrink-0 mt-1" />
              <div>
                <h2 className="text-fg text-[18px] sm:text-[20px] lg:text-[22px] font-medium mb-1">
                  {marca} {modeloCompleto} {year}
                </h2>
                <p className="text-primary text-[16px] sm:text-[18px] lg:text-[22px] font-light">
                  Conquiste a cidade com estilo, tecnologia e conforto.
                </p>
              </div>
              </motion.div>

            {/* Introduction */}
            {(gptContent?.apresentacao || !gptContent) && (
                <motion.p
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
              transition={{ duration: ANIMATION_DURATION.normal, ease: ANIMATION_EASING }}
              className="section-text mb-8"
            >
              {gptContent?.apresentacao ? (
                gptContent.apresentacao
              ) : (
                `O novo ${marca} ${modeloCompleto} é a escolha perfeita para quem
                busca um veículo versátil, ideal para famílias modernas e
                aventureiros urbanos. Com um design atrativo e sofisticado, este
                modelo não só parece bom, mas também oferece uma experiência de
                condução excepcional, graças às suas características técnicas
                avançadas e conforto superior.`
              )}
                </motion.p>
            )}

            {/* Accordion Sections */}
            <div className="space-y-2">
              {/* Accordions dinâmicos do GPT */}
              {gptContent && gptContent.accordions.length > 0 ? (
                gptContent.accordions.map((accordion: AccordionSection, index: number) => (
                  <AccordionItem
                    key={index}
                    title={accordion.title}
                    defaultOpen={index === 0}
                  >
                    {typeof accordion.content === "object" && accordion.content !== null && "itens" in accordion.content ? (
                      <>
                        {accordion.content.introducao && (
                          <p className="section-text mb-4">
                            {accordion.content.introducao}
                          </p>
                        )}
                        {accordion.content.itens.length > 0 && (
                          <ul className="space-y-2 list-disc list-outside text-fg text-[14px] sm:text-[15px] leading-[26px] ml-5">
                            {accordion.content.itens.map((item, itemIndex) => (
                              <li key={itemIndex} className="pl-2">
                                {item.label && <strong>{item.label}</strong>} {item.texto}
                              </li>
                            ))}
                          </ul>
                        )}
                      </>
                    ) : (
                      <p className="section-text">
                        {accordion.content}
                      </p>
                    )}
                  </AccordionItem>
                ))
              ) : (
                /* Fallback: Accordions estáticos quando não há conteúdo GPT */
                <>
                  <AccordionItem
                    title="Diferenciais técnicos que destacam o modelo"
                    defaultOpen={true}
                  >
                    <p className="section-text mb-4">
                      O {modeloCompleto} é projetado para proporcionar uma jornada
                      suave e eficiente. Entre os destaques técnicos, este modelo
                      inclui:
                    </p>
                    <ul className="space-y-2 list-disc list-outside section-text ml-5">
                      <li className="pl-2">
                        Motor {vehicle.motor || "potente"} que oferece excelente
                        desempenho e eficiência energética.
                      </li>
                      <li className="pl-2">
                        Câmbio {vehicle.cambio?.toLowerCase() || "automático"} que
                        garante trocas suaves e ágeis.
                      </li>
                      <li className="pl-2">
                        Direção elétrica que proporciona um manuseio preciso e
                        facilita a condução em espaços apertados.
                      </li>
                      <li className="pl-2">
                        Suspensão otimizada que melhora o conforto em diferentes
                        tipos de terreno.
                      </li>
                    </ul>
                  </AccordionItem>

                  <AccordionItem title="Tecnologia e conforto a bordo">
                    <p className="text-fg text-[14px] sm:text-[15px] leading-[26px]">
                      Equipado com as mais recentes tecnologias para garantir
                      conforto e conectividade durante toda a jornada.
                    </p>
                  </AccordionItem>

                  <AccordionItem title="Recursos avançados de segurança">
                    <p className="text-fg text-[14px] sm:text-[15px] leading-[26px]">
                      Sistema completo de segurança com múltiplos air bags, controle
                      de estabilidade e muito mais.
                    </p>
                  </AccordionItem>

                  <AccordionItem title="Espaço e capacidade">
                    <p className="text-fg text-[14px] sm:text-[15px] leading-[26px]">
                      Amplo espaço interno para passageiros e bagagens, perfeito
                      para viagens longas.
                    </p>
                  </AccordionItem>

                  <AccordionItem title="Por que optar pelo modelo?">
                    <p className="text-fg text-[14px] sm:text-[15px] leading-[26px]">
                      Combinação perfeita de design, tecnologia, conforto e
                      economia, ideal para seu dia a dia.
                    </p>
                  </AccordionItem>
                </>
              )}
            </div>
          </div>

          {/* Sticky Sidebar - ordem invertida no mobile */}
          <div className="order-2 lg:order-2 lg:sticky lg:top-8 lg:self-start">
            <CTASidebar vehicle={vehicle} modeloCompleto={modeloCompleto} />
          </div>
        </div>
      </div>
        </section>
  );
}
