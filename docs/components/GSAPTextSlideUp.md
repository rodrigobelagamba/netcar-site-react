# Componente GSAPTextSlideUp

Componente para animação de texto que sobe ao hover usando GSAP.

## Status
⚠️ **Não implementado** - Referência para implementação futura

## Descrição
Componente que cria um efeito de texto deslizando para cima ao passar o mouse, usando GSAP para animações suaves.

## Código Proposto

```typescript
// Componente: Texto sobe ao hover
function GSAPTextSlideUp({
  children,
  color,
}: {
  children: React.ReactNode;
  color?: string;
}) {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const textRef = useRef<HTMLSpanElement>(null);
  const cloneRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (textRef.current && cloneRef.current && buttonRef.current) {
      cloneRef.current.textContent = textRef.current.textContent;
    }
  }, []);

  const handleMouseEnter = () => {
    if (textRef.current && cloneRef.current) {
      gsap.to(textRef.current, {
        y: -100,
        opacity: 0,
        duration: 0.4,
        ease: "power2.out",
      });
      gsap.fromTo(
        cloneRef.current,
        { y: 100, opacity: 0 },
        {
          y: 0,
          opacity: 1,
          duration: 0.4,
          ease: "power2.out",
        }
      );
    }
  };

  const handleMouseLeave = () => {
    if (textRef.current && cloneRef.current) {
      gsap.to(textRef.current, {
        y: 0,
        opacity: 1,
        duration: 0.4,
        ease: "power2.out",
      });
      gsap.to(cloneRef.current, {
        y: -100,
        opacity: 0,
        duration: 0.4,
        ease: "power2.out",
      });
    }
  };

  return (
    <Button
      ref={buttonRef}
      color={color as any}
      className="w-full overflow-hidden relative"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <span ref={textRef} className="inline-block relative">
        {children}
      </span>
      <span
        ref={cloneRef}
        className="absolute inset-0 inline-flex items-center justify-center opacity-0"
      >
        {children}
      </span>
    </Button>
  );
}
```

## Dependências Necessárias
- `gsap` - Biblioteca de animações
- `useRef` e `useEffect` do React
- Componente `Button` (do design system)

## Notas
- Este componente foi planejado mas ainda não foi implementado na página de detalhes
- Pode ser útil para melhorar a interatividade dos botões CTA
- Originalmente planejado para ser adicionado após o fechamento da função `DetalhesPage`
