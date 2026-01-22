// pages/dashboard.js
import { callApi, formatError } from "../api.js";
import { renderSkeleton, renderErrorBanner, fmtNumber, fmtDateTime, showToast, escapeHtml } from "../ui.js";
import { getRole } from "../auth.js";

let pollTimer = null;
let isSyncing = false;

function canRefresh() {
  const role = getRole();
  return role === "ADMIN" || role === "STORE";
}

function stopPolling() {
  if (pollTimer) clearInterval(pollTimer);
  pollTimer = null;
}

async function loadSnapshot(container, { silent = false } = {}) {
  if (!silent) {
    renderSkeleton(container, { rows: 8 });
  }

  const res = await callApi("dashboard_snapshot", {});
  if (!res?.ok) {
    container.innerHTML = "";
    renderErrorBanner(container, res?.message || formatError(res), () => loadSnapshot(container));
    return;
  }

  const data = res.data || res.snapshot || res;
  const kpi = data.kpi || data.KPI || data;
  const lowStock = data.lowStockTop20 || data.lowStock || [];
  const topIssue = data.topIssueTop10 || data.topIssue || [];
  const lastUpdated = kpi.lastUpdated || data.lastUpdated || null;
  const lastSyncTime = data.lastSyncTime || data.lastSyncTimeISO || null;

  container.innerHTML = `
    <div class="d-flex flex-column flex-md-row justify-content-between align-items-start align-items-md-center gap-2 mb-3">
      <div class="text-muted small">
        <span class="me-3"><i class="bi bi-clock me-1"></i>Last updated: <span class="fw-semibold">${escapeHtml(fmtDateTime(lastUpdated))}</span></span>
        <span><i class="bi bi-arrow-repeat me-1"></i>Last sync: <span class="fw-semibold" id="lastSync">${escapeHtml(fmtDateTime(lastSyncTime))}</span></span>
        <span class="ms-2 badge text-bg-${isSyncing ? "warning" : "success"}" id="syncStatus">${isSyncing ? "syncing" : "idle"}</span>
      </div>
      ${canRefresh() ? `
        <button class="btn btn-sm btn-outline-primary" id="btnRefresh">
          <i class="bi bi-arrow-clockwise me-1"></i>Refresh
        </button>
      ` : ""}
    </div>

    <div class="row g-3 mb-3">
      <div class="col-6 col-lg-3">
        <div class="card kpi-card shadow-sm">
          <div class="card-body">
            <div class="text-muted small">Active Items</div>
            <div class="kpi-value">${fmtNumber(kpi.totalActiveItems)}</div>
          </div>
        </div>
      </div>
      <div class="col-6 col-lg-3">
        <div class="card kpi-card shadow-sm">
          <div class="card-body">
            <div class="text-muted small">On Hand (รวม)</div>
            <div class="kpi-value">${fmtNumber(kpi.totalOnHand)}</div>
          </div>
        </div>
      </div>
      <div class="col-6 col-lg-3">
        <div class="card kpi-card shadow-sm">
          <div class="card-body">
            <div class="text-muted small">Low Stock Lines</div>
            <div class="kpi-value">${fmtNumber(kpi.lowStockLines)}</div>
          </div>
        </div>
      </div>
      <div class="col-6 col-lg-3">
        <div class="card kpi-card shadow-sm">
          <div class="card-body">
            <div class="text-muted small">Last Updated</div>
            <div class="kpi-value fs-6">${escapeHtml(fmtDateTime(lastUpdated))}</div>
          </div>
        </div>
      </div>
    </div>

    <div class="row g-3">
      <div class="col-12 col-lg-6">
        <div class="card shadow-sm">
          <div class="card-header d-flex align-items-center justify-content-between">
            <div class="fw-semibold"><i class="bi bi-exclamation-triangle me-2"></i>Low Stock (Top 20)</div>
          </div>
          <div class="card-body p-0">
            <div class="table-responsive">
              <table class="table table-sm table-hover align-middle mb-0">
                <thead>
                  <tr>
                    <th>Item</th>
                    <th>Warehouse</th>
                    <th class="text-end">On Hand</th>
                    <th class="text-end">Minimum</th>
                  </tr>
                </thead>
                <tbody>
                  ${lowStock.length ? lowStock.map(r => `
                    <tr>
                      <td>
                        <div class="fw-semibold">${escapeHtml(r.item_code || r.itemCode || "")}</div>
                        <div class="text-muted small">${escapeHtml(r.name_th || r.name || "")}</div>
                      </td>
                      <td>${escapeHtml(r.warehouse || r.warehouse_code || r.warehouseCode || "")}</td>
                      <td class="text-end">${fmtNumber(r.on_hand ?? r.onHand)}</td>
                      <td class="text-end">${fmtNumber(r.minimum)}</td>
                    </tr>
                  `).join("") : `
                    <tr><td colspan="4" class="text-center text-muted py-4">ไม่มีรายการ</td></tr>
                  `}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      <div class="col-12 col-lg-6">
        <div class="card shadow-sm">
          <div class="card-header d-flex align-items-center justify-content-between">
            <div class="fw-semibold"><i class="bi bi-bar-chart me-2"></i>Top Issue (Top 10)</div>
          </div>
          <div class="card-body p-0">
            <div class="table-responsive">
              <table class="table table-sm table-hover align-middle mb-0">
                <thead>
                  <tr>
                    <th>Item</th>
                    <th class="text-end">Issued Qty</th>
                    <th>Period</th>
                  </tr>
                </thead>
                <tbody>
                  ${topIssue.length ? topIssue.map(r => `
                    <tr>
                      <td>
                        <div class="fw-semibold">${escapeHtml(r.item_code || r.itemCode || "")}</div>
                        <div class="text-muted small">${escapeHtml(r.name_th || r.name || "")}</div>
                      </td>
                      <td class="text-end">${fmtNumber(r.issued_qty ?? r.qty ?? r.issuedQty)}</td>
                      <td>${escapeHtml(r.period || r.month || "")}</td>
                    </tr>
                  `).join("") : `
                    <tr><td colspan="3" class="text-center text-muted py-4">ไม่มีรายการ</td></tr>
                  `}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;

  const btnRefresh = container.querySelector("#btnRefresh");
  if (btnRefresh) {
    btnRefresh.addEventListener("click", async () => {
      btnRefresh.disabled = true;
      btnRefresh.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>กำลัง Refresh...';
      isSyncing = true;
      container.querySelector("#syncStatus")?.classList.replace("text-bg-success", "text-bg-warning");
      container.querySelector("#syncStatus").textContent = "syncing";

      const r = await callApi("refresh_dashboard", {});
      if (r?.ok) {
        showToast("สั่ง Refresh สำเร็จ กำลังอัปเดต snapshot", "success");
        await loadSnapshot(container, { silent: true });
      } else {
        showToast(r?.message || formatError(r), "danger", { title: "Refresh ไม่สำเร็จ" });
      }

      isSyncing = false;
      btnRefresh.disabled = false;
      btnRefresh.innerHTML = '<i class="bi bi-arrow-clockwise me-1"></i>Refresh';
      container.querySelector("#syncStatus")?.classList.replace("text-bg-warning", "text-bg-success");
      container.querySelector("#syncStatus").textContent = "idle";
    });
  }
}

export async function render(container) {
  // Initial load
  await loadSnapshot(container);

  // Polling every 5 seconds while on dashboard
  stopPolling();
  pollTimer = setInterval(() => {
    // silent refresh for better UX
    loadSnapshot(container, { silent: true });
  }, 5000);

  return {
    cleanup() {
      stopPolling();
    },
  };
}
