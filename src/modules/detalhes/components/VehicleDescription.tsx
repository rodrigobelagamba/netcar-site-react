import React, { useId, useState } from "react";
import { ChevronDown } from "lucide-react";
import type { AccordionSection, ParsedGptContent } from "@/lib/parseGptContent";

function isListContent(
  content: AccordionSection["content"],
): content is {
  introducao?: React.ReactNode;
  itens: Array<{ label?: string; texto: React.ReactNode }>;
} {
  return typeof content === "object" && content !== null && "itens" in content;
}

/** Mostra o início do anúncio cadastrado, sem resumir nem reescrever o texto. */
export function VehicleDescription({ content }: { content: ParsedGptContent }) {
  const [expanded, setExpanded] = useState(false);
  const contentId = useId();
  const titleId = useId();
  const firstSection = content.accordions[0]?.content;
  const preview =
    content.apresentacao ||
    (isListContent(firstSection)
      ? firstSection.introducao ||
        firstSection.itens.map((item, index) => (
          <React.Fragment key={index}>
            {index > 0 && " "}
            {item.label && <strong>{item.label} </strong>}
            {item.texto}
          </React.Fragment>
        ))
      : firstSection);

  if (!preview && content.accordions.length === 0) return null;

  return (
    <section
      aria-labelledby={titleId}
      className="mt-8 border-t border-[#00283C]/10 pt-5"
    >
      <h3
        id={titleId}
        className="mb-3 text-[16px] font-bold text-[#00283C] sm:text-[17px]"
      >
        Descrição do veículo
      </h3>
      <div id={contentId}>
        <p
          hidden={expanded}
          className={`${expanded ? "hidden" : "line-clamp-3"} text-[14px] leading-6 text-fg sm:text-[15px] sm:leading-7`}
        >
          {preview}
        </p>
        <div hidden={!expanded} className={expanded ? "space-y-6" : "hidden"}>
          {content.apresentacao && (
            <p className="section-text">{content.apresentacao}</p>
          )}
          {content.accordions.map((accordion, index) => (
            <div key={`${accordion.title}-${index}`}>
              <h4 className="mb-2 text-[16px] font-bold text-[#23747C] sm:text-[18px]">
                {accordion.title}
              </h4>
              {isListContent(accordion.content) ? (
                <>
                  {accordion.content.introducao && (
                    <p className="section-text mb-3">
                      {accordion.content.introducao}
                    </p>
                  )}
                  {accordion.content.itens.length > 0 && (
                    <ul className="ml-5 list-outside list-disc space-y-2 text-[14px] leading-[26px] text-fg sm:text-[15px]">
                      {accordion.content.itens.map((item, itemIndex) => (
                        <li key={itemIndex} className="pl-2">
                          {item.label && <strong>{item.label}</strong>}{" "}
                          {item.texto}
                        </li>
                      ))}
                    </ul>
                  )}
                </>
              ) : (
                <p className="section-text">{accordion.content}</p>
              )}
            </div>
          ))}
        </div>
      </div>
      <button
        type="button"
        onClick={() => setExpanded((current) => !current)}
        aria-expanded={expanded}
        aria-controls={contentId}
        className="mt-2 inline-flex min-h-11 items-center gap-2 rounded-lg text-[14px] font-bold text-[#175F67] underline decoration-[#175F67]/30 underline-offset-4 transition-colors hover:text-[#00283C] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#23747C]"
      >
        {expanded ? "Ler menos" : "Ler mais"}
        <ChevronDown
          aria-hidden="true"
          className={`h-4 w-4 transition-transform ${expanded ? "rotate-180" : ""}`}
        />
      </button>
    </section>
  );
}
