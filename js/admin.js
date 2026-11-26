// Espacio Privado de Administración Editorial · La Luneta
// - Candado automático LFDA Art. 29 (100 años: autores fallecidos > 1926 bloquean texto completo)
// - Generador de borrador de Guía Antididáctica asistido con IA (Carta del Espectador Niño, sin moralejas)
//   que EXIGE aprobación manual humana antes de publicarse en la Edición Docente ($100 MXN)
// - Seguimiento de enlaces rastreables YouTube, buzón de Retroalimentación (Fase Beta), interés Capa 2 y dramaturgos Ola 2

export function renderAdminPanel(container, {
  plays,
  orders,
  quotes,
  feedbackList,
  interestList,
  playwrightList,
  ytClicks,
  onAddPlay,
  onSaveGuide,
  onBackHome,
  onOpenPlay,
  onNotify
}) {
  let activeTab = "alta";
  let selectedPlayId = plays[0] ? plays[0].id : "";
  let draftGuide = null;

  function draw() {
    const dpReady = plays.filter((p) => p.capa === "capa1" && p.textoEstado !== "digitalizacion").length;
    const dpTotal = plays.filter((p) => p.capa === "capa1" || p.capa === "capa1_cola").length;
    const totalYt = Object.values(ytClicks || {}).reduce((a, b) => a + b, 0);

    container.innerHTML = `
      <div class="page-wrap">
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;margin-bottom:20px;">
          <div>
            <p style="margin:0;font-size:0.78rem;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:var(--guinda);">Espacio privado · Curaduría editorial</p>
            <h1 style="margin:4px 0 0;font-family:var(--font-serif);font-size:2rem;">Administración de La Luneta</h1>
          </div>
          <button type="button" class="btn-secondary" id="adm-home">← Volver al catálogo</button>
        </div>

        <div class="stats-row">
          <div class="stat-tile">
            <div class="stat-num">${dpReady} / ${dpTotal}</div>
            <div class="stat-lbl">Obras DP en lector / total DP</div>
          </div>
          <div class="stat-tile">
            <div class="stat-num">${orders.length + quotes.length}</div>
            <div class="stat-lbl">Descargas y cotizaciones de prueba</div>
          </div>
          <div class="stat-tile">
            <div class="stat-num">${feedbackList.length + interestList.length}</div>
            <div class="stat-lbl">Mensajes Beta e interés Capa 2</div>
          </div>
          <div class="stat-tile">
            <div class="stat-num">${totalYt}</div>
            <div class="stat-lbl">Visitas rastreadas desde YouTube</div>
          </div>
        </div>

        <div class="quick-tabs" style="border-bottom:1px solid var(--border);margin-bottom:22px;">
          <button type="button" class="quick-tab ${activeTab === "alta" ? "is-active" : ""}" data-atab="alta">Subir obra (candado 100 años)</button>
          <button type="button" class="quick-tab ${activeTab === "guias" ? "is-active" : ""}" data-atab="guias">Guías antididácticas con IA</button>
          <button type="button" class="quick-tab ${activeTab === "buzon" ? "is-active" : ""}" data-atab="buzon">Buzón Beta e interés (${feedbackList.length + interestList.length + playwrightList.length})</button>
          <button type="button" class="quick-tab ${activeTab === "youtube" ? "is-active" : ""}" data-atab="youtube">Enlaces YouTube</button>
        </div>

        <div id="adm-tab-body">
          ${renderTabBody()}
        </div>
      </div>
    `;

    container.querySelector("#adm-home").addEventListener("click", onBackHome);
    container.querySelectorAll("[data-atab]").forEach((b) => {
      b.addEventListener("click", () => {
        activeTab = b.dataset.atab;
        draftGuide = null;
        draw();
      });
    });

    bindTabEvents();
  }

  function renderTabBody() {
    if (activeTab === "alta") {
      return `
        <div class="panel-card">
          <h3 style="margin:0 0 6px;font-family:var(--font-serif);">Dar de alta una obra con verificación legal automática (LFDA Art. 29)</h3>
          <p style="margin:0 0 18px;color:var(--ink-muted);font-size:0.9rem;">
            Al capturar el <strong>año de fallecimiento del autor</strong>, La Luneta aplica la regla de los 100 años: si falleció en 1926 o antes, permite publicar el texto completo en Dominio Público; si falleció después de 1926 y no cargas permiso firmado, <strong>bloquea automáticamente el texto completo</strong> y la publica solo como Ficha Histórica.
          </p>
          <form id="adm-new-play-form">
            <div class="form-grid-2" style="margin-bottom:12px;">
              <div class="filter-group">
                <label for="np-title">Título de la obra *</label>
                <input id="np-title" class="form-input" required placeholder="Ej. Sor Juana Inés de la Cruz (drama)" />
              </div>
              <div class="filter-group">
                <label for="np-author">Autoría *</label>
                <input id="np-author" class="form-input" required placeholder="Ej. José Rosas Moreno" />
              </div>
              <div class="filter-group">
                <label for="np-death">Año de fallecimiento del autor *</label>
                <input id="np-death" type="number" class="form-input" required value="1883" />
              </div>
              <div class="filter-group">
                <label for="np-dur">Duración aproximada (minutos)</label>
                <input id="np-dur" type="number" class="form-input" value="25" />
              </div>
              <div class="filter-group">
                <label for="np-min">Intérpretes mínimo</label>
                <input id="np-min" type="number" class="form-input" value="5" />
              </div>
              <div class="filter-group">
                <label for="np-max">Intérpretes máximo</label>
                <input id="np-max" type="number" class="form-input" value="10" />
              </div>
            </div>
            <div id="np-lfda-banner" class="legal-callout" style="margin:0 0 14px;">
              <strong>Verificación LFDA:</strong> Fallecido en 1883 (hace más de 100 años) → <strong>Dominio Público habilitado</strong>.
            </div>
            <div class="filter-group" style="margin-bottom:12px;">
              <label for="np-premise">Premisa breve (2 líneas, estilo La Luneta) *</label>
              <input id="np-premise" class="form-input" required placeholder="De qué trata sin sermones ni moralejas..." />
            </div>
            <div class="filter-group" style="margin-bottom:12px;">
              <label for="np-yt">Enlace al videoensayo de YouTube (opcional)</label>
              <input id="np-yt" class="form-input" placeholder="https://www.youtube.com/watch?v=..." />
            </div>
            <div class="filter-group" id="np-script-wrap" style="margin-bottom:16px;">
              <label for="np-script">Texto inicial de la obra (opcional, se habilita solo en Dominio Público)</label>
              <textarea id="np-script" rows="4" class="form-textarea" placeholder="PERSONAJE: Diálogo inicial..."></textarea>
            </div>
            <button type="submit" class="btn-primary">Guardar obra en el catálogo</button>
          </form>
        </div>
      `;
    }

    if (activeTab === "guias") {
      const editablePlays = plays.filter((p) => p.capa === "capa1" || p.capa === "capa3_beta");
      const target = editablePlays.find((p) => p.id === selectedPlayId) || editablePlays[0];
      const currentGuide = draftGuide || (target && target.guiaAntididactica) || {
        aprobada: false,
        editor: "En revisión",
        contexto: "",
        preguntasAntes: ["", ""],
        preguntasDialogo: ["", "", "", ""]
      };

      return `
        <div class="panel-card">
          <h3 style="margin:0 0 6px;font-family:var(--font-serif);">Asistente editorial de Guías Antididácticas (con sello humano obligatorio)</h3>
          <p style="margin:0 0 16px;color:var(--ink-muted);font-size:0.9rem;">
            Ningún borrador generado con inteligencia artificial se publica solo. Siempre pasa por <strong>Revisión editorial</strong> y se anexa a la <strong>Edición Docente (\$100 MXN)</strong> únicamente cuando pulsas <strong>«Aprobar y publicar»</strong>.
          </p>

          <div class="form-grid-2" style="align-items:end;margin-bottom:16px;">
            <div class="filter-group">
              <label for="adm-guide-play">Elige una obra</label>
              <select id="adm-guide-play" class="form-select">
                ${editablePlays.map((p) => `<option value="${p.id}" ${p.id === target.id ? "selected" : ""}>${escapeHtml(p.id)} · ${escapeHtml(p.titulo)} (${p.guiaAntididactica && p.guiaAntididactica.aprobada ? "Aprobada" : "Pendiente"})</option>`).join("")}
              </select>
            </div>
            <div>
              <button type="button" class="btn-secondary btn-full" id="adm-gen-ai">✨ Generar borrador con IA (Carta del Espectador Niño)</button>
            </div>
          </div>

          <div class="legal-callout ${currentGuide.aprobada ? "" : "is-warning"}" style="margin:0 0 16px;">
            <strong>Estado actual:</strong> ${currentGuide.aprobada ? `APROBADA Y PUBLICADA (${escapeHtml(currentGuide.editor)})` : "BORRADOR EN REVISIÓN HUMANA · Aún no visible en la Edición Docente"}
          </div>

          <div class="filter-group" style="margin-bottom:12px;">
            <label for="g-ctx">1. Contexto histórico y teatral breve</label>
            <textarea id="g-ctx" rows="3" class="form-textarea">${escapeHtml(currentGuide.contexto || "")}</textarea>
          </div>
          <div class="filter-group" style="margin-bottom:12px;">
            <label for="g-antes">2. Dos preguntas disparadoras antes de leer (una por línea, sin arruinar la trama)</label>
            <textarea id="g-antes" rows="3" class="form-textarea">${escapeHtml((currentGuide.preguntasAntes || []).join("\n"))}</textarea>
          </div>
          <div class="filter-group" style="margin-bottom:16px;">
            <label for="g-dialogo">3. Cuatro preguntas de diálogo abierto (una por línea · prohibido incluir moralejas)</label>
            <textarea id="g-dialogo" rows="5" class="form-textarea">${escapeHtml((currentGuide.preguntasDialogo || []).join("\n"))}</textarea>
          </div>

          <div style="display:flex;gap:10px;flex-wrap:wrap;">
            <button type="button" class="btn-primary" id="adm-approve-guide">✓ Aprobar y publicar en Edición Docente ($100)</button>
            <button type="button" class="btn-secondary" id="adm-view-play">Ver ficha de esta obra</button>
          </div>
        </div>
      `;
    }

    if (activeTab === "buzon") {
      return `
        <div class="panel-card">
          <h3 style="margin:0 0 12px;font-family:var(--font-serif);">Retroalimentación de la Fase Beta (${feedbackList.length})</h3>
          ${feedbackList.length ? feedbackList.map((f) => `
            <div style="padding:12px 0;border-bottom:1px solid var(--border);font-size:0.9rem;">
              <strong>${escapeHtml(f.role)}</strong> · <span style="color:var(--ink-subtle);">${escapeHtml(f.fecha)}</span>
              <p style="margin:4px 0 0;">${escapeHtml(f.message)}</p>
            </div>
          `).join("") : `<p style="color:var(--ink-muted);">Todavía no hay comentarios. Prueba la pestaña lateral «Retroalimentación» para ver cómo llegan aquí.</p>`}
        </div>

        <div class="panel-card">
          <h3 style="margin:0 0 12px;font-family:var(--font-serif);">Interés registrado en obras protegidas / Capa 2 (${interestList.length})</h3>
          ${interestList.length ? interestList.map((it) => `
            <div style="padding:10px 0;border-bottom:1px solid var(--border);font-size:0.9rem;">
              <strong>${escapeHtml(it.playTitle)}</strong> — ${escapeHtml(it.email)} (${escapeHtml(it.school || "Docente")}) · <span style="color:var(--ink-subtle);">${escapeHtml(it.fecha)}</span>
            </div>
          `).join("") : `<p style="color:var(--ink-muted);">Sin solicitudes todavía. Cuando alguien pida avisos en la ficha de Julia Nava de Ruisánchez aparecerán aquí para priorizar la gestión con herederos.</p>`}
        </div>

        <div class="panel-card">
          <h3 style="margin:0 0 12px;font-family:var(--font-serif);">Dramaturgas y dramaturgos interesados en Ola 2 (${playwrightList.length})</h3>
          ${playwrightList.length ? playwrightList.map((pw) => `
            <div style="padding:10px 0;border-bottom:1px solid var(--border);font-size:0.9rem;">
              <strong>${escapeHtml(pw.name)}</strong> (${escapeHtml(pw.email)}) · Gestión: <em>${escapeHtml(pw.rightsMode)}</em> · Obra: ${escapeHtml(pw.sampleTitle)}
            </div>
          `).join("") : `<p style="color:var(--ink-muted);">Sin registros de dramaturgos aún.</p>`}
        </div>
      `;
    }

    // YouTube tab
    const topPlays = plays.filter((p) => p.enPortada).slice(0, 10);
    return `
      <div class="panel-card">
        <h3 style="margin:0 0 6px;font-family:var(--font-serif);">Enlaces rastreables para tus videoensayos de YouTube</h3>
        <p style="margin:0 0 16px;color:var(--ink-muted);font-size:0.9rem;">
          Coloca estos enlaces en la descripción de cada videoensayo de tu tesina en YouTube. Cada vez que una maestra entre desde ese enlace, La Luneta abre directo la obra y suma una visita rastreada aquí.
        </p>
        <div style="display:flex;flex-direction:column;gap:10px;">
          ${topPlays.map((p) => {
            const ref = p.youtube ? p.youtube.refCodigo : `yt-tesina-${p.id.toLowerCase()}`;
            const url = `${window.location.origin}${window.location.pathname}?ref=${ref}#obra/${p.id}`;
            const hits = (ytClicks && ytClicks[ref]) || 0;
            return `
              <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;padding:12px;border:1px solid var(--border);border-radius:8px;">
                <div>
                  <strong>${escapeHtml(p.titulo)}</strong>
                  <div style="font-size:0.8rem;color:var(--ink-muted);word-break:break-all;">${escapeHtml(url)}</div>
                </div>
                <div style="display:flex;gap:8px;align-items:center;">
                  <span class="tag-pill">${hits} visita(s)</span>
                  <button type="button" class="btn-secondary" style="padding:6px 12px;font-size:0.82rem;" data-copy-yt="${escapeHtml(url)}">Copiar enlace</button>
                </div>
              </div>
            `;
          }).join("")}
        </div>
      </div>
    `;
  }

  function bindTabEvents() {
    if (activeTab === "alta") {
      const deathInput = container.querySelector("#np-death");
      const banner = container.querySelector("#np-lfda-banner");
      const scriptWrap = container.querySelector("#np-script-wrap");
      const updateRule = () => {
        const yr = Number(deathInput.value);
        const isProtected = !yr || yr > 1926;
        if (isProtected) {
          banner.className = "legal-callout is-warning";
          banner.innerHTML = `<strong>Candado LFDA Art. 29 activado:</strong> Autor fallecido en ${yr || "fecha posterior a 1926"} (protegido hasta ${yr ? yr + 100 : "100 años después"}). El sistema <strong>bloquea la carga de texto completo</strong> y la publicará solo como Ficha Histórica.`;
          scriptWrap.hidden = true;
        } else {
          banner.className = "legal-callout";
          banner.innerHTML = `<strong>Dominio Público verificado (LFDA Art. 29):</strong> Autor fallecido en ${yr} (más de 100 años). Puedes publicar la ficha y el texto completo.`;
          scriptWrap.hidden = false;
        }
      };
      deathInput.addEventListener("input", updateRule);
      updateRule();

      container.querySelector("#adm-new-play-form").addEventListener("submit", (e) => {
        e.preventDefault();
        const yr = Number(deathInput.value);
        const isProtected = !yr || yr > 1926;
        const id = "TYA-NEW-" + String(Math.floor(100 + Math.random() * 900));
        const titulo = container.querySelector("#np-title").value.trim();
        const autor = container.querySelector("#np-author").value.trim();
        const premisa = container.querySelector("#np-premise").value.trim();
        const dur = Number(container.querySelector("#np-dur").value) || 25;
        const emin = Number(container.querySelector("#np-min").value) || 4;
        const emax = Number(container.querySelector("#np-max").value) || 10;
        const yt = container.querySelector("#np-yt").value.trim();
        const rawScript = !isProtected ? container.querySelector("#np-script").value.trim() : "";

        const newPlay = {
          id,
          titulo,
          autor,
          vida: `†${yr}`,
          anioFallecimiento: yr,
          anio: "Alta editorial",
          periodo: yr <= 1926 ? "1900-1925" : "Siglo XX",
          capa: isProtected ? "capa2_beta" : "capa1",
          esBeta: isProtected,
          enPortada: true,
          textoEstado: isProtected ? "protegido_solo_ficha" : (rawScript ? "completo_lector" : "digitalizacion"),
          etiquetaPublica: isProtected ? "Fase Beta · Ficha histórica (protegida)" : (rawScript ? "Lectura gratis hoy" : "Dominio público · En digitalización"),
          cover: "assets/covers/dp-cola.svg",
          premisa,
          sinopsis: premisa,
          duracionMin: dur,
          elencoMin: emin,
          elencoMax: emax,
          elencoFlexible: true,
          notaElenco: `Reparto flexible de ${emin} a ${emax} intérpretes.`,
          repartoGenero: { femenino: 0, masculino: 0, flexible: emax },
          nivelEducativo: "Primaria y Secundaria",
          edadSugerida: "8–15 años",
          paraEdad: "8 a 15 años",
          conEdad: "8 a 15 años",
          edadMin: 8,
          edadMax: 15,
          enfoque: ["para", "con"],
          espacio: "aula",
          formatoEscenico: "Teatro escolar",
          complejidadEscenica: "Baja — Salón o patio",
          nemCampo: "Lenguajes",
          nemEjes: ["Artes y experiencias estéticas", "Pensamiento crítico"],
          temas: ["Nueva alta editorial", "Teatro mexicano"],
          actividadAula: "Lectura dramatizada en círculo y diálogo abierto sin moralejas.",
          tags: dur <= 20 ? ["cortas", "aula"] : ["aula"],
          popularidad: 88,
          estatusLegal: isProtected
            ? `Protegida por LFDA Art. 29 (†${yr} → hasta ${yr + 100}). Texto bloqueado automáticamente.`
            : `Dominio Público estricto (LFDA Art. 29: †${yr} > 100 años).`,
          notaMoralLfda: `Respetar crédito autoral de ${autor} conforme a los Arts. 21 y 153 de la LFDA.`,
          ubicacionBibliotecas: isProtected ? ["Archivo físico por verificar / En gestión con sucesión"] : undefined,
          urlRepositorio: "https://www.cervantesvirtual.com/",
          repositorioAlterno: "Alta directa en Espacio Editorial La Luneta",
          precioEstudiante: isProtected ? null : 25,
          precioDocente: isProtected ? null : 100,
          guiaAntididactica: isProtected ? null : {
            aprobada: false,
            editor: "Pendiente de revisión humana",
            contexto: `Obra recién dada de alta por el equipo editorial (${autor}).`,
            preguntasAntes: ["¿Qué te sugiere el título antes de abrir la primera escena?"],
            preguntasDialogo: ["¿Qué decisión de los personajes discutirías con tu grupo?"]
          },
          youtube: {
            titulo: `Videoensayo · ${titulo}`,
            canal: "La Luneta · Videoensayos TYA",
            url: yt || "https://www.youtube.com/",
            refCodigo: `yt-tesina-${id.toLowerCase()}`,
            estado: yt ? "Videoensayo conectado" : "Listo para enlazar"
          },
          opinionesJovenes: [],
          bloqueoMusicaRevueltas: false
        };

        let scriptObj = null;
        if (rawScript) {
          const lines = rawScript.split("\n").map((l) => l.trim()).filter(Boolean);
          const blocks = [{ tipo: "acto", texto: titulo.toUpperCase() }];
          const speakers = new Set();
          for (const ln of lines) {
            const m = ln.match(/^([A-ZÁÉÍÓÚÑ0-9\s]{2,28}):\s*(.+)$/);
            if (m) {
              speakers.add(m[1].trim());
              blocks.push({ tipo: "linea", personaje: m[1].trim(), texto: m[2].trim() });
            } else {
              blocks.push({ tipo: "acotacion", texto: ln });
            }
          }
          scriptObj = {
            edicionNota: `Texto cargado desde el Espacio Editorial de La Luneta (${autor}, †${yr}).`,
            esCompleto: true,
            esVistaPrevia: false,
            personajesMeta: Array.from(speakers).map((s) => ({ nombre: s, genero: "Flexible", descripcion: "Personaje de la obra." })),
            bloques: blocks
          };
        }

        onAddPlay(newPlay, scriptObj);
        onNotify(isProtected
          ? "Obra guardada solo como Ficha Histórica (texto bloqueado por regla LFDA de 100 años)."
          : "¡Obra de Dominio Público agregada al catálogo de La Luneta!");
        onOpenPlay(id);
      });
    }

    if (activeTab === "guias") {
      const sel = container.querySelector("#adm-guide-play");
      sel.addEventListener("change", (e) => {
        selectedPlayId = e.target.value;
        draftGuide = null;
        draw();
      });
      container.querySelector("#adm-gen-ai").addEventListener("click", () => {
        const p = plays.find((x) => x.id === selectedPlayId);
        draftGuide = {
          aprobada: false,
          editor: "Borrador IA — Pendiente de aprobación humana",
          contexto: `Borrador asistido sobre «${p.titulo}» (${p.autor}, ${p.anio}): en lugar de cerrar la obra con una lección de conducta, proponemos mirarla desde la Carta del Espectador Niño como un detonador de preguntas incómodas, juego escénico y escucha real en el salón (${p.nemCampo}).`,
          preguntasAntes: [
            `Antes de leer «${p.titulo}», ¿qué conflicto imaginas a partir del título sin buscar todavía quién tiene la razón?`,
            `Si tuvieras que contar esta historia en ${p.duracionMin} minutos con objetos cotidianos del aula, ¿qué objeto sería el protagonista?`
          ],
          preguntasDialogo: [
            "¿Qué personaje te cayó bien aunque no hiciera lo «correcto»?",
            "¿En qué momento de la obra sentiste que alguien intentaba mandar sobre los demás?",
            "Si pudieran cambiar una sola decisión de la escena final sin dar sermones, ¿cuál elegirían?",
            "¿Qué parte de este texto de otra época sigue pasando exactamente igual en nuestra escuela o barrio?"
          ]
        };
        onNotify("Borrador antididáctico generado en estado «En revisión humana». Revísalo antes de aprobar.");
        draw();
      });
      container.querySelector("#adm-approve-guide").addEventListener("click", () => {
        const guide = {
          aprobada: true,
          editor: "Aprobada manualmente por Curaduría La Luneta (" + new Date().toLocaleDateString("es-MX") + ")",
          contexto: container.querySelector("#g-ctx").value.trim(),
          preguntasAntes: container.querySelector("#g-antes").value.split("\n").map((x) => x.trim()).filter(Boolean),
          preguntasDialogo: container.querySelector("#g-dialogo").value.split("\n").map((x) => x.trim()).filter(Boolean)
        };
        draftGuide = guide;
        onSaveGuide(selectedPlayId, guide);
        onNotify("¡Guía antididáctica aprobada y publicada en la Edición Docente ($100 MXN)!");
        draw();
      });
      container.querySelector("#adm-view-play").addEventListener("click", () => onOpenPlay(selectedPlayId));
    }

    if (activeTab === "youtube") {
      container.querySelectorAll("[data-copy-yt]").forEach((btn) => {
        btn.addEventListener("click", () => {
          navigator.clipboard?.writeText(btn.dataset.copyYt).catch(() => {});
          onNotify("Enlace rastreable de YouTube copiado.");
        });
      });
    }
  }

  draw();
}

function escapeHtml(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
