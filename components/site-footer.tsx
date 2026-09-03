/** Footer compartido por las 3 pantallas. Portado 1:1 de design/*.html. */
export function SiteFooter() {
  return (
    <footer className="w-full bg-surface-container-lowest border-t-4 border-primary mt-space-3xl">
      <div className="max-w-340 mx-auto px-margin-mobile lg:px-margin-desktop py-space-xl flex flex-col md:flex-row items-center justify-between gap-space-md font-label-caps text-body-sm">
        <div className="flex flex-col sm:flex-row items-center gap-3 text-center sm:text-left">
          <span className="bg-primary text-on-primary px-2 py-0.5 font-bold">
            CINSOFT 2026
          </span>
        </div>
        <div className="text-on-surface-variant font-code-badge text-code-badge">
          SYSTEM CODE: PAULOMANTILLADEV // ALL RIGHTS RESERVED
        </div>
      </div>
    </footer>
  );
}
