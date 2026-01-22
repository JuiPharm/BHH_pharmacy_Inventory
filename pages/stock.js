// pages/stock.js
import { callApi, formatError } from "../api.js";
import { renderSkeleton, renderErrorBanner, fmtNumber, fmtDateTime, escapeHtml } from "../ui.js";

let stockData = [];
let warehouses = [];

function normalizeRow(r) {
  return {
    item_code: r.item_code ?? r.itemCode ?? "",
    name_th: r.name_th ?? r.name ?? "",
    warehouse: r.warehouse ?? r.warehouse_code ?? r.warehouseCode ?? "",
    on_hand: Number(r.on_hand ?? r.onHand ?? 0),
    minimum: Number(r.minimum ?? 0),
    status: r.status ?? "",
  };
}

function renderTable(container, rows) {
  const body = rows.map((r) => {
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
  }).join("");

  container.innerHTML = `
    <div class="d-flex flex-column flex-md-row justify-content-between align-items-start align-items-md-center gap-2 mb-3">
      <div class="d-flex flex-column flex-md-row gap-2 align-items-start align-items-md-center">
        <div class="input-group" style="min-width: 260px;">
          <span class="input-group-text"><i class="bi bi-search"></i></span>
          <input type="search" class="form-control" id="q" placeholder="ค้นหา item_code / name">
        </div>
        <select class="form-select" id="warehouseFilter" style="min-width: 220px;">
          <option value="">ทุกคลัง</option>
          ${warehouses.map(w => `<option value="${escapeHtml(w)}">${escapeHtml(w)}</option>`).join("")}
        </select>
      </div>
      <div class="text-muted small">
        <i class="bi bi-clock me-1"></i>Last sync: <span class="fw-semibold" id="lastSync"></span>
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
            <tbody>
              ${rows.length ? body : `<tr><td colspan="6" class="text-center text-muted py-4">ไม่มีข้อมูล</td></tr>`}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;

  const qEl = container.querySelector("#q");
  const wEl = container.querySelector("#warehouseFilter");

  const applyFilters = () => {
    const q = qEl.value.trim().toLowerCase();
    const w = wEl.value;

    const filtered = stockData.filter((r) => {
      const matchQ = !q || r.item_code.toLowerCase().includes(q) || r.name_th.toLowerCase().includes(q);
      const matchW = !w || r.warehouse === w;
      return matchQ && matchW;
    });

    // Re-render only tbody for performance
    const tbody = container.querySelector("tbody");
    tbody.innerHTML = filtered.length ? filtered.map((r) => {
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
  };

  qEl.addEventListener("input", applyFilters);
  wEl.addEventListener("change", applyFilters);
}

async function loadStock(container) {
  renderSkeleton(container, { rows: 8 });

  const res = await callApi("get_stock_summary", {});
  if (!res?.ok) {
    container.innerHTML = "";
    renderErrorBanner(container, res?.message || formatError(res), () => loadStock(container));
    return;
  }

  const data = res.data || res;
  const rows = (data.rows || data.items || []).map(normalizeRow);
  const lastSync = data.lastSyncTime || data.lastSync || data.lastUpdated || null;

  stockData = rows;
  warehouses = Array.from(new Set(rows.map(r => r.warehouse).filter(Boolean))).sort();

  renderTable(container, rows);
  container.querySelector("#lastSync").textContent = fmtDateTime(lastSync);
}

export async function render(container) {
  await loadStock(container);
  return { cleanup() {} };
}
