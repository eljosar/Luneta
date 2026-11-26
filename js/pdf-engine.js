// Motor puro de generación de archivos PDF 1.4 (sin dependencias externas, funciona 100% offline).
// Soporta acentos del español (codificación WinAnsi), encabezados La Luneta, paginación automática
// y marca de agua dinámica al pie de cada página.

const WINANSI_MAP = {
  0x20AC: 0x80, 0x201A: 0x82, 0x201E: 0x84, 0x2026: 0x85, 0x2020: 0x86,
  0x2021: 0x87, 0x2030: 0x89, 0x2039: 0x8B, 0x2018: 0x91, 0x2019: 0x92,
  0x201C: 0x93, 0x201D: 0x94, 0x2022: 0x95, 0x2013: 0x96, 0x2014: 0x97,
  0x2122: 0x99, 0x203A: 0x9B
};

function encodePdfText(str) {
  let out = "";
  const clean = String(str ?? "").replace(/\r/g, "");
  for (let i = 0; i < clean.length; i++) {
    const code = clean.charCodeAt(i);
    if (code === 0x5C) { out += "\\\\"; }
    else if (code === 0x28) { out += "\\("; }
    else if (code === 0x29) { out += "\\)"; }
    else if (code >= 32 && code <= 126) { out += clean[i]; }
    else if (code >= 0xA0 && code <= 0xFF) {
      out += "\\" + code.toString(8).padStart(3, "0");
    } else if (WINANSI_MAP[code]) {
      out += "\\" + WINANSI_MAP[code].toString(8).padStart(3, "0");
    } else if (code === 0x09) {
      out += "  ";
    } else {
      out += " ";
    }
  }
  return out;
}

function wrapText(text, maxChars) {
  const paragraphs = String(text ?? "").split("\n");
  const lines = [];
  for (const para of paragraphs) {
    const trimmed = para.trim();
    if (!trimmed) {
      lines.push("");
      continue;
    }
    const words = trimmed.split(/\s+/);
    let current = "";
    for (const word of words) {
      if (!current) {
        current = word;
      } else if ((current.length + 1 + word.length) <= maxChars) {
        current += " " + word;
      } else {
        lines.push(current);
        current = word;
      }
    }
    if (current) lines.push(current);
  }
  return lines;
}

class SimplePdfDoc {
  constructor(watermarkText) {
    this.watermarkText = watermarkText;
    this.pages = [];
    this.pageW = 612; // Letter width pt
    this.pageH = 792; // Letter height pt
    this.marginX = 56;
    this.cursorY = 720;
    this.ops = [];
    this.startPage(true);
  }

  startPage(isFirst = false) {
    if (this.ops.length > 0) {
      this.finishCurrentPage();
    }
    this.ops = [];
    // Soft ivory paper top band
    if (isFirst) {
      this.ops.push("0.161 0.298 0.471 rg"); // #294C78 Azul tinta
      this.ops.push(`0 ${this.pageH - 74} ${this.pageW} 74 re f`);
      this.ops.push("0.502 0.173 0.271 rg"); // #802C45 Guinda accent bar
      this.ops.push(`0 ${this.pageH - 78} ${this.pageW} 4 re f`);
      this.ops.push("1 1 1 rg");
      this.ops.push(`BT /F2 17 Tf ${this.marginX} ${this.pageH - 42} Td (${encodePdfText("LA LUNETA")}) Tj ET`);
      this.ops.push(`BT /F1 9 Tf ${this.marginX} ${this.pageH - 58} Td (${encodePdfText("Teatro para y con infancias y juventudes · Biblioteca digital y microlicencias")}) Tj ET`);
      this.cursorY = this.pageH - 110;
    } else {
      this.ops.push("0.161 0.298 0.471 rg");
      this.ops.push(`${this.marginX} ${this.pageH - 44} ${this.pageW - this.marginX * 2} 1.2 re f`);
      this.ops.push("0.161 0.298 0.471 rg");
      this.ops.push(`BT /F2 8.5 Tf ${this.marginX} ${this.pageH - 36} Td (${encodePdfText("LA LUNETA · EDICIÓN AUTORIZADA")}) Tj ET`);
      this.cursorY = this.pageH - 72;
    }
  }

