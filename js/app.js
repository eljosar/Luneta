// La Luneta — Aplicación principal (portada, buscador con sugerencias, panel de Filtros,
// Ficha de Representación estilo Concord + YouthPLAYS, Lector protegido, Cotizador, Compras, Mi cuenta y Retroalimentación).

import { PLAYS_DATA } from "../data/plays-data.js";
import { SCRIPTS_DATA } from "../data/scripts-data.js";
import { computeCharacterAnalytics, renderProtectedReader, stopReaderSpeech } from "./reader.js";
import { openLicenseEstimator } from "./estimator.js";
import { openEditionCheckout } from "./checkout.js";
import { downloadEditionPdf, downloadQuotePdf, downloadSimulatedCfdiPdf } from "./pdf-engine.js";
import { renderAdminPanel } from "./admin.js";

const STORAGE_KEY = "la_luneta_mvp_v1";

function loadStore() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (_) {}
  return {
    user: null,
    favorites: [],
    orders: [],
    quotes: [],
    feedback: [],
    interests: [],
    playwrights: [],
    youthNotes: {},
    customPlays: [],
    customScripts: {},
    guideOverrides: {},
    ytClicks: {}
  };
}

const store = loadStore();
function saveStore() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(store)); } catch (_) {}
  updateAccountDot();
}

function getAllPlays() {
  const base = [...store.customPlays, ...PLAYS_DATA];
  return base.map((p) => {
    const override = store.guideOverrides[p.id];
    const extraYouth = store.youthNotes[p.id] || [];
    return {
      ...p,
      guiaAntididactica: override ? override : p.guiaAntididactica,
      opinionesJovenes: [...(p.opinionesJovenes || []), ...extraYouth]
    };
  });
}

function getScriptFor(playId) {
  return store.customScripts[playId] || SCRIPTS_DATA[playId] || null;
}

// Estado actual de búsqueda y filtros
const filterState = {
  query: "",
  tab: "todas",
  cast: "",
  duration: "",
  sort: "relevancia",
  age: "",
  enfoque: "",
  gender: "",
  space: "",
  readableOnly: false,
  includeBeta: true,
  includeQueue: false
};

// Elementos del DOM
const views = {
  catalog: document.getElementById("view-catalog"),
  detail: document.getElementById("view-detail"),
  reader: document.getElementById("view-reader"),
  account: document.getElementById("view-account"),
  admin: document.getElementById("view-admin")
};

const searchInput = document.getElementById("search-input");
const searchClearBtn = document.getElementById("search-clear-btn");
const searchForm = document.getElementById("search-form");
const suggestionsBox = document.getElementById("search-suggestions");
const catalogGrid = document.getElementById("catalog-grid");
const catalogSummary = document.getElementById("catalog-summary");
const catalogEmpty = document.getElementById("catalog-empty");
const activeFiltersBar = document.getElementById("active-filters-bar");
const filterDrawer = document.getElementById("filter-drawer");
const filterBackdrop = document.getElementById("filter-backdrop");
const filterCountBadge = document.getElementById("filter-count-badge");
const btnOpenFilters = document.getElementById("btn-open-filters");
const modal = document.getElementById("app-modal");
const modalContent = document.getElementById("app-modal-content");
const toastRegion = document.getElementById("toast-region");
const siteFooter = document.getElementById("site-footer");

function notify(message) {
  const el = document.createElement("div");
  el.className = "toast";
  el.textContent = message;
  toastRegion.appendChild(el);
  setTimeout(() => el.remove(), 3800);
}

function updateAccountDot() {
  const dot = document.getElementById("account-dot");
  const count = store.favorites.length + store.orders.length + store.quotes.length;
  dot.hidden = !(store.user || count > 0);
}

function showView(name) {
  stopReaderSpeech();
  Object.entries(views).forEach(([k, sec]) => {
    sec.hidden = k !== name;
  });
  siteFooter.hidden = name === "reader";
  window.scrollTo({ top: 0, behavior: "instant" });
}

// =========================================================================
// 1. Sugerencias del buscador ("¿Qué quieres montar?")
// =========================================================================
const DEFAULT_SUGGESTIONS = [
  { text: "pastorela", hint: "Tradición y humor" },
  { text: "pastorela cómica", hint: "9 intérpretes · 15 min" },
  { text: "pastorela para primaria", hint: "Grupos escolares" },
  { text: "pastorela con reparto grande", hint: "Hasta 20 intérpretes" },
  { text: "títeres primaria", hint: "Renacuajo, Vanegas Arroyo" },
  { text: "comedia preparatoria", hint: "PrepaTec · Juvenil" },
  { text: "Julia Nava de Ruisánchez", hint: "Rescate siglo XX · Fase Beta" }
];

function buildSuggestions(q) {
  const norm = normalize(q);
  if (!norm) return DEFAULT_SUGGESTIONS.slice(0, 6);
  const out = [];
  const seen = new Set();

  for (const s of DEFAULT_SUGGESTIONS) {
    if (normalize(s.text).includes(norm)) {
      out.push(s);
      seen.add(normalize(s.text));
    }
  }
  for (const p of getAllPlays()) {
    if (out.length >= 7) break;
    if (normalize(p.titulo).includes(norm) || normalize(p.autor).includes(norm)) {
      const key = normalize(p.titulo);
      if (!seen.has(key)) {
        out.push({ text: p.titulo, hint: `${p.elencoMin}–${p.elencoMax} int. · ${p.duracionMin} min`, playId: p.id });
        seen.add(key);
      }
    }
  }
  if (!out.length) {
    out.push({ text: q.trim(), hint: "Buscar en La Luneta" });
  }
  return out;
}

function renderSuggestions() {
  const list = buildSuggestions(searchInput.value);
  suggestionsBox.innerHTML = list.map((s) => `
    <button type="button" class="suggestion-item" role="option" data-val="${escapeHtml(s.text)}" data-play="${s.playId || ""}">
      <span>${escapeHtml(s.text)}</span>
      <span class="suggestion-hint">${escapeHtml(s.hint)}</span>
    </button>
  `).join("");
  suggestionsBox.hidden = false;
  searchInput.setAttribute("aria-expanded", "true");

  suggestionsBox.querySelectorAll(".suggestion-item").forEach((btn) => {
    btn.addEventListener("mousedown", (e) => {
      e.preventDefault();
      if (btn.dataset.play) {
        hideSuggestions();
        navigateToPlay(btn.dataset.play);
      } else {
        searchInput.value = btn.dataset.val;
        searchClearBtn.hidden = !searchInput.value;
        filterState.query = btn.dataset.val;
        hideSuggestions();
        goCatalogAndRender();
      }
    });
  });
}

function hideSuggestions() {
  suggestionsBox.hidden = true;
  searchInput.setAttribute("aria-expanded", "false");
}

searchInput.addEventListener("focus", renderSuggestions);
searchInput.addEventListener("input", () => {
  searchClearBtn.hidden = !searchInput.value;
  filterState.query = searchInput.value;
  renderSuggestions();
  if (!views.catalog.hidden) renderCatalog();
});
searchInput.addEventListener("blur", () => setTimeout(hideSuggestions, 160));
searchClearBtn.addEventListener("click", () => {
  searchInput.value = "";
  searchClearBtn.hidden = true;
  filterState.query = "";
  hideSuggestions();
  goCatalogAndRender();
  searchInput.focus();
});
searchForm.addEventListener("submit", (e) => {
  e.preventDefault();
  filterState.query = searchInput.value.trim();
  hideSuggestions();
  goCatalogAndRender();
});

