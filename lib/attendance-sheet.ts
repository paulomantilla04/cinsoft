import { PDFDocument, StandardFonts, rgb, type PDFPage } from "pdf-lib";

export type AttendanceRow = {
  accountNumber: string;
  fullName: string;
  group: string;
  /** Keyword corta del taller; sólo se imprime en las listas por grupo. */
  workshopKeyword: string;
};

/** Alto de carta en puntos: coincide con el MediaBox de la plantilla. */
const PAGE_HEIGHT = 792;

/** El membrete de la plantilla ocupa la franja superior; aquí empieza lo nuestro. */
const HEADER_BOTTOM = 150;
const MARGIN_X = 48;
const MARGIN_BOTTOM = 56;
const ROW_HEIGHT = 26;

/**
 * La cuarta columna cambia según cómo se agrupe la lista: en la de un taller
 * el dato que falta es el grupo escolar, y en la de un grupo, el taller. La
 * otra ya está en el título, así que repetirla sólo robaría ancho al nombre.
 */
const COLUMNS = {
  group: [
    { label: "#", width: 34 },
    { label: "NÚMERO DE CUENTA", width: 132 },
    { label: "NOMBRE", width: 232 },
    { label: "GRUPO", width: 62 },
    { label: "ASISTENCIA", width: 56 },
  ],
  workshop: [
    { label: "#", width: 34 },
    { label: "NÚMERO DE CUENTA", width: 120 },
    { label: "NOMBRE", width: 190 },
    { label: "TALLER", width: 116 },
    { label: "ASISTENCIA", width: 56 },
  ],
} as const;

/** Ambas disposiciones suman lo mismo, así que la tabla no cambia de ancho. */
const TABLE_WIDTH = COLUMNS.group.reduce(
  (sum, column) => sum + column.width,
  0,
);

const BLACK = rgb(0, 0, 0);
const GREY = rgb(0.45, 0.45, 0.45);
const HEADER_FILL = rgb(0.91, 0.91, 0.91);

export type AttendanceSection = {
  rows: AttendanceRow[];
  /** Qué dato lleva la cuarta columna; el otro va en el título. */
  secondary: keyof typeof COLUMNS;
  title: string;
};

/**
 * Listas de asistencia para imprimir, dibujadas sobre `public/plantilla.pdf`
 * para conservar el membrete institucional.
 *
 * Cada sección es un taller y **siempre empieza en hoja nueva**: se imprimen
 * para repartirlas por aula, así que dos talleres no pueden compartir papel.
 *
 * La última columna va vacía a propósito: es donde se palomea a mano.
 */
export async function buildAttendanceSheet({
  sections,
  template: templateBytes,
}: {
  sections: AttendanceSection[];
  /** Bytes de `plantilla.pdf`. Se reciben para poder generar la hoja fuera
   *  del navegador (scripts, pruebas) sin depender de `fetch`. */
  template: ArrayBuffer | Uint8Array;
}): Promise<Blob> {
  const template = await PDFDocument.load(templateBytes);

  const doc = await PDFDocument.create();
  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  // Cuántas filas caben bajo el título y la cabecera de la tabla.
  const firstRowTop = PAGE_HEIGHT - HEADER_BOTTOM - 58;
  const usableHeight = firstRowTop - MARGIN_BOTTOM;
  const rowsPerPage = Math.max(1, Math.floor(usableHeight / ROW_HEIGHT) - 1);

  const layout = sections.map((section) => ({
    ...section,
    pageCount: Math.max(1, Math.ceil(section.rows.length / rowsPerPage)),
  }));
  const totalPages = layout.reduce(
    (sum, section) => sum + section.pageCount,
    0,
  );

  // Una sola llamada a `copyPages` para todas las páginas: llamarla en bucle
  // duplicaría las imágenes del membrete en cada copia y el archivo se
  // multiplicaría de tamaño.
  const copied = await doc.copyPages(
    template,
    Array.from({ length: totalPages }, () => 0),
  );

  let cursor = 0;
  for (const section of layout) {
    for (let pageIndex = 0; pageIndex < section.pageCount; pageIndex += 1) {
      const page = doc.addPage(copied[cursor]);
      cursor += 1;

      const slice = section.rows.slice(
        pageIndex * rowsPerPage,
        (pageIndex + 1) * rowsPerPage,
      );

      drawHeading({
        bold,
        page,
        pageCount: section.pageCount,
        pageIndex,
        regular,
        total: section.rows.length,
        title: section.title,
      });

      drawTable({
        bold,
        firstIndex: pageIndex * rowsPerPage + 1,
        page,
        regular,
        rows: slice,
        secondary: section.secondary,
        top: firstRowTop,
      });
    }
  }

  const bytes = await doc.save();
  // `bytes` es un Uint8Array; el Blob necesita su buffer subyacente exacto.
  return new Blob([bytes.slice().buffer], { type: "application/pdf" });
}

