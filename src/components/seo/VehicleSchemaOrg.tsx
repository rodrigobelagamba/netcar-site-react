import { useEffect } from "react";

interface VehicleSchemaOrgProps {
  marca: string;
  modelo: string;
  ano?: number;
  km?: number;
  combustivel?: string;
  cambio?: string;
  cor?: string;
  images: string[];
  price: number;
  placa?: string;
}

/**
 * Componente que adiciona Schema.org Car no head do documento
 * Usado na página de detalhes de cada veículo
 */
export function VehicleSchemaOrg({
  marca,
  modelo,
  ano,
  km,
  combustivel,
  cambio,
  cor,
  images,
  price,
  placa,
}: VehicleSchemaOrgProps) {
  useEffect(() => {
    const baseUrl = typeof window !== "undefined" ? window.location.origin : "https://www.netcarmultimarcas.com.br";
    const currentUrl = typeof window !== "undefined" ? window.location.href : "";

    const vehicleName = `${marca} ${modelo}${ano ? ` ${ano}` : ""}`;
    
    // Converte imagens para URLs absolutas
    const absoluteImages = images
      .filter(img => img && img.trim() !== "")
      .map(img => {
        if (img.startsWith("http")) return img;
        if (img.startsWith("/")) return `${baseUrl}${img}`;
        return `${baseUrl}/${img}`;
      })
      .slice(0, 5); // Limita a 5 imagens

    // Converte combustível para formato Schema.org
    const fuelTypeMap: Record<string, string> = {
      "flex": "FlexFuel",
      "gasolina": "Gasoline",
      "etanol": "Ethanol",
      "diesel": "Diesel",
      "elétrico": "Electric",
      "híbrido": "Hybrid",
    };
    const fuelType = combustivel 
      ? fuelTypeMap[combustivel.toLowerCase()] || combustivel
      : undefined;

    // Converte câmbio para formato Schema.org
    const transmissionMap: Record<string, string> = {
      "manual": "ManualTransmission",
      "automático": "AutomaticTransmission",
      "automatic": "AutomaticTransmission",
      "cvt": "CVT",
      "dct": "DualClutchTransmission",
    };
    const transmission = cambio
      ? transmissionMap[cambio.toLowerCase()] || cambio
      : undefined;

    const schema = {
      "@context": "https://schema.org",
      "@type": "Car",
      "name": vehicleName,
      "brand": {
        "@type": "Brand",
        "name": marca
      },
      "model": modelo,
      ...(ano && { "vehicleModelDate": String(ano) }),
      ...(km && {
        "mileageFromOdometer": {
          "@type": "QuantitativeValue",
          "value": km,
          "unitCode": "KMT"
        }
      }),
      ...(fuelType && { "fuelType": fuelType }),
      ...(transmission && { "vehicleTransmission": transmission }),
      ...(cor && { "color": cor }),
      ...(absoluteImages.length > 0 && { "image": absoluteImages }),
      "offers": {
        "@type": "Offer",
        "price": price,
        "priceCurrency": "BRL",
        "itemCondition": "https://schema.org/UsedCondition",
        "availability": "https://schema.org/InStock",
        "url": currentUrl,
        "seller": {
          "@type": "AutoDealer",
          "name": "Netcar Multimarcas",
          "url": baseUrl
        }
      },
      ...(placa && { "identifier": placa })
    };

    // Remove script existente se houver
    const existingScript = document.querySelector('script[type="application/ld+json"][data-schema="vehicle"]');
    if (existingScript) {
      existingScript.remove();
    }

    // Cria novo script
    const script = document.createElement("script");
    script.type = "application/ld+json";
    script.setAttribute("data-schema", "vehicle");
    script.textContent = JSON.stringify(schema, null, 2);
    document.head.appendChild(script);

    return () => {
      const scriptToRemove = document.querySelector('script[type="application/ld+json"][data-schema="vehicle"]');
      if (scriptToRemove) {
        scriptToRemove.remove();
      }
    };
  }, [marca, modelo, ano, km, combustivel, cambio, cor, images, price, placa]);

  return null;
}
