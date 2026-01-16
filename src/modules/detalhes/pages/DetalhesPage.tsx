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
import { useEffect, useState } from "react";
import { useVehicleQuery } from "@/api/queries/useVehicleQuery";
import { useVehiclesQuery } from "@/api/queries/useVehiclesQuery";
import iCheckLogo from "@/assets/images/i-check-ogo.svg";
import icon1 from "@/assets/images/icon-1.svg";
import { VehicleCard } from "@/design-system/components/patterns/VehicleCard";
import { FabricaDeValor } from "@/design-system/components/patterns/FabricaDeValor";
import { Localizacao } from "@/design-system/components/layout/Localizacao";
import { IanBot } from "@/design-system/components/layout/IanBot";
import { maskPlate } from "@/lib/slug";
import { useMetaTags } from "@/hooks/useMetaTags";

interface Badge {
  text: string;
  variant: "success" | "purple";
  icon?: boolean;
}

// Badge Component
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
      transition={{ duration: 0.7, ease: [0.25, 0.1, 0.25, 1] }}
      className={`${bgColor} ${textColor} px-3 sm:px-4 lg:px-5 h-[22px] sm:h-[24px] lg:h-[26px] rounded-[45px] flex items-center gap-1.5 sm:gap-2 uppercase text-[12px] sm:text-[14px] lg:text-[16px] font-bold tracking-wide`}
    >
      {icon && (
        <div className="w-[12px] h-[12px] sm:w-[13px] sm:h-[13px] lg:w-[15px] lg:h-[15px] flex-shrink-0">
          <CheckSquare className="w-full h-full text-fg" />
    </div>
      )}
      <span className="whitespace-nowrap">{text}</span>
    </motion.div>
  );
}

// CTA Button Component with Hover Animation
interface CTAButtonProps {
  text: string;
  icon?: LucideIcon;
  borderColor?: string;
  textColor?: string;
  hoverBgColor?: string;
  className?: string;
  initialAnimation?: boolean;
}

