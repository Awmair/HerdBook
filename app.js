(() => {
  const DB_NAME = "herdbook-db";
  const STORE_NAME = "kv";
  const FARM_KEY = "farm";
  const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.appdata";
  const CONFIG = window.HERDBOOK_CONFIG || {};

  const app = document.getElementById("app");
  const modalRoot = document.getElementById("modal-root");

  const state = {
    data: null,
    view: "dashboard",
    recordTab: "health",
    selectedGoatId: null,
    search: "",
    drive: {
      token: "",
      busy: false,
      message: "",
      error: "",
    },
  };

  const recordTabs = [
    ["health", "Health"],
    ["breeding", "Breeding"],
    ["kidding", "Kidding"],
    ["weights", "Weights"],
    ["milk", "Milk"],
    ["tasks", "Tasks"],
  ];

  function uid(prefix) {
    return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  }

  function todayIso() {
    return new Date().toISOString().slice(0, 10);
  }

  function addDays(dateText, days) {
    const date = dateText ? new Date(`${dateText}T00:00:00`) : new Date();
    date.setDate(date.getDate() + days);
    return date.toISOString().slice(0, 10);
  }

  function fmtDate(value) {
    if (!value) return "No date";
    return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric" }).format(
      new Date(`${value}T00:00:00`)
    );
  }

  function fmtMoney(value) {
    const amount = Number(value || 0);
    const currency = state.data?.settings?.currency || "USD";
    try {
      return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(amount);
    } catch {
      return `${amount.toFixed(2)} ${currency}`;
    }
  }

  function esc(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function normalizeDate(value) {
    return value || "";
  }

  function defaultFarm() {
    const now = new Date().toISOString();
    return {
      meta: {
        schemaVersion: 1,
        farmId: uid("farm"),
        farmName: "",
        setupComplete: false,
        createdAt: now,
        updatedAt: now,
        localRevision: 0,
      },
      settings: {
        weightUnit: "lb",
        milkUnit: "qt",
        currency: "USD",
        defaultDewormingDays: 90,
        defaultVaccineDays: 365,
      },
      sync: {
        dirty: true,
        lastSyncedAt: "",
        driveFileId: "",
        driveModifiedTime: "",
        accountHint: "",
      },
      goats: [],
      health: [],
      breedings: [],
      kiddings: [],
      weights: [],
      milk: [],
      expenses: [],
      tasks: [],
    };
  }

  function demoFarm() {
    const data = defaultFarm();
    data.meta.farmName = "Cedar Ridge Goats";
    data.meta.setupComplete = true;
    data.goats = [
      {
        id: "goat_marigold",
        name: "Marigold",
        tagId: "A014",
        sex: "Doe",
        breed: "Nubian",
        dob: "2023-02-14",
        status: "Active",
        damId: "",
        sireId: "",
        notes: "Calm milker. Watch body condition before kidding.",
      },
      {
        id: "goat_pepper",
        name: "Pepper",
        tagId: "B002",
        sex: "Buck",
        breed: "Boer",
        dob: "2022-11-03",
        status: "Active",
        damId: "",
        sireId: "",
        notes: "Used for spring breeding group.",
      },
      {
        id: "goat_saffron",
        name: "Saffron",
        tagId: "A018",
        sex: "Doe",
        breed: "Nubian",
        dob: "2024-01-22",
        status: "Active",
        damId: "goat_marigold",
        sireId: "goat_pepper",
        notes: "Growing well.",
      },
    ];
    data.health = [
      {
        id: uid("health"),
        goatId: "goat_marigold",
        type: "Deworming",
        date: addDays(todayIso(), -82),
        nextDue: addDays(todayIso(), 8),
        medicine: "Demo dewormer",
        dosage: "Per label",
        notes: "Sample record only.",
      },
      {
        id: uid("health"),
        goatId: "goat_saffron",
        type: "Vaccine",
        date: addDays(todayIso(), -360),
        nextDue: addDays(todayIso(), 5),
        medicine: "CD&T",
        dosage: "2 ml",
        notes: "Booster due soon.",
      },
    ];
    data.breedings = [
      {
        id: uid("breed"),
        doeId: "goat_marigold",
        buckId: "goat_pepper",
        serviceDate: addDays(todayIso(), -124),
        dueDate: addDays(todayIso(), 26),
        status: "Confirmed",
        notes: "Watch closely during final week.",
      },
    ];
    data.weights = [
      { id: uid("weight"), goatId: "goat_saffron", date: addDays(todayIso(), -60), weight: "42", notes: "" },
      { id: uid("weight"), goatId: "goat_saffron", date: addDays(todayIso(), -30), weight: "48", notes: "" },
      { id: uid("weight"), goatId: "goat_saffron", date: todayIso(), weight: "54", notes: "" },
    ];
    data.expenses = [
      { id: uid("expense"), date: addDays(todayIso(), -12), category: "Feed", amount: "86", goatId: "", notes: "Grain and minerals" },
      { id: uid("expense"), date: addDays(todayIso(), -7), category: "Medicine", amount: "34", goatId: "goat_saffron", notes: "CD&T supply" },
    ];
    data.tasks = [
      { id: uid("task"), title: "Prepare kidding pen", dueDate: addDays(todayIso(), 18), type: "Kidding", goatId: "goat_marigold", done: false, notes: "" },
      { id: uid("task"), title: "Review mineral feeder", dueDate: todayIso(), type: "Barn", goatId: "", done: false, notes: "" },
    ];
    return data;
  }

  function goatName(id) {
    if (!id) return "Unassigned";
    return state.data.goats.find((goat) => goat.id === id)?.name || "Unknown goat";
  }

  function goatOptions(includeBlank = true) {
    const blank = includeBlank ? [{ value: "", label: "None" }] : [];
    return blank.concat(state.data.goats.map((goat) => ({ value: goat.id, label: `${goat.name} (${goat.tagId || "no tag"})` })));
  }

  function openDb() {
    return new Promise((resolve, reject) => {
      if (!("indexedDB" in window)) {
        resolve(null);
        return;
      }
      const request = indexedDB.open(DB_NAME, 1);
      request.onupgradeneeded = () => request.result.createObjectStore(STORE_NAME);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async function readStoredFarm() {
    try {
      const db = await openDb();
      if (!db) {
        const raw = localStorage.getItem("herdbook-farm");
        return raw ? JSON.parse(raw) : null;
      }
      return await new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, "readonly");
        const request = tx.objectStore(STORE_NAME).get(FARM_KEY);
        request.onsuccess = () => resolve(request.result || null);
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      console.warn("Falling back after storage read failed", error);
      const raw = localStorage.getItem("herdbook-farm");
      return raw ? JSON.parse(raw) : null;
    }
  }

  async function writeStoredFarm(data) {
    try {
      const db = await openDb();
      if (!db) {
        localStorage.setItem("herdbook-farm", JSON.stringify(data));
        return;
      }
      await new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, "readwrite");
        tx.objectStore(STORE_NAME).put(data, FARM_KEY);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    } catch (error) {
      console.warn("Falling back after storage write failed", error);
      localStorage.setItem("herdbook-farm", JSON.stringify(data));
    }
  }

  async function persist({ dirty = true, toastText = "" } = {}) {
    state.data.meta.updatedAt = new Date().toISOString();
    if (dirty) {
      state.data.meta.localRevision += 1;
      state.data.sync.dirty = true;
    }
    await writeStoredFarm(state.data);
    render();
    if (toastText) toast(toastText);
  }

  function toast(message) {
    const node = document.createElement("div");
    node.className = "toast";
    node.textContent = message;
    document.body.appendChild(node);
    window.setTimeout(() => node.remove(), 2600);
  }

  function syncLabel() {
    if (state.drive.busy) return ["Syncing", "warn"];
    if (state.drive.error) return ["Sync issue", "danger"];
    if (state.data?.sync?.dirty) return ["Unsynced", "warn"];
    return ["Synced", "clean"];
  }

  function render() {
    if (!state.data) return;
    parseRoute();
    if (!state.data.meta.setupComplete) {
      app.innerHTML = renderSetup();
      bindSetup();
      return;
    }

    const [label, status] = syncLabel();
    app.innerHTML = `
      <header class="topbar">
        <div class="brand-mark"><img src="assets/herdbook-open-book-goat-icon-concept.png" alt="HerdBook icon" /></div>
        <div class="topbar-title">
          <p class="eyebrow">${esc(state.data.meta.farmName || "HerdBook")}</p>
          <h1>${esc(titleForView())}</h1>
          <p class="topbar-subtitle">${esc(subtitleForView())}</p>
        </div>
        <button class="sync-pill" data-action="goto-sync" type="button">
          <span class="sync-dot ${status}"></span>${label}
        </button>
      </header>
      ${renderNav()}
      <main>${renderView()}</main>
    `;
    bindApp();
  }

  function titleForView() {
    return {
      dashboard: "HerdBook",
      herd: "Herd",
      records: "Records",
      finance: "Finance",
      sync: "Sync",
    }[state.view] || "HerdBook";
  }

  function subtitleForView() {
    return {
      dashboard: state.data.sync.dirty ? "Unsynced changes on this iPhone" : `Last synced ${lastSyncedText()}`,
      herd: "Profiles, tags, lineage, and notes",
      records: "Health, breeding, milk, weights, and tasks",
      finance: "Purchases, sales, and simple net tracking",
      sync: "Google Drive backup and restore",
    }[state.view] || "";
  }

  function renderSetup() {
    const googleReady = Boolean(CONFIG.googleClientId);
    return `
      <section class="setup">
        <div class="setup-panel">
          <div class="setup-visual">
            <p class="eyebrow">Drive-first goat records</p>
            <h1>HerdBook</h1>
          </div>
          <div class="setup-body">
            <h2>Set up your farm</h2>
            <p class="muted">Your records save on this iPhone first. After Google is configured, Save & Sync stores the main farm file in your own Google Drive.</p>
            <form id="setup-form" class="grid">
              <div class="field">
                <label for="farmName">Farm name</label>
                <input id="farmName" name="farmName" placeholder="Example: Cedar Ridge Goats" required />
              </div>
              <div class="grid two">
                <div class="field">
                  <label for="weightUnit">Weight unit</label>
                  <select id="weightUnit" name="weightUnit">
                    <option value="lb">lb</option>
                    <option value="kg">kg</option>
                  </select>
                </div>
                <div class="field">
                  <label for="currency">Currency</label>
                  <select id="currency" name="currency">
                    <option value="USD">USD</option>
                    <option value="PKR">PKR</option>
                    <option value="GBP">GBP</option>
                    <option value="EUR">EUR</option>
                    <option value="CAD">CAD</option>
                    <option value="AUD">AUD</option>
                  </select>
                </div>
              </div>
              <button class="btn brass" type="submit">Create Farm</button>
              <button class="btn secondary" data-action="load-demo" type="button">Preview with Demo Data</button>
            </form>
            <p class="muted">${googleReady ? "Google Drive setup is ready to test." : "Google Drive setup still needs a browser OAuth client ID."}</p>
          </div>
        </div>
      </section>
    `;
  }

  function renderNav() {
    const items = [
      ["dashboard", "Today"],
      ["herd", "Herd"],
      ["records", "Records"],
      ["finance", "Finance"],
      ["sync", "Sync"],
    ];
    return `
      <nav class="bottom-nav" aria-label="HerdBook sections">
        ${items
          .map(
            ([id, label]) =>
              `<button type="button" class="${state.view === id ? "active" : ""}" data-view="${id}"><span class="nav-icon">${navIcon(id)}</span><span>${esc(label)}</span></button>`
          )
          .join("")}
      </nav>
    `;
  }

  function navIcon(id) {
    const attrs = `class="nav-svg" viewBox="0 0 24 24" aria-hidden="true" focusable="false"`;
    const common = `fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"`;
    const icons = {
      dashboard: `<svg ${attrs}><rect ${common} x="5" y="5" width="14" height="14" rx="3"></rect><path ${common} d="M8 9h8"></path><path ${common} d="M9 4v3"></path><path ${common} d="M15 4v3"></path><path ${common} d="m9 13 2 2 4-4"></path><circle class="nav-accent" cx="17.2" cy="17" r="1.8"></circle></svg>`,
      herd: `<svg ${attrs}><path ${common} d="M7.5 10.2c0-3.1 2-5.2 4.5-5.2s4.5 2.1 4.5 5.2v2.6c0 3.2-2 5.2-4.5 5.2s-4.5-2-4.5-5.2z"></path><path ${common} d="M8.3 9.4 4.8 7.8c.1 2.7 1.2 4.4 3 5"></path><path ${common} d="m15.7 9.4 3.5-1.6c-.1 2.7-1.2 4.4-3 5"></path><path ${common} d="M10.1 13.2h.1"></path><path ${common} d="M13.8 13.2h.1"></path><path ${common} d="M10.8 16h2.4"></path><circle class="nav-accent" cx="12" cy="10" r="1.4"></circle></svg>`,
      records: `<svg ${attrs}><path ${common} d="M5 6.5c2.8-.9 5.1-.5 7 1.1 1.9-1.6 4.2-2 7-1.1v12c-2.8-.9-5.1-.5-7 1.1-1.9-1.6-4.2-2-7-1.1z"></path><path ${common} d="M12 7.6v12"></path><path ${common} d="M8 10h2"></path><path ${common} d="M8 13h2"></path><path ${common} d="M14 10h2"></path><path ${common} d="M14 13h2"></path><circle class="nav-accent" cx="18" cy="17" r="1.6"></circle></svg>`,
      finance: `<svg ${attrs}><rect ${common} x="5" y="6" width="14" height="12" rx="3"></rect><path ${common} d="M8 10h5"></path><path ${common} d="M8 14h3"></path><circle ${common} cx="16" cy="14" r="2.2"></circle><path ${common} d="M16 12.8v2.4"></path><circle class="nav-accent" cx="8" cy="17.5" r="1.5"></circle></svg>`,
      sync: `<svg ${attrs}><path ${common} d="M8.1 17.2H7.5a3.4 3.4 0 0 1-.3-6.8 4.9 4.9 0 0 1 9.3-1.7 3.9 3.9 0 0 1 .2 7.7h-.8"></path><path ${common} d="M9 15.8c1.3 1.4 3.2 1.8 4.9.9"></path><path ${common} d="m13.4 14.8.7 1.9-1.9.7"></path><path ${common} d="M15 12.1c-1.3-1.4-3.2-1.8-4.9-.9"></path><path ${common} d="m10.6 13.1-.7-1.9 1.9-.7"></path><circle class="nav-accent" cx="17.5" cy="8" r="1.6"></circle></svg>`,
    };
    return icons[id] || "";
  }

  function renderView() {
    if (state.view === "herd") return renderHerd();
    if (state.view === "records") return renderRecords();
    if (state.view === "finance") return renderFinance();
    if (state.view === "sync") return renderSync();
    return renderDashboard();
  }

  function renderDashboard() {
    const goats = state.data.goats;
    const activeGoats = goats.filter((goat) => goat.status === "Active");
    const does = activeGoats.filter((goat) => goat.sex === "Doe");
    const bucks = activeGoats.filter((goat) => goat.sex === "Buck");
    const kids = activeGoats.filter((goat) => goat.sex === "Kid");
    const dueHealth = state.data.health.filter((item) => isDueSoon(item.nextDue, 14));
    const dueTasks = state.data.tasks.filter((task) => !task.done && isDueSoon(task.dueDate, 14));
    const kiddingSoon = state.data.breedings.filter((item) => item.status !== "Kidded" && isDueSoon(item.dueDate, 45));
    const recentExpenses = [...state.data.expenses].sort((a, b) => (b.date || "").localeCompare(a.date || "")).slice(0, 4);

    return `
      <section class="dashboard-hero">
        <div>
          <p class="eyebrow">Today</p>
          <h2>${esc(state.data.meta.farmName)}</h2>
          <p>${state.data.sync.dirty ? "Local changes are waiting for Save & Sync." : `Last synced ${lastSyncedText()}.`}</p>
        </div>
        <button class="btn brass small" data-action="goto-sync" type="button">${state.data.sync.dirty ? "Save & Sync" : "Sync"}</button>
      </section>
      <section class="stats-grid">
        ${stat(activeGoats.length, "Active herd", "H")}
        ${stat(does.length, "Does", "D")}
        ${stat(bucks.length, "Bucks", "B")}
        ${stat(kids.length, "Kids", "K")}
      </section>
      <section class="desktop-layout">
        <div>
          <section class="panel">
            <div class="section-head">
              <div>
                <p class="section-kicker">Next 14 days</p>
                <h2>Due Today</h2>
              </div>
              <button class="btn small" data-form="task" type="button">Add Task</button>
            </div>
            ${renderDueList(dueHealth, dueTasks)}
          </section>
          <section class="panel">
            <div class="section-head">
              <div>
                <p class="section-kicker">Next 45 days</p>
                <h2>Kidding Soon</h2>
              </div>
              <button class="btn small secondary" data-form="breeding" type="button">Add Breeding</button>
            </div>
            ${renderKiddingSoon(kiddingSoon)}
          </section>
        </div>
        <div>
          <section class="panel">
            <div class="section-head compact">
              <div>
                <p class="section-kicker">Finance</p>
                <h2>Recent Expenses</h2>
              </div>
            </div>
            ${recentExpenses.length ? `<div class="list">${recentExpenses.map(renderExpenseItem).join("")}</div>` : empty("No expenses yet.")}
          </section>
          <section class="panel">
            <div class="section-head compact">
              <div>
                <p class="section-kicker">Growth</p>
                <h2>Weight Trend</h2>
              </div>
            </div>
            ${renderMiniWeightChart()}
          </section>
        </div>
      </section>
    `;
  }

  function stat(value, label, icon = "") {
    return `<div class="stat">${icon ? `<span class="stat-icon">${esc(icon)}</span>` : ""}<strong>${esc(value)}</strong><span>${esc(label)}</span></div>`;
  }

  function isDueSoon(dateText, days) {
    if (!dateText) return false;
    const now = new Date(`${todayIso()}T00:00:00`).getTime();
    const due = new Date(`${dateText}T00:00:00`).getTime();
    return due <= now + days * 86400000;
  }

  function renderDueList(health, tasks) {
    const items = [
      ...health.map((item) => ({
        title: `${item.type} due for ${goatName(item.goatId)}`,
        date: item.nextDue,
        meta: item.medicine || "Health",
        kind: "health",
      })),
      ...tasks.map((task) => ({
        title: task.title,
        date: task.dueDate,
        meta: `${task.type || "Task"}${task.goatId ? ` - ${goatName(task.goatId)}` : ""}`,
        kind: "task",
      })),
    ].sort((a, b) => (a.date || "").localeCompare(b.date || ""));
    if (!items.length) return empty("Nothing due in the next two weeks.");
    return `<div class="list">${items
      .map(
        (item) => `
          <div class="item">
            <div class="item-row">
              <p class="item-title">${esc(item.title)}</p>
              <span class="tag ${item.kind === "health" ? "warn" : "neutral"}">${esc(fmtDate(item.date))}</span>
            </div>
            <div class="meta"><span>${esc(item.meta)}</span></div>
          </div>
        `
      )
      .join("")}</div>`;
  }

  function renderKiddingSoon(items) {
    if (!items.length) return empty("No kidding windows in the next 45 days.");
    return `<div class="list">${items
      .map(
        (item) => `
          <div class="item">
            <div class="item-row">
              <p class="item-title">${esc(goatName(item.doeId))}</p>
              <span class="tag warn">${esc(fmtDate(item.dueDate))}</span>
            </div>
            <div class="meta"><span>Bred to ${esc(goatName(item.buckId))}</span><span>${esc(item.status)}</span></div>
          </div>
        `
      )
      .join("")}</div>`;
  }

  function renderMiniWeightChart() {
    const weights = state.data.weights
      .map((item) => Number(item.weight))
      .filter((value) => Number.isFinite(value))
      .slice(-8);
    if (!weights.length) return empty("Add weights to see a quick trend.");
    const max = Math.max(...weights, 1);
    return `<div class="mini-chart">${weights
      .map((value) => `<span style="height:${Math.max(6, (value / max) * 48)}px"></span>`)
      .join("")}</div>`;
  }

  function renderHerd() {
    const query = state.search.trim().toLowerCase();
    const goats = state.data.goats.filter((goat) => {
      if (!query) return true;
      return [goat.name, goat.tagId, goat.sex, goat.breed, goat.status].join(" ").toLowerCase().includes(query);
    });
    const selected = state.data.goats.find((goat) => goat.id === state.selectedGoatId) || goats[0] || null;
    return `
      <section class="toolbar">
        <div class="toolbar-left">
          <h2>Herd</h2>
        </div>
        <div class="toolbar-right">
          <button class="btn" data-form="goat" type="button">Add Goat</button>
        </div>
      </section>
      <section class="filter-row">
        <input class="search" data-search="herd" value="${esc(state.search)}" placeholder="Search name, tag, breed..." />
        <button class="btn secondary icon" data-action="clear-search" type="button" aria-label="Clear search">X</button>
      </section>
      <section class="desktop-layout">
        <div class="panel">
          ${goats.length ? `<div class="list">${goats.map(renderGoatItem).join("")}</div>` : empty("No goats match this search.")}
        </div>
        <div>${selected ? renderGoatProfile(selected) : `<section class="panel">${empty("Add a goat to start the herd book.")}</section>`}</div>
      </section>
    `;
  }

  function renderGoatItem(goat) {
    return `
      <button class="item" data-select-goat="${esc(goat.id)}" type="button">
        <div class="item-row">
          <p class="item-title">${esc(goat.name || "Unnamed goat")}</p>
          <span class="tag">${esc(goat.tagId || "No tag")}</span>
        </div>
        <div class="meta">
          <span>${esc(goat.sex || "Unknown")}</span>
          <span>${esc(goat.breed || "No breed")}</span>
          <span>${esc(goat.status || "Active")}</span>
        </div>
      </button>
    `;
  }

  function renderGoatProfile(goat) {
    const events = [
      ...state.data.health.filter((item) => item.goatId === goat.id).map((item) => ({ date: item.date, title: item.type, meta: item.medicine || "Health" })),
      ...state.data.breedings.filter((item) => item.doeId === goat.id || item.buckId === goat.id).map((item) => ({ date: item.serviceDate, title: "Breeding", meta: item.status })),
      ...state.data.weights.filter((item) => item.goatId === goat.id).map((item) => ({ date: item.date, title: "Weight", meta: `${item.weight} ${state.data.settings.weightUnit}` })),
      ...state.data.milk.filter((item) => item.goatId === goat.id).map((item) => ({ date: item.date, title: "Milk", meta: `${milkTotal(item)} ${state.data.settings.milkUnit}` })),
    ].sort((a, b) => (b.date || "").localeCompare(a.date || ""));
    return `
      <section class="panel">
        <div class="toolbar">
          <div>
            <p class="eyebrow" style="color: var(--muted);">${esc(goat.tagId || "No tag")}</p>
            <h2>${esc(goat.name || "Unnamed goat")}</h2>
          </div>
          <button class="btn small secondary" data-edit-goat="${esc(goat.id)}" type="button">Edit</button>
        </div>
        <div class="meta">
          <span class="tag">${esc(goat.sex)}</span>
          <span class="tag neutral">${esc(goat.breed || "No breed")}</span>
          <span class="tag ${goat.status === "Active" ? "" : "warn"}">${esc(goat.status || "Active")}</span>
        </div>
        <p class="muted" style="margin-top: 12px;">Born ${esc(fmtDate(goat.dob))}. Dam: ${esc(goatName(goat.damId))}. Sire: ${esc(goatName(goat.sireId))}.</p>
        <p>${esc(goat.notes || "No notes yet.")}</p>
        <div class="toolbar">
          <button class="btn small" data-form="health" data-goat="${esc(goat.id)}" type="button">Health</button>
          <button class="btn small secondary" data-form="weight" data-goat="${esc(goat.id)}" type="button">Weight</button>
          <button class="btn small secondary" data-action="show-qr" data-goat="${esc(goat.id)}" type="button">QR Link</button>
        </div>
      </section>
      <section class="panel">
        <h2>Timeline</h2>
        ${events.length ? `<div class="list">${events.slice(0, 8).map(renderTimelineItem).join("")}</div>` : empty("No events logged for this goat.")}
      </section>
    `;
  }

  function renderTimelineItem(item) {
    return `
      <div class="item">
        <div class="item-row">
          <p class="item-title">${esc(item.title)}</p>
          <span class="tag neutral">${esc(fmtDate(item.date))}</span>
        </div>
        <div class="meta"><span>${esc(item.meta || "")}</span></div>
      </div>
    `;
  }

  function renderRecords() {
    const activeTab = state.recordTab;
    return `
      <section class="toolbar">
        <h2>Records</h2>
        <button class="btn" data-form="${esc(tabToForm(activeTab))}" type="button">Add</button>
      </section>
      <section class="segmented">
        ${recordTabs
          .map(([id, label]) => `<button class="${activeTab === id ? "active" : ""}" data-record-tab="${id}" type="button">${label}</button>`)
          .join("")}
      </section>
      <section class="panel" style="margin-top: 12px;">
        ${renderRecordTab(activeTab)}
      </section>
    `;
  }

  function tabToForm(tab) {
    if (tab === "weights") return "weight";
    if (tab === "tasks") return "task";
    return tab;
  }

  function renderRecordTab(tab) {
    if (tab === "health") {
      const items = [...state.data.health].sort((a, b) => (b.date || "").localeCompare(a.date || ""));
      return items.length ? `<div class="list">${items.map(renderHealthItem).join("")}</div>` : empty("No health records yet.");
    }
    if (tab === "breeding") {
      const items = [...state.data.breedings].sort((a, b) => (b.serviceDate || "").localeCompare(a.serviceDate || ""));
      return items.length ? `<div class="list">${items.map(renderBreedingItem).join("")}</div>` : empty("No breeding records yet.");
    }
    if (tab === "kidding") {
      const items = [...state.data.kiddings].sort((a, b) => (b.date || "").localeCompare(a.date || ""));
      return items.length ? `<div class="list">${items.map(renderKiddingItem).join("")}</div>` : empty("No kidding records yet.");
    }
    if (tab === "weights") {
      const items = [...state.data.weights].sort((a, b) => (b.date || "").localeCompare(a.date || ""));
      return items.length ? `<div class="list">${items.map(renderWeightItem).join("")}</div>` : empty("No weights yet.");
    }
    if (tab === "milk") {
      const items = [...state.data.milk].sort((a, b) => (b.date || "").localeCompare(a.date || ""));
      return items.length ? `<div class="list">${items.map(renderMilkItem).join("")}</div>` : empty("No milk entries yet.");
    }
    const tasks = [...state.data.tasks].sort((a, b) => Number(a.done) - Number(b.done) || (a.dueDate || "").localeCompare(b.dueDate || ""));
    return tasks.length ? `<div class="list">${tasks.map(renderTaskItem).join("")}</div>` : empty("No tasks yet.");
  }

  function renderHealthItem(item) {
    return `
      <div class="item">
        <div class="item-row"><p class="item-title">${esc(item.type)} - ${esc(goatName(item.goatId))}</p><span class="tag">${esc(fmtDate(item.date))}</span></div>
        <div class="meta"><span>${esc(item.medicine || "No medicine")}</span><span>Next: ${esc(fmtDate(item.nextDue))}</span></div>
      </div>
    `;
  }

  function renderBreedingItem(item) {
    return `
      <div class="item">
        <div class="item-row"><p class="item-title">${esc(goatName(item.doeId))} x ${esc(goatName(item.buckId))}</p><span class="tag warn">${esc(item.status)}</span></div>
        <div class="meta"><span>Served ${esc(fmtDate(item.serviceDate))}</span><span>Due ${esc(fmtDate(item.dueDate))}</span></div>
      </div>
    `;
  }

  function renderKiddingItem(item) {
    return `
      <div class="item">
        <div class="item-row"><p class="item-title">${esc(goatName(item.doeId))}</p><span class="tag">${esc(fmtDate(item.date))}</span></div>
        <div class="meta"><span>${esc(item.kidsCount || 0)} kids</span><span>${esc(item.notes || "")}</span></div>
      </div>
    `;
  }

  function renderWeightItem(item) {
    return `
      <div class="item">
        <div class="item-row"><p class="item-title">${esc(goatName(item.goatId))}</p><span class="tag">${esc(item.weight)} ${esc(state.data.settings.weightUnit)}</span></div>
        <div class="meta"><span>${esc(fmtDate(item.date))}</span><span>${esc(item.notes || "")}</span></div>
      </div>
    `;
  }

  function milkTotal(item) {
    return (Number(item.morning || 0) + Number(item.evening || 0)).toFixed(2).replace(/\.00$/, "");
  }

  function renderMilkItem(item) {
    return `
      <div class="item">
        <div class="item-row"><p class="item-title">${esc(goatName(item.goatId))}</p><span class="tag">${esc(milkTotal(item))} ${esc(state.data.settings.milkUnit)}</span></div>
        <div class="meta"><span>${esc(fmtDate(item.date))}</span><span>${esc(item.notes || "")}</span></div>
      </div>
    `;
  }

  function renderTaskItem(item) {
    return `
      <div class="item">
        <div class="item-row">
          <p class="item-title">${esc(item.title)}</p>
          <button class="btn small ${item.done ? "secondary" : ""}" data-toggle-task="${esc(item.id)}" type="button">${item.done ? "Done" : "Mark Done"}</button>
        </div>
        <div class="meta"><span>${esc(item.type || "Task")}</span><span>${esc(fmtDate(item.dueDate))}</span><span>${esc(goatName(item.goatId))}</span></div>
      </div>
    `;
  }

  function renderFinance() {
    const expenses = [...state.data.expenses].sort((a, b) => (b.date || "").localeCompare(a.date || ""));
    const spent = expenses.reduce((sum, item) => sum + Number(item.amount || 0), 0);
    const purchases = expenses.filter((item) => item.category === "Purchase").reduce((sum, item) => sum + Number(item.amount || 0), 0);
    const sales = expenses.filter((item) => item.category === "Sale").reduce((sum, item) => sum + Number(item.amount || 0), 0);
    return `
      <section class="toolbar">
        <h2>Finance</h2>
        <button class="btn" data-form="expense" type="button">Add Entry</button>
      </section>
      <section class="stats-grid">
        ${stat(fmtMoney(spent), "All entries")}
        ${stat(fmtMoney(purchases), "Purchases")}
        ${stat(fmtMoney(sales), "Sales")}
        ${stat(fmtMoney(sales - (spent - sales)), "Simple net")}
      </section>
      <section class="panel" style="margin-top: 14px;">
        ${expenses.length ? `<div class="list">${expenses.map(renderExpenseItem).join("")}</div>` : empty("No finance entries yet.")}
      </section>
    `;
  }

  function renderExpenseItem(item) {
    return `
      <div class="item">
        <div class="item-row"><p class="item-title">${esc(item.category)}</p><span class="tag ${item.category === "Sale" ? "" : "warn"}">${esc(fmtMoney(item.amount))}</span></div>
        <div class="meta"><span>${esc(fmtDate(item.date))}</span><span>${esc(goatName(item.goatId))}</span><span>${esc(item.notes || "")}</span></div>
      </div>
    `;
  }

  function renderSync() {
    const googleReady = Boolean(CONFIG.googleClientId);
    const signedIn = Boolean(state.drive.token);
    return `
      <section class="panel">
        <h2>Save & Sync</h2>
        <div class="sync-card">
          <div class="item-row">
            <p class="item-title">${state.data.sync.dirty ? "Unsynced local changes" : "Drive copy is current"}</p>
            <span class="tag ${state.data.sync.dirty ? "warn" : ""}">${esc(lastSyncedText())}</span>
          </div>
          <p class="muted">Edits always save on this iPhone first. Tap Save & Sync and wait for Synced before closing the app.</p>
          <p class="muted">Restore from Drive replaces this phone's local copy with the HerdBook file already saved in Google Drive. Use it on a new phone, after clearing Safari data, or when recovering from Drive.</p>
          <div class="toolbar">
            <button class="btn brass" data-action="save-sync" type="button" ${googleReady ? "" : "disabled"}>Save & Sync</button>
            <button class="btn ${signedIn ? "" : "secondary"}" data-action="google-signin" type="button" ${googleReady && !signedIn ? "" : "disabled"}>${signedIn ? "Signed In" : "Sign In"}</button>
            <button class="btn secondary" data-action="load-drive" type="button" ${googleReady ? "" : "disabled"}>Restore from Drive</button>
          </div>
          ${state.drive.message ? `<p>${esc(state.drive.message)}</p>` : ""}
          ${state.drive.error ? `<p class="tag danger">${esc(state.drive.error)}</p>` : ""}
          ${googleReady ? "" : `<p class="muted">Google Drive is not ready yet.</p>`}
        </div>
      </section>
      <section class="panel">
        <h2>Backup</h2>
        <div class="toolbar">
          <button class="btn secondary" data-action="export-json" type="button">Export JSON</button>
          <button class="btn secondary" data-action="export-goats" type="button">Export Goats CSV</button>
          <label class="btn secondary" for="import-file">Import JSON</label>
          <input id="import-file" type="file" accept="application/json" hidden />
        </div>
      </section>
    `;
  }

  function lastSyncedText() {
    if (!state.data.sync.lastSyncedAt) return "Never synced";
    return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(state.data.sync.lastSyncedAt));
  }

  function empty(message) {
    return `<div class="empty">${esc(message)}</div>`;
  }

  function bindSetup() {
    document.getElementById("setup-form")?.addEventListener("submit", async (event) => {
      event.preventDefault();
      const form = new FormData(event.currentTarget);
      state.data.meta.farmName = form.get("farmName").trim();
      state.data.meta.setupComplete = true;
      state.data.settings.weightUnit = form.get("weightUnit");
      state.data.settings.currency = form.get("currency");
      await persist({ toastText: "Farm created on this iPhone." });
    });
    document.querySelector("[data-action='load-demo']")?.addEventListener("click", async () => {
      state.data = demoFarm();
      await persist({ toastText: "Demo data loaded." });
    });
  }

  function bindApp() {
    document.querySelectorAll("[data-view]").forEach((button) => {
      button.addEventListener("click", () => {
        state.view = button.dataset.view;
        render();
      });
    });
    document.querySelector("[data-action='goto-sync']")?.addEventListener("click", () => {
      state.view = "sync";
      render();
    });
    document.querySelectorAll("[data-form]").forEach((button) => {
      button.addEventListener("click", () => openRecordForm(button.dataset.form, button.dataset.goat || ""));
    });
    document.querySelector("[data-search='herd']")?.addEventListener("input", (event) => {
      const cursor = event.target.selectionStart;
      state.search = event.target.value;
      render();
      const input = document.querySelector("[data-search='herd']");
      if (input) {
        input.focus();
        input.setSelectionRange(cursor, cursor);
      }
    });
    document.querySelector("[data-action='clear-search']")?.addEventListener("click", () => {
      state.search = "";
      render();
    });
    document.querySelectorAll("[data-select-goat]").forEach((button) => {
      button.addEventListener("click", () => {
        state.selectedGoatId = button.dataset.selectGoat;
        window.location.hash = `goat/${state.selectedGoatId}`;
        render();
      });
    });
    document.querySelectorAll("[data-edit-goat]").forEach((button) => {
      button.addEventListener("click", () => openGoatForm(state.data.goats.find((goat) => goat.id === button.dataset.editGoat)));
    });
    document.querySelectorAll("[data-record-tab]").forEach((button) => {
      button.addEventListener("click", () => {
        state.recordTab = button.dataset.recordTab;
        render();
      });
    });
    document.querySelectorAll("[data-toggle-task]").forEach((button) => {
      button.addEventListener("click", async () => {
        const task = state.data.tasks.find((item) => item.id === button.dataset.toggleTask);
        if (task) {
          task.done = !task.done;
          await persist({ toastText: task.done ? "Task completed." : "Task reopened." });
        }
      });
    });
    document.querySelector("[data-action='show-qr']")?.addEventListener("click", (event) => showQrLink(event.currentTarget.dataset.goat));
    document.querySelector("[data-action='export-json']")?.addEventListener("click", exportJson);
    document.querySelector("[data-action='export-goats']")?.addEventListener("click", exportGoatsCsv);
    document.getElementById("import-file")?.addEventListener("change", importJson);
    document.querySelector("[data-action='google-signin']")?.addEventListener("click", signInToGoogle);
    document.querySelector("[data-action='save-sync']")?.addEventListener("click", saveAndSync);
    document.querySelector("[data-action='load-drive']")?.addEventListener("click", loadFromDrive);
  }

  function openRecordForm(type, goatId = "") {
    if (type === "goat") return openGoatForm();
    if (type === "health") return openHealthForm(goatId);
    if (type === "breeding") return openBreedingForm(goatId);
    if (type === "kidding") return openKiddingForm(goatId);
    if (type === "weight") return openWeightForm(goatId);
    if (type === "milk") return openMilkForm(goatId);
    if (type === "expense") return openExpenseForm(goatId);
    if (type === "task") return openTaskForm(goatId);
  }

  function openGoatForm(existing = null) {
    openForm({
      title: existing ? "Edit Goat" : "Add Goat",
      values: existing || { status: "Active", sex: "Doe" },
      fields: [
        { name: "name", label: "Name", required: true },
        { name: "tagId", label: "Tag ID" },
        { name: "sex", label: "Sex", type: "select", options: ["Doe", "Buck", "Kid", "Wether", "Unknown"] },
        { name: "breed", label: "Breed" },
        { name: "dob", label: "Date of birth", type: "date" },
        { name: "status", label: "Status", type: "select", options: ["Active", "Sold", "Deceased", "Archived"] },
        { name: "damId", label: "Dam", type: "select", options: goatOptions(true) },
        { name: "sireId", label: "Sire", type: "select", options: goatOptions(true) },
        { name: "notes", label: "Notes", type: "textarea" },
      ],
      onSave: async (values) => {
        if (existing) Object.assign(existing, values);
        else state.data.goats.push({ id: uid("goat"), ...values });
        await persist({ toastText: existing ? "Goat updated." : "Goat added." });
      },
    });
  }

  function openHealthForm(goatId = "") {
    openForm({
      title: "Add Health Record",
      values: { goatId, type: "Deworming", date: todayIso(), nextDue: addDays(todayIso(), 90) },
      fields: [
        { name: "goatId", label: "Goat", type: "select", options: goatOptions(false), required: true },
        { name: "type", label: "Type", type: "select", options: ["Vaccine", "Deworming", "Illness", "Treatment", "Vet Visit", "Other"] },
        { name: "date", label: "Date given", type: "date" },
        { name: "nextDue", label: "Next due", type: "date" },
        { name: "medicine", label: "Medicine" },
        { name: "dosage", label: "Dosage" },
        { name: "notes", label: "Notes", type: "textarea" },
      ],
      onSave: async (values) => {
        state.data.health.push({ id: uid("health"), ...values });
        await persist({ toastText: "Health record added." });
      },
    });
  }

  function openBreedingForm(goatId = "") {
    openForm({
      title: "Add Breeding Record",
      values: { doeId: goatId, serviceDate: todayIso(), dueDate: addDays(todayIso(), 150), status: "Observed" },
      fields: [
        { name: "doeId", label: "Doe", type: "select", options: goatOptions(false), required: true },
        { name: "buckId", label: "Buck", type: "select", options: goatOptions(false), required: true },
        { name: "serviceDate", label: "Service date", type: "date" },
        { name: "dueDate", label: "Expected kidding", type: "date" },
        { name: "status", label: "Status", type: "select", options: ["Observed", "Confirmed", "Open", "Kidded"] },
        { name: "notes", label: "Notes", type: "textarea" },
      ],
      onSave: async (values) => {
        state.data.breedings.push({ id: uid("breed"), ...values });
        await persist({ toastText: "Breeding record added." });
      },
    });
  }

  function openKiddingForm(goatId = "") {
    openForm({
      title: "Add Kidding Record",
      values: { doeId: goatId, date: todayIso(), kidsCount: "1" },
      fields: [
        { name: "doeId", label: "Doe", type: "select", options: goatOptions(false), required: true },
        { name: "date", label: "Birth date", type: "date" },
        { name: "kidsCount", label: "Number of kids", type: "number" },
        { name: "notes", label: "Kids, weights, complications", type: "textarea" },
      ],
      onSave: async (values) => {
        state.data.kiddings.push({ id: uid("kid"), ...values });
        await persist({ toastText: "Kidding record added." });
      },
    });
  }

  function openWeightForm(goatId = "") {
    openForm({
      title: "Add Weight",
      values: { goatId, date: todayIso() },
      fields: [
        { name: "goatId", label: "Goat", type: "select", options: goatOptions(false), required: true },
        { name: "date", label: "Date", type: "date" },
        { name: "weight", label: `Weight (${state.data.settings.weightUnit})`, type: "number", required: true },
        { name: "notes", label: "Notes", type: "textarea" },
      ],
      onSave: async (values) => {
        state.data.weights.push({ id: uid("weight"), ...values });
        await persist({ toastText: "Weight added." });
      },
    });
  }

  function openMilkForm(goatId = "") {
    openForm({
      title: "Add Milk Entry",
      values: { goatId, date: todayIso(), morning: "0", evening: "0" },
      fields: [
        { name: "goatId", label: "Goat", type: "select", options: goatOptions(false), required: true },
        { name: "date", label: "Date", type: "date" },
        { name: "morning", label: `Morning (${state.data.settings.milkUnit})`, type: "number" },
        { name: "evening", label: `Evening (${state.data.settings.milkUnit})`, type: "number" },
        { name: "notes", label: "Notes", type: "textarea" },
      ],
      onSave: async (values) => {
        state.data.milk.push({ id: uid("milk"), ...values });
        await persist({ toastText: "Milk entry added." });
      },
    });
  }

  function openExpenseForm(goatId = "") {
    openForm({
      title: "Add Finance Entry",
      values: { date: todayIso(), category: "Feed", goatId },
      fields: [
        { name: "date", label: "Date", type: "date" },
        { name: "category", label: "Category", type: "select", options: ["Feed", "Vet", "Medicine", "Equipment", "Labor", "Purchase", "Sale", "Transport", "Other"] },
        { name: "amount", label: "Amount", type: "number", required: true },
        { name: "goatId", label: "Linked goat", type: "select", options: goatOptions(true) },
        { name: "notes", label: "Notes", type: "textarea" },
      ],
      onSave: async (values) => {
        state.data.expenses.push({ id: uid("expense"), ...values });
        await persist({ toastText: "Finance entry added." });
      },
    });
  }

  function openTaskForm(goatId = "") {
    openForm({
      title: "Add Task",
      values: { dueDate: todayIso(), type: "Barn", goatId },
      fields: [
        { name: "title", label: "Task", required: true },
        { name: "dueDate", label: "Due date", type: "date" },
        { name: "type", label: "Type", type: "select", options: ["Health", "Breeding", "Kidding", "Feed", "Barn", "Other"] },
        { name: "goatId", label: "Linked goat", type: "select", options: goatOptions(true) },
        { name: "notes", label: "Notes", type: "textarea" },
      ],
      onSave: async (values) => {
        state.data.tasks.push({ id: uid("task"), done: false, ...values });
        await persist({ toastText: "Task added." });
      },
    });
  }

  function openForm({ title, values, fields, onSave }) {
    modalRoot.innerHTML = `
      <div class="modal-backdrop" role="dialog" aria-modal="true">
        <form class="modal" id="record-form">
          <div class="modal-header">
            <h2>${esc(title)}</h2>
            <button class="btn secondary icon" data-action="close-modal" type="button" aria-label="Close">X</button>
          </div>
          <div class="modal-body">
            <div class="grid">
              ${fields.map((field) => renderField(field, values[field.name])).join("")}
            </div>
            <div class="modal-actions">
              <button class="btn secondary" data-action="close-modal" type="button">Cancel</button>
              <button class="btn brass" type="submit">Save</button>
            </div>
          </div>
        </form>
      </div>
    `;
    modalRoot.querySelectorAll("[data-action='close-modal']").forEach((button) => button.addEventListener("click", closeModal));
    modalRoot.querySelector("#record-form").addEventListener("submit", async (event) => {
      event.preventDefault();
      const form = new FormData(event.currentTarget);
      const next = {};
      fields.forEach((field) => {
        next[field.name] = normalizeDate(form.get(field.name));
      });
      closeModal();
      await onSave(next);
    });
  }

  function renderField(field, value = "") {
    const required = field.required ? "required" : "";
    if (field.type === "textarea") {
      return `<div class="field"><label>${esc(field.label)}</label><textarea name="${esc(field.name)}" ${required}>${esc(value)}</textarea></div>`;
    }
    if (field.type === "select") {
      const options = (field.options || []).map((option) => {
        const item = typeof option === "string" ? { value: option, label: option } : option;
        return `<option value="${esc(item.value)}" ${item.value === value ? "selected" : ""}>${esc(item.label)}</option>`;
      });
      return `<div class="field"><label>${esc(field.label)}</label><select name="${esc(field.name)}" ${required}>${options.join("")}</select></div>`;
    }
    return `<div class="field"><label>${esc(field.label)}</label><input name="${esc(field.name)}" type="${esc(field.type || "text")}" value="${esc(value)}" ${required} /></div>`;
  }

  function closeModal() {
    modalRoot.innerHTML = "";
  }

  function showQrLink(goatId) {
    const goat = state.data.goats.find((item) => item.id === goatId);
    const base = CONFIG.appUrl || window.location.href.split("#")[0];
    const link = `${base}#goat/${goatId}`;
    modalRoot.innerHTML = `
      <div class="modal-backdrop" role="dialog" aria-modal="true">
        <div class="modal">
          <div class="modal-header">
            <h2>QR / Tag Link</h2>
            <button class="btn secondary icon" data-action="close-modal" type="button" aria-label="Close">X</button>
          </div>
          <div class="modal-body">
            <div class="qr-box">
              <p class="item-title">${esc(goat?.name || "Goat profile")}</p>
              <p class="muted">Print this link as a QR code later. Scanning it opens this goat profile in HerdBook.</p>
              <div class="code">${esc(link)}</div>
              <button class="btn brass" data-copy="${esc(link)}" type="button">Copy Link</button>
            </div>
          </div>
        </div>
      </div>
    `;
    modalRoot.querySelector("[data-action='close-modal']").addEventListener("click", closeModal);
    modalRoot.querySelector("[data-copy]").addEventListener("click", async (event) => {
      await navigator.clipboard.writeText(event.currentTarget.dataset.copy);
      toast("QR link copied.");
    });
  }

  function exportJson() {
    downloadFile(`herdbook-backup-${todayIso()}.json`, JSON.stringify(state.data, null, 2), "application/json");
  }

  function exportGoatsCsv() {
    const rows = [["Name", "Tag ID", "Sex", "Breed", "DOB", "Status", "Notes"]].concat(
      state.data.goats.map((goat) => [goat.name, goat.tagId, goat.sex, goat.breed, goat.dob, goat.status, goat.notes])
    );
    downloadFile(`herdbook-goats-${todayIso()}.csv`, rows.map((row) => row.map(csvCell).join(",")).join("\n"), "text/csv");
  }

  function csvCell(value) {
    return `"${String(value || "").replaceAll('"', '""')}"`;
  }

  function downloadFile(name, content, type) {
    const blob = new Blob([content], { type });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = name;
    link.click();
    URL.revokeObjectURL(link.href);
  }

  async function importJson(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    const imported = JSON.parse(text);
    if (!imported.meta || !Array.isArray(imported.goats)) {
      toast("That backup does not look like a HerdBook file.");
      return;
    }
    state.data = imported;
    state.data.sync = { ...defaultFarm().sync, ...state.data.sync, dirty: true };
    await persist({ toastText: "Backup imported on this iPhone." });
  }

  function waitForGoogle() {
    return new Promise((resolve, reject) => {
      const started = Date.now();
      const timer = window.setInterval(() => {
        if (window.google?.accounts?.oauth2) {
          window.clearInterval(timer);
          resolve();
        }
        if (Date.now() - started > 8000) {
          window.clearInterval(timer);
          reject(new Error("Google sign-in script did not load."));
        }
      }, 100);
    });
  }

  async function signInToGoogle() {
    if (!CONFIG.googleClientId) {
      state.drive.error = "Missing Google OAuth client ID.";
      render();
      return "";
    }
    state.drive.busy = true;
    state.drive.error = "";
    state.drive.message = "Waiting for Google sign-in...";
    render();
    try {
      await waitForGoogle();
      const token = await new Promise((resolve, reject) => {
        const client = google.accounts.oauth2.initTokenClient({
          client_id: CONFIG.googleClientId,
          scope: DRIVE_SCOPE,
          prompt: "",
          callback: (response) => {
            if (response.error) reject(new Error(response.error));
            else resolve(response.access_token);
          },
        });
        client.requestAccessToken();
      });
      state.drive.token = token;
      state.drive.message = "Google Drive access ready.";
      state.drive.busy = false;
      render();
      return token;
    } catch (error) {
      state.drive.error = error.message;
      state.drive.busy = false;
      render();
      return "";
    }
  }

  async function ensureToken() {
    return state.drive.token || signInToGoogle();
  }

  async function driveFetch(path, options = {}) {
    const token = await ensureToken();
    if (!token) throw new Error("Google sign-in is not ready.");
    const response = await fetch(path, {
      ...options,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(options.headers || {}),
      },
    });
    if (!response.ok) {
      const text = await response.text();
      throw new Error(text || `Drive request failed: ${response.status}`);
    }
    return response;
  }

  async function findDriveFile() {
    const name = CONFIG.driveFileName || "herdbook-farm.json";
    const query = encodeURIComponent(`name='${name.replaceAll("'", "\\'")}' and trashed=false`);
    const response = await driveFetch(
      `https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&q=${query}&fields=files(id,name,modifiedTime)`
    );
    const data = await response.json();
    return data.files?.[0] || null;
  }

  async function createDriveFile() {
    const boundary = `herdbook_${Date.now()}`;
    const metadata = {
      name: CONFIG.driveFileName || "herdbook-farm.json",
      parents: ["appDataFolder"],
      mimeType: "application/json",
    };
    const body = [
      `--${boundary}`,
      "Content-Type: application/json; charset=UTF-8",
      "",
      JSON.stringify(metadata),
      `--${boundary}`,
      "Content-Type: application/json",
      "",
      JSON.stringify(state.data, null, 2),
      `--${boundary}--`,
    ].join("\r\n");
    const response = await driveFetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,modifiedTime", {
      method: "POST",
      headers: { "Content-Type": `multipart/related; boundary=${boundary}` },
      body,
    });
    return response.json();
  }

  async function updateDriveFile(fileId) {
    const response = await driveFetch(`https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media&fields=id,modifiedTime`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(state.data, null, 2),
    });
    return response.json();
  }

  async function downloadDriveFile(fileId) {
    const response = await driveFetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`);
    return response.json();
  }

  async function saveAndSync() {
    state.drive.busy = true;
    state.drive.error = "";
    state.drive.message = "Syncing to Google Drive...";
    render();
    try {
      const existing = state.data.sync.driveFileId ? { id: state.data.sync.driveFileId } : await findDriveFile();
      const result = existing ? await updateDriveFile(existing.id) : await createDriveFile();
      state.data.sync.driveFileId = result.id;
      state.data.sync.driveModifiedTime = result.modifiedTime || "";
      state.data.sync.lastSyncedAt = new Date().toISOString();
      state.data.sync.dirty = false;
      await writeStoredFarm(state.data);
      state.drive.busy = false;
      state.drive.message = "Synced to Google Drive.";
      render();
      toast("Synced to Google Drive.");
    } catch (error) {
      state.drive.busy = false;
      state.drive.error = error.message;
      render();
    }
  }

  async function loadFromDrive() {
    state.drive.busy = true;
    state.drive.error = "";
    state.drive.message = "Looking for HerdBook in Google Drive...";
    render();
    try {
      const file = await findDriveFile();
      if (!file) {
        state.drive.message = "No HerdBook file found in Drive yet.";
        state.drive.busy = false;
        render();
        return;
      }
      if (state.data.sync.dirty && !window.confirm("Local changes are unsynced. Restore the Drive copy anyway?")) {
        state.drive.busy = false;
        render();
        return;
      }
      const remote = await downloadDriveFile(file.id);
      remote.sync = {
        ...defaultFarm().sync,
        ...remote.sync,
        dirty: false,
        driveFileId: file.id,
        driveModifiedTime: file.modifiedTime,
        lastSyncedAt: new Date().toISOString(),
      };
      state.data = remote;
      await writeStoredFarm(state.data);
      state.drive.busy = false;
      state.drive.message = "Restored from Google Drive.";
      render();
      toast("Restored Drive copy.");
    } catch (error) {
      state.drive.busy = false;
      state.drive.error = error.message;
      render();
    }
  }

  function parseRoute() {
    const hash = window.location.hash.replace(/^#\/?/, "");
    if (hash.startsWith("goat/")) {
      const goatId = decodeURIComponent(hash.slice(5));
      if (state.data?.goats?.some((goat) => goat.id === goatId)) {
        state.selectedGoatId = goatId;
        state.view = "herd";
      }
    }
  }

  async function init() {
    state.data = (await readStoredFarm()) || defaultFarm();
    if (!state.data.sync) state.data.sync = defaultFarm().sync;
    parseRoute();
    render();
    if ("serviceWorker" in navigator && location.protocol !== "file:") {
      navigator.serviceWorker.register("./sw.js").catch((error) => console.warn("Service worker failed", error));
    }
  }

  window.addEventListener("hashchange", () => {
    parseRoute();
    render();
  });

  init();
})();
