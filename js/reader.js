// Lector Web Protegido y Accesible ($0 sin registro)
// - Tamaño de letra, Alto Contraste WCAG AAA, Lectura en voz alta (Web Speech API)
// - Resaltador de parlamentos por personaje (Part Book)
// - Protección amigable anticopia / anti-impresión invitando a descargar Edición Estudiante ($25) o Docente ($100)

export function computeCharacterAnalytics(script) {
  if (!script || !script.bloques) return [];
  const counts = {};
  for (const b of script.bloques) {
    if (b.personaje && (b.tipo === "linea" || b.tipo === "verso")) {
      const words = b.texto.trim().split(/\s+/).filter(Boolean).length;
      if (!counts[b.personaje]) counts[b.personaje] = { intervenciones: 0, palabras: 0 };
      counts[b.personaje].intervenciones += 1;
      counts[b.personaje].palabras += words;
    }
  }
  const totalWords = Object.values(counts).reduce((a, c) => a + c.palabras, 0) || 1;
  const metaList = script.personajesMeta || [];
  const rows = metaList.map((m) => {
    const stat = counts[m.nombre] || { intervenciones: 0, palabras: 0 };
    return {
      nombre: m.nombre,
      genero: m.genero,
      descripcion: m.descripcion,
      intervenciones: stat.intervenciones,
      palabras: stat.palabras,
      porcentaje: Math.round((stat.palabras / totalWords) * 100)
    };
  });
  return rows.sort((a, b) => b.palabras - a.palabras);
}

let readerState = {
  fontSize: 18,
  highContrast: false,
  highlightRole: "",
  speaking: false,
  speechIdx: -1
};

export function stopReaderSpeech() {
  if ("speechSynthesis" in window) {
    window.speechSynthesis.cancel();
  }
  readerState.speaking = false;
  readerState.speechIdx = -1;
}

