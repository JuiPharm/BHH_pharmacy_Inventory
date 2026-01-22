// pages/stock.js — server-side pagination + filtering (fast)
import { callApi, formatError } from "../api.js";
import {
  renderSkeleton,
  renderErrorBanner,
  fmtNumber,
  fmtDateTime,
  escapeHtml,
  getLocalCache,
  setLocalCache
} from "../ui.js";

let warehouses = [];

const state = {
  q: "",
  warehouse: "",
  limit: 50,
  cursor: 0,
  nextCursor: 0,
  hasMore: false,
  history: [] // stack of previous cursors for Prev
};

function normalizeRow(r) {
  return {
    item_code: r.item_code ?? r.itemCode ?? "",
    name_th: r.name_th ?? r.name ?? "",
    warehouse: r.warehouse ?? r.warehouse_code ?? r.warehouseCode ?? "",
    on_hand: Number(r.on_hand ?? r.onHand ?? 0),
    minimum: Number(r.minimum ?? 0),
    status: r.status ?? ""
  };
}

function debounce(fn, wait = 350) {
  let t = null;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), wait);
  };
}

async function loadWarehouses() {
  const cached = getLocalCache("masters_warehouses");
  if (Array.isArray(cached) && cached.length) {
    warehouses = cached;
    return;
  }
  const res = await callApi("list_warehouses", {});
  if (res?.ok) {
    const list = res.data?.warehouses || res.warehouses || res.data || [];
    warehouses = list.map(w => (w.warehouse_code || w.code || w.id || w.name || "")).filter(Boolean);
    warehouses = Array.from(new Set(warehouses)).sort();
    setLocalCache("masters_warehouses", warehouses, 5 * 60 * 1000);
  } else {
    warehouses = [];
  }
}

function renderLayout(container) {
  container.innerHTML = `
    <div class="d-flex flex-column flex-md-row justify-content-between align-items-start align-items-md-center gap-2 mb-3">
      <div class="d-flex flex-column flex-md-row gap-2 align-items-start align-items-md-center flex-wrap">
        <div class="input-group" style="min-width: 260px;">
          <span class="input-group-text"><i class="bi bi-search"></i></span>
          <input type="search" class="form-control" id="q" placeholder="ค้นหา item_code / name">
        </div>

        <select class="form-select" id="warehouseFilter" style="min-width: 220px;">
          <option value="">ทุกคลัง</option>
          ${warehouses.map(w => `<option value="${escapeHtml(w)}">${escapeHtml(w)}</option>`).join("")}
        </select>

        <select class="form-select" id="pageSize" style="min-width: 160px;">
          <option value="25">25 / หน้า</option>
          <option value="50" selected>50 / หน้า</option>
          <option value="100">100 / หน้า</option>
          <option value="200">200 / หน้า</option>
        </select>

        <button class="btn btn-outline-secondary" id="btnReset" type="button">
          <i class="bi bi-arrow-counterclockwise me-1"></i>รีเซ็ต
        </button>
      </div>

      <div class="text-muted small">
        <i class="bi bi-clock me-1"></i>Last sync: <span class="fw-semibold" id="lastSync">-</span>
      </div>
    </div>

    <div class="d-flex justify-content-between align-items-center mb-2">
      <div class="text-muted small" id="pageInfo">-</div>
      <div class="btn-group">
        <button class="btn btn-sm btn-outline-secondary" id="btnPrev" title="ก่อนหน้า">
          <i class="bi bi-chevron-left"></i>
        </button>
        <button class="btn btn-sm btn-outline-secondary" id="btnNext" title="ถัดไป">
          <i class="bi bi-chevron-right"></i>
        </button>
      </div>
    </div>

    <div class="card shadow-sm">
      <div class="card-body p-0">
        <div class="table-responsive">
          <table class="table table-hover align-middle mb-0">
            <thead>
              <tr>
                <th>item_code</th>
                <th>name_th</th>
                <th>warehouse</th>
                <th class="text-end">on_hand</th>
                <th class="text-end">minimum</th>
                <th>status</th>
              </tr>
            </thead>
            <tbody id="tbodyStock"></tbody>
          </table>
        </div>
      </div>
    </div>
  `;
}

function setTableLoading(container) {
  const tbody = container.querySelector("#tbodyStock");
  if (!tbody) return;
  tbody.innerHTML = Array.from({ length: 8 }).map(() => `
    <tr>
      <td colspan="6">
        <div class="placeholder-glow">
          <span class="placeholder col-12"></span>
        </div>
      </td>
    </tr>
  `).join("");
}