// =========================================================================
// 2. Motor de filtrado del catálogo (Ficha de Representación completa)
// =========================================================================
function normalize(s) {
  return String(s ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function getFilteredPlays() {
  const all = getAllPlays();
  const qNorm = normalize(filterState.query.trim());
  const qTokens = qNorm ? qNorm.split(/\s+/).filter((t) => t.length > 1) : [];

  let list = all.filter((p) => {
    // Visibilidad base (portada muestra 22 Día 1 DP + 2 muestras Beta; cola DP de 59 solo si se marca o busca por nombre exacto)
    if (p.capa === "capa1_cola" && !filterState.includeQueue && !qNorm) return false;
    if (p.esBeta && !filterState.includeBeta && filterState.tab !== "fase_beta") return false;

    // Pestañas rápidas
    if (filterState.tab === "cortas" && p.duracionMin > 25) return false;
    if (filterState.tab === "comicas" && !(p.tags || []).includes("comicas")) return false;
    if (filterState.tab === "pastorela" && !(p.tags || []).includes("pastorela") && !normalize(p.titulo).includes("pastorela")) return false;
    if (filterState.tab === "primaria" && p.edadMin > 11) return false;
    if (filterState.tab === "preparatoria" && p.edadMax < 14) return false;
    if (filterState.tab === "fase_beta" && !p.esBeta) return false;

    // Búsqueda textual (soporta frases como "pastorela cómica", "pastorela reparto grande", "Julia Nava")
    if (qTokens.length) {
      const hay = normalize([
        p.titulo, p.autor, p.premisa, p.sinopsis, p.formatoEscenico,
        p.nivelEducativo, p.nemCampo, ...(p.temas || []), ...(p.tags || []),
        p.elencoMax >= 12 ? "reparto grande" : "",
        p.duracionMin <= 20 ? "corta cortas" : ""
      ].join(" "));
      for (const tok of qTokens) {
        if (tok === "para" || tok === "con" || tok === "de" || tok === "en") continue;
        if (!hay.includes(tok)) return false;
      }
    }

    // Intérpretes exactos que tiene el docente
    if (filterState.cast) {
      const c = Number(filterState.cast);
      if (c === 15) {
        if (p.elencoMax < 15) return false;
      } else {
        if (c < p.elencoMin || c > p.elencoMax) return false;
      }
    }

    // Duración máxima
    if (filterState.duration) {
      if (p.duracionMin > Number(filterState.duration)) return false;
    }

    // Edad recomendada
    if (filterState.age) {
      const [amin, amax] = filterState.age.split("-").map(Number);
      if (p.edadMax < amin || p.edadMin > amax) return false;
    }

    // Para vs Con
    if (filterState.enfoque) {
      if (!(p.enfoque || []).includes(filterState.enfoque)) return false;
    }

    // Género del reparto
    if (filterState.gender === "flexible" && !p.elencoFlexible) return false;
    if (filterState.gender === "femenino3") {
      const f = (p.repartoGenero && p.repartoGenero.femenino) || 0;
      const fl = (p.repartoGenero && p.repartoGenero.flexible) || 0;
      if (f < 3 && fl < 4) return false;
    }

    // Espacio
    if (filterState.space && p.espacio !== filterState.space) return false;

    // Solo con texto listo en lector hoy
    if (filterState.readableOnly && !getScriptFor(p.id)) return false;

    return true;
  });

  // Ordenamiento (priorizando siempre obras con texto legible en relevancia)
  if (filterState.sort === "popularidad") {
    list.sort((a, b) => (b.popularidad || 0) - (a.popularidad || 0));
  } else if (filterState.sort === "duracion") {
    list.sort((a, b) => a.duracionMin - b.duracionMin);
  } else {
    list.sort((a, b) => {
      const score = (x) => (getScriptFor(x.id) ? 100 : 0) + (x.enPortada ? 40 : 0) + (x.popularidad || 0) * 0.5;
      return score(b) - score(a);
    });
  }

  return list;
}

function countActiveDrawerFilters() {
  let n = 0;
  if (filterState.cast) n++;
  if (filterState.duration) n++;
  if (filterState.age) n++;
  if (filterState.enfoque) n++;
  if (filterState.gender) n++;
  if (filterState.space) n++;
  if (filterState.readableOnly) n++;
  if (filterState.includeQueue) n++;
  if (!filterState.includeBeta) n++;
  return n;
}

function renderActiveChips() {
  const chips = [];
  if (filterState.query) chips.push({ label: `Búsqueda: «${filterState.query}»`, clear: () => { filterState.query = ""; searchInput.value = ""; searchClearBtn.hidden = true; } });
  if (filterState.cast) chips.push({ label: `${filterState.cast === "15" ? "15+" : filterState.cast} intérpretes`, clear: () => { filterState.cast = ""; } });
  if (filterState.duration) chips.push({ label: `Hasta ${filterState.duration} min`, clear: () => { filterState.duration = ""; } });
  if (filterState.age) chips.push({ label: `Edad ${filterState.age} años`, clear: () => { filterState.age = ""; } });
  if (filterState.enfoque) chips.push({ label: filterState.enfoque === "con" ? "Para montar con infancias/jóvenes" : "Para presentar ante infancias/jóvenes", clear: () => { filterState.enfoque = ""; } });
  if (filterState.gender) chips.push({ label: filterState.gender === "flexible" ? "Reparto flexible" : "3+ papeles femeninos", clear: () => { filterState.gender = ""; } });
  if (filterState.space) chips.push({ label: `Espacio: ${filterState.space}`, clear: () => { filterState.space = ""; } });
  if (filterState.readableOnly) chips.push({ label: "Solo listas para leer hoy", clear: () => { filterState.readableOnly = false; } });
  if (filterState.includeQueue) chips.push({ label: "+ 59 DP en cola", clear: () => { filterState.includeQueue = false; } });

  const count = countActiveDrawerFilters();
  filterCountBadge.textContent = String(count);
  filterCountBadge.hidden = count === 0;
  btnOpenFilters.classList.toggle("has-filters", count > 0);

  if (!chips.length) {
    activeFiltersBar.hidden = true;
    activeFiltersBar.innerHTML = "";
    return;
  }
  activeFiltersBar.hidden = false;
  activeFiltersBar.innerHTML = chips.map((c, idx) => `
    <span class="filter-chip">
      <span>${escapeHtml(c.label)}</span>
      <button type="button" data-chip="${idx}" aria-label="Quitar filtro ${escapeHtml(c.label)}">×</button>
    </span>
  `).join("") + `<button type="button" class="btn-text-only" id="chips-clear-all" style="font-size:0.83rem;">Limpiar todo</button>`;

  activeFiltersBar.querySelectorAll("[data-chip]").forEach((btn) => {
    btn.addEventListener("click", () => {
      chips[Number(btn.dataset.chip)].clear();
      syncDrawerInputs();
      renderCatalog();
    });
  });
  activeFiltersBar.querySelector("#chips-clear-all").addEventListener("click", resetAllFilters);
}

function renderCatalog() {
  renderActiveChips();
  const list = getFilteredPlays();

  const readableCount = list.filter((p) => Boolean(getScriptFor(p.id))).length;
  catalogSummary.textContent = list.length
    ? `${list.length} obra${list.length === 1 ? "" : "s"} disponible${list.length === 1 ? "" : "s"} (${readableCount} con texto listo para leer gratis hoy en pantalla)`
    : "0 obras encontradas";

  if (!list.length) {
    catalogGrid.innerHTML = "";
    catalogEmpty.hidden = false;
    return;
  }
  catalogEmpty.hidden = true;

  catalogGrid.innerHTML = list.map((p) => {
    const hasReader = Boolean(getScriptFor(p.id));
    let badgeHtml = "";
    if (p.esBeta) {
      badgeHtml = `<span class="thumb-badge is-beta">${p.capa === "capa2_beta" ? "Fase Beta · Ficha histórica" : "Fase Beta · Microlicencia"}</span>`;
    } else if (hasReader) {
      badgeHtml = `<span class="thumb-badge is-readable">Lectura gratis hoy</span>`;
    } else if (p.capa === "capa1_cola") {
      badgeHtml = `<span class="thumb-badge is-queue">DP · En cola</span>`;
    }
    const castLabel = p.elencoMin === p.elencoMax
      ? `${p.elencoMin} intérpretes`
      : `Reparto: ${p.elencoMin}–${p.elencoMax}`;

    return `
      <button type="button" class="play-card" data-open-play="${escapeHtml(p.id)}">
        <div class="play-card-thumb-wrap">
          <img class="play-card-thumb" src="${escapeHtml(p.cover)}" alt="" loading="lazy" />
          ${badgeHtml}
        </div>
        <h3 class="play-card-title">${escapeHtml(p.titulo)}</h3>
        <p class="play-card-premise">${escapeHtml(p.premisa)}</p>
        <p class="play-card-meta">
          <span>${castLabel} · ${p.duracionMin} min</span>
          <span class="play-card-author">· ${escapeHtml(p.autor.split("/")[0].trim())}</span>
        </p>
      </button>
    `;
  }).join("");

  catalogGrid.querySelectorAll("[data-open-play]").forEach((card) => {
    card.addEventListener("click", () => navigateToPlay(card.dataset.openPlay));
  });
}

function resetAllFilters() {
  filterState.query = "";
  filterState.tab = "todas";
  filterState.cast = "";
  filterState.duration = "";
  filterState.sort = "relevancia";
  filterState.age = "";
  filterState.enfoque = "";
  filterState.gender = "";
  filterState.space = "";
  filterState.readableOnly = false;
  filterState.includeBeta = true;
  filterState.includeQueue = false;
  searchInput.value = "";
  searchClearBtn.hidden = true;
  document.querySelectorAll("#quick-tabs .quick-tab").forEach((t) => {
    const active = t.dataset.tab === "todas";
    t.classList.toggle("is-active", active);
    t.setAttribute("aria-selected", String(active));
  });
  syncDrawerInputs();
  renderCatalog();
}

// =========================================================================
// 3. Panel lateral de Filtros (Drawer)
// =========================================================================
function syncDrawerInputs() {
  document.getElementById("f-cast").value = filterState.cast;
  document.getElementById("f-duration").value = filterState.duration;
  document.getElementById("f-age").value = filterState.age;
  document.getElementById("f-enfoque").value = filterState.enfoque;
  document.getElementById("f-gender").value = filterState.gender;
  document.getElementById("f-space").value = filterState.space;
  document.getElementById("f-readable-only").checked = filterState.readableOnly;
  document.getElementById("f-include-beta").checked = filterState.includeBeta;
  document.getElementById("f-include-queue").checked = filterState.includeQueue;
  document.querySelectorAll("#f-sort-list .sort-option").forEach((b) => {
    const sel = b.dataset.sort === filterState.sort;
    b.classList.toggle("is-selected", sel);
    b.setAttribute("aria-checked", String(sel));
  });
}

function openFilterDrawer() {
  syncDrawerInputs();
  filterBackdrop.hidden = false;
  filterDrawer.hidden = false;
  document.getElementById("f-cast").focus();
}

function closeFilterDrawer() {
  filterBackdrop.hidden = true;
  filterDrawer.hidden = true;
}

btnOpenFilters.addEventListener("click", openFilterDrawer);
document.getElementById("btn-close-filters").addEventListener("click", closeFilterDrawer);
filterBackdrop.addEventListener("click", closeFilterDrawer);

document.querySelectorAll("#f-sort-list .sort-option").forEach((b) => {
  b.addEventListener("click", () => {
    filterState.sort = b.dataset.sort;
    syncDrawerInputs();
  });
});

document.getElementById("btn-apply-filters").addEventListener("click", () => {
  filterState.cast = document.getElementById("f-cast").value;
  filterState.duration = document.getElementById("f-duration").value;
  filterState.age = document.getElementById("f-age").value;
  filterState.enfoque = document.getElementById("f-enfoque").value;
  filterState.gender = document.getElementById("f-gender").value;
  filterState.space = document.getElementById("f-space").value;
  filterState.readableOnly = document.getElementById("f-readable-only").checked;
  filterState.includeBeta = document.getElementById("f-include-beta").checked;
  filterState.includeQueue = document.getElementById("f-include-queue").checked;
  closeFilterDrawer();
  goCatalogAndRender();
});

document.getElementById("btn-clear-filters").addEventListener("click", () => {
  resetAllFilters();
  closeFilterDrawer();
});

document.getElementById("btn-reset-empty").addEventListener("click", resetAllFilters);

document.querySelectorAll("#quick-tabs .quick-tab").forEach((tab) => {
  tab.addEventListener("click", () => {
    filterState.tab = tab.dataset.tab;
    document.querySelectorAll("#quick-tabs .quick-tab").forEach((t) => {
      const active = t === tab;
      t.classList.toggle("is-active", active);
      t.setAttribute("aria-selected", String(active));
    });
    renderCatalog();
  });
});

// =========================================================================
// 4. Vista Ficha de Representación (estilo Concord Theatricals + YouthPLAYS)
// =========================================================================
function renderPlayDetail(playId) {
  const plays = getAllPlays();
  const play = plays.find((p) => p.id === playId);
  if (!play) {
    goCatalogAndRender();
    return;
  }

  const script = getScriptFor(play.id);
  const analytics = computeCharacterAnalytics(script);
  const isFav = store.favorites.includes(play.id);
  const isCapa2 = play.capa === "capa2_beta";
  const isCapa3 = play.capa === "capa3_beta";

  // Obras relacionadas (3 tarjetas)
  const related = plays
    .filter((p) => p.id !== play.id && p.enPortada)
    .sort((a, b) => (Math.abs(a.duracionMin - play.duracionMin) - Math.abs(b.duracionMin - play.duracionMin)))
    .slice(0, 3);

  const ytRefUrl = `${window.location.origin}${window.location.pathname}?ref=${play.youtube.refCodigo}#obra/${play.id}`;

  // Botones protagonistas del Hero (3 acciones claras estilo Concord)
  let heroButtonsHtml = "";
  if (isCapa2) {
    heroButtonsHtml = `
      <button type="button" class="btn-hero-white" id="d-btn-interest">Avisarme / Solicitar gestión</button>
      <button type="button" class="btn-hero-outline" data-scroll-sec="sec-materiales">Ver en qué bibliotecas está</button>
      <button type="button" class="btn-hero-outline" data-scroll-sec="sec-video">Ver videoensayo de la tesina</button>
    `;
  } else if (isCapa3) {
    heroButtonsHtml = `
      <button type="button" class="btn-hero-white" id="d-btn-read">Leer vista previa gratis ($0)</button>
      <button type="button" class="btn-hero-outline" id="d-btn-estimator">Cotizar montaje paso a paso</button>
      <button type="button" class="btn-hero-outline" id="d-btn-buy-doc">Edición Docente ($100) / Estudiante ($25)</button>
    `;
  } else {
    heroButtonsHtml = `
      <button type="button" class="btn-hero-white" id="d-btn-read">${script ? "Leer completa gratis ($0)" : "Ver estado y fuente verificada"}</button>
      <button type="button" class="btn-hero-outline" id="d-btn-buy-est">Edición Estudiante · $25 MXN</button>
      <button type="button" class="btn-hero-outline" id="d-btn-buy-doc">Edición Docente + Guía · $100 MXN</button>
    `;
  }

  views.detail.innerHTML = `
    <div class="detail-hero">
      <div class="detail-hero-inner">
        <button type="button" class="back-crumb" id="d-back">← Volver al catálogo</button>
        <div class="detail-hero-grid">
          <div>
            <div class="detail-eyebrow">
              <span>${escapeHtml(play.etiquetaPublica)} · ${escapeHtml(play.id)}</span>
              ${play.esBeta ? `<span class="beta-pill-hero">Fase Beta · Muestra interactiva</span>` : ""}
            </div>
            <h1 class="detail-title">${escapeHtml(play.titulo)}</h1>
            <div class="detail-subtitle-stats">
              ${escapeHtml(play.formatoEscenico)} / ${play.elencoMin === play.elencoMax ? `${play.elencoMin} intérpretes` : `${play.elencoMin}–${play.elencoMax} intérpretes`} ${play.elencoFlexible ? "(reparto flexible)" : ""} / ${play.duracionMin} min
            </div>
            <div class="detail-author-line">${escapeHtml(play.autor)} <span style="font-weight:400;opacity:0.85;">(${escapeHtml(play.vida)})</span></div>
            <p class="detail-premise">${escapeHtml(play.premisa)}</p>
          </div>
          <div class="detail-hero-actions">
            ${heroButtonsHtml}
            <div class="hero-secondary-links">
              <button type="button" class="hero-mini-btn" id="d-btn-fav">${isFav ? "♥ Guardada en favoritas" : "♡ Guardar en favoritas"}</button>
              <button type="button" class="hero-mini-btn" id="d-btn-share">↗ Compartir ficha</button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Barra pegajosa con pestañas limpias estilo Concord -->
    <nav class="detail-sticky-nav" aria-label="Secciones de la obra">
      <div class="detail-sticky-inner">
        <div class="detail-tabs">
          <button type="button" class="detail-tab is-active" data-scroll-sec="sec-ficha">Ficha</button>
          <button type="button" class="detail-tab" data-scroll-sec="sec-reparto">Reparto</button>
          <button type="button" class="detail-tab" data-scroll-sec="sec-materiales">Materiales y licencias</button>
          <button type="button" class="detail-tab" data-scroll-sec="sec-autoria">Autoría</button>
          <button type="button" class="detail-tab" data-scroll-sec="sec-video">Videoensayo y opiniones</button>
        </div>
        <div class="sticky-quick-cta">
          ${isCapa2
            ? `<button type="button" class="btn-guinda" id="sticky-interest">Solicitar gestión</button>`
            : `<button type="button" class="btn-primary" id="sticky-read">${isCapa3 ? "Vista previa" : "Leer gratis"}</button>`}
          ${isCapa3
            ? `<button type="button" class="btn-secondary" id="sticky-est">Cotizar montaje</button>`
            : !isCapa2 ? `<button type="button" class="btn-secondary" id="sticky-doc">Ed. Docente $100</button>` : ""}
        </div>
      </div>
    </nav>

    <div class="detail-body">
      <!-- Bloque de datos clave con íconos + Cartel (estilo Concord imagen 2) -->
      <section id="sec-ficha" class="detail-section">
        <div class="overview-grid">
          <div class="facts-grid">
            <div class="fact-box">
              <div class="fact-label">Tamaño de reparto</div>
              <div class="fact-value">${play.elencoMin === play.elencoMax ? `${play.elencoMin} intérpretes exactos` : `${play.elencoMin} a ${play.elencoMax} intérpretes`} · ${play.elencoFlexible ? "Flexible en género" : "Reparto fijo"}</div>
            </div>
            <div class="fact-box">
              <div class="fact-label">Para público de…</div>
              <div class="fact-value">${escapeHtml(play.paraEdad)}</div>
            </div>
            <div class="fact-box">
              <div class="fact-label">Ideal para montar con…</div>
              <div class="fact-value">${escapeHtml(play.conEdad)}</div>
            </div>
            <div class="fact-box">
              <div class="fact-label">Duración y espacio</div>
              <div class="fact-value">${play.duracionMin} minutos · ${escapeHtml(play.complejidadEscenica)}</div>
            </div>
          </div>
          <figure class="detail-poster-card" style="margin:0;">
            <img src="${escapeHtml(play.cover)}" alt="Cartel ilustrativo de ${escapeHtml(play.titulo)}" />
            <figcaption class="detail-poster-caption">${escapeHtml(play.nivelEducativo)} · ${escapeHtml(play.anio)}</figcaption>
          </figure>
        </div>

        <div class="details-two-col" style="margin-top:28px;">
          <div>
            <h2 class="section-kicker">Resumen y enfoque en aula</h2>
            <p style="margin:0 0 14px;">${escapeHtml(play.sinopsis)}</p>

            ${isCapa2 && play.estudioCritico ? `
              <div class="legal-callout is-warning">
                <strong>Rescate histórico (TESINA · LFDA Art. 29)</strong>
                <p style="margin:6px 0 0;">${escapeHtml(play.estudioCritico)}</p>
              </div>
            ` : ""}

            ${play.bloqueoMusicaRevueltas ? `
              <div class="legal-callout is-warning">
                <strong>Recordatorio legal de derechos:</strong> Esta ficha y su lector incluyen exclusivamente el texto literario de Rafael Pombo (†1912). Nunca utilices sin licencia la música protegida de Silvestre Revueltas (†1940).
              </div>
            ` : ""}

            <div class="legal-callout">
              <strong>Actividad de aula (15 min · Nueva Escuela Mexicana)</strong>
              <p style="margin:6px 0 6px;">${escapeHtml(play.actividadAula)}</p>
              <span style="font-size:0.83rem;color:var(--ink-muted);"><strong>Campo formativo:</strong> ${escapeHtml(play.nemCampo)} · <strong>Ejes:</strong> ${(play.nemEjes || []).join(" · ")}</span>
            </div>
          </div>

          <div>
            <div class="fact-box" style="margin-bottom:14px;">
              <div class="fact-label">Temas y etiquetas</div>
              <div class="tag-cloud">
                ${(play.temas || []).map((t) => `<span class="tag-pill">${escapeHtml(t)}</span>`).join("")}
              </div>
            </div>
            <div class="fact-box">
              <div class="fact-label">Estatus jurídico</div>
              <div class="fact-value" style="font-size:0.86rem;">${escapeHtml(play.estatusLegal)}</div>
            </div>
          </div>
        </div>
      </section>

      <!-- Sección Reparto + Gráfica visual de peso por personaje (Character Grid) -->
      <section id="sec-reparto" class="detail-section">
        <h2 class="section-kicker">Reparto y peso de parlamentos por personaje</h2>
        <p style="margin:0 0 12px;color:var(--ink-muted);">${escapeHtml(play.notaElenco)}</p>
        ${analytics.length ? `
          <p style="margin:0 0 10px;font-size:0.85rem;color:var(--ink-subtle);">
            Analítica automática de texto: consulta de un vistazo quién protagoniza, quién tiene papeles breves y qué roles admiten cambio de género.
          </p>
          <div class="char-chart-list">
            ${analytics.map((c) => `
              <div class="char-row">
                <div class="char-row-top">
                  <span class="char-name">${escapeHtml(c.nombre)}</span>
                  <div class="char-badges">
                    <span class="gender-pill">${escapeHtml(c.genero)}</span>
                    <span>${c.intervenciones} interv. · ${c.palabras} palabras (${c.porcentaje}%)</span>
                  </div>
                </div>
                <div class="char-bar-track" aria-hidden="true">
                  <div class="char-bar-fill" style="width:${Math.max(c.porcentaje, 4)}%;"></div>
                </div>
                <div class="char-desc-row">
                  <span>${escapeHtml(c.descripcion)}</span>
                  ${!isCapa2 ? `<button type="button" class="link-btn" data-read-role="${escapeHtml(c.nombre)}">Resaltar en lector →</button>` : ""}
                </div>
              </div>
            `).join("")}
          </div>
        ` : `
          <div class="fact-box">
            <strong>Distribución de referencia:</strong>
            ${play.repartoGenero.femenino ? `${play.repartoGenero.femenino} femenino(s) · ` : ""}
            ${play.repartoGenero.masculino ? `${play.repartoGenero.masculino} masculino(s) · ` : ""}
            ${play.repartoGenero.flexible} flexible(s) / intercambiables.
            <div style="font-size:0.84rem;color:var(--ink-muted);margin-top:6px;">La gráfica de peso exacto por parlamento se genera automáticamente al concluirse la transcripción limpia del libreto.</div>
          </div>
        `}
      </section>

      <!-- Sección Materiales y Licencias: 3 tarjetas limpias estilo Concord -->
      <section id="sec-materiales" class="detail-section">
        <h2 class="section-kicker">Materiales y licencias</h2>
        ${isCapa2 ? renderCapa2Materials(play) : renderStandardMaterials(play, script, isCapa3)}
      </section>

      <!-- Sección Autoría -->
      <section id="sec-autoria" class="detail-section">
        <h2 class="section-kicker">Autoría y respaldo documental</h2>
        <div class="panel-card" style="display:flex;justify-content:space-between;flex-wrap:wrap;gap:18px;align-items:center;">
          <div style="max-width:66ch;">
            <h3 style="margin:0 0 6px;font-family:var(--font-serif);font-size:1.35rem;">${escapeHtml(play.autor)}</h3>
            <p style="margin:0 0 8px;font-size:0.9rem;color:var(--ink-muted);">${escapeHtml(play.vida)} · Periodo: ${escapeHtml(play.periodo)}</p>
            <p style="margin:0 0 8px;font-size:0.88rem;"><strong>Derechos morales (LFDA Arts. 21 y 153):</strong> ${escapeHtml(play.notaMoralLfda)}</p>
            <p style="margin:0;font-size:0.84rem;color:var(--ink-subtle);"><strong>Fuente documental:</strong> ${escapeHtml(play.repositorioAlterno)}</p>
          </div>
          ${play.urlRepositorio && !isCapa2 ? `
            <a href="${escapeHtml(play.urlRepositorio)}" target="_blank" rel="noopener noreferrer" class="btn-secondary">Consultar acervo fuente ↗</a>
          ` : ""}
        </div>
      </section>

      <!-- Sección Videoensayo YouTube + Lectura de Jóvenes Espectadores (Fase Beta) -->
      <section id="sec-video" class="detail-section">
        <h2 class="section-kicker">Videoensayo y mirada de jóvenes espectadores</h2>

        <div class="yt-card">
          <div class="yt-thumb">
            <span class="yt-play-circle">▶</span>
            <span>YouTube · TESINA</span>
          </div>
          <div>
            <div style="font-size:0.76rem;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:var(--guinda);margin-bottom:4px;">${escapeHtml(play.youtube.canal)}</div>
            <h4 style="margin:0 0 6px;font-size:1.08rem;">${escapeHtml(play.youtube.titulo)}</h4>
            <p style="margin:0 0 12px;font-size:0.86rem;color:var(--ink-muted);">Enlace rastreable conectado al videoensayo largo contra el teatro moralizante (${escapeHtml(play.youtube.estado)}).</p>
            <div style="display:flex;gap:10px;flex-wrap:wrap;">
              <a href="${escapeHtml(play.youtube.url)}" target="_blank" rel="noopener noreferrer" class="btn-primary" style="padding:8px 14px;font-size:0.86rem;">Abrir en YouTube ↗</a>
              <button type="button" class="btn-secondary" style="padding:8px 14px;font-size:0.86rem;" id="d-copy-yt">Copiar enlace rastreable</button>
            </div>
          </div>
        </div>

        <div class="youth-box">
          <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;margin-bottom:10px;">
            <h4 style="margin:0;font-size:1.05rem;">Lectura de Jóvenes Espectadores (10–17 años)</h4>
            <span class="tag-pill" style="background:var(--guinda-soft);color:var(--guinda);border-color:var(--guinda-border);font-weight:600;">Fase Beta</span>
          </div>
          <p style="margin:0 0 12px;font-size:0.88rem;color:var(--ink-muted);">Etiquetas reales de estudiantes tras leer o ensayar la obra, para equilibrar el criterio adulto:</p>
          <div class="tag-cloud" style="margin-bottom:14px;">
            ${play.opinionesJovenes.length
              ? play.opinionesJovenes.map((op) => `<span class="tag-pill">${escapeHtml(op)}</span>`).join("")
              : `<span style="font-size:0.86rem;color:var(--ink-subtle);">Aún sin opiniones juveniles en esta obra. ¡Agrega la primera de tu grupo!</span>`}
          </div>
          <form id="d-youth-form" style="display:flex;gap:8px;flex-wrap:wrap;">
            <input id="d-youth-input" class="form-input" style="flex:1;min-width:220px;" placeholder="Ej. «Nos hizo debatir», «El final quedó abierto»…" />
            <button type="submit" class="btn-secondary">Sumar opinión juvenil</button>
          </form>
        </div>
      </section>

      <!-- Otras obras que te pueden interesar (tomado de YouthPLAYS con tarjetas limpias La Luneta) -->
      <section class="detail-section">
        <h2 class="section-kicker">Otras obras que te pueden interesar</h2>
        <div class="catalog-grid">
          ${related.map((r) => `
            <button type="button" class="play-card" data-open-related="${escapeHtml(r.id)}">
              <div class="play-card-thumb-wrap">
                <img class="play-card-thumb" src="${escapeHtml(r.cover)}" alt="" loading="lazy" />
              </div>
              <h3 class="play-card-title">${escapeHtml(r.titulo)}</h3>
              <p class="play-card-premise">${escapeHtml(r.premisa)}</p>
              <p class="play-card-meta"><span>Reparto: ${r.elencoMin}–${r.elencoMax} · ${r.duracionMin} min</span></p>
            </button>
          `).join("")}
        </div>
      </section>
    </div>
  `;

  // Bindings de la Ficha
  views.detail.querySelector("#d-back").addEventListener("click", goCatalogAndRender);
  views.detail.querySelector("#d-btn-fav").addEventListener("click", () => {
    if (store.favorites.includes(play.id)) {
      store.favorites = store.favorites.filter((x) => x !== play.id);
      notify("Quitada de tus favoritas.");
    } else {
      store.favorites.push(play.id);
      notify("Guardada en tus favoritas (visible en «Mi cuenta»).");
    }
    saveStore();
    renderPlayDetail(play.id);
  });
  views.detail.querySelector("#d-btn-share").addEventListener("click", () => {
    navigator.clipboard?.writeText(window.location.href).catch(() => {});
    notify("Enlace de esta ficha copiado para compartir.");
  });
  views.detail.querySelector("#d-copy-yt").addEventListener("click", () => {
    navigator.clipboard?.writeText(ytRefUrl).catch(() => {});
    notify("Enlace rastreable para YouTube copiado.");
  });

  // Navegación suave entre pestañas internas
  views.detail.querySelectorAll("[data-scroll-sec]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const target = views.detail.querySelector("#" + btn.dataset.scrollSec);
      if (target) target.scrollIntoView({ behavior: "smooth" });
      if (btn.classList.contains("detail-tab")) {
        views.detail.querySelectorAll(".detail-tab").forEach((t) => t.classList.remove("is-active"));
        btn.classList.add("is-active");
      }
    });
  });

  const openRead = (role = "") => openReaderView(play.id, role);
  const openEst = () => openEditionCheckout(modal, modalContent, {
    play, script, initialEdition: "estudiante", currentUser: store.user,
    onOrderComplete: handleOrderComplete, onCreateAccount: handleCreateAccount, onNotify: notify
  });
  const openDoc = () => openEditionCheckout(modal, modalContent, {
    play, script, initialEdition: "docente", currentUser: store.user,
    onOrderComplete: handleOrderComplete, onCreateAccount: handleCreateAccount, onNotify: notify
  });
  const openCalc = () => openLicenseEstimator(modal, modalContent, {
    play,
    onSaveQuote: (q) => { store.quotes.unshift(q); saveStore(); },
    onNotify: notify
  });

  views.detail.querySelectorAll("#d-btn-read, #sticky-read, #mat-read").forEach((el) => el.addEventListener("click", () => openRead("")));
  views.detail.querySelectorAll("#d-btn-buy-est, #mat-est").forEach((el) => el.addEventListener("click", openEst));
  views.detail.querySelectorAll("#d-btn-buy-doc, #sticky-doc, #mat-doc").forEach((el) => el.addEventListener("click", openDoc));
  views.detail.querySelectorAll("#d-btn-estimator, #sticky-est, #mat-calc").forEach((el) => el.addEventListener("click", openCalc));
  views.detail.querySelectorAll("#d-btn-interest, #sticky-interest, #mat-interest").forEach((el) => el.addEventListener("click", () => openCapa2InterestModal(play)));

  views.detail.querySelectorAll("[data-read-role]").forEach((btn) => {
    btn.addEventListener("click", () => openRead(btn.dataset.readRole));
  });
  views.detail.querySelectorAll("[data-open-related]").forEach((card) => {
    card.addEventListener("click", () => navigateToPlay(card.dataset.openRelated));
  });

  views.detail.querySelector("#d-youth-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const inp = views.detail.querySelector("#d-youth-input");
    const val = inp.value.trim();
    if (!val) return;
    if (!store.youthNotes[play.id]) store.youthNotes[play.id] = [];
    store.youthNotes[play.id].push(val.startsWith("«") ? val : `«${val}»`);
    saveStore();
    notify("¡Gracias! Opinión juvenil agregada a la Fase Beta.");
    renderPlayDetail(play.id);
  });
}

