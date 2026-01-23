// pages/stock.js — client-side state → filter/search → render (fast for small datasets)
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

const CACHE_KEY_ROWS = "stock_all_v1";
const CACHE_KEY_META = "stock_all_meta_v1";
const CACHE_TTL_MS = 60 * 1000; // 60s (adjust if needed)

const state = {
  q: "",
  warehouse: "",
  pageSize: 50,
  page: 1,
  allRows: [],
  lastSyncTime: null
};

function normalizeRow(r) {
  const item_code = String(r.item_code ?? r.itemCode ?? "").trim();
  const name_th = String(r.name_th ?? r.name ?? "").trim();
  const warehouse = String(r.warehouse ?? r.warehouse_code ?? r.warehouseCode ?? "").trim();
  const on_hand = Number(r.on_hand ?? r.onHand ?? 0);
  const minimum = Number(r.minimum ?? 0);
  const status = (r.status ?? ((on_hand < minimum) ? "LOW" : "OK"));

  // Precompute searchable key (avoid repeated lowercasing in filter loop)
  const _k = (item_code + " " + name_th + " " + warehouse).toLowerCase();

  return { item_code, name_th, warehouse, on_hand, minimum, status, _k };
}

function debounce(fn, wait = 350) {
  let t = null;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), wait);
  };
}

async function fetchAllStockOnce() {
  // Prefer cache for snappy UX
  const cachedRows = getLocalCache(CACHE_KEY_ROWS);
  const cachedMeta = getLocalCache(CACHE_KEY_META);

  if (Array.isArray(cachedRows) && cachedRows.length) {
    state.allRows = cachedRows;
    state.lastSyncTime = cachedMeta?.lastSyncTime ?? null;
    return;
  }

  // New action: get_stock_summary_all (single fetch)
  let res = await callApi("get_stock_summary_all", {});
  if (!res?.ok) {
    // Backward-compatible fallback: accumulate paged results (still works if dataset is small)
    const rows = [];
    let cursor = 0;
    const limit = 200;
    for (let guard = 0; guard < 50; guard++) { // cap 10,000 rows
      const r = await callApi("get_stock_summary", { limit, cursor });
      if (!r?.ok) { res = r; break; }
      const payload = r.data || {};
      const part = Array.isArray(payload.rows) ? payload.rows : [];
      rows.push(...part);
      const page = payload.page || {};
      if (!page.hasMore) {
        state.lastSyncTime = payload.lastSyncTime ?? null;
        res = { ok: true, data: { rows, lastSyncTime: state.lastSyncTime } };
        break;
      }
      cursor = page.nextCursor ?? (cursor + limit);
    }
    if (!res?.ok) throw res;
    state.allRows = rows.map(normalizeRow);
  } else {
    const payload = res.data || {};
    const rows = Array.isArray(payload.rows) ? payload.rows : (Array.isArray(payload) ? payload : []);
    state.allRows = rows.map(normalizeRow);
    state.lastSyncTime = payload.lastSyncTime ?? null;
  }

  // Cache for a short TTL; deterministic refresh after POST will clear these keys.
  setLocalCache(CACHE_KEY_ROWS, state.allRows, CACHE_TTL_MS);
  setLocalCache(CACHE_KEY_META, { lastSyncTime: state.lastSyncTime }, CACHE_TTL_MS);
}

function computeWarehouses() {
  const set = new Set();
  for (const r of state.allRows) {
    if (r.warehouse) set.add(r.warehouse);
  }
  return Array.from(set).sort();
}

