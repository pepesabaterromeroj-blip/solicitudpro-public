(function () {
  const {
    learningPlan,
    platforms,
    STATUS_OPTIONS,
    PAUSE_REASONS,
    motivationalQuotes,
  } = window.SummerLearningPlan;

  const STORAGE_KEY = "summerLearningDiary:v1";
  const CHECKS = [
    "He abierto la plataforma",
    "He hecho la tarea principal",
    "He escrito lo aprendido",
    "He marcado el dia como completado",
  ];

  const app = document.querySelector("#app");
  let progress = loadProgress();
  let filters = { platform: "all", category: "all", status: "all", search: "" };
  let selectedDayId = getTodayPlanDay() ? getTodayPlanDay().id : learningPlan[0].id;
  let activeSection = "today";

  function loadProgress() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch (error) {
      return {};
    }
  }

  function saveProgress() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
  }

  function getDayProgress(dayId) {
    return {
      status: "pending",
      checks: {},
      notes: {
        learned: "",
        difficult: "",
        next: "",
      },
      pauseReason: "",
      pauseNote: "",
      updatedAt: "",
      ...(progress[dayId] || {}),
    };
  }

  function updateDay(dayId, patch, shouldRender = true) {
    const current = getDayProgress(dayId);
    progress[dayId] = {
      ...current,
      ...patch,
      updatedAt: new Date().toISOString(),
    };
    saveProgress();
    if (shouldRender) {
      render();
    }
  }

  function updateNestedDay(dayId, group, key, value, shouldRender = true) {
    const current = getDayProgress(dayId);
    updateDay(dayId, {
      [group]: {
        ...(current[group] || {}),
        [key]: value,
      },
    }, shouldRender);
  }

  function formatDate(dateString, withWeekday) {
    const date = new Date(`${dateString}T12:00:00`);
    return new Intl.DateTimeFormat("es-ES", {
      weekday: withWeekday ? "long" : undefined,
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(date);
  }

  function getTodayISO() {
    return new Date().toISOString().slice(0, 10);
  }

  function getTodayPlanDay() {
    const today = getTodayISO();
    return learningPlan.find((day) => day.date === today) || null;
  }

  function getStatusLabel(statusId) {
    return STATUS_OPTIONS.find((status) => status.id === statusId)?.label || "Pendiente";
  }

  function getQuote(day) {
    const dateIndex = learningPlan.findIndex((item) => item.id === day.id);
    return day.quote || motivationalQuotes[dateIndex % motivationalQuotes.length];
  }

  function getPlatformUrl(day) {
    return platforms[day.platform] ? platforms[day.platform].url : "";
  }

  function getStats() {
    const stats = learningPlan.reduce(
      (acc, day) => {
        const dayStatus = getDayProgress(day.id).status;
        acc.byStatus[dayStatus] = (acc.byStatus[dayStatus] || 0) + 1;
        acc.byCategory[day.category] = acc.byCategory[day.category] || { total: 0, completed: 0 };
        acc.byCategory[day.category].total += 1;

        if (dayStatus === "completed") {
          acc.completed += 1;
          acc.hours += 1;
          acc.byCategory[day.category].completed += 1;
        }

        if (dayStatus === "paused") {
          acc.paused += 1;
        }

        if (dayStatus === "pending") {
          acc.pending += 1;
        }

        if (dayStatus === "in-progress") {
          acc.inProgress += 1;
        }

        return acc;
      },
      {
        completed: 0,
        paused: 0,
        pending: 0,
        inProgress: 0,
        hours: 0,
        byStatus: {},
        byCategory: {},
      }
    );

    stats.percent = Math.round((stats.completed / learningPlan.length) * 100);
    stats.streak = getCurrentStreak();
    stats.nextTask = getNextTask();
    stats.topCategory = getTopCategory(stats.byCategory);
    return stats;
  }

  function getCurrentStreak() {
    const today = getTodayISO();
    const pastDays = learningPlan.filter((day) => day.date <= today);
    const ordered = pastDays.length ? pastDays : learningPlan;
    let streak = 0;

    for (let index = ordered.length - 1; index >= 0; index -= 1) {
      const status = getDayProgress(ordered[index].id).status;
      if (status === "completed") {
        streak += 1;
      } else {
        break;
      }
    }

    return streak;
  }

  function getNextTask() {
    const today = getTodayISO();
    return (
      learningPlan.find((day) => day.date >= today && getDayProgress(day.id).status !== "completed") ||
      learningPlan.find((day) => getDayProgress(day.id).status !== "completed") ||
      learningPlan.at(-1)
    );
  }

  function getTopCategory(byCategory) {
    return Object.entries(byCategory)
      .map(([name, value]) => ({
        name,
        percent: value.total ? Math.round((value.completed / value.total) * 100) : 0,
      }))
      .sort((a, b) => b.percent - a.percent)[0];
  }

  function groupByWeek(days) {
    const weeks = [];
    for (let index = 0; index < days.length; index += 5) {
      weeks.push(days.slice(index, index + 5));
    }
    return weeks;
  }

  function getFilteredDays() {
    return learningPlan.filter((day) => {
      const state = getDayProgress(day.id).status;
      const text = `${day.platform} ${day.category} ${day.task} ${day.result}`.toLowerCase();
      return (
        (filters.platform === "all" || filters.platform === day.platform) &&
        (filters.category === "all" || filters.category === day.category) &&
        (filters.status === "all" || filters.status === state) &&
        (!filters.search || text.includes(filters.search.toLowerCase()))
      );
    });
  }

  function setActive(sectionId) {
    activeSection = sectionId;
    render();
    requestAnimationFrame(() => {
      document.querySelector(`#${sectionId}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  function escapeHtml(value) {
    return String(value || "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function render() {
    const stats = getStats();
    const selectedDay = learningPlan.find((day) => day.id === selectedDayId) || learningPlan[0];

    app.innerHTML = `
      <header class="site-header">
        <a class="brand" href="#top" aria-label="Ir al inicio">
          <span class="brand-mark">DV</span>
          <span>Diario Verano</span>
        </a>
        <nav class="main-nav" aria-label="Navegacion principal">
          <button data-section="today">Hoy</button>
          <button data-section="calendar">Calendario</button>
          <button data-section="progress">Progreso</button>
          <button data-section="help">Ayuda</button>
          <button data-section="solicitudpro">SolicitudPro</button>
        </nav>
      </header>

      <main id="top">
        ${renderHero(stats)}
        <section id="progress" class="section">${renderProgress(stats)}</section>
        <section id="today" class="section">${renderToday()}</section>
        <section id="calendar" class="section">${renderCalendar()}</section>
        <section id="help" class="section">${renderHelp()}</section>
        <section id="solicitudpro" class="section">${renderSolicitudPro()}</section>
      </main>

      ${renderDetail(selectedDay)}

      <footer class="footer">
        <p>Diario local sin backend, sin login y sin APIs de pago. Tus avances se guardan solo en este navegador.</p>
      </footer>
    `;

    bindEvents();
  }

  function renderHero(stats) {
    return `
      <section class="hero section">
        <div class="hero-copy">
          <p class="eyebrow">22 junio - 31 agosto 2026</p>
          <h1>Diario de Aprendizaje de Verano</h1>
          <p class="hero-subtitle">
            1 hora al dia para aprender programacion, IA, bases de datos, automatizaciones y construir mejor SolicitudPro.
          </p>
          <p class="kind-note">
            Este diario no va de hacerlo perfecto. Va de avanzar cuando puedas, descansar cuando toque y volver sin perder el rumbo.
          </p>
          <div class="hero-actions">
            <button class="button primary" data-section="today">Ver tarea de hoy</button>
            <button class="button secondary" data-section="calendar">Ver calendario completo</button>
            <button class="button ghost" data-section="progress">Ver progreso</button>
          </div>
        </div>
        <aside class="hero-panel" aria-label="Resumen del progreso">
          <span class="panel-label">Progreso real</span>
          <strong>${stats.percent}%</strong>
          <div class="progress-bar" aria-label="Barra de progreso general">
            <span style="width:${stats.percent}%"></span>
          </div>
          <p>${stats.completed} dias completados · ${stats.paused} pausados · ${stats.hours} horas reales</p>
        </aside>
      </section>
    `;
  }

  function renderProgress(stats) {
    return `
      <div class="section-heading">
        <p class="eyebrow">Panel de progreso</p>
        <h2>Avance claro, sin castigos por descansar.</h2>
      </div>
      <div class="metric-grid">
        ${metric("Dias completados", stats.completed)}
        ${metric("Dias pendientes", stats.pending)}
        ${metric("Dias pausados", stats.paused)}
        ${metric("Horas reales acumuladas", stats.hours)}
        ${metric("Progreso real", `${stats.percent}%`)}
        ${metric("Racha actual", `${stats.streak} dias`)}
      </div>
      <div class="two-column">
        <article class="soft-panel">
          <h3>Proxima tarea</h3>
          <p><strong>${formatDate(stats.nextTask.date, true)}</strong></p>
          <p>${escapeHtml(stats.nextTask.platform)} · ${escapeHtml(stats.nextTask.task)}</p>
        </article>
        <article class="soft-panel">
          <h3>Categoria mas avanzada</h3>
          <p><strong>${escapeHtml(stats.topCategory.name)}</strong></p>
          <p>${stats.topCategory.percent}% completado en esa categoria.</p>
        </article>
      </div>
      <div class="category-list">
        ${Object.entries(stats.byCategory)
          .map(([category, value]) => {
            const percent = Math.round((value.completed / value.total) * 100);
            return `
              <div class="category-row">
                <span>${escapeHtml(category)}</span>
                <div class="progress-bar"><span style="width:${percent}%"></span></div>
                <strong>${percent}%</strong>
              </div>
            `;
          })
          .join("")}
      </div>
      <button class="button danger" data-reset>Resetear progreso</button>
    `;
  }

  function metric(label, value) {
    return `
      <article class="metric-card">
        <span>${label}</span>
        <strong>${value}</strong>
      </article>
    `;
  }

  function renderToday() {
    const today = getTodayPlanDay();
    const todayDate = new Date(`${getTodayISO()}T12:00:00`);
    const weekend = todayDate.getDay() === 0 || todayDate.getDay() === 6;

    if (!today) {
      return `
        <div class="section-heading">
          <p class="eyebrow">Vista Hoy</p>
          <h2>${weekend ? "Hoy toca descanso o repaso opcional." : "Hoy no hay tarea programada."}</h2>
          <p>${weekend ? "Puedes repasar notas, ordenar ideas o simplemente descansar sin culpa." : "El plan cubre los dias de aprendizaje entre semana del verano."}</p>
        </div>
      `;
    }

    return `
      <div class="section-heading">
        <p class="eyebrow">Vista Hoy</p>
        <h2>${formatDate(today.date, true)}</h2>
        <p>${escapeHtml(today.platform)} · ${escapeHtml(today.category)}</p>
      </div>
      ${renderTaskPanel(today, true)}
    `;
  }

  function renderTaskPanel(day, compact) {
    const state = getDayProgress(day.id);
    const url = getPlatformUrl(day);

    return `
      <article class="task-panel status-${state.status}">
        <div class="task-main">
          <div>
            <span class="status-pill ${state.status}">${getStatusLabel(state.status)}</span>
            <h3>${escapeHtml(day.task)}</h3>
            <p>${escapeHtml(day.objective)}</p>
          </div>
          ${url ? `<a class="button secondary" href="${url}" target="_blank" rel="noopener noreferrer">Abrir ${escapeHtml(day.platform)}</a>` : ""}
        </div>
        <div class="time-grid">
          <span>0-5 min: abrir diario y preparar sesion</span>
          <span>5-45 min: tarea principal</span>
          <span>45-55 min: apuntar lo aprendido</span>
          <span>55-60 min: marcar estado y siguiente paso</span>
        </div>
        <div class="checklist">
          ${CHECKS.map(
            (label, index) => `
              <label>
                <input type="checkbox" data-check="${index}" data-day="${day.id}" ${state.checks[index] ? "checked" : ""} />
                <span>${label}</span>
              </label>
            `
          ).join("")}
        </div>
        <blockquote>${escapeHtml(getQuote(day))}</blockquote>
        <div class="status-actions" data-day="${day.id}">
          ${STATUS_OPTIONS.map(
            (status) => `<button class="status-button ${status.id} ${state.status === status.id ? "active" : ""}" data-status="${status.id}">${status.label}</button>`
          ).join("")}
        </div>
        ${state.status === "paused" ? renderPauseFields(day) : ""}
        ${
          compact
            ? `<button class="button primary" data-complete="${day.id}">Marcar dia completado</button>`
            : ""
        }
      </article>
    `;
  }

  function renderPauseFields(day) {
    const state = getDayProgress(day.id);
    return `
      <div class="pause-box">
        <p><strong>Descansar tambien forma parte del proceso. Lo importante es volver.</strong></p>
        <label>
          Motivo opcional
          <select data-pause-reason="${day.id}">
            <option value="">Sin motivo concreto</option>
            ${PAUSE_REASONS.map(
              (reason) => `<option value="${reason}" ${state.pauseReason === reason ? "selected" : ""}>${reason}</option>`
            ).join("")}
          </select>
        </label>
        <label>
          Nota breve
          <textarea data-pause-note="${day.id}" rows="3" placeholder="Hoy no he podido hacerlo porque estaba de vacaciones. Lo retomare cuando vuelva.">${escapeHtml(state.pauseNote)}</textarea>
        </label>
      </div>
    `;
  }

  function renderCalendar() {
    const filteredDays = getFilteredDays();
    const weeks = groupByWeek(filteredDays);
    const platformOptions = [...new Set(learningPlan.map((day) => day.platform))];
    const categoryOptions = [...new Set(learningPlan.map((day) => day.category))];

    return `
      <div class="section-heading">
        <p class="eyebrow">Calendario completo</p>
        <h2>Lunes a viernes, una sesion manejable cada dia.</h2>
      </div>
      <div class="filters" aria-label="Filtros del calendario">
        <input type="search" data-filter-search placeholder="Buscar tarea, plataforma o resultado" value="${escapeHtml(filters.search)}" />
        <select data-filter-platform>
          <option value="all">Todas las plataformas</option>
          ${platformOptions.map((platform) => `<option value="${platform}" ${filters.platform === platform ? "selected" : ""}>${platform}</option>`).join("")}
        </select>
        <select data-filter-category>
          <option value="all">Todas las categorias</option>
          ${categoryOptions.map((category) => `<option value="${category}" ${filters.category === category ? "selected" : ""}>${category}</option>`).join("")}
        </select>
        <select data-filter-status>
          <option value="all">Todos los estados</option>
          ${STATUS_OPTIONS.map((status) => `<option value="${status.id}" ${filters.status === status.id ? "selected" : ""}>${status.label}</option>`).join("")}
        </select>
      </div>
      <div class="weeks">
        ${
          weeks.length
            ? weeks
                .map(
                  (week, index) => `
                    <section class="week-band">
                      <h3>Semana ${index + 1}</h3>
                      <div class="day-grid">
                        ${week.map(renderDayCard).join("")}
                      </div>
                    </section>
                  `
                )
                .join("")
            : `<p class="empty-state">No hay dias que coincidan con los filtros.</p>`
        }
      </div>
    `;
  }

  function renderDayCard(day) {
    const state = getDayProgress(day.id);
    const url = getPlatformUrl(day);
    const tools = [day.platform, ...(day.tools || [])]
      .filter((tool, index, list) => platforms[tool] && platforms[tool].url && list.indexOf(tool) === index);

    return `
      <article class="day-card status-${state.status}">
        <div class="day-card-top">
          <span>${formatDate(day.date, true)}</span>
          <span class="status-pill ${state.status}">${getStatusLabel(state.status)}</span>
        </div>
        <h4>${escapeHtml(day.platform)}</h4>
        <p class="category">${escapeHtml(day.category)}</p>
        <p>${escapeHtml(day.task)}</p>
        <div class="tool-links">
          ${tools.map((tool) => `<a href="${platforms[tool].url}" target="_blank" rel="noopener noreferrer">${escapeHtml(tool)}</a>`).join("")}
        </div>
        <div class="status-actions compact" data-day="${day.id}">
          ${STATUS_OPTIONS.map(
            (status) => `<button class="status-button ${status.id} ${state.status === status.id ? "active" : ""}" data-status="${status.id}">${status.label}</button>`
          ).join("")}
        </div>
        <div class="card-actions">
          <label class="quick-check">
            <input type="checkbox" data-card-complete="${day.id}" ${state.status === "completed" ? "checked" : ""} />
            <span>Completado</span>
          </label>
          <button class="button ghost" data-open-detail="${day.id}">Ver detalle</button>
        </div>
        ${url ? `<a class="external-link" href="${url}" target="_blank" rel="noopener noreferrer">Abrir plataforma</a>` : ""}
      </article>
    `;
  }

  function renderDetail(day) {
    const state = getDayProgress(day.id);
    const url = getPlatformUrl(day);

    return `
      <dialog class="detail-modal" id="day-detail">
        <form method="dialog">
          <button class="icon-close" aria-label="Cerrar detalle">x</button>
        </form>
        <div class="detail-content">
          <span class="status-pill ${state.status}">${getStatusLabel(state.status)}</span>
          <h2>${formatDate(day.date, true)}</h2>
          <p>${escapeHtml(day.category)} · ${escapeHtml(day.platform)}</p>
          ${url ? `<a class="button secondary" href="${url}" target="_blank" rel="noopener noreferrer">Abrir plataforma</a>` : ""}
          ${renderTaskPanel(day, false)}
          <div class="detail-grid">
            <article>
              <h3>Resultado que debo guardar</h3>
              <p>${escapeHtml(day.result)}</p>
            </article>
            <article>
              <h3>Por que sirve</h3>
              <p>${escapeHtml(day.why)}</p>
            </article>
          </div>
          <div class="notes-grid">
            <label>
              Que he aprendido
              <textarea data-note="learned" data-day="${day.id}" rows="4">${escapeHtml(state.notes.learned)}</textarea>
            </label>
            <label>
              Que me ha costado
              <textarea data-note="difficult" data-day="${day.id}" rows="4">${escapeHtml(state.notes.difficult)}</textarea>
            </label>
            <label>
              Siguiente paso
              <textarea data-note="next" data-day="${day.id}" rows="4">${escapeHtml(state.notes.next)}</textarea>
            </label>
          </div>
          <p class="updated-at">${state.updatedAt ? `Ultima actualizacion: ${new Date(state.updatedAt).toLocaleString("es-ES")}` : "Todavia sin cambios guardados."}</p>
        </div>
      </dialog>
    `;
  }

  function renderHelp() {
    return `
      <div class="section-heading">
        <p class="eyebrow">No entiendo que hacer</p>
        <h2>Ayuda rapida por plataforma.</h2>
      </div>
      <div class="help-grid">
        ${helpCard("TryHackMe", "Si una room se bloquea por pago, haz la siguiente gratuita disponible o repasa una anterior. Fijate en IP, DNS, terminal, web y servidores.")}
        ${helpCard("SQLBolt", "Conceptos clave: SELECT elige columnas, WHERE filtra, ORDER BY ordena, JOIN une tablas, INSERT crea datos, UPDATE cambia datos, DELETE borra y GROUP BY agrupa resultados.")}
        ${helpCard("CodeCombat", "Usa JavaScript. Practica variables, if, bucles, funciones, arrays y objetos como piezas pequenas de pensamiento logico.")}
        ${helpCard("Learn Prompting", "Aprende a dar rol, objetivo, contexto, ejemplos y criterios de evaluacion para trabajar mejor con IA.")}
        <article class="help-card">
          <h3>Viernes de proyecto</h3>
          <p>No depende de herramientas de pago ni pruebas de 14 dias. Trabaja con planes gratuitos o local: n8n, Supabase, Google Sheets y Netlify.</p>
          <div class="tool-links">
            ${["n8n", "Supabase", "Google Sheets", "Netlify"].map((tool) => `<a href="${platforms[tool].url}" target="_blank" rel="noopener noreferrer">${tool}</a>`).join("")}
          </div>
        </article>
      </div>
    `;
  }

  function helpCard(platform, extra) {
    return `
      <article class="help-card">
        <h3>${platform}</h3>
        <p>${escapeHtml(platforms[platform].summary)}</p>
        <p>${escapeHtml(extra)}</p>
        <a href="${platforms[platform].url}" target="_blank" rel="noopener noreferrer">Abrir ${platform}</a>
      </article>
    `;
  }

  function renderSolicitudPro() {
    const rows = [
      ["TryHackMe", "Ayuda a entender servidores, redes, seguridad y funcionamiento web."],
      ["SQLBolt", "Ayuda a crear bases de datos, filtrar solicitudes y entender Supabase/PostgreSQL."],
      ["CodeCombat", "Ayuda a mejorar logica para JavaScript, React, backend y automatizaciones."],
      ["Learn Prompting", "Ayuda a crear mejores prompts para Codex, ChatGPT, agentes IA y asistentes."],
      ["Viernes de proyecto", "Convierte lo aprendido en piezas reales para SolicitudPro."],
    ];

    return `
      <div class="section-heading">
        <p class="eyebrow">Como esto ayuda a SolicitudPro</p>
        <h2>El diario no es teoria suelta: alimenta tu SaaS.</h2>
      </div>
      <div class="connection-list">
        ${rows
          .map(
            ([title, body]) => `
              <article class="connection-row">
                <h3>${title}</h3>
                <p>${body}</p>
              </article>
            `
          )
          .join("")}
      </div>
    `;
  }

  function bindEvents() {
    document.querySelectorAll("[data-section]").forEach((button) => {
      button.addEventListener("click", () => setActive(button.dataset.section));
    });

    document.querySelectorAll("[data-status]").forEach((button) => {
      button.addEventListener("click", () => {
        const dayId = button.closest("[data-day]").dataset.day;
        const status = button.dataset.status;
        selectedDayId = dayId;
        updateDay(dayId, { status });

        if (status === "paused") {
          requestAnimationFrame(openDetail);
        }
      });
    });

    document.querySelectorAll("[data-complete]").forEach((button) => {
      button.addEventListener("click", () => {
        updateDay(button.dataset.complete, {
          status: "completed",
          checks: { 0: true, 1: true, 2: true, 3: true },
        });
      });
    });

    document.querySelectorAll("[data-card-complete]").forEach((checkbox) => {
      checkbox.addEventListener("change", () => {
        updateDay(checkbox.dataset.cardComplete, {
          status: checkbox.checked ? "completed" : "pending",
        });
      });
    });

    document.querySelectorAll("[data-check]").forEach((checkbox) => {
      checkbox.addEventListener("change", () => {
        updateNestedDay(checkbox.dataset.day, "checks", checkbox.dataset.check, checkbox.checked);
      });
    });

    document.querySelectorAll("[data-open-detail]").forEach((button) => {
      button.addEventListener("click", () => {
        selectedDayId = button.dataset.openDetail;
        render();
        requestAnimationFrame(openDetail);
      });
    });

    document.querySelectorAll("[data-note]").forEach((textarea) => {
      textarea.addEventListener("input", () => {
        updateNestedDay(textarea.dataset.day, "notes", textarea.dataset.note, textarea.value, false);
      });
    });

    document.querySelectorAll("[data-pause-reason]").forEach((select) => {
      select.addEventListener("change", () => {
        updateDay(select.dataset.pauseReason, { pauseReason: select.value });
      });
    });

    document.querySelectorAll("[data-pause-note]").forEach((textarea) => {
      textarea.addEventListener("input", () => {
        updateDay(textarea.dataset.pauseNote, { pauseNote: textarea.value }, false);
      });
    });

    document.querySelector("[data-filter-search]")?.addEventListener("input", (event) => {
      filters.search = event.target.value;
      render();
      requestAnimationFrame(() => {
        const searchInput = document.querySelector("[data-filter-search]");
        if (searchInput) {
          searchInput.focus();
          searchInput.setSelectionRange(filters.search.length, filters.search.length);
        }
      });
    });

    document.querySelector("[data-filter-platform]")?.addEventListener("change", (event) => {
      filters.platform = event.target.value;
      render();
    });

    document.querySelector("[data-filter-category]")?.addEventListener("change", (event) => {
      filters.category = event.target.value;
      render();
    });

    document.querySelector("[data-filter-status]")?.addEventListener("change", (event) => {
      filters.status = event.target.value;
      render();
    });

    document.querySelector("[data-reset]")?.addEventListener("click", () => {
      const confirmed = window.confirm("Seguro que quieres borrar todo el progreso guardado en este navegador?");
      if (confirmed) {
        progress = {};
        saveProgress();
        render();
      }
    });
  }

  function openDetail() {
    const dialog = document.querySelector("#day-detail");
    if (dialog && !dialog.open) {
      dialog.showModal();
    }
  }

  render();
})();