  finishCurrentPage() {
    const pageNum = this.pages.length + 1;
    // Diagonal subtle watermark in center of page
    this.ops.push("q 0.90 0.89 0.86 rg");
    this.ops.push(`BT /F2 18 Tf 0.866 0.5 -0.5 0.866 115 310 Tm (${encodePdfText("LA LUNETA · EJEMPLAR TRAZABLE")}) Tj ET Q`);
    // Dynamic footer watermark on every single page
    this.ops.push("0.85 0.83 0.79 RG 0.6 w");
    this.ops.push(`${this.marginX} 46 m ${this.pageW - this.marginX} 46 l S`);
    this.ops.push("0.38 0.37 0.35 rg");
    this.ops.push(`BT /F1 7.8 Tf ${this.marginX} 32 Td (${encodePdfText(this.watermarkText)}) Tj ET`);
    this.ops.push(`BT /F2 8 Tf ${this.pageW - this.marginX - 42} 32 Td (${encodePdfText("Pág. " + pageNum)}) Tj ET`);
    this.pages.push(this.ops.join("\n"));
  }

  ensureSpace(neededPt) {
    if (this.cursorY - neededPt < 66) {
      this.startPage(false);
    }
  }

  addTitle(text) {
    const lines = wrapText(text, 44);
    this.ensureSpace(lines.length * 24 + 12);
    this.ops.push("0.141 0.137 0.125 rg"); // #242320
    for (const l of lines) {
      this.ops.push(`BT /F2 19 Tf ${this.marginX} ${this.cursorY} Td (${encodePdfText(l)}) Tj ET`);
      this.cursorY -= 24;
    }
    this.cursorY -= 4;
  }

  addSubtitle(text) {
    const lines = wrapText(text, 74);
    this.ensureSpace(lines.length * 15 + 8);
    this.ops.push("0.161 0.298 0.471 rg");
    for (const l of lines) {
      this.ops.push(`BT /F2 11 Tf ${this.marginX} ${this.cursorY} Td (${encodePdfText(l)}) Tj ET`);
      this.cursorY -= 15;
    }
    this.cursorY -= 6;
  }

  addHeading(text) {
    this.ensureSpace(34);
    this.cursorY -= 8;
    this.ops.push("0.502 0.173 0.271 rg");
    this.ops.push(`BT /F2 11.5 Tf ${this.marginX} ${this.cursorY} Td (${encodePdfText(text.toUpperCase())}) Tj ET`);
    this.cursorY -= 6;
    this.ops.push("0.88 0.85 0.80 rg");
    this.ops.push(`${this.marginX} ${this.cursorY} ${this.pageW - this.marginX * 2} 0.8 re f`);
    this.cursorY -= 14;
  }

  addParagraph(text, options = {}) {
    const font = options.bold ? "/F2" : options.italic ? "/F3" : "/F1";
    const size = options.size || 10.2;
    const indent = options.indent || 0;
    const maxChars = options.maxChars || Math.floor((this.pageW - this.marginX * 2 - indent) / (size * 0.52));
    const color = options.color || "0.141 0.137 0.125";
    const lines = wrapText(text, maxChars);
    const leading = size + 4.4;
    for (const l of lines) {
      this.ensureSpace(leading + 4);
      if (l) {
        this.ops.push(`${color} rg`);
        this.ops.push(`BT ${font} ${size} Tf ${this.marginX + indent} ${this.cursorY} Td (${encodePdfText(l)}) Tj ET`);
      }
      this.cursorY -= leading;
    }
    this.cursorY -= (options.after ?? 5);
  }