function renderStandardMaterials(play, script, isCapa3) {
  return `
    <div class="materials-grid">
      <div class="material-card">
        <div>
          <h4>Lectura en pantalla <span class="help-dot" title="Lee la obra directamente en el navegador sin crear cuenta, con controles de tamaño de letra, alto contraste y lectura en voz alta.">?</span></h4>
          <div class="material-price">$0 MXN</div>
          <ul class="material-list">
            <li>Sin registro ni muro de pago previo.</li>
            <li>${isCapa3 ? "Vista previa protegida (Escena 1 en Fase Beta)." : (script ? "Lectura accesible con zoom, alto contraste y voz." : "Ficha NEM completa + enlace directo a biblioteca pública.")}</li>
            <li>No incluye descarga PDF ni impresión.</li>
          </ul>
        </div>
        <button type="button" class="btn-secondary btn-full" id="mat-read">${script ? (isCapa3 ? "Abrir vista previa gratis" : "Leer completa gratis") : "Abrir fuente verificada"}</button>
      </div>

      <div class="material-card is-featured">
        <div>
          <h4>Edición Estudiante / Docente <span class="help-dot" title="Edición Estudiante ($25): libreto limpio con espacio de notas. Edición Docente ($100): incluye Guía Antididáctica aprobada por editor (sin moralejas) y actividad NEM. Ambos en PDF con marca de agua imprimible sin internet.">?</span></h4>
          <div class="material-price">$25 · $100 MXN</div>
          <ul class="material-list">
            <li><strong>Edición Estudiante ($25):</strong> libreto limpio + hojas de apuntes.</li>
            <li><strong>Edición Docente ($100):</strong> libreto + guía antididáctica aprobada por editor + actividad NEM.</li>
            <li>Descarga PDF con marca de agua para imprimir sin internet · Pago por CoDi ($0 comisión) o tarjeta + CFDI 4.0 opcional.</li>
          </ul>
        </div>
        <div style="display:flex;flex-direction:column;gap:8px;">
          <button type="button" class="btn-primary btn-full" id="mat-doc">Descargar Edición Docente · $100</button>
          <button type="button" class="btn-secondary btn-full" id="mat-est">Descargar Edición Estudiante · $25</button>
        </div>
      </div>

      <div class="material-card">
        <div>
          <h4>Derechos de montaje <span class="help-dot" title="Las obras de Dominio Público (fallecidos antes de 1926) pueden montarse libremente respetando el crédito del autor. Las obras contemporáneas (Capa 3) requieren microlicencia.">?</span></h4>
          <div class="material-price">${isCapa3 ? "Desde $200 MXN" : "Libre (Dominio Público)"}</div>
          <ul class="material-list">
            ${isCapa3 ? `
              <li>Cotizador paso a paso en pesos mexicanos (escuela pública, PrepaTec/colegios, taquilla 10% + IVA).</li>
              <li>Descarga Cotización PDF formal al instante.</li>
              <li>Soporta Orden de Compra (PO) sin liberar derechos hasta confirmar pago.</li>
            ` : `
              <li>Obra verificada bajo LFDA Art. 29 (más de 100 años post mortem).</li>
              <li>Puedes montarla en tu escuela o teatro sin tramitar ni pagar licencia de representación.</li>
              <li>Solo acredita siempre el nombre del autor original (Arts. 21 y 153).</li>
            `}
          </ul>
        </div>
        ${isCapa3
          ? `<button type="button" class="btn-guinda btn-full" id="mat-calc">Abrir cotizador paso a paso</button>`
          : `<button type="button" class="btn-secondary btn-full" id="mat-calc">Probar cotizador (muestra Beta)</button>`}
      </div>
    </div>
  `;
}

