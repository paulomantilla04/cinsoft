import Link from "next/link";

/**
 * Header fijo compartido por las 3 pantallas. Portado 1:1 de design/*.html.
 * El badge dice "CONGRESS" en dashboard/login y "CONGRESO" en registro.
 */
export function SiteHeader({ badge = "CONGRESS" }: { badge?: string }) {
  return (
    <header className="fixed top-0 left-0 w-full z-50 bg-surface-container-lowest border-b-4 border-primary shadow-[0_6px_0px_#000000]">
      <div className="h-20 max-w-[1360px] mx-auto px-margin-mobile lg:px-margin-desktop flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link className="flex items-center gap-3" href="/registro">
            <div className="bg-primary text-on-primary px-3 py-1 font-display-hero text-headline-sm tracking-tight">
              CINSOFT
            </div>
            <span className="hidden sm:inline-block font-label-caps text-label-caps text-primary tracking-widest border border-primary px-2 py-0.5">
              v26.0 // {badge}
            </span>
          </Link>
        </div>
        <nav className="hidden md:flex items-center gap-2" />
        <div className="flex items-center gap-4">
          <div className="hidden sm:flex flex-col items-end">
            <span className="font-code-badge text-code-badge text-primary">
              TERMINAL_ONLINE
            </span>
            <span className="font-code-badge text-code-badge text-on-surface-variant">
              SYS_ID: 8089-AUTH
            </span>
          </div>
          <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center">
            <span className="material-symbols-outlined text-on-primary text-[18px]">
              person
            </span>
          </div>
        </div>
      </div>
    </header>
  );
}
