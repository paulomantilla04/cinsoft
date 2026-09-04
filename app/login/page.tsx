"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";

/** /login — portado 1:1 de design/login.html. */
export default function LoginPage() {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasError, setHasError] = useState(false);

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const email = String(form.get("admin-user") ?? "").trim();
    const password = String(form.get("admin-password") ?? "");

    if (email === "" || password === "") {
      setHasError(true);
      return;
    }

    setHasError(false);
    setIsSubmitting(true);
    const { error } = await authClient.signIn.email({ email, password });
    if (error) {
      // Mensaje genérico a propósito: distinguir "no existe" de "contraseña
      // incorrecta" le confirmaría a un atacante qué correos son válidos.
      setHasError(true);
      setIsSubmitting(false);
      return;
    }
    router.push("/dashboard");
  };

  return (
    <main className="w-full pt-20 bg-transparent min-h-screen">
      <div className="flex flex-col w-full min-h-[calc(100vh-5rem)] justify-center items-center py-space-xl px-margin-mobile">
        <div className="w-full max-w-[430px] flex flex-col items-center">
          {/* 1. ENCABEZADO */}
          <div className="flex flex-col items-center mb-space-lg w-full text-center">
            <div className="font-display-hero text-[52px] sm:text-[60px] tracking-[-0.04em] uppercase font-bold leading-none select-none flex items-center justify-center">
              <span className="text-primary-container">CINS</span>
              <span className="text-secondary-container text-error">O</span>
              <span className="text-primary-container">FT</span>
            </div>
            <div className="font-code-badge text-code-badge text-on-surface-variant tracking-widest mt-1 mb-space-xs uppercase">
              SYS_AUTH_LEVEL // ROOT_ADMIN_v24.0
            </div>
            <div className="w-full flex items-center justify-center gap-2 px-3 py-1.5 bg-surface-container-low border-[3px] border-secondary-container shadow-[4px_4px_0px_#000000]">
              <span className="inline-block w-2.5 h-2.5 bg-error animate-pulse" />
              <span className="font-label-caps text-[11px] sm:text-label-caps tracking-wider text-error uppercase font-bold">
                PANEL DE ADMINISTRACIÓN // ACCESO RESTRINGIDO
              </span>
            </div>
          </div>

          {/* 2. TARJETA DE LOGIN */}
          <div className="w-full bg-surface-container-low border-[3px] border-on-surface shadow-[8px_8px_0px_#8cc63f] p-space-md sm:p-space-lg flex flex-col">
            <div className="flex items-center justify-between border-b-[2px] border-outline-variant pb-space-xs mb-space-md font-code-badge text-code-badge text-on-surface-variant">
              <span className="flex items-center gap-1.5 text-primary">
                <span className="material-symbols-outlined text-[14px]">
                  terminal
                </span>
                SEC_GATE // NODE_01
              </span>
              <span className="text-on-surface-variant uppercase">
                AUTH_PROTOCOL_0x4F
              </span>
            </div>

            {/* BANNER DE ERROR: oculto hasta que Better Auth rechaza */}
            {hasError ? (
              <div
                className="w-full mb-space-md p-space-xs bg-secondary-container border-[3px] border-surface-container-lowest shadow-[4px_4px_0px_#000000] flex items-start gap-2"
                id="auth-error-banner"
              >
                <span className="material-symbols-outlined text-on-error-container text-[18px] leading-none select-none">
                  warning
                </span>
                <div className="flex flex-col">
                  <span className="font-label-caps text-label-caps text-on-error-container font-bold uppercase tracking-wider">
                    ⚠ ERROR // CREDENCIALES INCORRECTAS
                  </span>
                  <span className="font-code-badge text-code-badge text-on-secondary-container mt-0.5">
                    VERIFIQUE SYS_ID Y LLAVE MAESTRA ANTES DE REINTENTAR.
                  </span>
                </div>
              </div>
            ) : null}

            <div className="mb-space-md">
              <div className="font-code-badge text-code-badge text-primary-container uppercase tracking-widest mb-1">
                SEC_AUTH // VERIFICATION
              </div>
              <h1 className="font-headline-md text-headline-md text-on-surface font-bold tracking-tight uppercase">
                INICIAR SESIÓN
              </h1>
            </div>

            <form className="flex flex-col gap-space-md" onSubmit={onSubmit}>
              {/* CAMPO 1: USUARIO / CORREO */}
              <div className="flex flex-col gap-1.5">
                <label
                  className="font-label-caps text-[11px] sm:text-label-caps text-on-surface uppercase flex items-center justify-between"
                  htmlFor="admin-user"
                >
                  <span>USUARIO O CORREO INSTITUCIONAL</span>
                  <span className="text-on-surface-variant font-code-badge">
                    [SYS_ID / EMAIL]
                  </span>
                </label>
                <div className="relative w-full">
                  <input
                    autoComplete="username"
                    className="w-full h-12 bg-surface-dim border-[3px] border-on-surface text-on-surface px-space-sm font-body-md text-body-md placeholder:text-outline focus:outline-none focus:border-secondary-container focus:shadow-[4px_4px_0px_#aa1400] transition-none"
                    id="admin-user"
                    name="admin-user"
                    placeholder="admin@uaeh.edu.mx"
                    required
                    type="text"
                  />
                </div>
              </div>

              {/* CAMPO 2: CONTRASEÑA MAESTRA */}
              <div className="flex flex-col gap-1.5">
                <label
                  className="font-label-caps text-[11px] sm:text-label-caps text-on-surface uppercase flex items-center justify-between"
                  htmlFor="admin-password"
                >
                  <span>CONTRASEÑA MAESTRA</span>
                  <span className="text-on-surface-variant font-code-badge">
                    [SECURITY_KEY]
                  </span>
                </label>
                <div className="relative w-full flex items-center">
                  <input
                    autoComplete="current-password"
                    className="w-full h-12 bg-surface-dim border-[3px] border-on-surface text-on-surface pl-space-sm pr-16 font-body-md text-body-md placeholder:text-outline focus:outline-none focus:border-secondary-container focus:shadow-[4px_4px_0px_#aa1400] transition-none"
                    id="admin-password"
                    name="admin-password"
                    placeholder="••••••••••••"
                    required
                    type={showPassword ? "text" : "password"}
                  />
                  <button
                    className={`absolute right-[3px] top-[3px] bottom-[3px] w-12 border-l-[3px] border-on-surface font-code-badge text-code-badge flex items-center justify-center transition-none uppercase ${
                      showPassword
                        ? "bg-primary-container text-surface-container-lowest"
                        : "bg-surface-container-high text-on-surface hover:bg-primary-container hover:text-surface-container-lowest"
                    }`}
                    onClick={() => setShowPassword((value) => !value)}
                    title="Mostrar / Ocultar"
                    type="button"
                  >
                    <span>{showPassword ? "[HIDE]" : "[SHOW]"}</span>
                  </button>
                </div>
              </div>

              {/* OPCIONES */}
              <div className="flex flex-row items-center justify-between gap-2 pt-1">
                <label className="flex items-center gap-2 cursor-pointer select-none group">
                  <input
                    className="sr-only peer"
                    defaultChecked
                    id="remember-session"
                    name="remember-session"
                    type="checkbox"
                  />
                  <div className="w-5 h-5 bg-surface-dim border-[3px] border-primary-container flex items-center justify-center peer-checked:bg-primary-container transition-none">
                    <span className="material-symbols-outlined text-[14px] text-surface-container-lowest font-black scale-110">
                      check
                    </span>
                  </div>
                  <span className="font-label-caps text-[11px] text-on-surface group-hover:text-primary transition-none uppercase">
                    MANTENER SESIÓN
                  </span>
                </label>

                <a
                  className="font-code-badge text-[11px] text-on-surface hover:text-primary-container underline underline-offset-4 decoration-2 decoration-primary-container uppercase"
                  href="#"
                  onClick={(event) => {
                    event.preventDefault();
                    window.alert(
                      "PROCESO DE RECUPERACIÓN // CONTACTAR A SOPORTE TI DE FACULTAD O ROOT ADMIN.",
                    );
                  }}
                >
                  ¿OLVIDASTE TU CONTRASEÑA?
                </a>
              </div>

              {/* BOTÓN PRINCIPAL */}
              <div className="pt-space-xs">
                <button
                  className={`w-full h-14 border-[4px] border-surface-container-lowest font-headline-sm text-headline-sm font-bold uppercase tracking-wider shadow-[6px_6px_0px_#000000] hover:-translate-x-[2px] hover:-translate-y-[2px] hover:shadow-[8px_8px_0px_#8cc63f] active:translate-x-[6px] active:translate-y-[6px] active:shadow-none flex items-center justify-center gap-2 transition-none cursor-pointer ${
                    isSubmitting
                      ? "bg-surface-bright text-primary"
                      : "bg-primary-container text-surface-container-lowest"
                  }`}
                  disabled={isSubmitting}
                  type="submit"
                >
                  {isSubmitting ? (
                    <span>ACCEDIENDO AL SISTEMA...</span>
                  ) : (
                    <>
                      <span>ENTRAR</span>
                      <span className="font-display-hero text-headline-sm">
                        ➔
                      </span>
                    </>
                  )}
                </button>
              </div>
            </form>

            <div className="mt-space-md pt-space-xs border-t-[2px] border-outline-variant/40 flex items-center gap-2">
              <span className="material-symbols-outlined text-[16px] text-secondary">
                lock
              </span>
              <p className="font-code-badge text-[10px] text-on-surface-variant leading-tight uppercase">
                ACTIVIDAD REGISTRADA BAJO IP INSTITUCIONAL. CUALQUIER INTENTO DE
                INTRODUCCIÓN NO AUTORIZADA SERÁ NOTIFICADO.
              </p>
            </div>
          </div>

          {/* 3. PIE */}
          <div className="mt-space-lg text-center flex flex-col items-center gap-1 font-code-badge text-code-badge text-on-surface-variant opacity-75">
            <div>
              CINSOFT 2026 — SOLO PERSONAL AUTORIZADO // TERMINAL SEC_NODE_01
            </div>
            <div className="text-[10px] text-outline">
              ENC: SHA-256 / RSA-4096 BIT KEY EXCHANGE ACTIVE
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
