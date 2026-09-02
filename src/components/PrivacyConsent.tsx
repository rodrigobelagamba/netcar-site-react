import { useEffect, useRef, useState } from "react";
import { ShieldCheck } from "lucide-react";
import { clearTrafficAttribution } from "@/lib/waTracking";

const PRIVACY_STORAGE_KEY = "nc_privacy_consent_v1";
const OPEN_PRIVACY_EVENT = "netcar:open-privacy-preferences";

declare global {
  interface Window {
    netcarSetPrivacyConsent?: (choice: "accepted" | "essential") => void;
  }
}

function hasStoredChoice(): boolean {
  try {
    return ["accepted", "essential"].includes(
      localStorage.getItem(PRIVACY_STORAGE_KEY) ?? "",
    );
  } catch {
    return false;
  }
}

export function openPrivacyPreferences(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(OPEN_PRIVACY_EVENT));
}

export function PrivacyConsent({
  showPersistentControl = false,
}: {
  showPersistentControl?: boolean;
}) {
  const [open, setOpen] = useState(() => !hasStoredChoice());
  const dialogRef = useRef<HTMLElement>(null);
  const persistentButtonRef = useRef<HTMLButtonElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const reopen = () => {
      returnFocusRef.current =
        document.activeElement instanceof HTMLElement
          ? document.activeElement
          : null;
      setOpen(true);
    };
    window.addEventListener(OPEN_PRIVACY_EVENT, reopen);
    return () => window.removeEventListener(OPEN_PRIVACY_EVENT, reopen);
  }, []);

  useEffect(() => {
    if (!open) return;
    const frame = window.requestAnimationFrame(() => {
      dialogRef.current?.focus({ preventScroll: true });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [open]);

  const reopenFromPersistentControl = () => {
    returnFocusRef.current = persistentButtonRef.current;
    setOpen(true);
  };

  const choose = (choice: "accepted" | "essential") => {
    if (choice === "essential") clearTrafficAttribution();
    window.netcarSetPrivacyConsent?.(choice);
    setOpen(false);
    window.requestAnimationFrame(() => {
      const previous = returnFocusRef.current;
      const target = previous?.isConnected
        ? previous
        : persistentButtonRef.current;
      target?.focus({ preventScroll: true });
      returnFocusRef.current = null;
    });
  };

  if (!open) {
    return showPersistentControl ? (
      <button
        ref={persistentButtonRef}
        type="button"
        onClick={reopenFromPersistentControl}
        className="print:hidden fixed bottom-3 right-3 z-[10020] inline-flex items-center gap-2 rounded-full border border-[#00283C]/15 bg-white px-4 py-2.5 text-sm font-bold text-[#00283C] shadow-lg"
      >
        <ShieldCheck className="h-4 w-4 text-[#00616A]" aria-hidden="true" />
        Privacidade
      </button>
    ) : null;
  }

  // Uma linha só. Mobile: faixa fina colada no header (rodapé cobria preço e
  // WhatsApp). Tablet/desktop: pílula pequena no canto inferior direito.
  return (
    <aside
      ref={dialogRef}
      role="dialog"
      aria-modal="false"
      aria-label="Cookies"
      aria-describedby="privacy-consent-description"
      tabIndex={-1}
      className="print:hidden fixed inset-x-0 top-16 z-[10020] flex items-center gap-2 border-b border-[#00283C]/10 bg-white px-3 py-1.5 shadow-[0_6px_18px_rgba(0,40,60,0.1)] sm:inset-x-auto sm:bottom-4 sm:right-4 sm:top-auto sm:rounded-full sm:border sm:py-1.5 sm:pl-4 sm:pr-1.5 sm:shadow-[0_10px_28px_rgba(0,40,60,0.18)]"
    >
      <p
        id="privacy-consent-description"
        className="min-w-0 flex-1 truncate text-[11px] leading-none text-slate-600 sm:flex-none sm:text-xs"
      >
        <span className="hidden sm:inline">Cookies p/ medir campanhas. </span>
        <span className="sm:hidden">Cookies: </span>
        <a
          href="/privacidade"
          className="font-semibold text-[#00616A] underline underline-offset-2"
        >
          Saiba mais
        </a>
      </p>
      <div className="flex shrink-0 gap-1">
        <button
          type="button"
          onClick={() => choose("essential")}
          className="h-7 rounded-full border border-[#00283C]/20 px-2 text-[11px] font-bold text-[#00283C] transition-colors hover:bg-slate-50 sm:text-xs"
        >
          Só essenciais
        </button>
        <button
          type="button"
          onClick={() => choose("accepted")}
          className="h-7 rounded-full bg-[#087A37] px-2.5 text-[11px] font-black text-white transition-colors hover:bg-[#075E54] sm:text-xs"
        >
          Aceitar
        </button>
      </div>
    </aside>
  );
}
