// Flujo de compra como invitado + invitación a «Mi cuenta»
// - Edición Estudiante ($25.00 MXN) y Edición Docente ($100.00 MXN)
// - Banxico CoDi ($0 comisión, opción principal recomendada) + Tarjeta abierta desde $25 MXN
// - Casilla opcional de Factura CFDI 4.0 (simulada para prueba UX)
// - Descarga real inmediata de PDF con marca de agua dinámica

import { downloadEditionPdf, downloadSimulatedCfdiPdf } from "./pdf-engine.js";

function renderCodiQrSvg(codeText) {
  // Crisp decorative deterministic QR-style vector for simulated Banxico CoDi preview
  let hash = 0;
  for (let i = 0; i < codeText.length; i++) hash = ((hash << 5) - hash + codeText.charCodeAt(i)) | 0;
  const cells = [];
  const size = 15;
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      const inTL = r < 5 && c < 5;
      const inTR = r < 5 && c >= size - 5;
      const inBL = r >= size - 5 && c < 5;
      let fill = false;
      if (inTL || inTR || inBL) {
        const lr = r < 5 ? r : r - (size - 5);
        const lc = c < 5 ? c : c - (size - 5);
        fill = lr === 0 || lr === 4 || lc === 0 || lc === 4 || (lr === 2 && lc === 2);
      } else {
        fill = (((hash >> ((r * 7 + c * 3) % 24)) ^ (r * 13 + c * 17)) & 1) === 1;
      }
      if (fill) {
        cells.push(`<rect x="${c * 8 + 10}" y="${r * 8 + 10}" width="7" height="7" rx="1" fill="#242320"/>`);
      }
    }
  }
  return `<svg viewBox="0 0 140 140" width="136" height="136" style="background:#FFFFFF;border-radius:8px;border:1px solid var(--border);" role="img" aria-label="Código QR Banxico CoDi de prueba">${cells.join("")}</svg>`;
}