function renderCapa2Materials(play) {
  return `
    <div class="materials-grid">
      <div class="material-card" style="border-color:var(--guinda-border);background:#FBF7F8;">
        <div>
          <h4>Texto completo protegido <span class="help-dot" title="En México, los derechos duran toda la vida del autor más 100 años (LFDA Art. 29). Julia Nava de Ruisánchez falleció en 1964, por lo que su obra está protegida hasta 2064.">?</span></h4>
          <div class="material-price" style="color:var(--guinda);">Bloqueado por ley</div>
          <ul class="material-list">
            <li>La Luneta <strong>nunca</strong> publica ni descarga textos sin permiso de herederos.</li>
            <li>Vigencia legal verificada hasta 2064 (LFDA Art. 29).</li>
            <li>Ficha crítica y metadatos 100% legales y abiertos.</li>
          </ul>
        </div>
        <button type="button" class="btn-guinda btn-full" id="mat-interest">Avisarme / Solicitar gestión</button>
      </div>

      <div class="material-card is-featured" style="grid-column:span 2;">
        <div>
          <h4>Dónde consultar el ejemplar físico en bibliotecas</h4>
          <p style="margin:6px 0 12px;font-size:0.9rem;color:var(--ink-muted);">Localizamos esta obra rara tras recorrer cuatro acervos mexicanos durante nuestra investigación de tesina:</p>
          <ul class="material-list">
            ${(play.ubicacionBibliotecas || []).map((b) => `<li><strong>${escapeHtml(b)}</strong></li>`).join("")}
          </ul>
        </div>
        <p style="margin:0;font-size:0.84rem;color:var(--ink-subtle);">Si tú o tu escuela tienen interés en montar o leer esta obra en formato digital legal, registra tu interés para priorizar la gestión con la sucesión.</p>
      </div>
    </div>
  `;
}

