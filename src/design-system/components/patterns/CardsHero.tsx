import { Plus } from "lucide-react";
import { motion } from "framer-motion";

interface CardsHeroProps {
  image: string;
  brand: string;
  model: string;
  year: string;
  fuel: string;
  transmission: string;
  mileage: string;
  price: string;
  delay?: number;
  onClick?: () => void;
}

export function CardsHero({ image, brand, model, price, year, delay = 0, onClick }: CardsHeroProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: delay * 0.1 }}
      viewport={{ once: true }}
      className={`pt-24 md:pt-32 ${onClick ? 'cursor-pointer' : ''}`} // Even more padding for the larger car
      onClick={onClick}
    >
      <div className="group relative bg-white rounded-[40px] shadow-[0_10px_40px_rgba(0,0,0,0.04)] hover:shadow-[0_20px_60px_rgba(0,0,0,0.08)] transition-all duration-500 p-8 flex flex-col items-center" style={{ border: '1px solid rgba(229, 231, 235, 0.5)' }}>
        
        {/* Floating Image Section - LARGER */}
        <div className="!border-0 absolute -top-32 md:-top-44 left-[-2%] right-[-2%] md:left-[-10%] md:right-[-10%] h-64 md:h-80 flex items-center justify-center z-10 pointer-events-none">
          <div className="!border-0 relative w-full h-full">
            <img 
              src={image} 
              alt={`${brand} ${model}`}
              className="!border-0 w-full h-full object-contain transition-transform duration-700 group-hover:scale-110 group-hover:-rotate-2 drop-shadow-[0_20px_30px_rgba(0,0,0,0.15)]"
            />
          </div>
        </div>

        {/* Content Section - Adjusted to match photo exactly */}
        <div className="!border-0 pt-28 md:pt-32 w-full flex flex-col items-start text-left space-y-4">
           {/* Brand Badge - Left aligned as in photo */}
           <span className="!border-0 bg-[#00283C] text-white hover:bg-[#00283C] rounded-md px-3 py-1 text-[10px] font-bold tracking-widest uppercase w-fit inline-block">
             {brand}
           </span>

           {/* Model and Year - Left aligned */}
           <div className="!border-0 space-y-1">
             <h3 className="!border-0 text-[17px] font-bold leading-tight" style={{ color: '#00283C' }}>
               {model}
             </h3>
             <p className="!border-0 text-gray-400 font-medium text-base">{year}</p>
           </div>

           {/* Price and Action - Left aligned price, right aligned button */}
           <div className="!border-0 flex items-center justify-between w-full pt-4">
             <p className="!border-0 text-[24px] font-bold font-sans tracking-tight" style={{ color: '#5CD29D' }}>
               {price}
             </p>
             
             <button 
               className="!border-0 h-10 w-10 rounded-full transition-all duration-300 shadow-lg group/btn flex items-center justify-center"
               style={{ 
                 backgroundColor: '#00283C',
                 color: 'white',
                 outline: 'none'
               }}
               onMouseEnter={(e) => {
                 e.currentTarget.style.backgroundColor = '#5CD29D';
                 e.currentTarget.style.color = '#00283C';
               }}
               onMouseLeave={(e) => {
                 e.currentTarget.style.backgroundColor = '#00283C';
                 e.currentTarget.style.color = 'white';
               }}
             >
               <Plus className="h-5 w-5 group-hover/btn:rotate-90 transition-transform duration-300" />
             </button>
           </div>
        </div>
      </div>
    </motion.div>
  );
}