function renderLayout(container, warehouses) {
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
        <i class="bi bi-lightning-charge me-1"></i>Mode: Client-side
        <span class="mx-2">|</span>
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

function applyFilters() {
  const q = state.q.trim().toLowerCase();
  const wh = state.warehouse.trim();

  let rows = state.allRows;

  if (wh) rows = rows.filter(r => r.warehouse === wh);
  if (q) rows = rows.filter(r => r._k.includes(q));

  return rows;
}

function renderTable(container) {
  const rows = applyFilters();
  const total = rows.length;

  const pageSize = state.pageSize;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  state.page = Math.min(state.page, totalPages);

  const startIdx = (state.page - 1) * pageSize;
  const endIdx = Math.min(total, startIdx + pageSize);
  const pageRows = rows.slice(startIdx, endIdx);

  // header info
  const pageInfo = container.querySelector("#pageInfo");
  if (pageInfo) {
    pageInfo.textContent = total
      ? `แสดง ${startIdx + 1}-${endIdx} จาก ${total} รายการ (หน้า ${state.page}/${totalPages})`
      : "ไม่พบข้อมูล";
  }

  // nav buttons
  const btnPrev = container.querySelector("#btnPrev");
  const btnNext = container.querySelector("#btnNext");
  if (btnPrev) btnPrev.disabled = (state.page <= 1);
  if (btnNext) btnNext.disabled = (state.page >= totalPages);

  // last sync
  const lastSyncEl = container.querySelector("#lastSync");
  if (lastSyncEl) lastSyncEl.textContent = state.lastSyncTime ? fmtDateTime(state.lastSyncTime) : "-";

  const tbody = container.querySelector("#tbodyStock");
  if (!tbody) return;

  if (!pageRows.length) {
    tbody.innerHTML = `<tr><td colspan="6" class="text-center text-muted py-4">ไม่พบข้อมูล</td></tr>`;
    return;
  }

  tbody.innerHTML = pageRows.map(r => {
    const isLow = Number(r.on_hand) < Number(r.minimum);
    const trClass = isLow ? "table-warning" : "";
    return `
      <tr class="${trClass}">
        <td class="fw-semibold">${escapeHtml(r.item_code)}</td>
        <td>${escapeHtml(r.name_th)}</td>
        <td>${escapeHtml(r.warehouse)}</td>
        <td class="text-end">${fmtNumber(r.on_hand)}</td>
        <td class="text-end">${fmtNumber(r.minimum)}</td>
        <td>${escapeHtml(r.status || (isLow ? "LOW" : "OK"))}</td>
      </tr>
    `;
  }).join("");
}

function wireEvents(container) {
  const q = container.querySelector("#q");
  const wh = container.querySelector("#warehouseFilter");
  const pageSize = container.querySelector("#pageSize");
  const btnPrev = container.querySelector("#btnPrev");
  const btnNext = container.querySelector("#btnNext");
  const btnReset = container.querySelector("#btnReset");

  const applyDebounced = debounce(() => {
    state.page = 1;
    renderTable(container);
  }, 250);

  q?.addEventListener("input", () => {
    state.q = q.value || "";
    applyDebounced();
  });

  wh?.addEventListener("change", () => {
    state.warehouse = wh.value || "";
    state.page = 1;
    renderTable(container);
  });

  pageSize?.addEventListener("change", () => {
    state.pageSize = Number(pageSize.value || 50);
    state.page = 1;
    renderTable(container);
  });

  btnPrev?.addEventListener("click", () => {
    if (state.page > 1) state.page -= 1;
    renderTable(container);
  });

  btnNext?.addEventListener("click", () => {
    state.page += 1;
    renderTable(container);
  });

  btnReset?.addEventListener("click", () => {
    state.q = "";
    state.warehouse = "";
    state.pageSize = 50;
    state.page = 1;

    if (q) q.value = "";
    if (wh) wh.value = "";
    if (pageSize) pageSize.value = "50";

    renderTable(container);
  });
}

async function loadStock(container) {
  renderSkeleton(container, { rows: 8 });

  try {
    await fetchAllStockOnce();
    const warehouses = computeWarehouses();

    renderLayout(container, warehouses);
    wireEvents(container);
    renderTable(container);
  } catch (e) {
    renderErrorBanner(container, formatError(e), () => loadStock(container));
  }
}

export async function render(container) {
  await loadStock(container);
  return { cleanup() {} };
}