  addBox(title, bodyLines, tint = "0.968 0.957 0.925") {
    const wrapped = [];
    for (const b of bodyLines) {
      wrapped.push(...wrapText(b, 78));
    }
    const h = 28 + wrapped.length * 13.5 + 10;
    this.ensureSpace(h + 12);
    const topY = this.cursorY + 6;
    this.ops.push(`${tint} rg`);
    this.ops.push(`${this.marginX} ${topY - h} ${this.pageW - this.marginX * 2} ${h} re f`);
    this.ops.push("0.161 0.298 0.471 rg");
    this.ops.push(`${this.marginX} ${topY - h} 3.5 ${h} re f`);
    this.ops.push(`BT /F2 10 Tf ${this.marginX + 12} ${topY - 18} Td (${encodePdfText(title)}) Tj ET`);
    let y = topY - 34;
    this.ops.push("0.141 0.137 0.125 rg");
    for (const l of wrapped) {
      if (l) {
        this.ops.push(`BT /F1 9.4 Tf ${this.marginX + 12} ${y} Td (${encodePdfText(l)}) Tj ET`);
      }
      y -= 13.5;
    }
    this.cursorY = topY - h - 14;
  }

  addKeyValueRows(rows) {
    for (const [label, value] of rows) {
      this.ensureSpace(18);
      this.ops.push("0.35 0.34 0.32 rg");
      this.ops.push(`BT /F2 9.5 Tf ${this.marginX} ${this.cursorY} Td (${encodePdfText(label + ":")}) Tj ET`);
      this.ops.push("0.141 0.137 0.125 rg");
      const valLines = wrapText(value, 58);
      let first = true;
      for (const vl of valLines) {
        if (!first) this.ensureSpace(14);
        this.ops.push(`BT /F1 9.5 Tf ${this.marginX + 145} ${this.cursorY} Td (${encodePdfText(vl)}) Tj ET`);
        this.cursorY -= 14;
        first = false;
      }
      this.cursorY -= 2;
    }
    this.cursorY -= 6;
  }

  buildBytes() {
    this.finishCurrentPage();
    const objects = [];
    const addObj = (body) => {
      objects.push(body);
      return objects.length;
    };

    const catalogId = addObj(""); // placeholder 1
    const pagesId = addObj("");   // placeholder 2
    const f1Id = addObj("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>");
    const f2Id = addObj("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>");
    const f3Id = addObj("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Oblique /Encoding /WinAnsiEncoding >>");

    const pageIds = [];
    for (const content of this.pages) {
      const byteLen = new TextEncoder().encode(content).length;
      const streamId = addObj(`<< /Length ${byteLen} >>\nstream\n${content}\nendstream`);
      const pId = addObj(
        `<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 ${this.pageW} ${this.pageH}] ` +
        `/Resources << /Font << /F1 ${f1Id} 0 R /F2 ${f2Id} 0 R /F3 ${f3Id} 0 R >> >> /Contents ${streamId} 0 R >>`
      );
      pageIds.push(pId);
    }

    objects[catalogId - 1] = `<< /Type /Catalog /Pages ${pagesId} 0 R >>`;
    objects[pagesId - 1] = `<< /Type /Pages /Kids [${pageIds.map(id => `${id} 0 R`).join(" ")}] /Count ${pageIds.length} >>`;

    const encoder = new TextEncoder();
    const chunks = [];
    let offset = 0;
    const pushStr = (s) => {
      const b = encoder.encode(s);
      chunks.push(b);
      offset += b.length;
    };

    pushStr("%PDF-1.4\n%\xE2\xE3\xCF\xD3\n");
    const offsets = [0];
    for (let i = 0; i < objects.length; i++) {
      offsets.push(offset);
      pushStr(`${i + 1} 0 obj\n${objects[i]}\nendobj\n`);
    }
    const xrefPos = offset;
    pushStr(`xref\n0 ${objects.length + 1}\n`);
    pushStr("0000000000 65535 f \n");
    for (let i = 1; i <= objects.length; i++) {
      pushStr(String(offsets[i]).padStart(10, "0") + " 00000 n \n");
    }
    pushStr(`trailer\n<< /Size ${objects.length + 1} /Root ${catalogId} 0 R >>\nstartxref\n${xrefPos}\n%%EOF`);

    const totalLen = chunks.reduce((acc, c) => acc + c.length, 0);
    const result = new Uint8Array(totalLen);
    let pos = 0;
    for (const c of chunks) {
      result.set(c, pos);
      pos += c.length;
    }
    return result;
  }
}