function renderRows(container, rows) {
  const tbody = container.querySelector("#tbodyStock");
  if (!tbody) return;

  tbody.innerHTML = rows.length ? rows.map(r => {
    const low = r.on_hand < r.minimum;
    return `
      <tr class="${low ? "table-warning" : ""}">
        <td class="fw-semibold">${escapeHtml(r.item_code)}</td>
        <td>${escapeHtml(r.name_th)}</td>
        <td>${escapeHtml(r.warehouse)}</td>
        <td class="text-end">${fmtNumber(r.on_hand)}</td>
        <td class="text-end">${fmtNumber(r.minimum)}</td>
        <td>${escapeHtml(r.status || (low ? "LOW" : "OK"))}</td>
      </tr>
    `;
  }).join("") : `<tr><td colspan="6" class="text-center text-muted py-4">ไม่พบรายการ</td></tr>`;
}

function updatePager(container, rowsCount) {
  const info = container.querySelector("#pageInfo");
  const btnPrev = container.querySelector("#btnPrev");
  const btnNext = container.querySelector("#btnNext");

  const pageNo = state.history.length + 1;
  const parts = [];
  parts.push(`หน้า ${pageNo}`);
  parts.push(`แสดง ${rowsCount.toLocaleString("th-TH")} รายการ`);
  parts.push(`ต่อหน้า ${state.limit.toLocaleString("th-TH")}`);

  if (state.q) parts.push(`ค้นหา: "${escapeHtml(state.q)}"`);
  if (state.warehouse) parts.push(`คลัง: ${escapeHtml(state.warehouse)}`);

  info.textContent = parts.join(" • ");

  btnPrev.disabled = state.history.length === 0;
  btnNext.disabled = !state.hasMore;
}

async function fetchPage(container) {
  setTableLoading(container);

  const res = await callApi("get_stock_summary", {
    q: state.q,
    warehouse: state.warehouse,
    limit: state.limit,
    cursor: state.cursor
  });

  if (!res?.ok) {
    container.innerHTML = "";
    renderErrorBanner(container, res?.message || formatError(res), () => fetchPage(container));
    return;
  }

  const data = res.data || res;
  const rows = (data.rows || []).map(normalizeRow);
  const page = data.page || {};

  state.nextCursor = Number(page.nextCursor ?? state.cursor);
  state.hasMore = Boolean(page.hasMore);

  renderRows(container, rows);

  const lastSync = data.lastSyncTime || data.lastSync || data.lastUpdated || null;
  const lastSyncEl = container.querySelector("#lastSync");
  if (lastSyncEl) lastSyncEl.textContent = fmtDateTime(lastSync);

  updatePager(container, rows.length);
}

function resetPaging() {
  state.cursor = 0;
  state.nextCursor = 0;
  state.hasMore = false;
  state.history = [];
}

function wireEvents(container) {
  const qEl = container.querySelector("#q");
  const wEl = container.querySelector("#warehouseFilter");
  const psEl = container.querySelector("#pageSize");
  const btnPrev = container.querySelector("#btnPrev");
  const btnNext = container.querySelector("#btnNext");
  const btnReset = container.querySelector("#btnReset");

  qEl.value = state.q;
  wEl.value = state.warehouse;
  psEl.value = String(state.limit);

  const onSearchChange = debounce(async () => {
    state.q = qEl.value.trim();
    resetPaging();
    await fetchPage(container);
  }, 350);

  qEl.addEventListener("input", onSearchChange);

  wEl.addEventListener("change", async () => {
    state.warehouse = wEl.value;
    resetPaging();
    await fetchPage(container);
  });

  psEl.addEventListener("change", async () => {
    state.limit = Number(psEl.value || 50);
    resetPaging();
    await fetchPage(container);
  });

  btnPrev.addEventListener("click", async () => {
    if (!state.history.length) return;
    state.cursor = state.history.pop();
    await fetchPage(container);
  });

  btnNext.addEventListener("click", async () => {
    if (!state.hasMore) return;
    state.history.push(state.cursor);
    state.cursor = state.nextCursor;
    await fetchPage(container);
  });

  btnReset.addEventListener("click", async () => {
    qEl.value = "";
    wEl.value = "";
    psEl.value = "50";
    state.q = "";
    state.warehouse = "";
    state.limit = 50;
    resetPaging();
    await fetchPage(container);
  });
}

async function loadStock(container) {
  renderSkeleton(container, { rows: 8 });

  await loadWarehouses();

  renderLayout(container);
  wireEvents(container);

  resetPaging();
  await fetchPage(container);
}

export async function render(container) {
  await loadStock(container);
  return { cleanup() {} };
}