function CTAButton({
  text,
  icon: Icon,
  borderColor = "border-green",
  textColor = "text-green",
  hoverBgColor = "bg-green-dark",
  className = "",
  initialAnimation = false,
}: CTAButtonProps) {
  const [isHovered, setIsHovered] = useState(false);

  const buttonContent = (
    <motion.button
      {...(initialAnimation
        ? {
            initial: { opacity: 0 },
            whileInView: { opacity: 1 },
            viewport: { once: true },
            transition: {
              duration: 0.8,
              delay: 0.25,
              ease: [0.25, 0.1, 0.25, 1],
            },
          }
        : {})}
      onHoverStart={() => setIsHovered(true)}
      onHoverEnd={() => setIsHovered(false)}
      className={`relative border ${borderColor} rounded-[65px] px-6 sm:px-8 h-[50px] flex items-center justify-center gap-2 sm:gap-3 uppercase text-[13px] sm:text-[14px] lg:text-[15px] font-bold tracking-wide overflow-hidden ${className}`}
    >
      {/* Background hover com fade */}
      <motion.div
        className={`absolute inset-0 ${hoverBgColor} rounded-[65px]`}
        initial={{ opacity: 0 }}
        animate={{ opacity: isHovered ? 1 : 0 }}
        transition={{ duration: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
      />

      {/* Container para conteúdo com overflow hidden */}
      <div className="relative flex items-center gap-2 sm:gap-3 h-full">
        {/* Container para texto com overflow hidden */}
        <div className="relative overflow-hidden h-full flex items-center">
          {/* Texto verde que sobe e desaparece */}
          <motion.span
            className={`${textColor} whitespace-nowrap relative z-10`}
            initial={{ y: 0, opacity: 1 }}
            animate={{
              y: isHovered ? -40 : 0,
              opacity: isHovered ? 0 : 1,
            }}
            transition={{ duration: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
          >
            {text}
          </motion.span>

          {/* Texto branco que sobe e aparece */}
          <motion.span
            className="text-white whitespace-nowrap absolute left-0 top-0 h-full flex items-center z-10"
            initial={{ y: 40, opacity: 0 }}
            animate={{
              y: isHovered ? 0 : 40,
              opacity: isHovered ? 1 : 0,
            }}
            transition={{ duration: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
          >
            {text}
          </motion.span>
    </div>

        {/* Ícone fixo que apenas muda de cor */}
        {Icon && (
          <div className="relative w-[22px] h-[22px] sm:w-[24px] sm:h-[24px] lg:w-[26px] lg:h-[26px] flex-shrink-0 z-10">
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

  return buttonContent;
}

// Contact Button Component
function ContactButton() {
  return (
    <CTAButton
      text="Solicitar contato"
      icon={MessageCircleMore}
      borderColor="border-secondary"
      textColor="text-secondary"
      hoverBgColor="bg-secondary"
      className="w-full sm:w-auto"
      initialAnimation={true}
    />
  );
}

// Car Detail Item
interface DetailItemProps {
  label: string;
  value: string;
}

// Accordion Item Component
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
      transition={{ duration: 0.7, ease: [0.25, 0.1, 0.25, 1] }}
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
          transition={{ duration: 0.4, ease: [0.25, 0.1, 0.25, 1] }}
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
        transition={{ duration: 0.4, ease: [0.25, 0.1, 0.25, 1] }}
        className="overflow-hidden"
      >
        {children}
      </motion.div>
    </motion.div>
  );
}

// Specification Badge Component
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

// Optional Item Component
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

// CTA Sidebar Component
function CTASidebar() {
  return (
    <div className="space-y-4 lg:space-y-6">
      {/* I-Check Card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5 }}
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
          />
        </div>
      </motion.div>

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
          />
        </div>
      </motion.div>
    </div>
  );
}

// Lightbox Modal Component
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
        className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center p-4"
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
        <div className="absolute top-4 left-4 sm:top-6 sm:left-6 text-white text-sm sm:text-base font-bold">
          {index + 1} / {images.length}
        </div>

        {/* Main Image */}
        <motion.div
          key={index}
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3 }}
          className="relative max-w-5xl max-h-[80vh] w-full"
          onClick={(e) => e.stopPropagation()}
        >
          <img
            src={images[index]}
            alt={`${vehicleName} - Imagem ${index + 1}`}
            className="w-full h-full object-contain"
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
              className="absolute left-2 sm:left-4 top-1/2 -translate-y-1/2 text-white hover:text-gray-300 transition-colors p-2 sm:p-3 bg-black/50 rounded-full"
            >
              <ChevronLeft className="w-6 h-6 sm:w-8 sm:h-8" />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleNext();
              }}
              className="absolute right-2 sm:right-4 top-1/2 -translate-y-1/2 text-white hover:text-gray-300 transition-colors p-2 sm:p-3 bg-black/50 rounded-full"
            >
              <ChevronRight className="w-6 h-6 sm:w-8 sm:h-8" />
            </button>
          </>
        )}
      </motion.div>
    </AnimatePresence>
  );
}

// Gallery Item Component
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
      className="relative overflow-hidden cursor-pointer bg-gray-200 group"
      onClick={onClick}
    >
      <div className="relative w-full h-[180px] sm:h-[200px] lg:h-[202px]">
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

function DetailItem({ label, value }: DetailItemProps) {
  const isModelo = label === "Modelo:";
  const isCombustivel = label === "Combustível:";
  const isCambio = label === "Cambio:";
  const isDetailField = isModelo || isCombustivel || isCambio;
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.6, ease: [0.25, 0.1, 0.25, 1] }}
      className="flex flex-col min-w-0"
    >
      <span className="text-muted-foreground text-[11px] sm:text-[12px] lg:text-[13px] uppercase mb-1 whitespace-nowrap">
        {label}
      </span>
      <span 
        className={`text-fg font-bold ${
          isDetailField
            ? "text-[14px] sm:text-[16px] lg:text-[18px] whitespace-nowrap" 
            : "text-[16px] sm:text-[18px] lg:text-[20px] break-words"
        }`}
      >
        {value}
      </span>
    </motion.div>
  );
}

