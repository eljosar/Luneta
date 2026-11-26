// Cotizador paso a paso de Microlicencias (inspirado en Concord Theatricals, 100% en español)
// Incluye nuestro distintivo Edición Estudiante ($25 MXN) y Edición Docente ($100 MXN),
// descarga real de Cotización PDF y flujo de Orden de Compra (PO) con bloqueo legal hasta liquidar.

import { downloadQuotePdf } from "./pdf-engine.js";

const ORG_RATES = {
  publica: { label: "Escuela pública / asamblea gratuita", tarifaFuncion: 200, comercial: false },
  privada: { label: "Colegio particular / PrepaTec / universidad", tarifaFuncion: 650, comercial: false },
  independiente: { label: "Grupo independiente / teatro aficionado", tarifaFuncion: 450, comercial: false },
  comercial: { label: "Temporada comercial con taquilla (10% + IVA)", tarifaFuncion: 800, comercial: true }
};

export function openLicenseEstimator(modal, modalContent, { play, onSaveQuote, onNotify }) {
  const state = {
    step: 0, // 0 intro, 1..5 steps, 6 summary + PO
    orgType: "privada",
    institucion: "",
    acreditada: "si",
    inclusiva: "no",
    cobraBoleto: "no",
    boletoMin: 0,
    boletoMax: 0,
    aforo: 180,
    funciones: 3,
    qtyEstudiante: Math.max(play.elencoMin || 6, 9),
    qtyDocente: 1,
    poMode: false,
    poNumber: "",
    poFileName: "",
    poSubmitted: false
  };

  function calcTotals() {
    const org = ORG_RATES[state.orgType];
    let derechos = 0;
    let derechosTexto = "";
    if (org.comercial) {
      const avgTicket = Math.max(Number(state.boletoMax) || 120, 80);
      const grossEst = avgTicket * (Number(state.aforo) || 100) * (Number(state.funciones) || 1);
      derechos = Math.max(Math.round(grossEst * 0.10), 800 * state.funciones);
      derechosTexto = `10% de taquilla estimada (mín. $800/función) → $${derechos.toFixed(2)} MXN`;
    } else {
      derechos = org.tarifaFuncion * Number(state.funciones || 1);
      derechosTexto = `${state.funciones} función(es) × $${org.tarifaFuncion} MXN → $${derechos.toFixed(2)} MXN`;
    }
    const estCost = state.qtyEstudiante * 25;
    const docCost = state.qtyDocente * 100;
    const subtotal = derechos + estCost + docCost;
    const iva = Math.round(subtotal * 0.16 * 100) / 100;
    const total = subtotal + iva;
    const folio = "COT-" + new Date().getFullYear() + "-" + String(Math.floor(1000 + Math.random() * 9000));
    return {
      folio,
      fecha: new Date().toLocaleDateString("es-MX", { day: "2-digit", month: "long", year: "numeric" }),
      playId: play.id,
      playTitle: play.titulo,
      institucion: state.institucion.trim() || "Escuela / Grupo solicitante",
      tipoLabel: org.label,
      boletoLabel: state.cobraBoleto === "si" ? `$${state.boletoMin} – $${state.boletoMax} MXN` : "Entrada gratuita ($0)",
      aforo: state.aforo,
      funciones: state.funciones,
      qtyEstudiante: state.qtyEstudiante,
      qtyDocente: state.qtyDocente,
      derechos,
      derechosTexto,
      subtotal,
      iva,
      total,
      poNumber: state.poNumber
    };
  }

  function railStep(idx, title, summaryVal) {
    const cls = state.step === idx ? "is-current" : state.step > idx ? "is-done" : "";
    return `
      <div class="wizard-step-item ${cls}">
        <span class="wizard-dot"></span>
        <div>
          <div style="font-size:0.72rem;opacity:0.8;text-transform:uppercase;letter-spacing:0.06em;">Paso ${idx}</div>
          <div style="font-weight:600;">${title}</div>
          ${state.step > idx && summaryVal ? `<div class="wizard-step-val">${escapeHtml(summaryVal)}</div>` : ""}
        </div>
      </div>
    `;
  }

  function draw() {
    const org = ORG_RATES[state.orgType];
    const totals = calcTotals();

    let bodyHtml = "";
    if (state.step === 0) {
      bodyHtml = `
        <div>
          <div class="wizard-step-kicker">Cotizador de microlicencias · Fase Beta</div>
          <h3>Calcula el costo de tu montaje</h3>
          <p style="color:var(--ink-muted);">Responde cinco preguntas breves para obtener una <strong>Cotización PDF formal en pesos mexicanos</strong> que puedas compartir con tu escuela, campus o departamento de compras.</p>
          <div class="legal-callout" style="margin:18px 0;">
            <strong>Obra seleccionada:</strong> ${escapeHtml(play.titulo)}<br/>
            <span style="font-size:0.86rem;color:var(--ink-muted);">Tarifas de referencia Fase Beta (escuela pública, PrepaTec/colegio privado, independiente o taquilla 10% + IVA).</span>
          </div>
        </div>
        <div class="wizard-nav" style="justify-content:flex-end;">
          <button type="button" class="btn-primary" id="wiz-next">Empezar cotización →</button>
        </div>
      `;
    } else if (state.step === 1) {
      bodyHtml = `
        <div>
          <div class="wizard-step-kicker">Paso 1 de 6</div>
          <h3>Tipo de escuela o grupo</h3>
          <p style="margin:0 0 14px;color:var(--ink-muted);font-size:0.92rem;">¿Quién va a montar esta obra?</p>
          <div style="display:flex;flex-direction:column;gap:8px;margin-bottom:16px;">
            ${Object.entries(ORG_RATES).map(([k, v]) => `
              <label style="display:flex;gap:10px;align-items:center;padding:10px 12px;border:1.5px solid ${state.orgType === k ? "var(--guinda)" : "var(--border)"};background:${state.orgType === k ? "var(--guinda-soft)" : "var(--surface)"};border-radius:8px;cursor:pointer;">
                <input type="radio" name="orgType" value="${k}" ${state.orgType === k ? "checked" : ""} style="accent-color:var(--guinda);" />
                <span><strong>${v.label}</strong></span>
              </label>
            `).join("")}
          </div>
          <div class="filter-group" style="margin-bottom:12px;">
            <label for="wiz-inst">Nombre de tu escuela, campus o compañía (opcional)</label>
            <input id="wiz-inst" class="form-input" placeholder="Ej. PrepaTec Campus Monterrey / Secundaria Técnica 42" value="${escapeHtml(state.institucion)}" />
          </div>
          <label class="check-row">
            <input type="checkbox" id="wiz-inc" ${state.inclusiva === "si" ? "checked" : ""} />
            <span>Nuestro elenco está integrado principalmente por intérpretes con discapacidad o adultos mayores (aplica tarifa preferencial)</span>
          </label>
        </div>
        <div class="wizard-nav">
          <button type="button" class="btn-secondary" id="wiz-prev">← Regresar</button>
          <button type="button" class="btn-primary" id="wiz-next">Continuar →</button>
        </div>
      `;
    } else if (state.step === 2) {
      bodyHtml = `
        <div>
          <div class="wizard-step-kicker">Paso 2 de 6</div>
          <h3>¿Cobrarán boleto de entrada?</h3>
          <p style="margin:0 0 14px;color:var(--ink-muted);font-size:0.92rem;">Saber si el acceso es gratuito o con boleto nos ayuda a calcular la regalía justa.</p>
          <div style="display:flex;gap:12px;margin-bottom:16px;">
            <label style="flex:1;padding:12px;border:1.5px solid ${state.cobraBoleto === "no" ? "var(--guinda)" : "var(--border)"};background:${state.cobraBoleto === "no" ? "var(--guinda-soft)" : "var(--surface)"};border-radius:8px;cursor:pointer;display:flex;gap:8px;align-items:center;">
              <input type="radio" name="cobraBoleto" value="no" ${state.cobraBoleto === "no" ? "checked" : ""} style="accent-color:var(--guinda);" />
              <span>Entrada gratuita ($0)</span>
            </label>
            <label style="flex:1;padding:12px;border:1.5px solid ${state.cobraBoleto === "si" ? "var(--guinda)" : "var(--border)"};background:${state.cobraBoleto === "si" ? "var(--guinda-soft)" : "var(--surface)"};border-radius:8px;cursor:pointer;display:flex;gap:8px;align-items:center;">
              <input type="radio" name="cobraBoleto" value="si" ${state.cobraBoleto === "si" ? "checked" : ""} style="accent-color:var(--guinda);" />
              <span>Sí, cobramos boleto</span>
            </label>
          </div>
          ${state.cobraBoleto === "si" ? `
            <div class="form-grid-2">
              <div class="filter-group">
                <label for="wiz-tmin">Boleto más económico (MXN)</label>
                <input type="number" min="0" id="wiz-tmin" class="form-input" value="${state.boletoMin}" />
              </div>
              <div class="filter-group">
                <label for="wiz-tmax">Boleto más alto (MXN)</label>
                <input type="number" min="0" id="wiz-tmax" class="form-input" value="${state.boletoMax}" />
              </div>
            </div>
          ` : ""}
        </div>
        <div class="wizard-nav">
          <button type="button" class="btn-secondary" id="wiz-prev">← Regresar</button>
          <button type="button" class="btn-primary" id="wiz-next">Continuar →</button>
        </div>
      `;
    } else if (state.step === 3) {
      bodyHtml = `
        <div>
          <div class="wizard-step-kicker">Paso 3 de 6</div>
          <h3>¿Cuántas personas asistirán por función?</h3>
          <p style="margin:0 0 16px;color:var(--ink-muted);font-size:0.92rem;">Indica el aforo aproximado de tu salón, patio o auditorio.</p>
          <div class="filter-group">
            <label for="wiz-aforo">Público estimado por función</label>
            <input type="number" min="10" max="5000" id="wiz-aforo" class="form-input" value="${state.aforo}" />
          </div>
        </div>
        <div class="wizard-nav">
          <button type="button" class="btn-secondary" id="wiz-prev">← Regresar</button>
          <button type="button" class="btn-primary" id="wiz-next">Continuar →</button>
        </div>
      `;
    } else if (state.step === 4) {
      bodyHtml = `
        <div>
          <div class="wizard-step-kicker">Paso 4 de 6</div>
          <h3>¿Cuántas funciones presentarán?</h3>
          <p style="margin:0 0 16px;color:var(--ink-muted);font-size:0.92rem;">Las microlicencias escolares se calculan por función para que pagues únicamente lo que presentas.</p>
          <div class="filter-group">
            <label for="wiz-func">Número de funciones</label>
            <input type="number" min="1" max="50" id="wiz-func" class="form-input" value="${state.funciones}" />
          </div>
        </div>
        <div class="wizard-nav">
          <button type="button" class="btn-secondary" id="wiz-prev">← Regresar</button>
          <button type="button" class="btn-primary" id="wiz-next">Continuar →</button>
        </div>
      `;
    } else if (state.step === 5) {
      bodyHtml = `
        <div>
          <div class="wizard-step-kicker">Paso 5 de 6 · Distintivo La Luneta</div>
          <h3>Materiales de ensayo</h3>
          <p style="margin:0 0 16px;color:var(--ink-muted);font-size:0.92rem;">Elige cuántas copias digitales imprimibles con marca de agua necesitas para tu elenco y dirección.</p>

          <div class="qty-row">
            <div>
              <strong>Edición Estudiante <span class="help-dot" title="Libreto limpio listo para ensayar, sin notas pedagógicas y con espacio para apuntes del intérprete.">?</span></strong>
              <div style="font-size:0.84rem;color:var(--ink-muted);">$25.00 MXN c/u · PDF descargable con marca de agua</div>
            </div>
            <div class="qty-stepper">
              <button type="button" data-qty="est" data-delta="-1" aria-label="Restar Edición Estudiante">−</button>
              <strong style="min-width:24px;text-align:center;">${state.qtyEstudiante}</strong>
              <button type="button" data-qty="est" data-delta="1" aria-label="Sumar Edición Estudiante">+</button>
            </div>
          </div>

          <div class="qty-row">
            <div>
              <strong>Edición Docente <span class="help-dot" title="Libreto completo + Guía Antididáctica aprobada por editor (Carta del Espectador Niño, sin moralejas) y vínculo NEM.">?</span></strong>
              <div style="font-size:0.84rem;color:var(--ink-muted);">$100.00 MXN c/u · Incluye Guía Antididáctica</div>
            </div>
            <div class="qty-stepper">
              <button type="button" data-qty="doc" data-delta="-1" aria-label="Restar Edición Docente">−</button>
              <strong style="min-width:24px;text-align:center;">${state.qtyDocente}</strong>
              <button type="button" data-qty="doc" data-delta="1" aria-label="Sumar Edición Docente">+</button>
            </div>
          </div>
        </div>
        <div class="wizard-nav">
          <button type="button" class="btn-secondary" id="wiz-prev">← Regresar</button>
          <button type="button" class="btn-primary" id="wiz-next">Ver cotización →</button>
        </div>
      `;
    } else {
      bodyHtml = `
        <div>
          <div class="wizard-step-kicker">Paso 6 de 6 · Resumen orientativo</div>
          <h3>Total estimado: $${totals.total.toFixed(2)} MXN</h3>
          <div class="panel-card" style="padding:14px 16px;margin-bottom:14px;font-size:0.9rem;">
            <div style="display:flex;justify-content:space-between;margin-bottom:6px;"><span>Derechos (${state.funciones} func. · ${org.label.split("/")[0].trim()})</span><strong>$${totals.derechos.toFixed(2)}</strong></div>
            <div style="display:flex;justify-content:space-between;margin-bottom:6px;"><span>Edición Estudiante (${state.qtyEstudiante} × $25)</span><strong>$${(state.qtyEstudiante * 25).toFixed(2)}</strong></div>
            <div style="display:flex;justify-content:space-between;margin-bottom:6px;"><span>Edición Docente (${state.qtyDocente} × $100)</span><strong>$${(state.qtyDocente * 100).toFixed(2)}</strong></div>
            <div style="display:flex;justify-content:space-between;color:var(--ink-muted);padding-top:6px;border-top:1px solid var(--border);"><span>IVA (16%)</span><span>$${totals.iva.toFixed(2)}</span></div>
          </div>

          <div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:14px;">
            <button type="button" class="btn-primary" id="wiz-dl-quote">⬇ Descargar Cotización PDF</button>
            <button type="button" class="btn-secondary" id="wiz-toggle-po">Subir Orden de Compra (PO)</button>
          </div>

          ${state.poMode ? `
            <div class="legal-callout is-warning" style="margin-top:0;">
              <strong>Trámite con Orden de Compra institucional (PO)</strong>
              <p style="margin:6px 0 10px;font-size:0.86rem;">Regla de cumplimiento: subir tu Orden de Compra registra el pedido para facturación CFDI 4.0, pero <strong>NO libera derechos de representación ni permite anunciar funciones hasta confirmarse el pago total</strong>.</p>
              ${state.poSubmitted ? `
                <div style="background:#FFFFFF;padding:12px;border-radius:8px;border:1.5px solid var(--guinda);">
                  <strong style="color:var(--guinda);">ESTADO: PENDIENTE DE PAGO — DERECHOS NO LIBERADOS</strong>
                  <p style="margin:4px 0 0;font-size:0.85rem;">Orden <strong>#${escapeHtml(state.poNumber)}</strong> guardada en «Mi cuenta» (${escapeHtml(state.poFileName || "archivo registrado")}). El Certificado de Licencia se desbloqueará al liquidar por CoDi, SPEI o tarjeta.</p>
                </div>
              ` : `
                <div style="display:flex;flex-direction:column;gap:10px;margin-bottom:12px;">
                  <input id="wiz-po-num" class="form-input" placeholder="N° de PO (ej. PO-TEC-2026-084)" value="${escapeHtml(state.poNumber)}" />
                  <input id="wiz-po-file" type="file" accept=".pdf,.png,.jpg" class="form-input" style="padding:8px;" />
                </div>
                <button type="button" class="btn-guinda" id="wiz-submit-po">Registrar PO (Pendiente de pago)</button>
              `}
            </div>
          ` : ""}
        </div>
        <div class="wizard-nav">
          <button type="button" class="btn-secondary" id="wiz-prev">← Editar materiales</button>
          <button type="button" class="btn-text-only" id="wiz-close-done">Cerrar</button>
        </div>
      `;
    }

    modalContent.innerHTML = `
      <div class="wizard-topbar">
        <div><strong>COTIZADOR DE MICROLICENCIA</strong> · Estimación en MXN (Fase Beta)</div>
        <button type="button" class="icon-close-btn" id="wiz-x" style="color:#FFFFFF;" aria-label="Cerrar cotizador">×</button>
      </div>
      <div class="wizard-layout">
        <aside class="wizard-rail" aria-label="Progreso del cotizador">
          ${railStep(1, "Tipo de grupo", org.label.split("/")[0].trim())}
          ${railStep(2, "Precio de boleto", state.cobraBoleto === "si" ? `$${state.boletoMin}–$${state.boletoMax}` : "Gratis ($0)")}
          ${railStep(3, "Público estimado", `${state.aforo} asistentes`)}
          ${railStep(4, "Funciones", `${state.funciones} función(es)`)}
          ${railStep(5, "Materiales", `${state.qtyEstudiante} Est · ${state.qtyDocente} Doc`)}
        </aside>
        <div class="wizard-main">${bodyHtml}</div>
      </div>
    `;

    // Listeners
    modalContent.querySelector("#wiz-x").addEventListener("click", () => modal.close());
    const closeDone = modalContent.querySelector("#wiz-close-done");
    if (closeDone) closeDone.addEventListener("click", () => modal.close());

    const prev = modalContent.querySelector("#wiz-prev");
    if (prev) prev.addEventListener("click", () => { captureInputs(); state.step -= 1; draw(); });

    const next = modalContent.querySelector("#wiz-next");
    if (next) next.addEventListener("click", () => { captureInputs(); state.step += 1; draw(); });

    modalContent.querySelectorAll('input[name="orgType"]').forEach((r) => {
      r.addEventListener("change", (e) => { state.orgType = e.target.value; draw(); });
    });
    modalContent.querySelectorAll('input[name="cobraBoleto"]').forEach((r) => {
      r.addEventListener("change", (e) => { state.cobraBoleto = e.target.value; draw(); });
    });
    modalContent.querySelectorAll("[data-qty]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const d = Number(btn.dataset.delta);
        if (btn.dataset.qty === "est") state.qtyEstudiante = Math.max(0, state.qtyEstudiante + d);
        if (btn.dataset.qty === "doc") state.qtyDocente = Math.max(0, state.qtyDocente + d);
        draw();
      });
    });

    const dlQuote = modalContent.querySelector("#wiz-dl-quote");
    if (dlQuote) {
      dlQuote.addEventListener("click", () => {
        const q = calcTotals();
        downloadQuotePdf(q);
        onSaveQuote({ ...q, status: state.poSubmitted ? "Pendiente de pago (PO registrada)" : "Cotización descargada" });
        onNotify("Cotización PDF descargada y guardada en «Mi cuenta».");
      });
    }

    const togglePo = modalContent.querySelector("#wiz-toggle-po");
    if (togglePo) {
      togglePo.addEventListener("click", () => { state.poMode = !state.poMode; draw(); });
    }

    const submitPo = modalContent.querySelector("#wiz-submit-po");
    if (submitPo) {
      submitPo.addEventListener("click", () => {
        const poInput = modalContent.querySelector("#wiz-po-num");
        const poFile = modalContent.querySelector("#wiz-po-file");
        const poNum = poInput ? poInput.value.trim() : "";
        if (!poNum) {
          onNotify("Escribe un número de Orden de Compra (PO) para registrarla.");
          return;
        }
        state.poNumber = poNum;
        state.poFileName = (poFile && poFile.files && poFile.files[0]) ? poFile.files[0].name : "OrdenDeCompra-Prueba.pdf";
        state.poSubmitted = true;
        const q = calcTotals();
        onSaveQuote({ ...q, status: "PENDIENTE DE PAGO · Derechos NO liberados (PO #" + poNum + ")" });
        onNotify("Orden de Compra registrada en estado «Pendiente de pago».");
        draw();
      });
    }
  }

  function captureInputs() {
    const inst = modalContent.querySelector("#wiz-inst");
    if (inst) state.institucion = inst.value;
    const inc = modalContent.querySelector("#wiz-inc");
    if (inc) state.inclusiva = inc.checked ? "si" : "no";
    const tmin = modalContent.querySelector("#wiz-tmin");
    if (tmin) state.boletoMin = Number(tmin.value) || 0;
    const tmax = modalContent.querySelector("#wiz-tmax");
    if (tmax) state.boletoMax = Number(tmax.value) || 0;
    const aforo = modalContent.querySelector("#wiz-aforo");
    if (aforo) state.aforo = Math.max(10, Number(aforo.value) || 100);
    const func = modalContent.querySelector("#wiz-func");
    if (func) state.funciones = Math.max(1, Number(func.value) || 1);
  }

  draw();
  modal.showModal();
}

function escapeHtml(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