function triggerPdfDownload(bytes, filename) {
  const blob = new Blob([bytes], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    URL.revokeObjectURL(url);
    a.remove();
  }, 1500);
}

// 1. Descarga real de Edición Estudiante ($25) o Edición Docente ($100) con marca de agua dinámica
export function downloadEditionPdf({ play, script, editionType, buyerName, schoolName, licenseCode }) {
  const isDocente = editionType === "docente";
  const label = isDocente ? "Edición Docente ($100 MXN)" : "Edición Estudiante ($25 MXN)";
  const owner = schoolName ? `${buyerName} · ${schoolName}` : buyerName;
  const watermark = `Licencia #${licenseCode} | ${label} | Autorizada para: ${owner} | Uso educativo sin internet`;

  const doc = new SimplePdfDoc(watermark);
  doc.addSubtitle(label.toUpperCase() + " · " + play.id);
  doc.addTitle(play.titulo);
  doc.addParagraph(`Autoría: ${play.autor} (${play.vida})`, { bold: true, size: 10.5, after: 8 });

  doc.addBox("DATOS DE MONTAJE Y EJEMPLAR AUTORIZADO", [
    `Titular de descarga: ${owner} · Folio: #${licenseCode}`,
    `Reparto: ${play.elencoMin} a ${play.elencoMax} intérpretes (${play.elencoFlexible ? "reparto flexible" : "reparto fijo"}) · Duración estimada: ${play.duracionMin} min`,
    `Para público de: ${play.paraEdad} | Ideal para montar con: ${play.conEdad}`,
    `Espacio sugerido: ${play.complejidadEscenica}`
  ]);

  if (play.bloqueoMusicaRevueltas) {
    doc.addBox("AVISO LEGAL IMPORTANTE (DERECHOS DE AUTOR)", [
      "Esta edición contiene exclusivamente el texto literario de Rafael Pombo (1833–1912), en Dominio Público. NO incluye ni autoriza el uso de la partitura musical de Silvestre Revueltas (†1940). Se recomienda usar percusión corporal o música libre."
    ], "0.98 0.92 0.93");
  }

  if (script && script.personajesMeta) {
    doc.addHeading("Reparto y notas de personajes");
    for (const p of script.personajesMeta) {
      doc.addParagraph(`${p.nombre} (${p.genero}): ${p.descripcion}`, { size: 9.6, after: 4 });
    }
  }

  doc.addHeading("Texto dramático para lectura y ensayo");
  if (script && script.bloques && script.bloques.length) {
    doc.addParagraph(script.edicionNota, { italic: true, size: 9, color: "0.35 0.34 0.32", after: 10 });
    for (const b of script.bloques) {
      if (b.tipo === "acto") {
        doc.addSubtitle(b.texto);
      } else if (b.tipo === "escena") {
        doc.addParagraph(b.texto, { bold: true, size: 10.2, color: "0.502 0.173 0.271", after: 6 });
      } else if (b.tipo === "acotacion") {
        doc.addParagraph(`(${b.texto})`, { italic: true, size: 9.4, color: "0.35 0.34 0.32", indent: 12, after: 7 });
      } else {
        if (b.personaje) {
          doc.addParagraph(b.personaje, { bold: true, size: 9.6, color: "0.161 0.298 0.471", after: 1 });
        }
        doc.addParagraph(b.texto, { size: 10, indent: 14, after: 6 });
      }
    }
  } else {
    doc.addParagraph("Texto fuente verificado en Dominio Público (en proceso de transcripción editorial completa). Puedes consultar el ejemplar fuente en: " + (play.urlRepositorio || play.repositorioAlterno), { italic: true, after: 8 });
    doc.addParagraph("Sinopsis completa: " + play.sinopsis, { after: 8 });
  }

  if (!isDocente) {
    doc.addHeading("Cuaderno de notas del estudiante / intérprete");
    doc.addParagraph("Espacio reservado para marcar tus entradas, pausas, trazos escénicos y preguntas sobre tu personaje:", { italic: true, size: 9.4, after: 12 });
    for (let i = 0; i < 6; i++) {
      doc.addParagraph("__________________________________________________________________________", { color: "0.75 0.73 0.70", after: 12 });
    }
  } else if (play.guiaAntididactica) {
    const g = play.guiaAntididactica;
    doc.startPage(false);
    doc.addSubtitle("GUÍA ANTIDIDÁCTICA PARA AULA · APROBADA POR EDITOR");
    doc.addTitle("Mediación sin moralejas: " + play.titulo);
    doc.addParagraph(`Enfoque: Carta del Espectador Niño · Aprobación editorial: ${g.editor}`, { italic: true, size: 9.2, color: "0.35 0.34 0.32", after: 10 });

    doc.addHeading("1. Contexto histórico y teatral");
    doc.addParagraph(g.contexto);

    doc.addHeading("2. Dos preguntas disparadoras antes de leer (sin revelar la trama)");
    g.preguntasAntes.forEach((q, idx) => doc.addParagraph(`${idx + 1}. ${q}`, { indent: 8 }));

    doc.addHeading("3. Preguntas de diálogo abierto (cero moralejas)");
    g.preguntasDialogo.forEach((q, idx) => doc.addParagraph(`${idx + 1}. ${q}`, { indent: 8 }));

    doc.addHeading("4. Vínculo Nueva Escuela Mexicana (NEM) y actividad de 15 minutos");
    doc.addKeyValueRows([
      ["Campo Formativo", play.nemCampo],
      ["Ejes Articuladores", (play.nemEjes || []).join(" · ")],
      ["Actividad sugerida", play.actividadAula]
    ]);
  }

  doc.addBox("PIE LEGAL OBLIGATORIO (LFDA ARTS. 21 Y 153)", [
    play.notaMoralLfda || "Obra en Dominio Público conforme a la Ley Federal del Derecho de Autor (México). Edición digital y guía pedagógica de La Luneta.",
    "Nota: La adquisición de esta edición autoriza su uso e impresión local para estudio y ensayo del titular indicado al pie de página."
  ]);

  const slug = play.id.toLowerCase() + "-" + editionType;
  triggerPdfDownload(doc.buildBytes(), `LaLuneta-${slug}-${licenseCode}.pdf`);
}

