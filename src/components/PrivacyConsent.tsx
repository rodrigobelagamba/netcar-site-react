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

  return (
    <aside
      ref={dialogRef}
      role="dialog"
      aria-modal="false"
      aria-labelledby="privacy-consent-title"
      aria-describedby="privacy-consent-description"
      tabIndex={-1}
      className="print:hidden fixed inset-x-2 bottom-[max(0.5rem,env(safe-area-inset-bottom))] z-[10020] mx-auto max-w-5xl rounded-xl border border-[#00283C]/10 bg-white p-3 shadow-[0_14px_36px_rgba(0,40,60,0.2)] sm:inset-x-4 sm:bottom-4 sm:px-4 sm:py-3"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-start gap-2.5 sm:items-center">
          <span className="hidden h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#5CD29D]/15 text-[#00616A] sm:flex">
            <ShieldCheck className="h-4 w-4" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <h2
              id="privacy-consent-title"
              className="text-sm font-black leading-tight text-[#00283C]"
            >
              Privacidade e cookies
            </h2>
            <p
              id="privacy-consent-description"
              className="mt-0.5 text-xs leading-snug text-slate-600 sm:text-[13px]"
            >
              Google e Meta usam cookies opcionais para medir campanhas e
              personalizar anúncios. Você escolhe.{" "}
              <a
                href="/privacidade"
                className="font-semibold text-[#00616A] underline underline-offset-2"
              >
                Saiba mais
              </a>
              .
            </p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:flex sm:shrink-0">
          <button
            type="button"
            onClick={() => choose("essential")}
            className="min-h-11 rounded-full border border-[#00283C]/20 px-3 py-2 text-xs font-bold text-[#00283C] transition-colors hover:bg-slate-50 sm:px-4 sm:text-sm"
          >
            Só essenciais
          </button>
          <button
            type="button"
            onClick={() => choose("accepted")}
            className="min-h-11 rounded-full bg-[#087A37] px-3 py-2 text-xs font-black text-white transition-colors hover:bg-[#075E54] sm:px-4 sm:text-sm"
          >
            Aceitar opcionais
          </button>
        </div>
      </div>
    </aside>
  );
}