export function renderProtectedReader(container, { play, script, initialRole = "", onBack, onBuyEdition, onOpenEstimator, onNotify }) {
  stopReaderSpeech();
  readerState.highlightRole = initialRole || "";

  const speakableBlocks = (script && script.bloques)
    ? script.bloques.filter((b) => b.tipo === "linea" || b.tipo === "verso" || b.tipo === "acotacion")
    : [];

  const uniqueRoles = (script && script.personajesMeta) ? script.personajesMeta.map((p) => p.nombre) : [];

  function draw() {
    container.innerHTML = `
      <div class="reader-shell ${readerState.highContrast ? "is-high-contrast" : ""}" id="reader-shell">
        <div class="reader-toolbar">
          <div class="reader-toolbar-inner">
            <button type="button" class="tool-btn" id="reader-back-btn">← Volver a la ficha</button>
            <div class="reader-controls">
              <button type="button" class="tool-btn" id="reader-font-dec" aria-label="Reducir tamaño de texto">A−</button>
              <button type="button" class="tool-btn" id="reader-font-inc" aria-label="Aumentar tamaño de texto">A+</button>
              <button type="button" class="tool-btn ${readerState.highContrast ? "is-active" : ""}" id="reader-contrast-btn" aria-pressed="${readerState.highContrast}">
                Alto contraste
              </button>
              <button type="button" class="tool-btn ${readerState.speaking ? "is-active" : ""}" id="reader-speech-btn">
                ${readerState.speaking ? "⏹ Detener voz" : "🔊 Leer en voz alta"}
              </button>
              ${uniqueRoles.length ? `
                <select id="reader-role-select" class="form-select" style="width:auto;padding:6px 10px;font-size:0.84rem;" aria-label="Resaltar parlamentos de un personaje">
                  <option value="">Resaltar personaje…</option>
                  ${uniqueRoles.map((r) => `<option value="${escapeHtml(r)}" ${readerState.highlightRole === r ? "selected" : ""}>${escapeHtml(r)}</option>`).join("")}
                </select>
              ` : ""}
            </div>
          </div>
        </div>

        <div class="reader-watermark-strip">
          <span>
            ${play.esBeta
              ? "Vista previa gratuita protegida (Fase Beta) · Solicita tu edición o licencia en 1 clic"
              : "Lectura gratuita de evaluación ($0) · ¿La necesitas impresa o sin internet en tu salón?"}
          </span>
          <div style="display:flex;gap:8px;flex-wrap:wrap;">
            <button type="button" class="btn-secondary" style="padding:5px 12px;font-size:0.82rem;" id="reader-buy-est">Edición Estudiante · $25</button>
            <button type="button" class="btn-primary" style="padding:5px 12px;font-size:0.82rem;" id="reader-buy-doc">Edición Docente + Guía · $100</button>
          </div>
        </div>

        <article class="reader-paper" id="reader-paper" style="font-size:${readerState.fontSize}px;">
          <header style="border-bottom:1px solid var(--border);padding-bottom:18px;margin-bottom:22px;">
            <p class="reader-eyebrow">
              ${escapeHtml(play.etiquetaPublica)} · ${escapeHtml(play.id)}
            </p>
            <h1 style="margin:0 0 6px;font-family:var(--font-serif);font-size:1.95em;line-height:1.15;">${escapeHtml(play.titulo)}</h1>
            <p style="margin:0;color:var(--ink-muted);font-size:0.9em;">${escapeHtml(play.autor)} (${escapeHtml(play.vida)})</p>
            ${script ? `<p style="margin:12px 0 0;font-size:0.82em;color:var(--ink-muted);font-style:italic;">${escapeHtml(script.edicionNota)}</p>` : ""}
          </header>

          ${play.bloqueoMusicaRevueltas ? `
            <div class="legal-callout is-warning" style="margin:0 0 20px;">
              <strong>Aviso de derechos:</strong> Este lector incluye únicamente el texto literario de Rafael Pombo (1833–1912), en Dominio Público. No incluye música protegida de Silvestre Revueltas (†1940).
            </div>
          ` : ""}

          <div id="reader-blocks">
            ${renderScriptBlocks(script, readerState.highlightRole, readerState.speechIdx)}
          </div>

          ${script && script.esVistaPrevia ? `
            <div class="legal-callout is-warning" style="margin-top:28px;">
              <strong>Fin de la vista previa (Fase Beta)</strong>
              <p style="margin:6px 0 12px;">En las obras de dramaturgas y dramaturgos contemporáneos, el porcentaje de lectura previa se configura según el acuerdo con cada autor. Aquí puedes probar el cotizador paso a paso de microlicencias o descargar una edición de muestra.</p>
              <div style="display:flex;gap:10px;flex-wrap:wrap;">
                <button type="button" class="btn-primary" id="reader-open-estimator">Cotizar montaje paso a paso</button>
                <button type="button" class="btn-secondary" id="reader-beta-doc">Probar Edición Docente ($100)</button>
              </div>
            </div>
          ` : ""}

          ${!script ? `
            <div class="legal-callout" style="margin-top:14px;">
              <strong>Texto en proceso de digitalización editorial</strong>
              <p style="margin:6px 0 12px;">Esta obra de Dominio Público ya tiene su Ficha de Representación y su guía NEM listas. Mientras nuestro equipo editorial concluye la transcripción limpia al lector, puedes consultar el ejemplar original verificado en biblioteca pública:</p>
              <a class="btn-primary" href="${escapeHtml(play.urlRepositorio)}" target="_blank" rel="noopener noreferrer">Abrir fuente verificada ↗</a>
            </div>
          ` : ""}

          <footer style="margin-top:34px;padding-top:16px;border-top:1px solid var(--border);font-size:0.78em;color:var(--ink-muted);">
            <strong>Derechos morales (LFDA Arts. 21 y 153):</strong> ${escapeHtml(play.notaMoralLfda)}
          </footer>
        </article>
      </div>
    `;

    // Bind events
    container.querySelector("#reader-back-btn").addEventListener("click", () => {
      stopReaderSpeech();
      onBack();
    });
    container.querySelector("#reader-font-dec").addEventListener("click", () => {
      readerState.fontSize = Math.max(14, readerState.fontSize - 2);
      draw();
    });
    container.querySelector("#reader-font-inc").addEventListener("click", () => {
      readerState.fontSize = Math.min(26, readerState.fontSize + 2);
      draw();
    });
    container.querySelector("#reader-contrast-btn").addEventListener("click", () => {
      readerState.highContrast = !readerState.highContrast;
      draw();
    });
    container.querySelector("#reader-buy-est").addEventListener("click", () => onBuyEdition("estudiante"));
    container.querySelector("#reader-buy-doc").addEventListener("click", () => onBuyEdition("docente"));

    const estBtn = container.querySelector("#reader-open-estimator");
    if (estBtn) estBtn.addEventListener("click", onOpenEstimator);
    const betaDoc = container.querySelector("#reader-beta-doc");
    if (betaDoc) betaDoc.addEventListener("click", () => onBuyEdition("docente"));

    const roleSelect = container.querySelector("#reader-role-select");
    if (roleSelect) {
      roleSelect.addEventListener("change", (e) => {
        readerState.highlightRole = e.target.value;
        draw();
      });
    }

    container.querySelector("#reader-speech-btn").addEventListener("click", () => {
      if (!("speechSynthesis" in window)) {
        onNotify("Tu navegador no incluye lectura en voz alta automática.");
        return;
      }
      if (readerState.speaking) {
        stopReaderSpeech();
        draw();
        return;
      }
      if (!speakableBlocks.length) {
        onNotify("Esta obra todavía no tiene parlamentos cargados para lectura en voz alta.");
        return;
      }
      startNarration(speakableBlocks, () => draw());
    });

    // Friendly anti-copy intercept inside reader paper
    const paper = container.querySelector("#reader-paper");
    paper.addEventListener("contextmenu", (e) => {
      e.preventDefault();
      onNotify("Lectura gratuita protegida. Para imprimir o llevar al salón sin internet, descarga la Edición Estudiante ($25) o Docente ($100).");
    });
    paper.addEventListener("copy", (e) => {
      e.preventDefault();
      onNotify("El copiado está desactivado en lectura gratuita. Descarga la edición PDF con marca de agua para imprimir.");
    });
  }

  function startNarration(blocks, redraw) {
    window.speechSynthesis.cancel();
    readerState.speaking = true;
    let i = 0;

    function speakNext() {
      if (!readerState.speaking || i >= blocks.length) {
        readerState.speaking = false;
        readerState.speechIdx = -1;
        redraw();
        return;
      }
      readerState.speechIdx = i;
      redraw();
      const b = blocks[i];
      const phrase = b.personaje ? `${b.personaje}. ${b.texto}` : b.texto;
      const utter = new SpeechSynthesisUtterance(phrase);
      utter.lang = "es-MX";
      utter.rate = 0.98;
      utter.onend = () => {
        i += 1;
        speakNext();
      };
      utter.onerror = () => {
        readerState.speaking = false;
        readerState.speechIdx = -1;
        redraw();
      };
      window.speechSynthesis.speak(utter);
    }
    speakNext();
  }

  draw();
}

function renderScriptBlocks(script, highlightRole, speechIdx) {
  if (!script || !script.bloques) return "";
  let speakCounter = 0;
  return script.bloques.map((b) => {
    if (b.tipo === "acto") {
      return `<h2 class="reader-script-act">${escapeHtml(b.texto)}</h2>`;
    }
    if (b.tipo === "escena") {
      return `<h3 class="reader-script-scene">${escapeHtml(b.texto)}</h3>`;
    }
    if (b.tipo === "acotacion") {
      const isSpk = speakCounter === speechIdx;
      speakCounter += 1;
      return `<p class="reader-script-stage ${isSpk ? "reader-cue is-speaking" : ""}">(${escapeHtml(b.texto)})</p>`;
    }
    const isSpk = speakCounter === speechIdx;
    speakCounter += 1;
    const isRole = highlightRole && b.personaje === highlightRole;
    return `
      <div class="reader-cue ${isRole ? "is-role-highlight" : ""} ${isSpk ? "is-speaking" : ""}">
        ${b.personaje ? `<div class="reader-speaker">${escapeHtml(b.personaje)}</div>` : ""}
        <p class="reader-dialogue">${escapeHtml(b.texto)}</p>
      </div>
    `;
  }).join("");
}

function escapeHtml(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