// =========================================================================
// 5. Vista Lector Protegido
// =========================================================================
function openReaderView(playId, initialRole = "") {
  const play = getAllPlays().find((p) => p.id === playId);
  if (!play) return;
  if (play.capa === "capa2_beta") {
    notify("Esta obra histórica está protegida hasta 2064; no puede abrirse en el lector sin autorización.");
    return;
  }
  const targetHash = `#leer/${play.id}`;
  lastHandledHash = targetHash;
  if (window.location.hash !== targetHash) {
    window.location.hash = targetHash;
  }
  const script = getScriptFor(play.id);
  showView("reader");
  renderProtectedReader(views.reader, {
    play,
    script,
    initialRole,
    onBack: () => navigateToPlay(play.id),
    onBuyEdition: (ed) => openEditionCheckout(modal, modalContent, {
      play, script, initialEdition: ed, currentUser: store.user,
      onOrderComplete: handleOrderComplete, onCreateAccount: handleCreateAccount, onNotify: notify
    }),
    onOpenEstimator: () => openLicenseEstimator(modal, modalContent, {
      play, onSaveQuote: (q) => { store.quotes.unshift(q); saveStore(); }, onNotify: notify
    }),
    onNotify: notify
  });
}

// =========================================================================
// 6. Vista «Mi cuenta»
// =========================================================================
function renderAccountView() {
  const plays = getAllPlays();
  const favPlays = plays.filter((p) => store.favorites.includes(p.id));

  views.account.innerHTML = `
    <div class="page-wrap">
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;margin-bottom:22px;">
        <div>
          <h1 style="margin:0;font-family:var(--font-serif);font-size:2rem;">Mi cuenta</h1>
          <p style="margin:4px 0 0;color:var(--ink-muted);">
            ${store.user ? `${escapeHtml(store.user.name)} · ${escapeHtml(store.user.email)} ${store.user.school ? `· ${escapeHtml(store.user.school)}` : ""}` : "Navegando como invitado (tus favoritas, descargas y cotizaciones de prueba se guardan aquí)"}
          </p>
        </div>
        <div style="display:flex;gap:10px;flex-wrap:wrap;">
          <button type="button" class="btn-secondary" id="acc-go-admin">Espacio editorial</button>
          <button type="button" class="btn-primary" id="acc-go-home">← Volver al catálogo</button>
        </div>
      </div>

      ${!store.user ? `
        <div class="panel-card" style="background:var(--surface-tint);">
          <h3 style="margin:0 0 6px;font-family:var(--font-serif);">Crea tu cuenta gratuita en un paso</h3>
          <p style="margin:0 0 14px;font-size:0.9rem;color:var(--ink-muted);">No es obligatoria para buscar ni leer gratis, pero te ayuda a conservar tus descargas, facturas y cotizaciones.</p>
          <form id="acc-signup-form" class="form-grid-2" style="align-items:end;">
            <div class="filter-group"><label for="su-name">Nombre</label><input id="su-name" class="form-input" required placeholder="Ej. Maestra Mariana" /></div>
            <div class="filter-group"><label for="su-email">Correo</label><input id="su-email" type="email" class="form-input" required placeholder="mariana@escuela.edu.mx" /></div>
            <div class="filter-group"><label for="su-school">Escuela o campus (opcional)</label><input id="su-school" class="form-input" placeholder="Ej. PrepaTec / Secundaria 14" /></div>
            <button type="submit" class="btn-primary">Guardar mi cuenta</button>
          </form>
        </div>
      ` : ""}

      <div class="panel-card">
        <h3 style="margin:0 0 12px;font-family:var(--font-serif);">Mis ediciones descargadas (${store.orders.length})</h3>
        ${store.orders.length ? store.orders.map((o, idx) => `
          <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;padding:12px 0;border-bottom:1px solid var(--border);">
            <div>
              <strong>${escapeHtml(o.playTitle)}</strong> · ${o.editionType === "docente" ? "Edición Docente ($100)" : "Edición Estudiante ($25)"}
              <div style="font-size:0.83rem;color:var(--ink-muted);">Folio #${o.folio} · ${o.fecha} · ${o.paymentMethod === "codi" ? "Banxico CoDi ($0 comisión)" : "Tarjeta"}</div>
            </div>
            <div style="display:flex;gap:8px;flex-wrap:wrap;">
              <button type="button" class="btn-secondary" style="padding:6px 12px;font-size:0.84rem;" data-redl-order="${idx}">⬇ PDF con marca de agua</button>
              ${o.cfdi ? `<button type="button" class="btn-secondary" style="padding:6px 12px;font-size:0.84rem;" data-redl-cfdi="${idx}">⬇ CFDI 4.0</button>` : ""}
            </div>
          </div>
        `).join("") : `<p style="color:var(--ink-muted);margin:0;">Aún no descargas ninguna Edición Estudiante ($25) o Docente ($100).</p>`}
      </div>

      <div class="panel-card">
        <h3 style="margin:0 0 12px;font-family:var(--font-serif);">Mis cotizaciones y Órdenes de Compra (PO) (${store.quotes.length})</h3>
        ${store.quotes.length ? store.quotes.map((q, idx) => `
          <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;padding:12px 0;border-bottom:1px solid var(--border);">
            <div>
              <strong>${escapeHtml(q.playTitle)}</strong> · $${q.total.toFixed(2)} MXN (${q.funciones} func.)
              <div style="font-size:0.83rem;color:${q.status.includes("NO liberados") ? "var(--guinda)" : "var(--ink-muted)"};font-weight:600;">${escapeHtml(q.status)} · Folio ${q.folio}</div>
            </div>
            <button type="button" class="btn-secondary" style="padding:6px 12px;font-size:0.84rem;" data-redl-quote="${idx}">⬇ Cotización PDF</button>
          </div>
        `).join("") : `<p style="color:var(--ink-muted);margin:0;">Todavía no generas cotizaciones de montaje.</p>`}
      </div>

      <div class="panel-card">
        <h3 style="margin:0 0 14px;font-family:var(--font-serif);">Obras guardadas en favoritas (${favPlays.length})</h3>
        ${favPlays.length ? `
          <div class="catalog-grid">
            ${favPlays.map((p) => `
              <button type="button" class="play-card" data-acc-play="${escapeHtml(p.id)}">
                <div class="play-card-thumb-wrap"><img class="play-card-thumb" src="${escapeHtml(p.cover)}" alt="" /></div>
                <h4 class="play-card-title">${escapeHtml(p.titulo)}</h4>
                <p class="play-card-meta"><span>Reparto: ${p.elencoMin}–${p.elencoMax} · ${p.duracionMin} min</span></p>
              </button>
            `).join("")}
          </div>
        ` : `<p style="color:var(--ink-muted);margin:0;">Toca «♡ Guardar en favoritas» en cualquier obra para verla aquí.</p>`}
      </div>
    </div>
  `;

  views.account.querySelector("#acc-go-home").addEventListener("click", goCatalogAndRender);
  views.account.querySelector("#acc-go-admin").addEventListener("click", openAdminView);
  const suForm = views.account.querySelector("#acc-signup-form");
  if (suForm) {
    suForm.addEventListener("submit", (e) => {
      e.preventDefault();
      handleCreateAccount({
        name: document.getElementById("su-name").value.trim(),
        email: document.getElementById("su-email").value.trim(),
        school: document.getElementById("su-school").value.trim()
      });
      notify("¡Cuenta guardada en La Luneta!");
      renderAccountView();
    });
  }
  views.account.querySelectorAll("[data-acc-play]").forEach((b) => b.addEventListener("click", () => navigateToPlay(b.dataset.accPlay)));
  views.account.querySelectorAll("[data-redl-order]").forEach((b) => {
    b.addEventListener("click", () => {
      const o = store.orders[Number(b.dataset.redlOrder)];
      const play = getAllPlays().find((p) => p.id === o.playId);
      if (play) {
        downloadEditionPdf({ play, script: getScriptFor(play.id), editionType: o.editionType, buyerName: o.buyerName, schoolName: o.schoolName, licenseCode: o.folio });
        notify("Descargando PDF con marca de agua…");
      }
    });
  });
  views.account.querySelectorAll("[data-redl-cfdi]").forEach((b) => {
    b.addEventListener("click", () => {
      downloadSimulatedCfdiPdf(store.orders[Number(b.dataset.redlCfdi)]);
      notify("Descargando CFDI 4.0 de muestra…");
    });
  });
  views.account.querySelectorAll("[data-redl-quote]").forEach((b) => {
    b.addEventListener("click", () => {
      downloadQuotePdf(store.quotes[Number(b.dataset.redlQuote)]);
      notify("Descargando Cotización PDF…");
    });
  });
}

