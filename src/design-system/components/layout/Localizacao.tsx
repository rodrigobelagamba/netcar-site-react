import { MapPin, ExternalLink } from "lucide-react";
import { GoogleMap, LoadScript, InfoWindow } from "@react-google-maps/api";
import { useState, useEffect, useCallback, useRef } from "react";

// Dados das lojas com endereços completos para geocodificação
const lojasData = [
  {
    id: 1,
    nome: "LOJA 1",
    tipo: "Matriz",
    endereco: "Av. Presidente Vargas, 740\nEsteio/RS",
    enderecoCompleto: "Av. Presidente Vargas, 740, Esteio, RS, 93260-000, Brasil",
    telefone: "(51) 3473-7900",
    coordenadas: { lat: -29.844377, lng: -51.173593 }, // Coordenadas aproximadas Av. Presidente Vargas, 740, Esteio
    cor: "primary"
  },
  {
    id: 2,
    nome: "LOJA 2",
    tipo: "Filial",
    endereco: "Av. Presidente Vargas, 1106\nEsteio/RS",
    enderecoCompleto: "Av. Presidente Vargas, 1106, Esteio, RS, 93260-000, Brasil",
    telefone: "(51) 3033-3900",
    coordenadas: { lat: -29.844800, lng: -51.174000 }, // Coordenadas aproximadas Av. Presidente Vargas, 1106, Esteio
    cor: "amber-500"
  }
];

// Função para calcular o centro do mapa baseado nas coordenadas das lojas
const calculateCenter = (lojas: typeof lojasData) => {
  if (lojas.length === 0) {
    return { lat: -29.839952, lng: -51.170587 }; // Coordenadas padrão de Esteio
  }
  
  const avgLat = lojas.reduce((sum, loja) => sum + loja.coordenadas.lat, 0) / lojas.length;
  const avgLng = lojas.reduce((sum, loja) => sum + loja.coordenadas.lng, 0) / lojas.length;
  
  return { lat: avgLat, lng: avgLng };
};

// Chave da API do Google Maps (pode ser configurada via variável de ambiente)
// Fallback para a chave pública do site netcarmultimarcas.com.br
const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || "AIzaSyBRpMbIFscJTVsMnPLR-jLBiMPLIAVizBU";

// Bibliotecas do Google Maps (deve ser constante para evitar recarregamentos)
const GOOGLE_MAPS_LIBRARIES: ("marker" | "places" | "drawing" | "geometry" | "visualization")[] = ["marker"];

// Estilos do mapa
const mapContainerStyle = {
  width: "100%",
  height: "100%"
};

const mapOptions: google.maps.MapOptions = {
  disableDefaultUI: false,
  zoomControl: true,
  streetViewControl: false,
  mapTypeControl: false,
  fullscreenControl: true,
  mapId: "NETCAR_MAP_ID", // ID do mapa necessário para AdvancedMarkerElement
  styles: [
    {
      featureType: "poi",
      elementType: "labels",
      stylers: [{ visibility: "off" }]
    }
  ]
};

