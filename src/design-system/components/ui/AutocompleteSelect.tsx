import { useState, useRef, useEffect } from "react";
import { ChevronDown, X } from "lucide-react";
import { cn } from "@/lib/cn";
import { motion, AnimatePresence } from "framer-motion";

export interface AutocompleteSelectOption {
  value: string;
  label: string;
}

export interface AutocompleteSelectProps {
  options: AutocompleteSelectOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  label?: string;
  className?: string;
  emptyMessage?: string;
}

export function AutocompleteSelect({
  options,
  value,
  onChange,
  placeholder = "SELECIONE",
  label,
  className,
  emptyMessage = "Nenhuma opção encontrada",
}: AutocompleteSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const selectedOption = options.find((opt) => opt.value === value);

  // Filtra opções baseado no termo de busca
  const filteredOptions = options.filter((option) =>
    option.label.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Reset highlighted index quando filtros mudam
  useEffect(() => {
    setHighlightedIndex(0);
  }, [searchTerm, isOpen]);

  // Fecha o dropdown ao clicar fora
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
        setSearchTerm("");
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Scroll para o item destacado
  useEffect(() => {
    if (isOpen && listRef.current && highlightedIndex >= 0) {
      const highlightedElement = listRef.current.children[highlightedIndex] as HTMLElement;
      if (highlightedElement) {
        highlightedElement.scrollIntoView({
          behavior: "smooth",
          block: "nearest",
        });
      }
    }
  }, [highlightedIndex, isOpen]);

  const handleSelect = (optionValue: string) => {
    onChange(optionValue);
    setIsOpen(false);
    setSearchTerm("");
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange("");
    setSearchTerm("");
    setIsOpen(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) {
      if (e.key === "Enter" || e.key === " " || e.key === "ArrowDown") {
        e.preventDefault();
        setIsOpen(true);
        inputRef.current?.focus();
      }
      return;
    }

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setHighlightedIndex((prev) =>
          prev < filteredOptions.length - 1 ? prev + 1 : prev
        );
        break;
      case "ArrowUp":
        e.preventDefault();
        setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : 0));
        break;
      case "Enter":
        e.preventDefault();
        if (filteredOptions[highlightedIndex]) {
          handleSelect(filteredOptions[highlightedIndex].value);
        }
        break;
      case "Escape":
        e.preventDefault();
        setIsOpen(false);
        setSearchTerm("");
        inputRef.current?.blur();
        break;
    }
  };

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      {label && (
        <label className="mb-1 block text-xs font-medium text-fg uppercase">
          {label}
        </label>
      )}
      <div className="relative group">
        <div
          className={cn(
            "w-full rounded-lg border border-border bg-bg px-4 py-2.5 pr-10",
            "text-sm text-fg transition-all duration-200",
            "hover:border-primary/50 hover:bg-bg/50",
            "focus-within:ring-2 focus-within:ring-primary/20 focus-within:border-primary",
            "cursor-text flex items-center"
          )}
          onClick={() => {
            setIsOpen(true);
            inputRef.current?.focus();
          }}
        >
          <input
            ref={inputRef}
            type="text"
            value={isOpen ? searchTerm : selectedOption?.label || ""}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setIsOpen(true);
            }}
            onFocus={() => setIsOpen(true)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            className={cn(
              "flex-1 bg-transparent outline-none",
              "placeholder:text-muted-foreground"
            )}
          />
          <div className="flex items-center gap-1 ml-2">
            {value && (
              <button
                type="button"
                onClick={handleClear}
                className="p-0.5 hover:bg-surface-alt rounded transition-colors"
                aria-label="Limpar seleção"
              >
                <X className="w-3.5 h-3.5 text-muted-foreground" />
              </button>
            )}
            <ChevronDown
              className={cn(
                "w-4 h-4 text-muted-foreground pointer-events-none transition-transform duration-200",
                isOpen && "rotate-180",
                "group-hover:text-primary"
              )}
            />
          </div>
        </div>

        <AnimatePresence>
          {isOpen && (
            <motion.ul
              ref={listRef}
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className={cn(
                "absolute z-50 w-full mt-1 max-h-60 overflow-auto",
                "bg-bg border border-border rounded-lg shadow-lg",
                "py-1"
              )}
            >
              {filteredOptions.length === 0 ? (
                <li className="px-4 py-2 text-sm text-muted-foreground text-center">
                  {emptyMessage}
                </li>
              ) : (
                filteredOptions.map((option, index) => (
                  <li
                    key={option.value}
                    onClick={() => handleSelect(option.value)}
                    className={cn(
                      "px-4 py-2 text-sm cursor-pointer transition-colors",
                      "hover:bg-surface-alt",
                      value === option.value && "bg-primary/10 text-primary font-medium",
                      highlightedIndex === index && "bg-surface-alt"
                    )}
                    onMouseEnter={() => setHighlightedIndex(index)}
                  >
                    {option.label}
                  </li>
                ))
              )}
            </motion.ul>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

