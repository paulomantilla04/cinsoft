"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  AnimatePresence,
  animate,
  motion,
  useReducedMotion,
} from "motion/react";
import { useRouter } from "next/navigation";
import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { ConvexError } from "convex/values";
import { BrutalistSelect } from "@/components/brutalist-select";
import { Modal, ModalHeader } from "@/components/modal";
import { api } from "@/convex/_generated/api";
import { GROUPS } from "@/lib/catalog";
import { formatSchedule, toSchedule } from "@/lib/schedule";
import type { Id } from "@/convex/_generated/dataModel";
import { authClient } from "@/lib/auth-client";

const PAGE_SIZE = 7;

type Row = NonNullable<
  ReturnType<typeof useQuery<typeof api.registrations.listAll>>
>[number];

/** /dashboard — portado 1:1 de design/dashboard.html. */
export default function DashboardPage() {
  const router = useRouter();
  const session = authClient.useSession();
  const { isAuthenticated } = useConvexAuth();
  const reduced = useReducedMotion();
  const [isSigningOut, setIsSigningOut] = useState(false);

  // Las queries protegidas sólo se suscriben con sesión viva. Sin esto, al
  // cerrar sesión el dashboard sigue montado un instante con sus
  // suscripciones abiertas, Convex las re-ejecuta ya sin identidad y
  // `requireAdmin` lanza UNAUTHORIZED. `isSigningOut` corta la suscripción
  // antes de invalidar el token; `isAuthenticated` cubre además la expiración
  // de la sesión y el arranque, cuando el token todavía no se ha resuelto.
  const canQuery = isAuthenticated && !isSigningOut;
  const rows = useQuery(api.registrations.listAll, canQuery ? {} : "skip");
  const workshops = useQuery(api.workshops.list, canQuery ? {} : "skip");
  const stats = useQuery(api.workshops.stats, canQuery ? {} : "skip");
  const removeRegistration = useMutation(api.registrations.remove);
  const moveRegistration = useMutation(api.registrations.move);

  const [filter, setFilter] = useState("all");
  const [groupFilter, setGroupFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  // Cambiar el filtro o la búsqueda vuelve a la primera página. Se hace en los
  // handlers y no en un efecto: un setState síncrono dentro de un efecto
  // dispara renders en cascada.
  const changeFilter = (slug: string) => {
    setFilter(slug);
    setPage(1);
  };
  const changeGroup = (group: string) => {
    setGroupFilter(group);
    setPage(1);
  };
  const changeSearch = (term: string) => {
    setSearch(term);
    setPage(1);
  };
  const [detail, setDetail] = useState<Row[] | null>(null);
  const [moveRow, setMoveRow] = useState<Row | null>(null);
  const [deleteRow, setDeleteRow] = useState<Row | null>(null);
  // Con el filtro "todos" conviven dos botones, así que el estado guarda cuál
  // está trabajando y no sólo que algo lo está.
  const [exportJob, setExportJob] = useState<{
    kind: "csv" | "sheet";
    state: "working" | "done";
  } | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);

  // Conteo por taller para los tabs: sobre el total, no sobre la búsqueda.
  const countsBySlug = useMemo(() => {
    const counts = new Map<string, number>();
    for (const row of rows ?? []) {
      counts.set(row.workshop.slug, (counts.get(row.workshop.slug) ?? 0) + 1);
    }
    return counts;
  }, [rows]);

  // Los conteos por grupo se calculan dentro del taller activo: al mirar un
  // taller interesa cuántos de *ese* taller son de cada grupo.
  const countsByGroup = useMemo(() => {
    const counts = new Map<string, number>();
    for (const row of rows ?? []) {
      if (filter !== "all" && row.workshop.slug !== filter) continue;
      counts.set(row.group, (counts.get(row.group) ?? 0) + 1);
    }
    return counts;
  }, [rows, filter]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return (rows ?? []).filter((row) => {
      const matchesFilter =
        filter === "all" || row.workshop.slug === filter;
      const matchesGroup =
        groupFilter === "all" || row.group === groupFilter;
      const matchesSearch =
        term === "" ||
        row.accountNumber.toLowerCase().includes(term) ||
        row.fullName.toLowerCase().includes(term);
      return matchesFilter && matchesGroup && matchesSearch;
    });
  }, [rows, filter, groupFilter, search]);

  // Con un taller filtrado la exportación cambia de CSV a lista de asistencia.
  const selectedWorkshop = workshops?.find(
    (workshop) => workshop.slug === filter,
  );

  const totalStudents = new Set((rows ?? []).map((row) => row.accountNumber))
    .size;

  const isAttendanceMode = selectedWorkshop !== undefined;
  // Lo que entraría en la lista: el taller filtrado, o todos, acotado al grupo.
  const attendanceRows = (rows ?? []).filter(
    (row) =>
      (filter === "all" || row.workshop.slug === filter) &&
      (groupFilter === "all" || row.group === groupFilter),
  );
  const attendanceCount = attendanceRows.length;
  // Secciones que aportarían al menos una hoja: talleres o grupos según el modo.
  const attendanceSectionCount = new Set(
    attendanceRows.map((row) =>
      isAttendanceMode ? row.workshop.slug : row.group,
    ),
  ).size;

  // Un alumno puede tener dos inscripciones, pero es una sola persona: la
  // tabla agrupa por número de cuenta y sus talleres se apilan en la columna.
  // Con un taller filtrado sólo entra su inscripción de ese taller, así que
  // ahí cada alumno aparece con un único distintivo.
  const students = useMemo(() => {
    const byAccount = new Map<string, Row[]>();
    for (const row of filtered) {
      const list = byAccount.get(row.accountNumber);
      if (list === undefined) byAccount.set(row.accountNumber, [row]);
      else list.push(row);
    }
    return [...byAccount.values()].map((rows) => ({
      // Ordenadas por antigüedad: el primer taller que eligió va primero.
      rows: rows.toSorted((a, b) => a._creationTime - b._creationTime),
      latest: Math.max(...rows.map((row) => row._creationTime)),
    }));
  }, [filtered]);

  const pageCount = Math.max(1, Math.ceil(students.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const start = (currentPage - 1) * PAGE_SIZE;
  const pageRows = students.slice(start, start + PAGE_SIZE);

  // ESC limpia el buscador desde cualquier parte de la pantalla.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") changeSearch("");
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const onSignOut = async () => {
    setIsSigningOut(true);
    await authClient.signOut();
    router.push("/login");
  };

  const onDelete = async (row: Row) => {
    await removeRegistration({ registrationId: row._id });
    setDeleteRow(null);
  };

  // Los diálogos no se apilan: abrir uno desde la ficha la cierra.
  const openMove = (row: Row) => {
    setDetail(null);
    setMoveRow(row);
  };
  const openDelete = (row: Row) => {
    setDetail(null);
    setDeleteRow(row);
  };

  const onMove = async (row: Row, workshopId: Id<"workshops">) => {
    await moveRegistration({ registrationId: row._id, workshopId });
    setMoveRow(null);
    setDetail(null);
  };

  // El CSV se arma en el cliente con los datos ya cargados y respeta el filtro
  // y la búsqueda activos: se exporta lo que se está viendo, no toda la tabla.
  const onExportCsv = () => {
    setExportError(null);
    setExportJob({ kind: "csv", state: "working" });
    const csv = toCsv(filtered);
    // El BOM hace que Excel abra los acentos correctamente.
    const blob = new Blob([`\ufeff${csv}`], {
      type: "text/csv;charset=utf-8;",
    });
    download(
      blob,
      `cinsoft-registros-${new Date().toISOString().slice(0, 10)}.csv`,
    );

    setExportJob({ kind: "csv", state: "done" });
    window.setTimeout(() => setExportJob(null), 1800);
  };

  /**
   * Listas de asistencia sobre el membrete institucional.
   *
   * Con un taller filtrado se agrupa por taller, y la cuarta columna es el
   * grupo escolar. Con "todos" se agrupa por **grupo**, porque una sola lista
   * con los siete talleres mezclados no serviría para pasar asistencia; ahí la
   * cuarta columna pasa a ser el taller, que es el dato que falta.
   *
   * Cada sección empieza en hoja nueva: se reparten por aula.
   *
   * Respeta el filtro de grupo, pero ignora la búsqueda: un texto olvidado en
   * el buscador daría una lista incompleta sin que nada lo delate en el papel,
   * y al pasar asistencia los que faltaran parecerían no inscritos.
   */
  const onExportAttendance = async () => {
    setExportError(null);
    setExportJob({ kind: "sheet", state: "working" });
    try {
      /**
       * Junta las inscripciones de un mismo alumno en una fila con sus dos
       * talleres. Sin esto, en la hoja de su grupo saldría dos veces y se le
       * pasaría lista por duplicado.
       */
      const toRows = (list: Row[]) => {
        const byAccount = new Map<string, Row[]>();
        for (const row of list) {
          const found = byAccount.get(row.accountNumber);
          if (found === undefined) byAccount.set(row.accountNumber, [row]);
          else found.push(row);
        }
        return [...byAccount.values()].map((group) => ({
          accountNumber: group[0].accountNumber,
          fullName: group[0].fullName,
          group: group[0].group,
          workshopKeywords: group
            .toSorted((a, b) => a._creationTime - b._creationTime)
            .map((row) => row.workshop.keyword),
        }));
      };
      // Alfabético: el orden con el que se pasa lista, no el de registro.
      const byName = (a: { fullName: string }, b: { fullName: string }) =>
        a.fullName.localeCompare(b.fullName, "es");

      const sections =
        selectedWorkshop === undefined
          ? GROUPS.filter(
              (group) => groupFilter === "all" || group === groupFilter,
            ).map((group) => ({
              rows: toRows(
                attendanceRows.filter((row) => row.group === group),
              ).toSorted(byName),
              secondary: "workshop" as const,
              title: `Grupo ${group}`,
            }))
          : [
              {
                rows: toRows(attendanceRows).toSorted(byName),
                schedule: (() => {
                  const s = toSchedule(selectedWorkshop);
                  return s === null ? undefined : formatSchedule(s);
                })(),
                secondary: "group" as const,
                title:
                  groupFilter === "all"
                    ? selectedWorkshop.name
                    : `${selectedWorkshop.name} — Grupo ${groupFilter}`,
              },
            ];

      // Una sección sin inscritos sólo gastaría papel.
      const withRows = sections.filter((section) => section.rows.length > 0);
      if (withRows.length === 0) {
        setExportError("No hay inscritos que listar.");
        setExportJob(null);
        return;
      }

      const response = await fetch("/plantilla.pdf");
      if (!response.ok) {
        throw new Error("No se pudo cargar la plantilla institucional.");
      }

      // Carga diferida: pdf-lib sólo se descarga al exportar, y nunca en las
      // pantallas públicas.
      const { buildAttendanceSheet } = await import("@/lib/attendance-sheet");
      const blob = await buildAttendanceSheet({
        sections: withRows,
        template: await response.arrayBuffer(),
      });

      const group = groupFilter === "all" ? "" : `-g${groupFilter}`;
      download(
        blob,
        selectedWorkshop === undefined
          ? `listas-asistencia-por-grupo${group}.pdf`
          : `lista-asistencia-${selectedWorkshop.slug}${group}.pdf`,
      );

      setExportJob({ kind: "sheet", state: "done" });
      window.setTimeout(() => setExportJob(null), 1800);
    } catch {
      setExportError("No se pudo generar la lista. Intenta de nuevo.");
      setExportJob(null);
    }
  };

  // Filas que llegaron por reactividad después de la carga inicial: se marcan
  // con un flash verde. El primer lote no cuenta, o parpadearía toda la tabla.
  const seenIds = useRef<Set<string> | null>(null);
  const [freshIds, setFreshIds] = useState<Set<string>>(new Set());
  useEffect(() => {
    if (rows === undefined) return;
    const ids = new Set(rows.map((row) => row._id));
    if (seenIds.current === null) {
      seenIds.current = ids;
      return;
    }
    const incoming = [...ids].filter((id) => !seenIds.current!.has(id));
    seenIds.current = ids;
    if (incoming.length === 0) return;
    setFreshIds(new Set(incoming));
    const timer = window.setTimeout(() => setFreshIds(new Set()), 1500);
    return () => window.clearTimeout(timer);
  }, [rows]);

  const isLoading = rows === undefined;

  return (
    <main className="w-full pt-20 bg-transparent min-h-screen">
      <div className="flex flex-col w-full">
        {/* TOP TELEMETRY STRIP */}
        <div className="w-full bg-surface-container-lowest border-b-4 border-primary px-margin-mobile lg:px-margin-desktop py-space-xs">
          <div className="max-w-340 mx-auto flex flex-wrap items-center justify-between gap-space-xs font-code-badge text-code-badge text-on-surface-variant">
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

        <div className="max-w-340 w-full mx-auto px-margin-mobile lg:px-margin-desktop py-space-xl flex flex-col gap-space-2xl">
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
              <h1 className="font-display-hero text-headline-lg-mobile lg:text-headline-lg text-on-background tracking-tight flex flex-wrap items-center gap-2">
                PANEL DE CONTROL{" "}
                <span className="text-secondary-container">{"//"}</span>{" "}
                <span className="text-primary font-display-hero">
                  ADMIN_TALLERES
                </span>
              </h1>
              <p className="font-body-sm text-body-sm text-on-surface-variant">
                AUDITORÍA EN TIEMPO REAL // ESCUELA SUPERIOR DE TLAHUELILPAN
              </p>
            </div>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-space-md">
              <div className="bg-primary text-on-primary p-space-md border-4 border-black shadow-[6px_6px_0px_#000000] flex flex-col justify-center">
                <span className="font-label-caps text-code-badge tracking-widest text-on-primary font-bold">
                  METRICA GLOBAL
                </span>
                <div className="font-display-hero text-headline-sm uppercase tracking-tight flex items-baseline gap-2">
                  <span>ALUMNOS: {stats?.totalStudents ?? 0}</span>
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
                      {stats?.totalRegistrations ?? 0} INSCRIPCIONES
                    </span>
                    <span className="material-symbols-outlined text-primary text-[18px]">
                      trending_up
                    </span>
                  </>
                }
                format={pad2}
                label="ALUMNOS REGISTRADOS"
                value={stats?.totalStudents ?? 0}
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
                format={pad2}
                label="TALLERES ACTIVOS"
                value={stats?.activeWorkshops ?? 0}
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
                value={stats?.availableSeats ?? 0}
              />
            </div>
          </section>

          {/* FILTER TABS & SEARCH */}
          <section className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-space-md">
            <div className="flex flex-wrap items-center gap-space-xs">
              <FilterTab
                active={filter === "all"}
                label={`TODOS (${totalStudents})`}
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

            <div className="flex flex-col sm:flex-row items-stretch gap-space-xs">
              <div className="sm:w-52 shrink-0">
                <span className="sr-only" id="group-filter-label">
                  Filtrar por grupo
                </span>
                <BrutalistSelect
                  id="group-filter"
                  labelledBy="group-filter-label"
                  onChange={changeGroup}
                  options={[
                    {
                      label: `TODOS LOS GRUPOS (${
                        filter === "all"
                          ? totalStudents
                          : (countsBySlug.get(filter) ?? 0)
                      })`,
                      value: "all",
                    },
                    ...GROUPS.map((group) => ({
                      label: `GRUPO ${group} (${countsByGroup.get(group) ?? 0})`,
                      value: group,
                    })),
                  ]}
                  placeholder="TODOS LOS GRUPOS"
                  value={groupFilter}
                />
              </div>

              <div className="relative min-w-full sm:min-w-75 lg:min-w-90">
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
            </div>
          </section>

          {/* DATA TABLE */}
          <section className="bg-surface-container-lowest border-4 border-primary shadow-[8px_8px_0px_#000000] overflow-hidden">
            <div className="bg-surface-container-high border-b-4 border-primary px-space-md py-space-xs flex flex-wrap items-center justify-between gap-x-space-sm gap-y-space-2xs">
              <div className="flex items-center gap-2 min-w-0">
                <span className="w-3 h-3 bg-secondary-container border border-black inline-block" />
                <span className="w-3 h-3 bg-primary-container border border-black inline-block" />
                <span className="w-3 h-3 bg-primary border border-black inline-block" />
                <span className="ml-2 font-code-badge text-code-badge text-on-surface-variant font-bold uppercase truncate">
                  DATABASE://WORKSHOP_PARTICIPANTS_INDEX
                </span>
              </div>
              <div className="flex items-center gap-space-sm font-code-badge text-code-badge text-primary">
                <span>READ_ONLY_LOCK: OFF</span>
                <span>{"// BUFFER: "}{isLoading ? "SYNC..." : "OK"}</span>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-245">
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
                  <AnimatePresence initial={false}>
                    {pageRows.map((student, index) => {
                      const row = student.rows[0];
                      const single =
                        student.rows.length === 1 ? student.rows[0] : null;
                      return (
                        <motion.tr
                          animate={{ opacity: 1 }}
                          className={`hover:bg-surface-container transition-colors ${
                            index % 2 === 0
                              ? "bg-surface-container-low"
                              : "bg-surface-container-lowest"
                          } ${student.rows.some((r) => freshIds.has(r._id)) ? "row-flash" : ""}`}
                          exit={reduced ? {} : { opacity: 0 }}
                          initial={reduced ? {} : { opacity: 0 }}
                          key={row.accountNumber}
                          layout={reduced ? false : "position"}
                          transition={{
                            duration: 0.16,
                            delay: reduced ? 0 : Math.min(index, 6) * 0.025,
                          }}
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
                            <div className="flex flex-wrap gap-1">
                              {student.rows.map((registration) => (
                                <span
                                  className={`inline-block bg-surface-container-highest border-2 px-2.5 py-1 font-code-badge text-code-badge font-bold uppercase ${ACCENT_CLASSES[registration.workshop.accent]}`}
                                  key={registration._id}
                                >
                                  {registration.workshop.keyword}
                                </span>
                              ))}
                            </div>
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
                                onClick={() => setDetail(student.rows)}
                                title="Ver ficha completa"
                                type="button"
                              >
                                [VER]
                              </button>
                              {/* Con dos talleres estos botones no sabrían a
                                  cuál aplicarse, así que ahí se opera desde la
                                  ficha, donde cada taller lleva los suyos. */}
                              {single === null ? null : (
                                <>
                                  <button
                                    className="px-2.5 py-1.5 bg-surface-container-high hover:bg-tertiary hover:text-on-tertiary text-tertiary font-label-caps text-code-badge border-2 border-tertiary shadow-[2px_2px_0px_#000] active:translate-x-0.5 active:translate-y-0.5 transition-all"
                                    onClick={() => setMoveRow(single)}
                                    title="Reasignar de taller"
                                    type="button"
                                  >
                                    [MOVER]
                                  </button>
                                  <button
                                    className="px-2.5 py-1.5 bg-secondary-container/30 hover:bg-secondary-container hover:text-on-secondary-container text-secondary font-label-caps text-code-badge border-2 border-secondary shadow-[2px_2px_0px_#000] active:translate-x-0.5 active:translate-y-0.5 transition-all"
                                    onClick={() => openDelete(single)}
                                    title="Eliminar registro"
                                    type="button"
                                  >
                                    [BORRAR]
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                        </motion.tr>
                      );
                    })}
                  </AnimatePresence>
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
                MOSTRANDO {students.length === 0 ? 0 : start + 1}-
                {Math.min(start + PAGE_SIZE, students.length)} DE{" "}
                {students.length} ALUMNOS // PÁGINA {currentPage} DE{" "}
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

            <div className="flex flex-col items-stretch sm:items-end gap-space-2xs">
              <div className="flex flex-col sm:flex-row items-stretch gap-2">
                {isAttendanceMode ? null : (
                  <ExportButton
                    disabled={filtered.length === 0}
                    icon="download"
                    job={exportJob}
                    kind="csv"
                    label="EXPORTAR CSV"
                    onClick={onExportCsv}
                    title="Exporta lo que se está viendo, con el filtro y la búsqueda activos"
                  />
                )}

                <ExportButton
                  disabled={attendanceCount === 0}
                  icon="print"
                  job={exportJob}
                  kind="sheet"
                  label="EXPORTAR LISTA"
                  onClick={onExportAttendance}
                  title={
                    isAttendanceMode
                      ? `Lista de asistencia de ${selectedWorkshop?.name}${groupFilter === "all" ? "" : ` (grupo ${groupFilter})`} para imprimir`
                      : "Listas de asistencia por grupo, con el taller de cada alumno, una por hoja"
                  }
                />
              </div>

              {exportError === null ? (
                <span className="font-code-badge text-code-badge text-on-surface-variant uppercase text-right">
                  {isAttendanceMode
                    ? `${attendanceCount} ${plural(attendanceCount, "INSCRITO", "INSCRITOS")} // PDF PARA IMPRIMIR`
                    : `${attendanceSectionCount} ${plural(attendanceSectionCount, "GRUPO", "GRUPOS")} CON INSCRITOS // UNA LISTA POR HOJA`}
                </span>
              ) : (
                <span className="font-code-badge text-code-badge text-secondary uppercase text-right">
                  ⚠ {exportError}
                </span>
              )}
            </div>
          </section>
        </div>
      </div>

      <AnimatePresence>
        {moveRow === null ? null : (
          <MoveModal
            key="move"
            onClose={() => setMoveRow(null)}
            onConfirm={(workshopId) => onMove(moveRow, workshopId)}
            row={moveRow}
            workshops={workshops ?? []}
          />
        )}

        {detail === null ? null : (
          <DetailModal
            key="detail"
            onClose={() => setDetail(null)}
            onDelete={openDelete}
            onMove={openMove}
            rows={detail}
          />
        )}

        {deleteRow === null ? null : (
          <DeleteModal
            key="delete"
            onClose={() => setDeleteRow(null)}
            onConfirm={() => onDelete(deleteRow)}
            row={deleteRow}
          />
        )}
      </AnimatePresence>
    </main>
  );
}

const pad2 = (value: number) => String(value).padStart(2, "0");

const plural = (count: number, one: string, many: string) =>
  count === 1 ? one : many;

/** Dispara la descarga de un blob generado en el cliente. */
function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
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

function ExportButton({
  disabled,
  icon,
  job,
  kind,
  label,
  onClick,
  title,
}: {
  disabled: boolean;
  icon: string;
  job: { kind: "csv" | "sheet"; state: "working" | "done" } | null;
  kind: "csv" | "sheet";
  label: string;
  onClick: () => void;
  title: string;
}) {
  const mine = job?.kind === kind ? job.state : null;
  return (
    <button
      className={`font-label-caps text-label-caps px-space-lg py-space-sm border-4 border-black shadow-[4px_4px_0px_#000000] hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[6px_6px_0px_#8cc63f] active:translate-x-[4px] active:translate-y-[4px] active:shadow-none transition-all flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed ${
        mine === null ? "bg-primary text-on-primary" : "bg-secondary text-on-secondary"
      }`}
      disabled={disabled || job !== null}
      onClick={onClick}
      title={title}
      type="button"
    >
      {mine === "working" ? (
        <>
          <span>GENERANDO STREAM...</span>
          <span className="material-symbols-outlined text-[18px] animate-spin">
            sync
          </span>
        </>
      ) : mine === "done" ? (
        <>
          <span>DESCARGA LISTA [OK]</span>
          <span className="material-symbols-outlined text-[18px]">check</span>
        </>
      ) : (
        <>
          <span>{label}</span>
          <span className="material-symbols-outlined text-[18px]">{icon}</span>
        </>
      )}
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
  format,
  label,
  value,
}: {
  code: string;
  footer: React.ReactNode;
  format?: (value: number) => string;
  label: string;
  value: number;
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
          <CountUp format={format} value={value} />
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
        <span className="font-display-hero text-headline-lg-mobile lg:text-headline-lg text-on-surface leading-tight block">
          {top?.keyword ?? "—"}
        </span>
        <span className="font-label-caps text-headline-sm text-secondary font-bold mt-1 block">
          <CountUp value={top?.enrolled ?? 0} /> ALUMNOS
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
  onMove,
  rows,
}: {
  onClose: () => void;
  onDelete: (row: Row) => void;
  onMove: (row: Row) => void;
  rows: Row[];
}) {
  const student = rows[0];

  return (
    <Modal labelledBy="detail-title" onClose={onClose}>
      <ModalHeader
        id="detail-title"
        onClose={onClose}
        title={`RECORD://${student.accountNumber}`}
      />

      <div className="overflow-y-auto scrollbar-brutal">
        <dl className="p-space-lg grid grid-cols-1 sm:grid-cols-2 gap-space-md">
          <ModalField label="NÚMERO DE CUENTA" value={student.accountNumber} />
          <ModalField label="GRUPO" value={`G-${student.group}`} />
          <ModalField label="NOMBRE" value={student.fullName.toUpperCase()} />
          <ModalField label="CORREO" value={student.email} />
          <ModalField
            label="AVISO ACEPTADO"
            value={
              student.acceptedPrivacyAt === undefined
                ? "SIN CONSTANCIA"
                : formatTimestamp(student.acceptedPrivacyAt)
            }
          />
          <ModalField
            label="USO DE IMAGEN (3.2)"
            value={
              student.allowsSecondaryUse === true
                ? "AUTORIZADO"
                : "NO AUTORIZADO"
            }
          />
        </dl>

        {/* Cada inscripción se opera por separado: son filas distintas. */}
        <div className="px-space-lg pb-space-lg flex flex-col gap-space-sm">
          <span className="font-label-caps text-label-caps text-primary uppercase tracking-wider">
            {rows.length === 1
              ? "TALLER INSCRITO"
              : `${rows.length} TALLERES INSCRITOS`}
          </span>

          {rows.map((row) => (
            <div
              className="border-2 border-surface-container-high bg-surface-container p-space-md flex flex-col sm:flex-row sm:items-center justify-between gap-space-sm"
              key={row._id}
            >
              <div className="flex flex-col gap-space-2xs min-w-0">
                <span
                  className={`self-start inline-block bg-surface-container-highest border-2 px-2.5 py-1 font-code-badge text-code-badge font-bold uppercase ${ACCENT_CLASSES[row.workshop.accent]}`}
                >
                  {row.workshop.keyword}
                </span>
                <span className="font-code-badge text-code-badge text-on-surface-variant uppercase">
                  REGISTRADO: {formatTimestamp(row._creationTime)}
                </span>
                {row.reassignedAt === undefined ? null : (
                  <span className="font-code-badge text-code-badge text-secondary uppercase">
                    REASIGNADO: {formatTimestamp(row.reassignedAt)}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  className="px-3 py-2 bg-surface-container-high hover:bg-tertiary hover:text-on-tertiary text-tertiary font-label-caps text-code-badge border-2 border-tertiary shadow-[2px_2px_0px_#000]"
                  onClick={() => onMove(row)}
                  type="button"
                >
                  [MOVER]
                </button>
                <button
                  className="px-3 py-2 bg-secondary-container/30 hover:bg-secondary-container hover:text-on-secondary-container text-secondary font-label-caps text-code-badge border-2 border-secondary shadow-[2px_2px_0px_#000]"
                  onClick={() => onDelete(row)}
                  type="button"
                >
                  [BORRAR]
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </Modal>
  );
}

/** Confirmación de borrado. Sustituye al `window.confirm` del navegador. */
function DeleteModal({
  onClose,
  onConfirm,
  row,
}: {
  onClose: () => void;
  onConfirm: () => Promise<void>;
  row: Row;
}) {
  const [isDeleting, setIsDeleting] = useState(false);

  return (
    <Modal accent="secondary" labelledBy="delete-title" onClose={onClose}>
      <ModalHeader
        accent="secondary"
        id="delete-title"
        onClose={onClose}
        title={`DELETE://${row.accountNumber}`}
      />

      <div className="p-space-lg flex flex-col gap-space-md">
        <div className="flex items-start gap-3">
          <span className="material-symbols-outlined text-secondary text-[28px]">
            warning
          </span>
          <div className="flex flex-col">
            <span className="font-label-caps text-label-caps text-secondary tracking-wider uppercase">
              ⚠ ESTA ACCIÓN NO SE PUEDE DESHACER
            </span>
            <p className="font-body-sm text-body-sm text-on-surface mt-0.5">
              Se borrará el registro de{" "}
              <strong>{row.fullName.toUpperCase()}</strong> (
              {row.accountNumber}) y su lugar volverá al taller{" "}
              {row.workshop.keyword}.
            </p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row justify-end gap-2">
          <button
            className="px-space-lg py-3 bg-surface-container-high text-on-surface font-label-caps text-label-caps border-2 border-outline hover:border-primary shadow-[2px_2px_0px_#000]"
            disabled={isDeleting}
            onClick={onClose}
            type="button"
          >
            [CANCELAR]
          </button>
          <button
            className="px-space-lg py-3 bg-secondary-container text-on-secondary-container font-label-caps text-label-caps border-[3px] border-black shadow-[4px_4px_0px_#000000] hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-[2px_2px_0px_#000000] active:translate-x-1 active:translate-y-1 active:shadow-none transition-all flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
            disabled={isDeleting}
            onClick={async () => {
              setIsDeleting(true);
              await onConfirm();
            }}
            type="button"
          >
            {isDeleting ? (
              <>
                <span className="material-symbols-outlined animate-spin text-[18px]">
                  sync
                </span>
                <span>BORRANDO...</span>
              </>
            ) : (
              <>
                <span>SÍ, BORRAR REGISTRO</span>
                <span className="material-symbols-outlined text-[18px]">
                  delete
                </span>
              </>
            )}
          </button>
        </div>
      </div>
    </Modal>
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

type Workshop = NonNullable<
  ReturnType<typeof useQuery<typeof api.workshops.list>>
>[number];

/** Selector de taller destino para el botón [MOVER]. Sin mock: mismo lenguaje. */
function MoveModal({
  onClose,
  onConfirm,
  row,
  workshops,
}: {
  onClose: () => void;
  onConfirm: (workshopId: Id<"workshops">) => Promise<void>;
  row: Row;
  workshops: Workshop[];
}) {
  const [target, setTarget] = useState("");
  const [isMoving, setIsMoving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // No tiene sentido ofrecer el taller en el que ya está.
  const options = workshops
    .filter((workshop) => workshop.keyword !== row.workshop.keyword)
    .map((workshop) => ({
      disabled: workshop.isFull,
      label: workshop.isFull
        ? `${workshop.name} (CUPO LLENO)`
        : `${workshop.name} (${workshop.remaining} cupos disp.)`,
      value: workshop._id,
    }));

  const submit = async () => {
    if (target === "") return;
    setIsMoving(true);
    setError(null);
    try {
      await onConfirm(target as Id<"workshops">);
    } catch (caught) {
      const data = caught instanceof ConvexError ? caught.data : null;
      setError(data?.message ?? "No se pudo reasignar el registro.");
      setIsMoving(false);
    }
  };

  return (
    <Modal accent="tertiary" labelledBy="move-title" onClose={onClose}>
      <ModalHeader
        accent="tertiary"
        id="move-title"
        onClose={onClose}
        title={`REASSIGN://${row.accountNumber}`}
      />

      <div className="p-space-lg flex flex-col gap-space-md">
        <div className="flex flex-col gap-space-2xs">
          <span className="font-code-badge text-code-badge text-on-surface-variant uppercase">
            ALUMNO
          </span>
          <span className="font-body-md text-body-md text-on-surface font-bold uppercase">
            {row.fullName} ({row.accountNumber})
          </span>
          <span className="font-code-badge text-code-badge text-on-surface-variant mt-space-2xs">
            TALLER ACTUAL: {row.workshop.keyword}
          </span>
        </div>

        <div className="flex flex-col gap-space-2xs">
          <label
            className="font-label-caps text-label-caps text-on-surface uppercase tracking-wider"
            htmlFor="move-target"
            id="move-target-label"
          >
            TALLER DESTINO
          </label>
          <BrutalistSelect
            accent="tertiary"
            disabled={isMoving}
            id="move-target"
            labelledBy="move-target-label"
            onChange={setTarget}
            options={options}
            placeholder="> SELECCIONAR TALLER DESTINO..."
            value={target}
          />
        </div>

        {error === null ? null : (
          <div className="flex items-start gap-2 border-2 border-secondary bg-surface-container-high p-space-sm">
            <span className="material-symbols-outlined text-secondary text-[18px]">
              warning
            </span>
            <span className="font-body-sm text-body-sm text-on-surface">
              {error}
            </span>
          </div>
        )}

        <button
          className="w-full bg-tertiary text-on-tertiary font-label-caps text-label-caps py-3 border-[3px] border-black shadow-[4px_4px_0px_#000000] hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-[2px_2px_0px_#000000] active:translate-x-1 active:translate-y-1 active:shadow-none transition-all flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
          disabled={target === "" || isMoving}
          onClick={submit}
          type="button"
        >
          {isMoving ? (
            <>
              <span className="material-symbols-outlined animate-spin text-[18px]">
                sync
              </span>
              <span>REASIGNANDO...</span>
            </>
          ) : (
            <>
              <span>CONFIRMAR REASIGNACIÓN</span>
              <span className="material-symbols-outlined text-[18px]">
                swap_horiz
              </span>
            </>
          )}
        </button>
      </div>
    </Modal>
  );
}

const CSV_HEADERS = [
  "NUMERO DE CUENTA",
  "NOMBRE",
  "CORREO",
  "TALLER",
  "GRUPO",
  "REGISTRADO",
  "REASIGNADO",
  "AVISO ACEPTADO",
  "USO DE IMAGEN 3.2",
];

/** Entrecomilla siempre: los nombres pueden traer comas y el CSV se rompería. */
function csvCell(value: string) {
  return `"${value.replace(/"/g, '""')}"`;
}

function toCsv(rows: Row[]) {
  const lines = [CSV_HEADERS.map(csvCell).join(",")];
  for (const row of rows) {
    lines.push(
      [
        row.accountNumber,
        row.fullName,
        row.email,
        row.workshop.keyword,
        `G-${row.group}`,
        formatTimestamp(row._creationTime),
        row.reassignedAt === undefined
          ? ""
          : formatTimestamp(row.reassignedAt),
        row.acceptedPrivacyAt === undefined
          ? "SIN CONSTANCIA"
          : formatTimestamp(row.acceptedPrivacyAt),
        row.allowsSecondaryUse === true ? "AUTORIZADO" : "NO AUTORIZADO",
      ]
        .map(csvCell)
        .join(","),
    );
  }
  return lines.join("\r\n");
}

/**
 * Cuenta hasta el valor en ~500ms: de 0 la primera vez, y desde el número
 * anterior en las actualizaciones reactivas, para que un 18 -> 17 no vuelva a
 * contar desde cero. Con `prefers-reduced-motion` muestra el valor directo.
 */
function CountUp({
  format = (value: number) => String(value),
  value,
}: {
  format?: (value: number) => string;
  value: number;
}) {
  const reduced = useReducedMotion();
  const [display, setDisplay] = useState(0);
  // El origen de la animación es siempre lo que se está mostrando, no el
  // último `value` recibido: si se anclara a `value`, el doble montaje de
  // efectos en desarrollo dejaría la segunda pasada animando de N a N, sin
  // emitir ningún onUpdate, y el contador se quedaría clavado en 0.
  const shown = useRef(0);

  useEffect(() => {
    // Nada de setState síncrono aquí: con reduced se pinta `value` directo más
    // abajo, y si no, el valor llega por el onUpdate asíncrono de la animación.
    if (reduced) return;
    const controls = animate(shown.current, value, {
      duration: 0.5,
      ease: "easeOut",
      onUpdate: (latest) => {
        shown.current = latest;
        setDisplay(Math.round(latest));
      },
    });
    return () => controls.stop();
  }, [reduced, value]);

  return <>{format(reduced ? value : display)}</>;
}