// Related Vehicles Section
function RelatedVehiclesSection({
  currentVehicleId,
}: {
  currentVehicleId: string;
}) {
  const { data: vehicles, isLoading } = useVehiclesQuery();

  // Filtrar veículos relacionados (excluir o atual e pegar até 4)
  // Converte ambos os IDs para string para comparação correta
  const relatedVehicles =
    vehicles?.filter((v) => String(v.id) !== String(currentVehicleId)).slice(0, 4) || [];

  if (isLoading || relatedVehicles.length === 0) {
    return null;
  }

  return (
    <section className="w-full py-8 sm:py-12 lg:py-16">
      <div className="max-w-[1290px] mx-auto px-4 sm:px-6 lg:px-0">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7, ease: [0.25, 0.1, 0.25, 1] }}
          className="mb-8 sm:mb-10 lg:mb-12"
        >
          <div className="flex items-center gap-3 mb-6">
            <div className="w-[26px] h-[26px] sm:w-[28px] sm:h-[28px] lg:w-[30px] lg:h-[30px]">
              <img src={icon1} alt="" className="block size-full" />
            </div>
            <h2 className="text-primary text-[17px] sm:text-[18px] lg:text-[19px] font-medium">
              Você também pode gostar
            </h2>
          </div>

          {/* Divider Line */}
          <div className="h-[1px] bg-primary w-full"></div>
        </motion.div>

        {/* Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 sm:gap-7 lg:gap-[30px] pt-16">
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

// Embed Social Section (Hashtag + Stories)
function EmbedSocialSection() {
  useEffect(() => {
    // EmbedSocial Hashtag script
    if (!document.getElementById("EmbedSocialHashtagScript")) {
      const script = document.createElement("script");
      script.id = "EmbedSocialHashtagScript";
      script.src = "https://embedsocial.com/cdn/ht.js";
      document.head.appendChild(script);
    }

    // EmbedSocial Stories script
    if (!document.getElementById("EmbedSocialStoriesScript")) {
      const script = document.createElement("script");
      script.id = "EmbedSocialStoriesScript";
      script.src = "https://embedsocial.com/embedscript/st.js";
      document.head.appendChild(script);
    }
  }, []);

  return (
    <section className="w-full py-8 sm:py-12 lg:py-16 bg-bg">
      <div className="max-w-[1290px] mx-auto px-4 sm:px-6 lg:px-0 space-y-10">
        {/* Hashtag Feed */}
        <div
          className="embedsocial-hashtag"
          data-ref="811726996bfe08c76a3bd507a02fcebb16fc6ad1"
        />

        {/* Stories */}
        <div
          className="embedsocial-stories"
          data-ref="b86f52e1790e82bd3b547af9c36814370d2526d7"
        />
      </div>
    </section>
  );
}