function openAdminView() {
  lastHandledHash = "#editorial";
  if (window.location.hash !== "#editorial") {
    window.location.hash = "#editorial";
  }
  showView("admin");
  renderAdminPanel(views.admin, {
    plays: getAllPlays(),
    orders: store.orders,
    quotes: store.quotes,
    feedbackList: store.feedback,
    interestList: store.interests,
    playwrightList: store.playwrights,
    ytClicks: store.ytClicks,
    onAddPlay: (play, script) => {
      store.customPlays.unshift(play);
      if (script) store.customScripts[play.id] = script;
      saveStore();
    },
    onSaveGuide: (playId, guide) => {
      store.guideOverrides[playId] = guide;
      saveStore();
    },
    onBackHome: goCatalogAndRender,
    onOpenPlay: navigateToPlay,
    onNotify: notify
  });
}

// =========================================================================
// 7. Modales de Retroalimentación (Fase Beta), Capa 2 Interés y Dramaturgos Ola 2
// =========================================================================
function openFeedbackModal() {
  modalContent.innerHTML = `
    <div class="modal-pad">
      <div class="modal-head">
        <div>
          <div class="wizard-step-kicker">Fase Beta · Tu opinión construye La Luneta</div>
          <h3>Cuéntanos qué te sirvió o qué faltó</h3>
        </div>
        <button type="button" class="icon-close-btn" id="fb-close" aria-label="Cerrar">×</button>
      </div>
      <form id="fb-form">
        <div class="filter-group" style="margin-bottom:12px;">
          <label for="fb-role">¿Desde qué rol nos visitas?</label>
          <select id="fb-role" class="form-select">
            <option>Docente / tallerista de escuela</option>
            <option>Coordinación cultural (PrepaTec / colegio privado)</option>
            <option>Dramaturga / dramaturgo</option>
            <option>Compañía de teatro independiente</option>
            <option>Estudiante / joven espectador</option>
          </select>
        </div>
        <div class="filter-group" style="margin-bottom:16px;">
          <label for="fb-msg">¿Qué filtro te faltó, qué duda tuviste o qué te gustaría ver en Capa 2 y Capa 3? *</label>
          <textarea id="fb-msg" rows="4" class="form-textarea" required placeholder="Ej. Me encantaría filtrar por obras sin escenografía para Día de Muertos…"></textarea>
        </div>
        <button type="submit" class="btn-guinda btn-full">Enviar retroalimentación</button>
      </form>
    </div>
  `;
  modalContent.querySelector("#fb-close").addEventListener("click", () => modal.close());
  modalContent.querySelector("#fb-form").addEventListener("submit", (e) => {
    e.preventDefault();
    store.feedback.unshift({
      role: document.getElementById("fb-role").value,
      message: document.getElementById("fb-msg").value.trim(),
      fecha: new Date().toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" })
    });
    saveStore();
    modal.close();
    notify("¡Gracias! Guardamos tu retroalimentación en el buzón editorial.");
  });
  modal.showModal();
}