export function openEditionCheckout(modal, modalContent, {
  play,
  script,
  initialEdition = "docente",
  currentUser,
  onOrderComplete,
  onCreateAccount,
  onNotify
}) {
  const state = {
    editionType: initialEdition,
    paymentMethod: "codi", // codi (principal $0) | card
    buyerName: currentUser ? currentUser.name : "",
    buyerEmail: currentUser ? currentUser.email : "",
    schoolName: currentUser ? (currentUser.school || "") : "",
    needsCfdi: false,
    rfc: "",
    razonSocial: "",
    regimen: "601 - General de Ley Personas Morales",
    usoCfdi: "G03 - Gastos en general",
    completedOrder: null,
    accountCreatedNow: false
  };

  function getPrice() {
    return state.editionType === "docente" ? (play.precioDocente || 100) : (play.precioEstudiante || 25);
  }

  function draw() {
    const price = getPrice();
    const isDoc = state.editionType === "docente";

    if (state.completedOrder) {
      const ord = state.completedOrder;
      modalContent.innerHTML = `
        <div class="modal-pad">
          <div class="modal-head">
            <div>
              <div class="wizard-step-kicker" style="color:var(--ok);">Pago simulado confirmado · Folio #${ord.folio}</div>
              <h3>¡Tu edición ya está lista para descargar!</h3>
            </div>
            <button type="button" class="icon-close-btn" id="chk-close" aria-label="Cerrar">×</button>
          </div>

          <div class="panel-card" style="background:var(--ok-soft);border-color:#B7DFC8;">
            <p style="margin:0 0 8px;"><strong>${escapeHtml(play.titulo)}</strong> — ${isDoc ? "Edición Docente + Guía Antididáctica ($100.00 MXN)" : "Edición Estudiante ($25.00 MXN)"}</p>
            <p style="margin:0 0 14px;font-size:0.88rem;color:var(--ink-muted);">
              Tu archivo PDF incluye marca de agua discreta al pie de cada página para <strong>${escapeHtml(ord.schoolName ? `${ord.buyerName} · ${ord.schoolName}` : ord.buyerName)}</strong>. Puedes imprimirlo y usarlo en tu salón sin conexión a internet.
            </p>
            <div style="display:flex;gap:10px;flex-wrap:wrap;">
              <button type="button" class="btn-primary" id="chk-dl-pdf">⬇ Descargar PDF con marca de agua</button>
              ${ord.cfdi ? `<button type="button" class="btn-secondary" id="chk-dl-cfdi">⬇ Descargar CFDI 4.0 (muestra)</button>` : ""}
            </div>
          </div>

          ${!currentUser && !state.accountCreatedNow ? `
            <div class="panel-card" style="background:var(--surface-tint);margin-top:16px;">
              <h4 style="margin:0 0 6px;">¿Quieres guardar tus libretos, favoritas y facturas en «Mi cuenta»?</h4>
              <p style="margin:0 0 12px;font-size:0.88rem;color:var(--ink-muted);">Compraste como invitado sin fricción. Con un clic creamos tu cuenta gratuita usando <strong>${escapeHtml(ord.buyerEmail)}</strong> para que no pierdas tus descargas.</p>
              <button type="button" class="btn-guinda" id="chk-save-account">Guardar todo en «Mi cuenta» en 1 clic</button>
            </div>
          ` : `
            <p style="font-size:0.88rem;color:var(--ok);font-weight:600;margin-top:12px;">✓ Esta descarga quedó guardada en «Mi cuenta».</p>
          `}

          <div style="display:flex;justify-content:flex-end;margin-top:18px;">
            <button type="button" class="btn-text-only" id="chk-done">Volver a la obra</button>
          </div>
        </div>
      `;

      modalContent.querySelector("#chk-close").addEventListener("click", () => modal.close());
      modalContent.querySelector("#chk-done").addEventListener("click", () => modal.close());
      modalContent.querySelector("#chk-dl-pdf").addEventListener("click", () => {
        downloadEditionPdf({
          play,
          script,
          editionType: ord.editionType,
          buyerName: ord.buyerName,
          schoolName: ord.schoolName,
          licenseCode: ord.folio
        });
        onNotify("Descargando archivo PDF con marca de agua…");
      });
      const cfdiBtn = modalContent.querySelector("#chk-dl-cfdi");
      if (cfdiBtn) {
        cfdiBtn.addEventListener("click", () => {
          downloadSimulatedCfdiPdf(ord);
          onNotify("Descargando comprobante CFDI 4.0 de muestra…");
        });
      }
      const saveAcc = modalContent.querySelector("#chk-save-account");
      if (saveAcc) {
        saveAcc.addEventListener("click", () => {
          onCreateAccount({ name: ord.buyerName, email: ord.buyerEmail, school: ord.schoolName });
          state.accountCreatedNow = true;
          onNotify("¡Listo! Creamos tu espacio en «Mi cuenta» con tus descargas.");
          draw();
        });
      }
      return;
    }

    modalContent.innerHTML = `
      <div class="modal-pad">
        <div class="modal-head">
          <div>
            <div class="wizard-step-kicker">Compra rápida como invitado · Pago simulado para prueba</div>
            <h3>Descargar edición imprimible</h3>
            <p style="margin:4px 0 0;font-size:0.9rem;color:var(--ink-muted);">${escapeHtml(play.titulo)} · ${escapeHtml(play.autor)}</p>
          </div>
          <button type="button" class="icon-close-btn" id="chk-close" aria-label="Cerrar">×</button>
        </div>

        <!-- Selector de Edición Estudiante vs Docente -->
        <div class="pay-tabs" role="radiogroup" aria-label="Tipo de edición">
          <button type="button" class="pay-tab ${!isDoc ? "is-selected" : ""}" data-ed="estudiante">
            <div style="display:flex;justify-content:space-between;align-items:center;">
              <strong>Edición Estudiante</strong>
              <strong style="color:var(--blue);">$25 MXN</strong>
            </div>
            <div style="font-size:0.8rem;color:var(--ink-muted);margin-top:4px;">Libreto limpio listo para ensayar, sin notas docentes y con hojas de apuntes.</div>
          </button>
          <button type="button" class="pay-tab ${isDoc ? "is-selected" : ""}" data-ed="docente">
            <div style="display:flex;justify-content:space-between;align-items:center;">
              <strong>Edición Docente</strong>
              <strong style="color:var(--blue);">$100 MXN</strong>
            </div>
            <div style="font-size:0.8rem;color:var(--ink-muted);margin-top:4px;">Libreto + Guía Antididáctica aprobada por editor (sin moralejas) y actividad NEM.</div>
          </button>
        </div>

        <!-- Datos del comprador (invitado) -->
        <div class="form-grid-2" style="margin-bottom:12px;">
          <div class="filter-group">
            <label for="chk-name">Tu nombre (saldrá en la marca de agua) *</label>
            <input id="chk-name" class="form-input" placeholder="Ej. Maestra Mariana López" value="${escapeHtml(state.buyerName)}" />
          </div>
          <div class="filter-group">
            <label for="chk-email">Tu correo electrónico *</label>
            <input id="chk-email" type="email" class="form-input" placeholder="mariana@escuela.edu.mx" value="${escapeHtml(state.buyerEmail)}" />
          </div>
        </div>
        <div class="filter-group" style="margin-bottom:14px;">
          <label for="chk-school">Escuela, grupo o campus (opcional)</label>
          <input id="chk-school" class="form-input" placeholder="Ej. Primaria Benito Juárez / PrepaTec Campus Monterrey" value="${escapeHtml(state.schoolName)}" />
        </div>

        <!-- Casilla opcional de Factura CFDI 4.0 -->
        <div style="padding:12px 14px;background:var(--bg);border:1px solid var(--border);border-radius:8px;margin-bottom:16px;">
          <label class="check-row" style="font-weight:600;">
            <input type="checkbox" id="chk-cfdi-toggle" ${state.needsCfdi ? "checked" : ""} />
            <span>¿Necesitas factura fiscal CFDI 4.0?</span>
          </label>
          ${state.needsCfdi ? `
            <div class="form-grid-2" style="margin-top:12px;">
              <div class="filter-group">
                <label for="chk-rfc">RFC</label>
                <input id="chk-rfc" class="form-input" placeholder="Ej. ITESM430906XX1" value="${escapeHtml(state.rfc)}" />
              </div>
              <div class="filter-group">
                <label for="chk-razon">Razón social</label>
                <input id="chk-razon" class="form-input" placeholder="Nombre fiscal o institución" value="${escapeHtml(state.razonSocial)}" />
              </div>
              <div class="filter-group">
                <label for="chk-regimen">Régimen fiscal</label>
                <select id="chk-regimen" class="form-select">
                  <option ${state.regimen.startsWith("601") ? "selected" : ""}>601 - General de Ley Personas Morales</option>
                  <option ${state.regimen.startsWith("603") ? "selected" : ""}>603 - Personas Morales con Fines no Lucrativos</option>
                  <option ${state.regimen.startsWith("612") ? "selected" : ""}>612 - Personas Físicas con Actividades Empresariales</option>
                  <option ${state.regimen.startsWith("626") ? "selected" : ""}>626 - Régimen Simplificado de Confianza (RESICO)</option>
                </select>
              </div>
              <div class="filter-group">
                <label for="chk-uso">Uso de CFDI</label>
                <select id="chk-uso" class="form-select">
                  <option ${state.usoCfdi.startsWith("G03") ? "selected" : ""}>G03 - Gastos en general</option>
                  <option ${state.usoCfdi.startsWith("D10") ? "selected" : ""}>D10 - Pagos por servicios educativos</option>
                  <option ${state.usoCfdi.startsWith("S01") ? "selected" : ""}>S01 - Sin efectos fiscales</option>
                </select>
              </div>
            </div>
          ` : ""}
        </div>

        <!-- Método de pago: Banxico CoDi recomendado ($0 comisión) + Tarjeta abierta -->
        <p style="margin:0 0 6px;font-weight:700;font-size:0.9rem;">Método de pago (simulado para prueba con docentes)</p>
        <div class="pay-tabs">
          <button type="button" class="pay-tab ${state.paymentMethod === "codi" ? "is-selected" : ""}" data-pay="codi">
            <div style="display:flex;justify-content:space-between;align-items:center;">
              <strong>Banxico CoDi</strong>
              <span style="background:var(--ok-soft);color:var(--ok);font-size:0.73rem;font-weight:700;padding:2px 8px;border-radius:99px;">$0 comisión · Recomendado</span>
            </div>
            <div style="font-size:0.8rem;color:var(--ink-muted);margin-top:4px;">Paga desde la app de tu banco en segundos sin comisiones hasta $8,000 MXN.</div>
          </button>
          <button type="button" class="pay-tab ${state.paymentMethod === "card" ? "is-selected" : ""}" data-pay="card">
            <div style="display:flex;justify-content:space-between;align-items:center;">
              <strong>Tarjeta de débito o crédito</strong>
              <span style="font-size:0.75rem;color:var(--ink-muted);">Visa · Mastercard</span>
            </div>
            <div style="font-size:0.8rem;color:var(--ink-muted);margin-top:4px;">Disponible desde $25 MXN si no usas CoDi en tu celular.</div>
          </button>
        </div>

        ${state.paymentMethod === "codi" ? `
          <div class="codi-qr-box">
            ${renderCodiQrSvg(play.id + "-" + price)}
            <div>
              <strong style="color:var(--blue);">Escanea con tu app bancaria (CoDi · Simulación)</strong>
              <p style="margin:6px 0 10px;font-size:0.86rem;color:var(--ink-muted);">Monto exacto: <strong>$${price.toFixed(2)} MXN</strong> · Comisión bancaria: <strong>$0.00 MXN</strong>.<br/>Como estamos en prueba de interfaz, pulsa el botón de abajo para simular la confirmación instantánea y descargar tu PDF real.</p>
              <button type="button" class="btn-primary" id="chk-confirm-pay">Simular pago CoDi ($${price}.00 MXN) y descargar PDF</button>
            </div>
          </div>
        ` : `
          <div style="background:var(--bg);border:1px solid var(--border);border-radius:10px;padding:16px;">
            <p style="margin:0 0 10px;font-size:0.84rem;color:var(--ink-muted);">Tarjeta de prueba (no se realiza ningún cargo real en esta versión):</p>
            <div class="form-grid-2" style="margin-bottom:12px;">
              <input class="form-input" value="4242 •••• •••• 4242" aria-label="Número de tarjeta de prueba" />
              <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
                <input class="form-input" value="08/29" aria-label="Vigencia" />
                <input class="form-input" value="123" aria-label="Código" />
              </div>
            </div>
            <button type="button" class="btn-primary btn-full" id="chk-confirm-pay">Simular pago con tarjeta ($${price}.00 MXN) y descargar PDF</button>
          </div>
        `}
      </div>
    `;

    // Bind listeners
    modalContent.querySelector("#chk-close").addEventListener("click", () => modal.close());

    modalContent.querySelectorAll("[data-ed]").forEach((b) => {
      b.addEventListener("click", () => { capture(); state.editionType = b.dataset.ed; draw(); });
    });
    modalContent.querySelectorAll("[data-pay]").forEach((b) => {
      b.addEventListener("click", () => { capture(); state.paymentMethod = b.dataset.pay; draw(); });
    });
    modalContent.querySelector("#chk-cfdi-toggle").addEventListener("change", (e) => {
      capture();
      state.needsCfdi = e.target.checked;
      draw();
    });

    modalContent.querySelector("#chk-confirm-pay").addEventListener("click", () => {
      capture();
      if (!state.buyerName.trim() || !state.buyerEmail.trim()) {
        onNotify("Escribe tu nombre y correo para estampar la marca de agua y entregar tu PDF.");
        return;
      }
      const folio = "LL-2026-" + String(Math.floor(1000 + Math.random() * 9000));
      const order = {
        folio,
        fecha: new Date().toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" }),
        playId: play.id,
        playTitle: play.titulo,
        editionType: state.editionType,
        amount: price,
        paymentMethod: state.paymentMethod,
        buyerName: state.buyerName.trim(),
        buyerEmail: state.buyerEmail.trim(),
        schoolName: state.schoolName.trim(),
        cfdi: state.needsCfdi ? {
          rfc: state.rfc.trim() || "XAXX010101000",
          razonSocial: state.razonSocial.trim() || state.buyerName.trim(),
          regimen: state.regimen,
          uso: state.usoCfdi
        } : null
      };
      state.completedOrder = order;
      onOrderComplete(order);
      downloadEditionPdf({
        play,
        script,
        editionType: order.editionType,
        buyerName: order.buyerName,
        schoolName: order.schoolName,
        licenseCode: order.folio
      });
      onNotify("¡Pago simulado confirmado! Descargando tu PDF con marca de agua.");
      draw();
    });
  }

  function capture() {
    const n = modalContent.querySelector("#chk-name"); if (n) state.buyerName = n.value;
    const e = modalContent.querySelector("#chk-email"); if (e) state.buyerEmail = e.value;
    const s = modalContent.querySelector("#chk-school"); if (s) state.schoolName = s.value;
    const r = modalContent.querySelector("#chk-rfc"); if (r) state.rfc = r.value;
    const rz = modalContent.querySelector("#chk-razon"); if (rz) state.razonSocial = rz.value;
    const rg = modalContent.querySelector("#chk-regimen"); if (rg) state.regimen = rg.value;
    const u = modalContent.querySelector("#chk-uso"); if (u) state.usoCfdi = u.value;
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