export function DetalhesPage() {
  // Todos os hooks devem ser chamados sempre na mesma ordem
  // Não usar useLoaderData pode causar problemas em produção, então vamos usar apenas useParams e useLocation
  const { slug: paramSlug } = useParams({ from: "/veiculo/$slug" });
  const location = useLocation();
  
  // Extrai o slug da URL (funciona tanto em navegação quanto em refresh/F5)
  const slug = paramSlug || location.pathname.replace(/^\/veiculo\//, '') || "";
  
  const { data: vehicle, isLoading, error } = useVehicleQuery(slug);
  
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  // Preparar dados do veículo (mesmo quando ainda está carregando, para evitar problemas com hooks)
  const marca = vehicle?.marca || vehicle?.name?.split(" ")[0] || "";
  const modeloCompleto = vehicle?.modelo || vehicle?.name || "";
  const price =
    vehicle?.valor_formatado ||
    (vehicle?.price ? `R$ ${vehicle.price.toLocaleString("pt-BR")}` : "");
  const year = vehicle?.year ? `${vehicle.year} / ${vehicle.year + 1}` : "";
  const combustivel = vehicle?.combustivel || "";
  const cambio = vehicle?.cambio || "";

  // Imagens
  const images = vehicle?.fullImages || vehicle?.fotos || vehicle?.images || [];
  
  // URL da imagem de carro coberto usada como fallback quando não houver PNG
  const CAR_COVERED_PLACEHOLDER_URL = "/images/semcapa.png";
  
  // Filtra apenas imagens PNG para a foto de destaque
  const pngImages = images.filter(img => {
    if (!img) return false;
    const imgLower = img.toLowerCase();
    return imgLower.endsWith('.png') || imgLower.includes('.png');
  });
  
  // Verifica se a primeira imagem PNG é a imagem específica que deve ser substituída
  const firstPngImage = pngImages.length > 0 ? pngImages[0] : null;
  // Verifica se contém o nome do arquivo problemático (case-insensitive)
  const shouldUsePlaceholder = firstPngImage && firstPngImage.toLowerCase().includes('271_131072img_8213');
  
  // Se não tiver PNG válido ou se for a imagem específica problemática, usa o placeholder
  // Caso contrário, usa a primeira PNG encontrada
  const mainImage: string = (pngImages.length > 0 && !shouldUsePlaceholder && firstPngImage) 
    ? firstPngImage
    : CAR_COVERED_PLACEHOLDER_URL;

  // Converte imagem para URL absoluta para metatags (WhatsApp precisa de URL absoluta)
  const getAbsoluteImageUrl = (imageUrl: string): string => {
    if (!imageUrl) return "";
    if (imageUrl.startsWith("http://") || imageUrl.startsWith("https://")) {
      return imageUrl;
    }
    const baseUrl = typeof window !== "undefined" ? window.location.origin : "";
    return imageUrl.startsWith("/") ? `${baseUrl}${imageUrl}` : `${baseUrl}/${imageUrl}`;
  };

  // Configura metatags para compartilhamento (sempre chamado, mesmo durante loading)
  // Título no formato: "2008 allure 2020 marrom izn-xx02" (minúsculas, sem "Netcar -")
  // Formato: {modelo} {ano} {cor} {placa-mascarada}
  const vehicleYear = vehicle?.year ? String(vehicle.year) : "";
  const vehicleModelo = modeloCompleto.toLowerCase();
  const vehicleCor = vehicle?.cor?.toLowerCase() || "";
  const vehiclePlacaMascarada = vehicle?.placa ? maskPlate(vehicle.placa).toLowerCase() : "";
  
  // Monta o título no formato correto
  const titleParts = [];
  if (vehicleModelo) titleParts.push(vehicleModelo);
  if (vehicleYear) titleParts.push(vehicleYear);
  if (vehicleCor) titleParts.push(vehicleCor);
  if (vehiclePlacaMascarada) titleParts.push(vehiclePlacaMascarada);
  
  const vehicleTitle = vehicle && titleParts.length > 0
    ? titleParts.join(' ')
    : "veículo";
  
  const vehicleDescription = "Seminovo é na Netcar";
  
  // Extrai o preço numérico (remove formatação)
  const priceAmount = vehicle?.price || 0;
  
  // URL completa da página
  const pageUrl = typeof window !== "undefined" ? window.location.href : "";
  
  useMetaTags({
    title: vehicleTitle,
    description: vehicleDescription,
    image: getAbsoluteImageUrl(mainImage),
    url: pageUrl,
    type: "article",
    imageWidth: 1200,
    imageHeight: 900,
    productBrand: "Netcar",
    productAvailability: "in stock",
    productCondition: "used_like_new",
    productPriceAmount: priceAmount,
    productPriceCurrency: "BRL",
    productRetailerItemId: vehiclePlacaMascarada,
  });

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
    <main>
      {/* Hero Section */}
      <section className="w-full pt-16">
        <div className="max-w-[1290px] mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-[30%_70%]">
            {/* Left Content */}
          <motion.div
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8, ease: [0.25, 0.1, 0.25, 1] }}
              className="px-4 sm:px-6 lg:pl-8 lg:pr-[63px] py-6 sm:py-8 lg:py-[27px] flex flex-col justify-between order-2 lg:order-1"
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
                className="text-muted-foreground text-[14px] sm:text-[16px] lg:text-[18px] uppercase tracking-wide mb-1 sm:mb-2"
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
                className="text-fg text-[28px] sm:text-[36px] lg:text-[48px] font-bold leading-[1.1] mb-4 sm:mb-6 lg:mb-8 max-w-full lg:max-w-[350px] break-words"
              >
                {modeloCompleto}
              </motion.h1>

              {/* Badges */}
              <div className="flex flex-wrap gap-2 sm:gap-3 lg:gap-4 mb-4 sm:mb-6 lg:mb-8">
                {badges.map((badge, idx) => (
                  <Badge key={idx} {...badge} />
                ))}
              </div>

              {/* Details Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 sm:gap-6 lg:gap-8 mb-4 sm:mb-5 lg:mb-6 pb-4 sm:pb-5 lg:pb-6 border-b border-black/5">
                {year && <DetailItem label="Modelo:" value={year} />}
                {combustivel && (
                  <DetailItem label="Combustível:" value={combustivel} />
                )}
                {cambio && <DetailItem label="Cambio:" value={cambio} />}
            </div>

              {/* Price & CTA */}
              <div className="flex flex-row items-center gap-4">
                <motion.p
                  initial={{ opacity: 0, y: 10 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{
                    duration: 0.7,
                    delay: 0.3,
                    ease: [0.25, 0.1, 0.25, 1],
                  }}
                  className="text-secondary text-[28px] sm:text-[32px] lg:text-[36px] font-bold whitespace-nowrap flex-shrink-0"
                  dangerouslySetInnerHTML={{ __html: price }}
                />
                <div className="flex-shrink-0">
                  <ContactButton />
                </div>
            </div>
          </motion.div>

            {/* Right Image */}
          <motion.div
              initial={{ opacity: 0, x: 20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8, ease: [0.25, 0.1, 0.25, 1] }}
              className="relative h-[280px] sm:h-[360px] lg:h-[476px] order-1 lg:order-2 overflow-hidden"
            >
              {mainImage && (
                <img
              src={mainImage}
                  alt={`${marca} ${modeloCompleto}`}
              className="w-full h-full object-cover object-bottom"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = "none";
              }}
            />
              )}
          </motion.div>
        </div>
        </div>
      </section>

      {/* Gallery Section */}
      {images.length > 1 && (
        <section className="w-full py-8 sm:py-12 lg:py-16">
          <div className="max-w-[1290px] mx-auto px-4 sm:px-6 lg:px-0">
            {/* Grid Container */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3 lg:gap-[6px]">
              {images.map((image, index) => (
                <GalleryItem
                  key={index}
                  image={image}
                  index={index}
                  alt={`${modeloCompleto} - Imagem ${index + 1}`}
                  onClick={() => {
                    setLightboxIndex(index);
                    setLightboxOpen(true);
                  }}
                />
                  ))}
                </div>
          </div>
        </section>
      )}

      {/* Lightbox Modal */}
      {lightboxOpen && (
        <Lightbox
          images={images}
          currentIndex={lightboxIndex}
          onClose={() => setLightboxOpen(false)}
          vehicleName={modeloCompleto}
        />
      )}

      {/* Details Section */}
      <DetailsSection vehicle={vehicle} />

      {/* Fábrica de Valor Section */}
      <section className="w-full pt-4 pb-8 sm:pt-6 sm:pb-12 lg:pt-8 lg:pb-16 bg-[rgb(247,247,247)]">
        <div className="max-w-[1290px] mx-auto px-4 sm:px-6 lg:px-0">
          <FabricaDeValor />
        </div>
      </section>

      {/* Related Vehicles Section */}
      <RelatedVehiclesSection currentVehicleId={String(vehicle.id)} />

      {/* Social Embeds Section (deve ser a última sessão) */}
      <EmbedSocialSection />

      <div className="w-full font-sans antialiased text-muted-foreground bg-muted py-12 px-4 md:px-8 space-y-8">
        <Localizacao />
        <IanBot />
      </div>
    </main>
  );
}

