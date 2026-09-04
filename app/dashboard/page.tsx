"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { authClient } from "@/lib/auth-client";

const PAGE_SIZE = 7;

type Row = NonNullable<
  ReturnType<typeof useQuery<typeof api.registrations.listAll>>
>[number];

/** /dashboard — portado 1:1 de design/dashboard.html. */
export default function DashboardPage() {
  const router = useRouter();
  const session = authClient.useSession();
  const rows = useQuery(api.registrations.listAll, {});
  const workshops = useQuery(api.workshops.list, {});
  const stats = useQuery(api.workshops.stats, {});
  const removeRegistration = useMutation(api.registrations.remove);

  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  // Cambiar el filtro o la búsqueda vuelve a la primera página. Se hace en los
  // handlers y no en un efecto: un setState síncrono dentro de un efecto
  // dispara renders en cascada.
  const changeFilter = (slug: string) => {
    setFilter(slug);
    setPage(1);
  };
  const changeSearch = (term: string) => {
    setSearch(term);
    setPage(1);
  };
  const [detail, setDetail] = useState<Row | null>(null);

  // Conteo por taller para los tabs: sobre el total, no sobre la búsqueda.
  const countsBySlug = useMemo(() => {
    const counts = new Map<string, number>();
    for (const row of rows ?? []) {
      counts.set(row.workshop.slug, (counts.get(row.workshop.slug) ?? 0) + 1);
    }
    return counts;
  }, [rows]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return (rows ?? []).filter((row) => {
      const matchesFilter =
        filter === "all" || row.workshop.slug === filter;
      const matchesSearch =
        term === "" ||
        row.accountNumber.toLowerCase().includes(term) ||
        row.fullName.toLowerCase().includes(term);
      return matchesFilter && matchesSearch;
    });
  }, [rows, filter, search]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const start = (currentPage - 1) * PAGE_SIZE;
  const pageRows = filtered.slice(start, start + PAGE_SIZE);

  // ESC limpia el buscador desde cualquier parte de la pantalla.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") changeSearch("");
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const onSignOut = async () => {
    await authClient.signOut();
    router.push("/login");
  };

  const onDelete = async (row: Row) => {
    const ok = window.confirm(
      `¿Borrar el registro de ${row.fullName} (${row.accountNumber})? Su lugar volverá al taller.`,
    );
    if (!ok) return;
    await removeRegistration({ registrationId: row._id });
    setDetail(null);
  };

  const isLoading = rows === undefined;

  return (
    <main className="w-full pt-20 bg-transparent min-h-screen">
      <div className="flex flex-col w-full">
        {/* TOP TELEMETRY STRIP */}
        <div className="w-full bg-surface-container-lowest border-b-4 border-primary px-margin-mobile lg:px-margin-desktop py-space-xs">
          <div className="max-w-[1360px] mx-auto flex flex-wrap items-center justify-between gap-space-xs font-code-badge text-code-badge text-on-surface-variant">
            <div className="flex items-center gap-space-sm flex-wrap">
              <span className="text-primary font-bold flex items-center gap-1">
                <span className="inline-block w-2 h-2 bg-primary animate-pulse" />
                SYS_STATUS: [ONLINE]
              </span>
              <span className="text-outline">|</span>
              <span>NODE: MX-HGO-SRV01</span>
              <span className="text-outline">|</span>
              <span className="text-on-surface">
                AUTH_USER: {session.data?.user.email?.toUpperCase() ?? "..."}
              </span>
              <button
                className="px-2 py-0.5 border border-secondary text-secondary hover:bg-secondary-container hover:text-on-secondary-container font-code-badge text-code-badge uppercase transition-none"
                onClick={onSignOut}
                type="button"
              >
                [CERRAR SESIÓN]
              </button>
            </div>
            <div className="flex items-center gap-space-sm font-label-caps text-label-caps">
              <span className="bg-surface-container-high text-primary px-2 py-0.5 border border-primary">
                UTC -06:00 // CS-CONGRESS-2026
              </span>
            </div>
          </div>
        </div>

        <div className="max-w-[1360px] w-full mx-auto px-margin-mobile lg:px-margin-desktop py-space-xl flex flex-col gap-space-2xl">
          {/* SUBHEADER */}
          <header className="flex flex-col lg:flex-row lg:items-center justify-between gap-space-lg bg-surface-container-low p-space-lg border-4 border-primary shadow-[6px_6px_0px_#000000]">
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <span className="bg-primary text-on-primary font-label-caps text-code-badge px-2 py-0.5 font-bold">
                  SEC_01
                </span>
                <span className="font-label-caps text-code-badge text-primary tracking-widest">
                  [ADMIN_PANEL_ROOT]
                </span>
              </div>
              <h1 className="font-display-hero text-headline-lg text-on-background tracking-tight flex flex-wrap items-center gap-2">
                PANEL DE CONTROL{" "}
                <span className="text-secondary-container">{"//"}</span>{" "}
                <span className="text-primary font-display-hero">
                  ADMIN_TALLERES
                </span>
              </h1>
              <p className="font-body-sm text-body-sm text-on-surface-variant">
                AUDITORÍA EN TIEMPO REAL // FACULTAD DE INGENIERÍA EN COMPUTACIÓN
                &amp; TELEMÁTICA
              </p>
            </div>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-space-md">
              <div className="bg-primary text-on-primary p-space-md border-4 border-black shadow-[6px_6px_0px_#000000] flex flex-col justify-center">
                <span className="font-label-caps text-code-badge tracking-widest text-on-primary font-bold">
                  METRICA GLOBAL
                </span>
                <div className="font-display-hero text-headline-sm uppercase tracking-tight flex items-baseline gap-2">
                  <span>REGISTROS: {stats?.totalRegistrations ?? 0}</span>
                  <span className="text-label-caps font-label-caps bg-on-primary text-primary px-1.5 py-0.5">
                    [{stats?.occupancyPercent ?? 0}% OCUPADO]
                  </span>
                </div>
              </div>
              <div className="bg-surface-container-lowest border-4 border-outline p-space-md shadow-[6px_6px_0px_#000000] flex flex-col justify-center min-w-[170px]">
                <span className="font-code-badge text-code-badge text-on-surface-variant uppercase">
                  ESTADO DE MATRÍCULA
                </span>
                <div className="flex items-center gap-2 mt-1">
                  <span className="w-3 h-3 bg-primary border-2 border-black" />
                  <span className="font-label-caps text-label-caps text-primary tracking-wider">
                    [SYS_ACTIVO]
                  </span>
                </div>
              </div>
            </div>
          </header>

          {/* 4 METRIC STAT CARDS */}
          <section aria-label="Estadísticas de Capacidad y Registro">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-space-lg">
              <StatCard
                code="REG-01"
                footer={
                  <>
                    <span className="text-primary font-bold">
                      +{stats?.registrationsLastHour ?? 0} EN LA ÚLTIMA HORA
                    </span>
                    <span className="material-symbols-outlined text-primary text-[18px]">
                      trending_up
                    </span>
                  </>
                }
                label="TOTAL REGISTRADOS"
                value={String(stats?.totalRegistrations ?? 0).padStart(2, "0")}
              />
              <StatCard
                code="MOD-05"
                footer={
                  <>
                    <span className="text-on-surface">
                      {stats?.workshopsWithSeats ?? 0} DE{" "}
                      {stats?.activeWorkshops ?? 0} CON CUPO ABIERTO
                    </span>
                    <span className="material-symbols-outlined text-primary text-[18px]">
                      lock_open
                    </span>
                  </>
                }
                label="TALLERES ACTIVOS"
                value={String(stats?.activeWorkshops ?? 0).padStart(2, "0")}
              />
              <TopWorkshopCard top={stats?.topWorkshop ?? null} />
              <StatCard
                code={`AVL-${stats?.availableSeats ?? 0}`}
                footer={
                  <>
                    <span className="text-on-surface">
                      [{stats?.availablePercent ?? 0}% GLOBAL RESTANTE]
                    </span>
                    <span className="material-symbols-outlined text-primary text-[18px]">
                      event_seat
                    </span>
                  </>
                }
                label="CUPOS DISPONIBLES"
                value={String(stats?.availableSeats ?? 0)}
              />
            </div>
          </section>

          {/* FILTER TABS & SEARCH */}
          <section className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-space-md">
            <div className="flex flex-wrap items-center gap-space-xs">
              <FilterTab
                active={filter === "all"}
                label={`TODOS (${rows?.length ?? 0})`}
                onClick={() => changeFilter("all")}
              />
              {workshops?.map((workshop) => (
                <FilterTab
                  active={filter === workshop.slug}
                  key={workshop._id}
                  label={`${workshop.keyword} (${countsBySlug.get(workshop.slug) ?? 0})`}
                  onClick={() => changeFilter(workshop.slug)}
                />
              ))}
            </div>

            <div className="relative min-w-full sm:min-w-[340px] lg:min-w-[420px]">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-primary font-bold">
                <span className="material-symbols-outlined text-[20px]">
                  search
                </span>
              </div>
              <input
                className="w-full pl-10 pr-4 py-2 bg-surface-container-lowest border-4 border-outline text-on-surface font-body-md text-body-md placeholder:text-on-surface-variant focus:border-primary focus:outline-none shadow-[4px_4px_0px_#000000] focus:shadow-[6px_6px_0px_#8cc63f] transition-all"
                onChange={(event) => changeSearch(event.target.value)}
                placeholder="> BUSCAR POR CUENTA O NOMBRE..."
                type="text"
                value={search}
              />
              <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-outline font-code-badge text-code-badge">
                [ESC_CLEAR]
              </div>
            </div>
          </section>

          {/* DATA TABLE */}
          <section className="bg-surface-container-lowest border-4 border-primary shadow-[8px_8px_0px_#000000] overflow-hidden">
            <div className="bg-surface-container-high border-b-4 border-primary px-space-md py-space-xs flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 bg-secondary-container border border-black inline-block" />
                <span className="w-3 h-3 bg-primary-container border border-black inline-block" />
                <span className="w-3 h-3 bg-primary border border-black inline-block" />
                <span className="ml-2 font-code-badge text-code-badge text-on-surface-variant font-bold uppercase">
                  DATABASE://WORKSHOP_PARTICIPANTS_INDEX
                </span>
              </div>
              <div className="flex items-center gap-space-sm font-code-badge text-code-badge text-primary">
                <span>READ_ONLY_LOCK: OFF</span>
                <span>{"// BUFFER: "}{isLoading ? "SYNC..." : "OK"}</span>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[980px]">
                <thead>
                  <tr className="bg-primary text-on-primary font-label-caps text-label-caps border-b-4 border-black select-none">
                    <th className="py-space-md px-space-md border-r-2 border-black w-14 text-center" scope="col">
                      #
                    </th>
                    <th className="py-space-md px-space-md border-r-2 border-black tracking-wider" scope="col">
                      NÚMERO DE CUENTA
                    </th>
                    <th className="py-space-md px-space-md border-r-2 border-black tracking-wider" scope="col">
                      NOMBRE
                    </th>
                    <th className="py-space-md px-space-md border-r-2 border-black tracking-wider" scope="col">
                      CORREO
                    </th>
                    <th className="py-space-md px-space-md border-r-2 border-black tracking-wider" scope="col">
                      TALLER
                    </th>
                    <th className="py-space-md px-space-md border-r-2 border-black tracking-wider text-center" scope="col">
                      GRUPO
                    </th>
                    <th className="py-space-md px-space-md tracking-wider text-right" scope="col">
                      ACCIONES
                    </th>
                  </tr>
                </thead>
                <tbody className="font-body-md text-body-md text-on-surface divide-y-2 divide-surface-container-high">
                  {pageRows.map((row, index) => (
                    <tr
                      className={`hover:bg-surface-container transition-colors ${
                        index % 2 === 0
                          ? "bg-surface-container-low"
                          : "bg-surface-container-lowest"
                      }`}
                      key={row._id}
                    >
                      <td className="py-space-md px-space-md border-r-2 border-surface-container-high text-center font-code-badge text-primary font-bold">
                        {String(start + index + 1).padStart(2, "0")}
                      </td>
                      <td className="py-space-md px-space-md border-r-2 border-surface-container-high font-bold font-code-badge text-primary-fixed">
                        {row.accountNumber}
                      </td>
                      <td className="py-space-md px-space-md border-r-2 border-surface-container-high font-headline-sm text-headline-sm uppercase text-on-background">
                        {row.fullName}
                      </td>
                      <td className="py-space-md px-space-md border-r-2 border-surface-container-high text-on-surface-variant font-body-sm text-body-sm">
                        {row.email}
                      </td>
                      <td className="py-space-md px-space-md border-r-2 border-surface-container-high">
                        <span
                          className={`inline-block bg-surface-container-highest border-2 px-2.5 py-1 font-code-badge text-code-badge font-bold uppercase ${ACCENT_CLASSES[row.workshop.accent]}`}
                        >
                          {row.workshop.keyword}
                        </span>
                      </td>
                      <td className="py-space-md px-space-md border-r-2 border-surface-container-high text-center">
                        <span className="inline-block bg-surface-container-highest text-primary border border-primary px-2.5 py-0.5 font-code-badge text-code-badge font-bold">
                          G-{row.group}
                        </span>
                      </td>
                      <td className="py-space-md px-space-md text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            className="px-2.5 py-1.5 bg-surface-container-high hover:bg-primary hover:text-on-primary text-primary font-label-caps text-code-badge border-2 border-primary shadow-[2px_2px_0px_#000] active:translate-x-0.5 active:translate-y-0.5 transition-all"
                            onClick={() => setDetail(row)}
                            title="Ver Ficha Completa"
                            type="button"
                          >
                            [VER]
                          </button>
                          <button
                            className="px-2.5 py-1.5 bg-secondary-container/30 hover:bg-secondary-container hover:text-on-secondary-container text-secondary font-label-caps text-code-badge border-2 border-secondary shadow-[2px_2px_0px_#000] active:translate-x-0.5 active:translate-y-0.5 transition-all"
                            onClick={() => onDelete(row)}
                            title="Eliminar Registro"
                            type="button"
                          >
                            [BORRAR]
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {pageRows.length === 0 ? (
                <EmptyState isLoading={isLoading} />
              ) : null}
            </div>
          </section>

          {/* PAGINATION */}
          <section className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-space-lg bg-surface-container-low p-space-md border-4 border-outline shadow-[6px_6px_0px_#000000]">
            <div className="font-code-badge text-code-badge text-on-surface-variant flex items-center gap-2">
              <span className="w-2.5 h-2.5 bg-primary" />
              <span>
                MOSTRANDO {filtered.length === 0 ? 0 : start + 1}-
                {Math.min(start + PAGE_SIZE, filtered.length)} DE{" "}
                {filtered.length} REGISTROS // PÁGINA {currentPage} DE{" "}
                {pageCount}
              </span>
            </div>

            <div className="flex items-center gap-1 flex-wrap">
              <PageButton
                disabled={currentPage === 1}
                label="<<"
                onClick={() => setPage(1)}
                title="Primera página"
              />
              <PageButton
                disabled={currentPage === 1}
                label="<"
                onClick={() => setPage(currentPage - 1)}
                title="Página anterior"
              />
              {pageNumbers(currentPage, pageCount).map((entry, index) =>
                entry === null ? (
                  <span
                    className="px-3.5 py-2 font-label-caps text-code-badge text-outline"
                    key={`gap-${index}`}
                  >
                    ...
                  </span>
                ) : (
                  <button
                    className={`px-3.5 py-2 font-label-caps text-code-badge border-2 shadow-[2px_2px_0px_#000] ${
                      entry === currentPage
                        ? "bg-inverse-surface text-inverse-on-surface border-black font-bold"
                        : "bg-surface-container-lowest text-on-surface hover:bg-surface-container-high border-outline hover:border-primary"
                    }`}
                    key={entry}
                    onClick={() => setPage(entry)}
                    type="button"
                  >
                    {String(entry).padStart(2, "0")}
                  </button>
                ),
              )}
              <PageButton
                disabled={currentPage === pageCount}
                label=">"
                onClick={() => setPage(currentPage + 1)}
                title="Página siguiente"
              />
              <PageButton
                disabled={currentPage === pageCount}
                label=">>"
                onClick={() => setPage(pageCount)}
                title="Última página"
              />
            </div>

            <button
              className="bg-primary text-on-primary font-label-caps text-label-caps px-space-lg py-space-sm border-4 border-black shadow-[4px_4px_0px_#000000] opacity-40 cursor-not-allowed flex items-center justify-center gap-2"
              disabled
              title="Disponible en F5"
              type="button"
            >
              <span>EXPORTAR CSV</span>
              <span className="material-symbols-outlined text-[18px]">
                download
              </span>
            </button>
          </section>
        </div>
      </div>

      {detail === null ? null : (
        <DetailModal
          onClose={() => setDetail(null)}
          onDelete={() => onDelete(detail)}
          row={detail}
        />
      )}
    </main>
  );
}

const ACCENT_CLASSES = {
  primary: "text-primary border-primary",
  secondary: "text-secondary border-secondary",
  tertiary: "text-tertiary border-tertiary",
} as const;

/** Ventana deslizante de páginas; `null` es el separador "...". */
function pageNumbers(current: number, total: number): (number | null)[] {
  if (total <= 5) {
    return Array.from({ length: total }, (_, index) => index + 1);
  }
  const pages = new Set([1, total, current, current - 1, current + 1]);
  const sorted = [...pages]
    .filter((page) => page >= 1 && page <= total)
    .sort((a, b) => a - b);

  const result: (number | null)[] = [];
  let previous = 0;
  for (const page of sorted) {
    if (previous !== 0 && page - previous > 1) result.push(null);
    result.push(page);
    previous = page;
  }
  return result;
}

function PageButton({
  disabled,
  label,
  onClick,
  title,
}: {
  disabled: boolean;
  label: string;
  onClick: () => void;
  title: string;
}) {
  return (
    <button
      className="px-3 py-2 bg-surface-container-lowest text-on-surface hover:bg-surface-container-high font-label-caps text-code-badge border-2 border-outline hover:border-primary shadow-[2px_2px_0px_#000] disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-surface-container-lowest disabled:hover:border-outline"
      disabled={disabled}
      onClick={onClick}
      title={title}
      type="button"
    >
      {label}
    </button>
  );
}

function FilterTab({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      className={`font-label-caps text-label-caps px-4 py-2 shadow-[4px_4px_0px_#000000] active:translate-x-1 active:translate-y-1 active:shadow-none transition-all ${
        active
          ? "bg-secondary text-on-secondary-fixed border-4 border-black"
          : "bg-surface-container-lowest text-on-surface hover:bg-surface-container-high border-2 border-outline hover:border-primary"
      }`}
      onClick={onClick}
      type="button"
    >
      {label}
    </button>
  );
}

function StatCard({
  code,
  footer,
  label,
  value,
}: {
  code: string;
  footer: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="bg-surface-container-low border-4 border-primary p-space-lg shadow-[6px_6px_0px_#000000] flex flex-col justify-between relative">
      <div className="flex items-center justify-between border-b-2 border-primary/40 pb-space-xs mb-space-sm">
        <span className="font-label-caps text-label-caps text-on-surface-variant">
          {label}
        </span>
        <span className="font-code-badge text-code-badge text-primary bg-surface-container px-1.5 py-0.5 border border-primary">
          {code}
        </span>
      </div>
      <div className="my-space-xs">
        <span className="font-display-hero text-display-hero text-primary leading-none block">
          {value}
        </span>
      </div>
      <div className="pt-space-xs flex items-center justify-between text-body-sm font-body-sm">
        {footer}
      </div>
    </div>
  );
}

function TopWorkshopCard({
  top,
}: {
  top: { keyword: string; enrolled: number; occupancyPercent: number } | null;
}) {
  const critical = (top?.occupancyPercent ?? 0) >= 80;
  return (
    <div className="bg-surface-container-low border-4 border-secondary p-space-lg shadow-[6px_6px_0px_#000000] flex flex-col justify-between relative">
      <div className="flex items-center justify-between border-b-2 border-secondary/40 pb-space-xs mb-space-sm">
        <span className="font-label-caps text-label-caps text-secondary font-bold">
          MÁS SOLICITADO
        </span>
        <span className="font-code-badge text-code-badge text-secondary-fixed bg-secondary-container px-1.5 py-0.5 border border-secondary">
          MAX_DEMAND
        </span>
      </div>
      <div className="my-space-xs">
        <span className="font-display-hero text-headline-lg text-on-surface leading-tight block">
          {top?.keyword ?? "—"}
        </span>
        <span className="font-label-caps text-headline-sm text-secondary font-bold mt-1 block">
          {top?.enrolled ?? 0} ALUMNOS
        </span>
      </div>
      <div className="pt-space-xs flex items-center justify-between text-body-sm font-body-sm text-secondary">
        <span>
          {critical ? "CAPACIDAD CRÍTICA" : "CAPACIDAD"} [
          {top?.occupancyPercent ?? 0}%]
        </span>
        <span className="material-symbols-outlined text-secondary text-[18px]">
          {critical ? "priority_high" : "insights"}
        </span>
      </div>
    </div>
  );
}

/** No viene en el HTML: diseñado en el mismo lenguaje. */
function EmptyState({ isLoading }: { isLoading: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center gap-space-xs py-space-3xl px-space-lg border-t-2 border-surface-container-high text-center">
      <span className="material-symbols-outlined text-outline text-[32px]">
        {isLoading ? "sync" : "database_off"}
      </span>
      <span className="font-label-caps text-label-caps text-on-surface-variant uppercase tracking-wider">
        {isLoading
          ? "SYNC_IN_PROGRESS // LEYENDO BUFFER"
          : "NO_RECORDS_FOUND // BUFFER VACÍO"}
      </span>
      {isLoading ? null : (
        <span className="font-code-badge text-code-badge text-outline">
          NINGÚN REGISTRO COINCIDE CON EL FILTRO O LA BÚSQUEDA ACTIVOS.
        </span>
      )}
    </div>
  );
}

function DetailModal({
  onClose,
  onDelete,
  row,
}: {
  onClose: () => void;
  onDelete: () => void;
  row: Row;
}) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[60] bg-black/70 flex items-center justify-center p-margin-mobile"
      onClick={onClose}
    >
      <div
        className="w-full max-w-[560px] bg-surface-container-low border-4 border-primary shadow-[8px_8px_0px_#000000]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="bg-surface-container-high border-b-4 border-primary px-space-md py-space-xs flex items-center justify-between">
          <span className="font-code-badge text-code-badge text-on-surface-variant font-bold uppercase">
            RECORD://{row.accountNumber}
          </span>
          <button
            className="font-code-badge text-code-badge text-secondary border border-secondary px-2 py-0.5 hover:bg-secondary-container hover:text-on-secondary-container"
            onClick={onClose}
            type="button"
          >
            [ESC]
          </button>
        </div>

        <dl className="p-space-lg grid grid-cols-1 sm:grid-cols-2 gap-space-md">
          <ModalField label="NÚMERO DE CUENTA" value={row.accountNumber} />
          <ModalField label="GRUPO" value={`G-${row.group}`} />
          <ModalField label="NOMBRE" value={row.fullName.toUpperCase()} />
          <ModalField label="CORREO" value={row.email} />
          <ModalField label="TALLER" value={row.workshop.keyword} />
          <ModalField
            label="REGISTRADO"
            value={formatTimestamp(row._creationTime)}
          />
          {row.reassignedAt === undefined ? null : (
            <ModalField
              label="REASIGNADO"
              value={formatTimestamp(row.reassignedAt)}
            />
          )}
        </dl>

        <div className="px-space-lg pb-space-lg flex justify-end">
          <button
            className="px-3 py-2 bg-secondary-container/30 hover:bg-secondary-container hover:text-on-secondary-container text-secondary font-label-caps text-code-badge border-2 border-secondary shadow-[2px_2px_0px_#000]"
            onClick={onDelete}
            type="button"
          >
            [BORRAR REGISTRO]
          </button>
        </div>
      </div>
    </div>
  );
}

function ModalField({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-space-2xs">
      <dt className="font-code-badge text-code-badge text-on-surface-variant uppercase">
        {label}
      </dt>
      <dd className="font-body-md text-body-md text-on-surface font-bold break-words">
        {value}
      </dd>
    </div>
  );
}

function formatTimestamp(timestamp: number) {
  return new Intl.DateTimeFormat("es-MX", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "America/Mexico_City",
  }).format(timestamp);
}