function drawHeading({
  bold,
  page,
  pageCount,
  pageIndex,
  regular,
  title,
  total,
}: {
  bold: Awaited<ReturnType<PDFDocument["embedFont"]>>;
  page: PDFPage;
  pageCount: number;
  pageIndex: number;
  regular: Awaited<ReturnType<PDFDocument["embedFont"]>>;
  title: string;
  total: number;
}) {
  const top = PAGE_HEIGHT - HEADER_BOTTOM;

  page.drawText("LISTA DE ASISTENCIA", {
    font: regular,
    size: 9,
    x: MARGIN_X,
    y: top,
    color: GREY,
  });

  // El título se reduce si no cabe, antes que desbordar el ancho.
  let titleSize = 16;
  while (
    titleSize > 10 &&
    bold.widthOfTextAtSize(title, titleSize) > TABLE_WIDTH
  ) {
    titleSize -= 0.5;
  }
  page.drawText(title, {
    font: bold,
    size: titleSize,
    x: MARGIN_X,
    y: top - 20,
    color: BLACK,
  });

  const summary =
    pageCount > 1
      ? `${total} inscritos · página ${pageIndex + 1} de ${pageCount}`
      : `${total} inscritos`;
  page.drawText(summary, {
    font: regular,
    size: 9,
    x: MARGIN_X,
    y: top - 36,
    color: GREY,
  });
}

function drawTable({
  bold,
  firstIndex,
  page,
  regular,
  rows,
  secondary,
  top,
}: {
  bold: Awaited<ReturnType<PDFDocument["embedFont"]>>;
  firstIndex: number;
  page: PDFPage;
  regular: Awaited<ReturnType<PDFDocument["embedFont"]>>;
  rows: AttendanceRow[];
  secondary: keyof typeof COLUMNS;
  top: number;
}) {
  const columns = COLUMNS[secondary];
  // Cabecera
  page.drawRectangle({
    x: MARGIN_X,
    y: top - ROW_HEIGHT,
    width: TABLE_WIDTH,
    height: ROW_HEIGHT,
    color: HEADER_FILL,
    borderColor: BLACK,
    borderWidth: 0.8,
  });

  let x = MARGIN_X;
  for (const column of columns) {
    page.drawText(column.label, {
      font: bold,
      size: 7.5,
      x: x + 6,
      y: top - ROW_HEIGHT + 10,
      color: BLACK,
    });
    x += column.width;
  }

  rows.forEach((row, index) => {
    const rowTop = top - ROW_HEIGHT * (index + 2);

    page.drawRectangle({
      x: MARGIN_X,
      y: rowTop,
      width: TABLE_WIDTH,
      height: ROW_HEIGHT,
      borderColor: BLACK,
      borderWidth: 0.6,
    });

    const values = [
      String(firstIndex + index).padStart(2, "0"),
      row.accountNumber,
      row.fullName.toUpperCase(),
      secondary === "group" ? `G-${row.group}` : row.workshopKeyword,
      "",
    ];

    let cellX = MARGIN_X;
    columns.forEach((column, columnIndex) => {
      // Separadores entre columnas, salvo antes de la primera.
      if (columnIndex > 0) {
        page.drawLine({
          start: { x: cellX, y: rowTop },
          end: { x: cellX, y: rowTop + ROW_HEIGHT },
          thickness: 0.6,
          color: BLACK,
        });
      }

      const value = values[columnIndex];
      if (value !== "") {
        page.drawText(truncate(value, regular, 9, column.width - 12), {
          font: regular,
          size: 9,
          x: cellX + 6,
          y: rowTop + 9,
          color: BLACK,
        });
      }
      cellX += column.width;
    });
  });
}

/** Recorta con puntos suspensivos si el texto no cabe en la celda. */
function truncate(
  text: string,
  font: Awaited<ReturnType<PDFDocument["embedFont"]>>,
  size: number,
  maxWidth: number,
) {
  if (font.widthOfTextAtSize(text, size) <= maxWidth) return text;
  let cut = text;
  while (cut.length > 1 && font.widthOfTextAtSize(`${cut}…`, size) > maxWidth) {
    cut = cut.slice(0, -1);
  }
  return `${cut}…`;
}
