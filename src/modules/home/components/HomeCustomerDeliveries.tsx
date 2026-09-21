import { Link } from "@tanstack/react-router";
import { ArrowUpRight, Camera } from "lucide-react";

// Same three photos as the vehicle callout, without loading the gallery dataset.
const DELIVERY_PHOTOS = [
  { id: "mkt-f70fefc7", crop: [0.036754, 0.150789, 0.571429, 0.321429] },
  { id: "mkt-2769a3fe", crop: [0.014288, 0.194769, 0.571429, 0.321429] },
  { id: "mkt-ed106e87", crop: [0.428571, 0.191309, 0.571429, 0.321429] },
] as const;

const PHOTO_FRAMES = [
  "left-0 top-2 -rotate-6",
  "left-[29%] top-9 z-10 rotate-2",
  "right-0 top-0 rotate-6",
] as const;

export function HomeCustomerDeliveries() {
  return (
    <section
      aria-labelledby="home-deliveries-title"
      className="container-main px-4 pt-4 sm:px-6 lg:px-8 xl:px-12 2xl:px-16"
    >
      <div className="overflow-hidden rounded-[28px] border border-[#23747C]/15 bg-[#EFF6F1] px-5 py-7 sm:px-9 sm:py-10 lg:grid lg:grid-cols-[1fr_1fr] lg:items-center lg:gap-10 lg:px-12">
        <div className="relative z-20">
          <span className="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.18em] text-[#23747C]">
            <Camera className="h-4 w-4" aria-hidden="true" />
            Clientes Netcar
          </span>
          <h2
            id="home-deliveries-title"
            className="mt-3 max-w-lg text-[28px] font-black leading-[1.12] tracking-[-0.03em] text-[#00283C] sm:text-4xl"
          >
            Veja quem já escolheu a Netcar.
          </h2>
          <p className="mt-4 max-w-md text-sm leading-relaxed text-[#3D6266] sm:text-base">
            Cada entrega tem uma história. Conheça nosso álbum, encontre sua
            foto e compartilhe esse momento.
          </p>
          <Link
            to="/entregas"
            search={{}}
            hash=""
            className="mt-6 inline-flex min-h-12 items-center justify-center gap-3 rounded-full bg-[#075E54] px-5 py-3 text-sm font-bold text-white transition-colors hover:bg-[#064D45] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#008B95]"
          >
            Ver álbum de entregas
            <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>

        <div
          aria-hidden="true"
          className="relative mx-auto mt-8 h-[190px] w-full max-w-[390px] sm:h-[240px] sm:max-w-[460px] lg:mt-0 lg:h-[260px]"
        >
          {DELIVERY_PHOTOS.map(({ id, crop }, index) => (
            <div
              key={id}
              className={`absolute w-[42%] rounded-2xl bg-white p-1.5 pb-5 shadow-[0_12px_26px_rgba(0,40,60,0.12)] sm:p-2 sm:pb-7 ${PHOTO_FRAMES[index]}`}
            >
              <div className="relative aspect-square overflow-hidden rounded-xl bg-[#DFEAE5]">
                <img
                  src={`/entregas-media/${id}-320.webp`}
                  srcSet={`/entregas-media/${id}-320.webp 320w, /entregas-media/${id}-640.webp 640w`}
                  sizes="(min-width: 1024px) 320px, (min-width: 640px) 280px, 220px"
                  width={320}
                  height={569}
                  alt=""
                  loading="lazy"
                  decoding="async"
                  className="absolute object-fill [&&]:!max-w-none"
                  style={{
                    left: `${(-crop[0] / crop[2]) * 100}%`,
                    top: `${(-crop[1] / crop[3]) * 100}%`,
                    width: `${100 / crop[2]}%`,
                    height: `${100 / crop[3]}%`,
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