function openCapa2InterestModal(play) {
  modalContent.innerHTML = `
    <div class="modal-pad">
      <div class="modal-head">
        <div>
          <div class="wizard-step-kicker">Rescate Siglo XX · Fase Beta</div>
          <h3>Solicitar gestión de derechos</h3>
          <p style="margin:4px 0 0;font-size:0.88rem;color:var(--ink-muted);">${escapeHtml(play.titulo)} — ${escapeHtml(play.autor)}</p>
        </div>
        <button type="button" class="icon-close-btn" id="int-close" aria-label="Cerrar">×</button>
      </div>
      <p style="margin:0 0 14px;font-size:0.9rem;">Registrar tu interés nos demuestra ante herederos e instituciones que las escuelas y compañías quieren leer y montar esta obra de manera legal.</p>
      <form id="int-form">
        <div class="filter-group" style="margin-bottom:12px;">
          <label for="int-email">Tu correo para avisarte cuando se libere *</label>
          <input id="int-email" type="email" class="form-input" required value="${store.user ? escapeHtml(store.user.email) : ""}" placeholder="correo@escuela.edu.mx" />
        </div>
        <div class="filter-group" style="margin-bottom:16px;">
          <label for="int-school">Escuela, universidad o grupo (opcional)</label>
          <input id="int-school" class="form-input" value="${store.user ? escapeHtml(store.user.school || "") : ""}" placeholder="Ej. PrepaTec / Secundaria / Compañía" />
        </div>
        <button type="submit" class="btn-guinda btn-full">Registrar mi interés</button>
      </form>
    </div>
  `;
  modalContent.querySelector("#int-close").addEventListener("click", () => modal.close());
  modalContent.querySelector("#int-form").addEventListener("submit", (e) => {
    e.preventDefault();
    store.interests.unshift({
      playId: play.id,
      playTitle: play.titulo,
      email: document.getElementById("int-email").value.trim(),
      school: document.getElementById("int-school").value.trim(),
      fecha: new Date().toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" })
    });
    saveStore();
    modal.close();
    notify("¡Listo! Registramos tu interés para priorizar la gestión con la sucesión.");
  });
  modal.showModal();
}