// 2. Descarga real de Cotización PDF Formal (Fase Beta / Escuelas y PrepaTec)
export function downloadQuotePdf(quote) {
  const watermark = `Cotización #${quote.folio} · Vigencia 30 días · La Luneta (Fase Beta) · NO libera derechos hasta liquidar`;
  const doc = new SimplePdfDoc(watermark);
  doc.addSubtitle("COTIZACIÓN FORMAL ORIENTATIVA · FASE BETA");
  doc.addTitle(quote.playTitle);
  doc.addParagraph(`Folio: ${quote.folio} · Fecha de emisión: ${quote.fecha} · Vigencia: 30 días naturales`, { bold: true, size: 9.6, after: 10 });

  doc.addHeading("Datos del solicitante y producción");
  doc.addKeyValueRows([
    ["Institución / Grupo", quote.institucion || "Por definir en solicitud formal"],
    ["Tipo de organización", quote.tipoLabel],
    ["Precio de boleto", quote.boletoLabel],
    ["Público estimado", `${quote.aforo} asistentes por función`],
    ["Número de funciones", `${quote.funciones} función(es)`],
    ["Estado de Orden (PO)", quote.poNumber ? `PO #${quote.poNumber} registrada — PENDIENTE DE PAGO` : "Cotización previa para trámite interno"]
  ]);

  doc.addHeading("Desglose estimado en pesos mexicanos (MXN)");
  doc.addKeyValueRows([
    ["Derechos de representación", quote.derechosTexto],
    [`Edición Estudiante (${quote.qtyEstudiante} × $25)`, `$${(quote.qtyEstudiante * 25).toFixed(2)} MXN`],
    [`Edición Docente (${quote.qtyDocente} × $100)`, `$${(quote.qtyDocente * 100).toFixed(2)} MXN`],
    ["Subtotal estimado", `$${quote.subtotal.toFixed(2)} MXN`],
    ["IVA (16%)", `$${quote.iva.toFixed(2)} MXN`],
    ["TOTAL ESTIMADO", `$${quote.total.toFixed(2)} MXN`]
  ]);

  doc.addBox("CONDICIONES LEGALES DE LICENCIAMIENTO Y ORDEN DE COMPRA (PO)", [
    "1. Esta cotización sirve para gestionar autorización presupuestal en escuelas, colegios y campus (como PrepaTec).",
    "2. Regla estricta de Orden de Compra: subir una Orden de Compra (PO) inicia el trámite administrativo, pero NO libera derechos de representación ni autoriza estrenar o anunciar funciones hasta confirmarse el pago total (CoDi $0 comisión hasta $8,000 MXN, SPEI o tarjeta).",
    "3. Facturación mexicana CFDI 4.0 disponible al liquidar el pago. Documento generado en Fase Beta para pruebas."
  ], "0.98 0.93 0.94");

  triggerPdfDownload(doc.buildBytes(), `LaLuneta-Cotizacion-${quote.folio}.pdf`);
}