export function Localizacao() {
  const [selectedLoja, setSelectedLoja] = useState<number | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [lojas, setLojas] = useState(lojasData);
  const [geocoder, setGeocoder] = useState<google.maps.Geocoder | null>(null);
  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [mapError, setMapError] = useState<string | null>(null);
  const markersRef = useRef<google.maps.marker.AdvancedMarkerElement[]>([]);

  // Função para geocodificar endereços e atualizar coordenadas
  const geocodeAddresses = useCallback(() => {
    if (!geocoder || !window.google?.maps) return;

    lojasData.forEach((loja) => {
      // Tenta múltiplos formatos de endereço para melhor precisão
      const addressVariants = [
        loja.enderecoCompleto,
        `Av. Presidente Vargas, ${loja.id === 1 ? '740' : '1106'}, Esteio, RS, Brasil`,
        `Av. Presidente Vargas, ${loja.id === 1 ? '740' : '1106'}, Centro, Esteio, RS`,
        `${loja.enderecoCompleto.split(',')[0]}, Esteio, RS, Brasil`
      ];

      const tryGeocode = (addressIndex: number) => {
        if (addressIndex >= addressVariants.length) {
          return;
        }

        const address = addressVariants[addressIndex];
        
        geocoder.geocode(
          { 
            address: address,
            region: 'BR' // Restringe ao Brasil
          },
          (results, status) => {
            if (status === "OK" && results && results[0]) {
              const location = results[0].geometry.location;
              const lat = location.lat();
              const lng = location.lng();
              
              setLojas((prevLojas) =>
                prevLojas.map((l) =>
                  l.id === loja.id
                    ? {
                        ...l,
                        coordenadas: {
                          lat: lat,
                          lng: lng,
                        },
                      }
                    : l
                )
              );
            } else {
              // Tenta próximo formato de endereço
              tryGeocode(addressIndex + 1);
            }
          }
        );
      };

      // Inicia a geocodificação com o primeiro formato
      tryGeocode(0);
    });
  }, [geocoder]);

  // Função para criar conteúdo HTML do marcador
  const createMarkerContent = (cor: string) => {
    const color = cor === "primary" ? "#6cc4ca" : "#f59e0b";
    const pin = document.createElement("div");
    pin.style.width = "40px";
    pin.style.height = "50px";
    pin.style.position = "relative";
    pin.innerHTML = `
      <svg width="40" height="50" viewBox="0 0 40 50" xmlns="http://www.w3.org/2000/svg">
        <path d="M20 0C9.507 0 1 8.507 1 19c0 13.5 19 31 19 31s19-17.5 19-31C39 8.507 30.493 0 20 0z" fill="${color}"/>
        <circle cx="20" cy="19" r="8" fill="white"/>
      </svg>
    `;
    return pin;
  };

  // Criar marcadores usando AdvancedMarkerElement ou Marker padrão como fallback
  const createAdvancedMarkers = useCallback(() => {
    if (!map || !window.google?.maps) {
      return;
    }

    // Verifica se o Google Maps está totalmente carregado
    if (!window.google.maps.Map || !window.google.maps.LatLng || !window.google.maps.Marker) {
      console.warn("Google Maps API não está totalmente carregado");
      return;
    }

    // Limpar marcadores existentes
    markersRef.current.forEach(marker => {
      try {
        if (marker && 'map' in marker) {
          (marker as any).map = null;
        }
      } catch (error) {
        console.warn("Erro ao limpar marcador:", error);
      }
    });
    markersRef.current = [];

    const useAdvancedMarker = window.google.maps.marker?.AdvancedMarkerElement;

    // Criar novos marcadores
    lojas.forEach((loja) => {
      try {
        // Verifica se todas as dependências estão disponíveis
        if (!window.google?.maps || !window.google.maps.LatLng || !window.google.maps.Marker) {
          console.warn("Google Maps API não disponível para criar marcadores");
          return;
        }
        
        if (useAdvancedMarker && window.google.maps.marker) {
          // Usar AdvancedMarkerElement
          const content = createMarkerContent(loja.cor);
          
          // Obter o mapId do mapa
          const mapId = (map as any).mapId || mapOptions.mapId;
          
          if (!mapId) {
            // Fallback para Marker padrão se não houver mapId
            const color = loja.cor === "primary" ? "#6cc4ca" : "#f59e0b";
            const svg = `
              <svg width="40" height="50" viewBox="0 0 40 50" xmlns="http://www.w3.org/2000/svg">
                <path d="M20 0C9.507 0 1 8.507 1 19c0 13.5 19 31 19 31s19-17.5 19-31C39 8.507 30.493 0 20 0z" fill="${color}"/>
                <circle cx="20" cy="19" r="8" fill="white"/>
              </svg>
            `;
            
            const icon = {
              url: `data:image/svg+xml;base64,${btoa(svg)}`,
              scaledSize: new window.google.maps.Size(40, 50),
              anchor: new window.google.maps.Point(20, 50)
            };

            const marker = new window.google.maps.Marker({
              map: map,
              position: loja.coordenadas,
              title: loja.nome,
              icon: icon,
              animation: window.google.maps.Animation.DROP
            });

            marker.addListener("click", () => {
              setSelectedLoja(loja.id);
            });

            markersRef.current.push(marker as any);
            return;
          }
          
          const marker = new useAdvancedMarker({
            map: map,
            position: loja.coordenadas,
            title: loja.nome,
            content: content,
          });

          // Adicionar evento de clique
          marker.addListener("click", () => {
            setSelectedLoja(loja.id);
          });

          markersRef.current.push(marker as any);
        } else {
          // Fallback para Marker padrão
          const color = loja.cor === "primary" ? "#6cc4ca" : "#f59e0b";
          const svg = `
            <svg width="40" height="50" viewBox="0 0 40 50" xmlns="http://www.w3.org/2000/svg">
              <path d="M20 0C9.507 0 1 8.507 1 19c0 13.5 19 31 19 31s19-17.5 19-31C39 8.507 30.493 0 20 0z" fill="${color}"/>
              <circle cx="20" cy="19" r="8" fill="white"/>
            </svg>
          `;
          
          const icon = {
            url: `data:image/svg+xml;base64,${btoa(svg)}`,
            scaledSize: new window.google.maps.Size(40, 50),
            anchor: new window.google.maps.Point(20, 50)
          };

          const marker = new window.google.maps.Marker({
            map: map,
            position: loja.coordenadas,
            title: loja.nome,
            icon: icon,
            animation: window.google.maps.Animation.DROP
          });

          marker.addListener("click", () => {
            setSelectedLoja(loja.id);
          });

          markersRef.current.push(marker as any);
        }
      } catch (error) {
        console.error(`Erro ao criar marcador para ${loja.nome}:`, error);
      }
    });
  }, [map, lojas]);

  // Inicializar geocoder quando o mapa carregar
  useEffect(() => {
    if (mapLoaded && typeof window !== "undefined" && window.google?.maps) {
      const geocoderInstance = new window.google.maps.Geocoder();
      setGeocoder(geocoderInstance);
    }
  }, [mapLoaded]);

  // Criar marcadores quando o mapa estiver pronto ou quando as coordenadas mudarem
  useEffect(() => {
    if (map && mapLoaded) {
      // Aguardar um pouco para garantir que o mapa está totalmente renderizado
      const timer = setTimeout(() => {
        createAdvancedMarkers();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [map, mapLoaded, lojas, createAdvancedMarkers]);

  // Geocodificar endereços quando o geocoder estiver pronto
  useEffect(() => {
    if (geocoder) {
      geocodeAddresses();
    }
  }, [geocoder, geocodeAddresses]);

  // Se não houver chave da API, usa o iframe como fallback
  if (!GOOGLE_MAPS_API_KEY) {
    return (
      <section className="max-w-[1400px] mx-auto w-full bg-white rounded-[32px] shadow-sm overflow-hidden border border-white relative group">
        <div className="w-full h-[450px] relative grayscale-[0.1]">
          <iframe
            src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d13826.0!2d-51.171175!3d-29.839405!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x0%3A0x0!2zMjnCsDUwJzIxLjkiUyA1McKwMTAnMTYuMiJX!5e0!3m2!1spt-BR!2sbr!4v1704628800000!5m2!1spt-BR!2sbr"
            width="100%"
            height="100%"
            style={{ border: 0 }}
            allowFullScreen
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            title="Localização das lojas Netcar"
            className="w-full h-full"
          />
          <div className="absolute top-6 right-6 md:top-8 md:right-8 bg-white/95 backdrop-blur-md rounded-2xl shadow-xl p-6 border border-white/50 hidden md:block max-w-[340px] z-30">
            <h5 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-6 flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span>
              Nossas Unidades
            </h5>
            {lojas.map((loja) => (
              <div key={loja.id} className="flex items-start gap-4 mb-6 relative group/item hover:bg-gray-50/50 p-2 -mx-2 rounded-lg transition-colors cursor-pointer">
                <div className="relative mt-1 flex-shrink-0">
                  <div className={`relative w-5 h-5 rounded-full ${loja.cor === "primary" ? "bg-primary" : "bg-amber-500"} flex items-center justify-center text-white shadow-sm z-10`}>
                    <MapPin className="w-3 h-3" strokeWidth={3} />
                  </div>
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <p className="font-bold text-gray-800 text-sm">{loja.nome}</p>
                    <span className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded font-bold uppercase">{loja.tipo}</span>
                  </div>
                  <p className="text-[13px] text-gray-500 leading-snug whitespace-pre-line">
                    {loja.endereco}
                  </p>
                </div>
              </div>
            ))}
            <div className="mt-6 pt-4 border-t border-gray-100">
              <a 
                href="https://maps.google.com/?q=Netcar+Esteio" 
                target="_blank" 
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 text-xs font-bold text-primary hover:opacity-80 transition-colors group/link"
              >
                ABRIR NO GOOGLE MAPS
                <ExternalLink className="w-3 h-3 group-hover/link:translate-x-0.5 transition-transform" />
              </a>
            </div>
          </div>
        </div>
      </section>
    );
  }

  // Se houver erro, mostrar mensagem
  if (mapError) {
    return (
      <section className="max-w-[1400px] mx-auto w-full bg-white rounded-[32px] shadow-sm overflow-hidden border border-white relative group">
        <div className="w-full h-[450px] relative flex items-center justify-center bg-gray-50 rounded-lg">
          <div className="text-center p-8">
            <div className="text-red-500 text-4xl mb-4">⚠️</div>
            <h3 className="text-lg font-bold text-gray-800 mb-2">Erro ao carregar Google Maps</h3>
            <p className="text-sm text-gray-600 mb-4">{mapError}</p>
            <p className="text-xs text-gray-500 mb-4">
              Verifique se a chave da API está configurada corretamente e se as APIs necessárias estão habilitadas no Google Cloud Console.
            </p>
            <button
              onClick={() => {
                setMapError(null);
                window.location.reload();
              }}
              className="px-4 py-2 bg-primary text-white rounded-lg hover:opacity-80 transition-opacity text-sm font-medium"
            >
              Tentar novamente
            </button>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="max-w-[1400px] mx-auto w-full bg-white rounded-[32px] shadow-sm overflow-hidden border border-white relative group">
      <div className="w-full h-[450px] relative grayscale-[0.1]">
        <LoadScript
          googleMapsApiKey={GOOGLE_MAPS_API_KEY}
          loadingElement={
            <div className="w-full h-full flex items-center justify-center bg-gray-100 rounded-lg">
              <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
                <p className="text-sm text-gray-600">Carregando mapa...</p>
              </div>
            </div>
          }
          libraries={GOOGLE_MAPS_LIBRARIES}
          version="weekly"
          id="google-maps-script"
          onLoad={() => {
            setMapLoaded(true);
          }}
          onError={(error) => {
            console.error("Erro ao carregar Google Maps:", error);
            setMapError("Erro ao carregar Google Maps. Verifique a chave da API e as configurações.");
          }}
        >
          <GoogleMap
            mapContainerStyle={mapContainerStyle}
            center={calculateCenter(lojas)}
            zoom={15}
            options={mapOptions}
            onLoad={(mapInstance) => {
              if (mapInstance) {
                setMap(mapInstance);
                setMapLoaded(true);
                setMapError(null);
              }
            }}
          >
            {selectedLoja && (() => {
              const loja = lojas.find(l => l.id === selectedLoja);
              if (!loja) return null;
              
              return (
                <InfoWindow
                  position={loja.coordenadas}
                  onCloseClick={() => setSelectedLoja(null)}
                >
                  <div className="p-2">
                    <h3 className="font-bold text-gray-800 text-sm mb-1">{loja.nome}</h3>
                    <p className="text-xs text-gray-600 mb-1 whitespace-pre-line">{loja.endereco}</p>
                    <p className="text-xs text-gray-500">{loja.telefone}</p>
                  </div>
                </InfoWindow>
              );
            })()}
          </GoogleMap>
        </LoadScript>

        
        {/* Card Flutuante */}
        <div className="absolute top-6 right-6 md:top-8 md:right-8 bg-white/95 backdrop-blur-md rounded-2xl shadow-xl p-6 border border-white/50 hidden md:block max-w-[340px] z-30">
          <h5 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-6 flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span>
            Nossas Unidades
          </h5>

          {lojas.map((loja, index) => (
            <div
              key={loja.id}
              className={`flex items-start gap-4 ${index < lojas.length - 1 ? "mb-6 relative" : ""} group/item hover:bg-gray-50/50 p-2 -mx-2 rounded-lg transition-colors cursor-pointer`}
              onClick={() => setSelectedLoja(loja.id)}
            >
              {index < lojas.length - 1 && (
                <div className="absolute left-[17px] top-10 bottom-[-16px] w-[2px] border-l-2 border-dotted border-gray-200"></div>
              )}
              <div className="relative mt-1 flex-shrink-0">
                <div className={`relative w-5 h-5 rounded-full ${loja.cor === "primary" ? "bg-primary" : "bg-amber-500"} flex items-center justify-center text-white shadow-sm z-10`}>
                  <MapPin className="w-3 h-3" strokeWidth={3} />
                </div>
              </div>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <p className="font-bold text-gray-800 text-sm">{loja.nome}</p>
                  <span className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded font-bold uppercase">{loja.tipo}</span>
                </div>
                <p className="text-[13px] text-gray-500 leading-snug whitespace-pre-line">
                  {loja.endereco}
                </p>
              </div>
            </div>
          ))}

          <div className="mt-6 pt-4 border-t border-gray-100">
            <a 
              href="https://maps.google.com/?q=Netcar+Esteio" 
              target="_blank" 
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 text-xs font-bold text-primary hover:opacity-80 transition-colors group/link"
            >
              ABRIR NO GOOGLE MAPS
              <ExternalLink className="w-3 h-3 group-hover/link:translate-x-0.5 transition-transform" />
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}

