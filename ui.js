// ui.js - shared UI helpers (Bootstrap 5)
// This module does NOT depend on any build tools; uses global bootstrap bundle loaded in index.html

import { getRole, getProfile } from "./auth.js";

export function escapeHtml(str) {
  return String(str ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function fmtNumber(n) {
  const x = Number(n);
  if (Number.isNaN(x)) return "-";
  return x.toLocaleString("th-TH");
}

export function fmtDateTime(dt) {
  if (!dt) return "-";
  try {
    const d = dt instanceof Date ? dt : new Date(dt);
    if (Number.isNaN(d.getTime())) return String(dt);
    return d.toLocaleString("th-TH", { hour12: false });
  } catch {
    return String(dt);
  }
}

export function mountToastHost() {
  let host = document.getElementById("toastHost");
  if (!host) {
    host = document.createElement("div");
    host.id = "toastHost";
    host.className = "toast-container position-fixed bottom-0 end-0 p-3";
    document.body.appendChild(host);
  }
  return host;
}

export function showToast(message, variant = "success", opts = {}) {
  const host = mountToastHost();
  const id = `t_${Date.now()}_${Math.random().toString(16).slice(2)}`;
  const title = opts.title || (variant === "success" ? "สำเร็จ" : variant === "warning" ? "แจ้งเตือน" : "ข้อผิดพลาด");

  const html = `
    <div id="${id}" class="toast align-items-center text-bg-${variant} border-0" role="alert" aria-live="assertive" aria-atomic="true">
      <div class="d-flex">
        <div class="toast-body">
          <div class="fw-semibold mb-1">${escapeHtml(title)}</div>
          <div>${escapeHtml(message)}</div>
        </div>
        <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button>
      </div>
    </div>
  `;
  host.insertAdjacentHTML("beforeend", html);
  const el = document.getElementById(id);
  const toast = new bootstrap.Toast(el, { delay: opts.delay ?? 3500 });
  toast.show();
  el.addEventListener("hidden.bs.toast", () => el.remove());
}

export function renderErrorBanner(container, message, onRetry) {
  container.innerHTML = `
    <div class="alert alert-danger d-flex justify-content-between align-items-start gap-3" role="alert">
      <div>
        <div class="fw-semibold mb-1"><i class="bi bi-exclamation-triangle-fill me-2"></i>เกิดข้อผิดพลาด</div>
        <div>${escapeHtml(message)}</div>
      </div>
      ${onRetry ? '<button class="btn btn-sm btn-light" id="btnRetry"><i class="bi bi-arrow-clockwise me-1"></i>ลองอีกครั้ง</button>' : ""}
    </div>
  `;
  if (onRetry) {
    container.querySelector("#btnRetry")?.addEventListener("click", onRetry);
  }
}

export function renderSkeleton(container, { rows = 6 } = {}) {
  const lines = Array.from({ length: rows })
    .map(
      () => `
    <div class="placeholder-glow mb-2">
      <span class="placeholder col-12"></span>
    </div>`
    )
    .join("");
  container.innerHTML = `<div class="card"><div class="card-body">${lines}</div></div>`;
}

export function confirmModal({ title, body, confirmText = "ยืนยัน", cancelText = "ยกเลิก", variant = "primary" }) {
  return new Promise((resolve) => {
    const id = `m_${Date.now()}_${Math.random().toString(16).slice(2)}`;
    const html = `
      <div class="modal fade" id="${id}" tabindex="-1" aria-hidden="true">
        <div class="modal-dialog modal-dialog-centered">
          <div class="modal-content">
            <div class="modal-header">
              <h5 class="modal-title">${escapeHtml(title)}</h5>
              <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
            </div>
            <div class="modal-body">${body}</div>
            <div class="modal-footer">
              <button type="button" class="btn btn-outline-secondary" data-bs-dismiss="modal">${escapeHtml(cancelText)}</button>
              <button type="button" class="btn btn-${variant}" id="${id}_ok">${escapeHtml(confirmText)}</button>
            </div>
          </div>
        </div>
      </div>
    `;
    document.body.insertAdjacentHTML("beforeend", html);
    const el = document.getElementById(id);
    const modal = new bootstrap.Modal(el, { backdrop: "static" });

    const cleanup = (val) => {
      try { modal.hide(); } catch {}
      el.remove();
      resolve(val);
    };

    el.addEventListener("hidden.bs.modal", () => {
      // If closed via X or ESC/backdrop, treat as cancel
      if (document.getElementById(id)) cleanup(false);
    });

    el.querySelector(`#${id}_ok`)?.addEventListener("click", () => cleanup(true));
    modal.show();
  });
}

function menuByRole(role) {
  const r = (role || "").toUpperCase();
  const base = [
    { key: "dashboard", label: "Dashboard", hash: "#/dashboard", icon: "bi-speedometer2" },
    { key: "stock", label: "Stock", hash: "#/stock", icon: "bi-box-seam" },
    { key: "requisitions", label: "Requisitions", hash: "#/requisitions", icon: "bi-file-text" },
  ];

  if (r === "STORE" || r === "ADMIN") {
    // Separate Receive and Issue for better usability.
    base.splice(2, 0,
      { key: "receive", label: "Receive", hash: "#/receive", icon: "bi-box-arrow-in-down" },
      { key: "issue", label: "Issue", hash: "#/issue", icon: "bi-box-arrow-up" }
    );
  }
  if (r === "ADMIN") {
    base.push({ key: "admin", label: "Admin Masters", hash: "#/admin", icon: "bi-shield-lock" });
  }

  // REQUESTER: stock is read-only; label remains the same
  return base;
}

export function renderShell(appContainer, { activeKey = "dashboard", pageTitle = "" } = {}) {
  const role = getRole();
  const profile = getProfile();

  const menus = menuByRole(role);
  const userLabel = escapeHtml(profile?.name || profile?.displayName || profile?.username || "ผู้ใช้");
  const roleBadge = role ? `<span class="badge text-bg-secondary ms-2">${escapeHtml(role)}</span>` : "";

  const sidebarLinks = menus
    .map((m) => {
      const active = m.key === activeKey ? "active" : "";
      return `
        <a class="nav-link d-flex align-items-center gap-2 ${active}" href="${m.hash}" data-navkey="${m.key}">
          <i class="bi ${m.icon}"></i>
          <span>${escapeHtml(m.label)}</span>
        </a>
      `;
    })
    .join("");

  appContainer.innerHTML = `
    <div class="app-shell">
      <nav class="navbar navbar-expand-lg navbar-dark bg-primary">
        <div class="container-fluid">
          <button class="btn btn-primary d-lg-none" type="button" data-bs-toggle="offcanvas" data-bs-target="#appSidebar" aria-controls="appSidebar">
            <i class="bi bi-list"></i>
          </button>
          <a class="navbar-brand ms-2 ms-lg-0" href="#/dashboard">Inventory</a>
          <div class="ms-auto d-flex align-items-center gap-2">
            <div class="text-white small d-none d-md-block">
              <i class="bi bi-person-circle me-1"></i>${userLabel}${roleBadge}
            </div>
            <button class="btn btn-outline-light btn-sm" id="btnLogout">
              <i class="bi bi-box-arrow-right me-1"></i>Logout
            </button>
          </div>
        </div>
      </nav>

      <div class="container-fluid">
        <div class="row g-0">
          <aside class="d-none d-lg-block col-lg-2 col-xl-2 border-end bg-white min-vh-100">
            <div class="p-3">
              <div class="small text-muted mb-2">เมนู</div>
              <nav class="nav flex-column sidebar-nav" id="sidebarNavDesktop">
                ${sidebarLinks}
              </nav>
              <div class="mt-4 small text-muted">
                <div class="mb-1">ผู้ใช้</div>
                <div class="fw-semibold">${userLabel}</div>
                ${role ? `<div class="mt-1"><span class="badge text-bg-light border">${escapeHtml(role)}</span></div>` : ""}
              </div>
            </div>
          </aside>

          <main class="col-12 col-lg-10 col-xl-10">
            <div class="p-3 p-lg-4">
              <div class="mb-3">
                <div class="page-title h4 mb-0">${escapeHtml(pageTitle)}</div>
              </div>
              <div id="pageHost"></div>
            </div>
          </main>
        </div>
      </div>

      <div class="offcanvas offcanvas-start" tabindex="-1" id="appSidebar" aria-labelledby="appSidebarLabel">
        <div class="offcanvas-header">
          <h5 class="offcanvas-title" id="appSidebarLabel">เมนู</h5>
          <button type="button" class="btn-close" data-bs-dismiss="offcanvas" aria-label="Close"></button>
        </div>
        <div class="offcanvas-body">
          <nav class="nav flex-column sidebar-nav" id="sidebarNavMobile">
            ${sidebarLinks}
          </nav>
          <hr/>
          <div class="small text-muted mb-1">ผู้ใช้</div>
          <div class="fw-semibold">${userLabel}</div>
          ${role ? `<div class="mt-1"><span class="badge text-bg-light border">${escapeHtml(role)}</span></div>` : ""}
        </div>
      </div>
    </div>
  `;

  return appContainer.querySelector("#pageHost");
}

export function setActiveNav(activeKey) {
  document.querySelectorAll("[data-navkey]").forEach((el) => {
    if (el.getAttribute("data-navkey") === activeKey) el.classList.add("active");
    else el.classList.remove("active");
  });
}


const LOCAL_CACHE_PREFIX = "INV_CACHE:";

export function setLocalCache(key, value, ttlMs) {
  const payload = { v: value, exp: Date.now() + (ttlMs || 0) };
  try {
    localStorage.setItem(LOCAL_CACHE_PREFIX + key, JSON.stringify(payload));
  } catch {
    // ignore quota errors
  }
}

export function getLocalCache(key) {
  const raw = localStorage.getItem(LOCAL_CACHE_PREFIX + key);
  if (!raw) return null;
  try {
    const payload = JSON.parse(raw);
    if (payload?.exp && Date.now() > payload.exp) {
      localStorage.removeItem(LOCAL_CACHE_PREFIX + key);
      return null;
    }
    return payload?.v ?? null;
  } catch {
    localStorage.removeItem(LOCAL_CACHE_PREFIX + key);
    return null;
  }
}

export function clearLocalCache(key) {
  localStorage.removeItem(LOCAL_CACHE_PREFIX + key);
}

export function dispatchAppEvent(name, detail = {}) {
  window.dispatchEvent(new CustomEvent(name, { detail }));
}