// Details Section Component
interface DetailsSectionProps {
  vehicle: any;
}

function DetailsSection({ vehicle }: DetailsSectionProps) {
  const [showMoreOptionals, setShowMoreOptionals] = useState(false);

  const marca = vehicle.marca || vehicle.name?.split(" ")[0] || "";
  const modeloCompleto = vehicle.modelo || vehicle.name || "";
  const year = vehicle.year || 0;

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

  const optionals =
    vehicle.opcionais?.map((op: any) =>
      typeof op === "string" ? op : op?.descricao || ""
    ) || [];

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
      <div className="max-w-[1290px] mx-auto px-4 sm:px-6 lg:px-0">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_410px] gap-8 lg:gap-10">
          {/* Main Content */}
          <div className="order-1 lg:order-1">
            {/* Specifications Section */}
                <motion.div
              initial={{ opacity: 0, y: 15 }}
                  whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.7, ease: [0.25, 0.1, 0.25, 1] }}
              className="mb-12"
            >
              <div className="flex items-center gap-3 mb-6 pb-4 border-b border-primary">
                      <SpecIcon />
                <h3 className="text-primary text-[17px] sm:text-[18px] lg:text-[19px] font-medium">
                        Especificações
                      </h3>
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
                transition={{ duration: 0.7, ease: [0.25, 0.1, 0.25, 1] }}
                className="mb-12"
              >
                <div className="flex items-center gap-3 mb-6 pb-4 border-b border-primary">
                        <SpecIcon />
                  <h3 className="text-primary text-[17px] sm:text-[18px] lg:text-[19px] font-medium">
                          Opcionais
                        </h3>
                      </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {optionals
                    .slice(0, showMoreOptionals ? optionals.length : 5)
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

                {!showMoreOptionals && optionals.length > 5 && (
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
              transition={{ duration: 0.5 }}
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
                <motion.p
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
              transition={{ duration: 0.5 }}
              className="text-fg text-[14px] sm:text-[15px] leading-[26px] mb-8"
            >
              O novo {marca} {modeloCompleto} é a escolha perfeita para quem
              busca um veículo versátil, ideal para famílias modernas e
              aventureiros urbanos. Com um design atrativo e sofisticado, este
              modelo não só parece bom, mas também oferece uma experiência de
              condução excepcional, graças às suas características técnicas
              avançadas e conforto superior.
                </motion.p>

            {/* Accordion Sections */}
            <div className="space-y-2">
              <AccordionItem
                title="Diferenciais técnicos que destacam o modelo"
                defaultOpen={true}
              >
                <p className="text-fg text-[14px] sm:text-[15px] leading-[26px] mb-4">
                  O {modeloCompleto} é projetado para proporcionar uma jornada
                  suave e eficiente. Entre os destaques técnicos, este modelo
                  inclui:
                </p>
                <ul className="space-y-2 list-disc list-inside text-fg text-[14px] sm:text-[15px] leading-[26px]">
                  <li>
                    Motor {vehicle.motor || "potente"} que oferece excelente
                    desempenho e eficiência energética.
                  </li>
                  <li>
                    Câmbio {vehicle.cambio?.toLowerCase() || "automático"} que
                    garante trocas suaves e ágeis.
                  </li>
                  <li>
                    Direção elétrica que proporciona um manuseio preciso e
                    facilita a condução em espaços apertados.
                  </li>
                  <li>
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
            </div>
          </div>

          {/* Sticky Sidebar - ordem invertida no mobile */}
          <div className="order-2 lg:order-2 lg:sticky lg:top-8 lg:self-start">
            <CTASidebar />
          </div>
        </div>
      </div>
        </section>
  );
}