// 3. Descarga real de Comprobante Fiscal CFDI 4.0 de muestra (simulado)
export function downloadSimulatedCfdiPdf(order) {
  const watermark = `CFDI 4.0 DE MUESTRA (SIMULADO) · Folio ${order.folio} · Sin validez fiscal ante el SAT en Fase Beta`;
  const doc = new SimplePdfDoc(watermark);
  doc.addSubtitle("COMPROBANTE FISCAL DIGITAL CFDI 4.0 · MUESTRA SIMULADA");
  doc.addTitle("Recibo de pago y datos fiscales");
  doc.addBox("AVISO DE PRUEBA (FASE BETA)", [
    "Este comprobante simula el timbrado CFDI 4.0 para probar el flujo con escuelas y docentes. No tiene validez fiscal real hasta conectar el servicio de timbrado productivo."
  ], "0.98 0.94 0.89");

  doc.addHeading("Datos del receptor (CFDI 4.0)");
  doc.addKeyValueRows([
    ["Folio interno", order.folio],
    ["RFC receptor", order.cfdi.rfc || "XAXX010101000"],
    ["Razón social", order.cfdi.razonSocial || order.buyerName],
    ["Régimen fiscal", order.cfdi.regimen || "616 - Sin obligaciones fiscales"],
    ["Uso de CFDI", order.cfdi.uso || "G03 - Gastos en general"],
    ["Método de pago", order.paymentMethod === "codi" ? "Banxico CoDi ($0 comisión)" : "Tarjeta bancaria"]
  ]);

  doc.addHeading("Concepto adquirido");
  doc.addKeyValueRows([
    ["Obra", order.playTitle],
    ["Edición", order.editionType === "docente" ? "Edición Docente con Guía Antididáctica" : "Edición Estudiante"],
    ["Total pagado", `$${order.amount.toFixed(2)} MXN (IVA incluido)`],
    ["Folio fiscal simulado", "BETA-UUID-" + order.folio + "-MX2026"]
  ]);

  triggerPdfDownload(doc.buildBytes(), `LaLuneta-CFDI-Muestra-${order.folio}.pdf`);
}