function openPlaywrightBetaModal() {
  modalContent.innerHTML = `
    <div class="modal-pad">
      <div class="modal-head">
        <div>
          <div class="wizard-step-kicker">Ola 2 · Fase Beta para autoría contemporánea</div>
          <h3>¿Eres dramaturga o dramaturgo?</h3>
        </div>
        <button type="button" class="icon-close-btn" id="pw-close" aria-label="Cerrar">×</button>
      </div>
      <p style="margin:0 0 14px;font-size:0.9rem;color:var(--ink-muted);">En esta primera etapa estamos validando La Luneta con acervo de Dominio Público. Déjanos tus datos para sumarte a la <strong>Ola 2</strong> de microlicencias escolares y universitarias con cobro justo.</p>
      <form id="pw-form">
        <div class="form-grid-2" style="margin-bottom:12px;">
          <div class="filter-group"><label for="pw-name">Tu nombre *</label><input id="pw-name" class="form-input" required placeholder="Ej. Sofía Ramírez" /></div>
          <div class="filter-group"><label for="pw-email">Tu correo *</label><input id="pw-email" type="email" class="form-input" required placeholder="sofia@correo.com" /></div>
        </div>
        <div class="filter-group" style="margin-bottom:12px;">
          <label for="pw-rights">¿Cómo administras hoy tus derechos?</label>
          <select id="pw-rights" class="form-select">
            <option>Gestión directa (sin sociedad autoral)</option>
            <option>Representación en SOGEM (México)</option>
            <option>Representación en ARGENTORES / SGAE / otra</option>
          </select>
        </div>
        <div class="filter-group" style="margin-bottom:16px;">
          <label for="pw-title">Título de una obra que te gustaría publicar en Ola 2</label>
          <input id="pw-title" class="form-input" placeholder="Ej. Obra para secundaria, 6 personajes..." />
        </div>
        <button type="submit" class="btn-primary btn-full">Unirme a la lista Fase Beta</button>
      </form>
    </div>
  `;
  modalContent.querySelector("#pw-close").addEventListener("click", () => modal.close());
  modalContent.querySelector("#pw-form").addEventListener("submit", (e) => {
    e.preventDefault();
    store.playwrights.unshift({
      name: document.getElementById("pw-name").value.trim(),
      email: document.getElementById("pw-email").value.trim(),
      rightsMode: document.getElementById("pw-rights").value,
      sampleTitle: document.getElementById("pw-title").value.trim() || "Por definir"
    });
    saveStore();
    modal.close();
    notify("¡Gracias! Quedaste registrado para la Ola 2 de dramaturgos en La Luneta.");
  });
  modal.showModal();
}

// =========================================================================
// 8. Handlers globales y enrutamiento por hash
// =========================================================================
function handleOrderComplete(order) {
  store.orders.unshift(order);
  saveStore();
}
function handleCreateAccount(userObj) {
  store.user = userObj;
  saveStore();
}

let lastHandledHash = "";

function goCatalogAndRender() {
  lastHandledHash = "#inicio";
  if (window.location.hash !== "#inicio" && window.location.hash !== "") {
    window.location.hash = "#inicio";
  }
  showView("catalog");
  renderCatalog();
}

function navigateToPlay(playId) {
  const targetHash = `#obra/${playId}`;
  lastHandledHash = targetHash;
  if (window.location.hash !== targetHash) {
    window.location.hash = targetHash;
  }
  showView("detail");
  renderPlayDetail(playId);
}

function handleRoute(force = false) {
  const hash = window.location.hash || "#inicio";
  if (!force && hash === lastHandledHash) return;
  lastHandledHash = hash;
  if (hash.startsWith("#leer/")) {
    const id = hash.replace("#leer/", "");
    openReaderView(id);
  } else if (hash.startsWith("#obra/")) {
    const id = hash.replace("#obra/", "");
    showView("detail");
    renderPlayDetail(id);
  } else if (hash === "#cuenta") {
    showView("account");
    renderAccountView();
  } else if (hash === "#editorial") {
    openAdminView();
  } else {
    showView("catalog");
    renderCatalog();
  }
}

// Rastreo automático de visitas desde enlaces de YouTube (?ref=yt-...)
function trackYoutubeRef() {
  const params = new URLSearchParams(window.location.search);
  const ref = params.get("ref");
  if (ref && ref.startsWith("yt-")) {
    store.ytClicks[ref] = (store.ytClicks[ref] || 0) + 1;
    saveStore();
  }
}

document.getElementById("logo-home-link").addEventListener("click", (e) => {
  e.preventDefault();
  resetAllFilters();
  goCatalogAndRender();
});
document.getElementById("btn-my-account").addEventListener("click", () => {
  lastHandledHash = "#cuenta";
  if (window.location.hash !== "#cuenta") {
    window.location.hash = "#cuenta";
  }
  showView("account");
  renderAccountView();
});
document.getElementById("floating-feedback-tab").addEventListener("click", openFeedbackModal);
document.getElementById("footer-btn-playwright").addEventListener("click", openPlaywrightBetaModal);
document.getElementById("footer-btn-admin").addEventListener("click", openAdminView);

// Cerrar diálogo o drawer con Escape o clic fuera del modal
modal.addEventListener("click", (e) => {
  if (e.target === modal) modal.close();
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !filterDrawer.hidden) closeFilterDrawer();
});

window.addEventListener("hashchange", () => handleRoute(false));

function escapeHtml(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// Arranque inicial
trackYoutubeRef();
updateAccountDot();
handleRoute(true);
