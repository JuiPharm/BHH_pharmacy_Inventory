// router.js - hash routing + page lifecycle management
import { requireAuth, enforceRouteRBAC, logout, isAuthed } from "./auth.js";
import { renderShell, renderErrorBanner, setActiveNav } from "./ui.js";
import { callApi, formatError } from "./api.js";

let currentPage = null; // { cleanup?: function }
let currentRouteKey = null;

const ROUTES = {
  login: { title: "เข้าสู่ระบบ", module: () => import("./pages/login.js"), auth: false },
  dashboard: { title: "Dashboard", module: () => import("./pages/dashboard.js"), auth: true },
  stock: { title: "Stock", module: () => import("./pages/stock.js"), auth: true },
  receive: { title: "Receive", module: () => import("./pages/receive.js"), auth: true },
  issue: { title: "Issue", module: () => import("./pages/issue.js"), auth: true },
  transactions: { title: "Transactions", module: () => import("./pages/transactions.js"), auth: true },
  requisitions: { title: "Requisitions", module: () => import("./pages/requisitions.js"), auth: true },
  admin: { title: "Admin Masters", module: () => import("./pages/admin.js"), auth: true },
};

function parseHash() {
  const raw = location.hash || "";
  const hash = raw.startsWith("#") ? raw.slice(1) : raw;
  const [pathPart, queryPart] = hash.split("?");
  const path = (pathPart || "/").replace(/^\//, ""); // e.g. 'dashboard'
  const key = path || "login";
  const params = new URLSearchParams(queryPart || "");
  return { key, params };
}

async function cleanupCurrent() {
  try {
    if (currentPage?.cleanup) await currentPage.cleanup();
  } catch {
    // ignore cleanup errors
  } finally {
    currentPage = null;
  }
}

function renderAccessDenied(pageHost, requestedKey) {
  pageHost.innerHTML = "";
  renderErrorBanner(pageHost, `คุณไม่มีสิทธิ์เข้าถึงหน้า: ${requestedKey}`, () => {
    location.hash = "#/dashboard";
  });
}

function attachLogoutHandler() {
  const btn = document.getElementById("btnLogout");
  if (!btn) return;
  btn.onclick = async () => {
    btn.disabled = true;
    try {
      // best-effort logout; then clear storage
      await logout();
    } finally {
      btn.disabled = false;
      location.hash = "#/login";
    }
  };
}

/**
 * initRouter()
 * - mounts app
 * - binds hashchange
 * - performs initial navigation
 */
export function initRouter() {
  window.addEventListener("hashchange", () => navigate().catch(console.error));
  window.addEventListener("DOMContentLoaded", () => navigate().catch(console.error));

  // Default landing: if no hash, choose based on session
  if (!location.hash) {
    location.hash = isAuthed() ? "#/dashboard" : "#/login";
  }
}

export async function navigate() {
  const app = document.getElementById("app");
  if (!app) return;

  const { key, params } = parseHash();
  const route = ROUTES[key] || ROUTES.login;

  await cleanupCurrent();

  // Auth guard
  if (route.auth) {
    if (!requireAuth()) return;

    // RBAC guard
    if (!enforceRouteRBAC(key)) {
      const pageHost = renderShell(app, { activeKey: "dashboard", pageTitle: "ไม่อนุญาต (Access Denied)" });
      attachLogoutHandler();
      setActiveNav("dashboard");
      renderAccessDenied(pageHost, key);
      currentRouteKey = "dashboard";
      return;
    }
  }

  // Render shell only for authenticated pages
  let pageHost = app;
  if (key !== "login" && route.auth) {
    pageHost = renderShell(app, { activeKey: key, pageTitle: route.title });
    attachLogoutHandler();
    setActiveNav(key);
    currentRouteKey = key;
  } else {
    currentRouteKey = "login";
    app.className = ""; // reset
  }

  // Lazy load module
  let mod;
  try {
    mod = await route.module();
  } catch (e) {
    pageHost.innerHTML = "";
    renderErrorBanner(pageHost, "โหลดหน้าไม่สำเร็จ โปรดรีเฟรชหน้าเว็บ", () => location.reload());
    return;
  }

  if (typeof mod.render !== "function") {
    pageHost.innerHTML = "";
    renderErrorBanner(pageHost, "Page module ไม่ถูกต้อง (ไม่มี render())", null);
    return;
  }

  // Page render
  try {
    const page = await mod.render(pageHost, { params, routeKey: key });
    currentPage = page || mod; // allow returning cleanup object or use module cleanup
  } catch (e) {
    pageHost.innerHTML = "";
    renderErrorBanner(pageHost, "เกิดข้อผิดพลาดระหว่าง render: " + (e?.message || String(e)), () => navigate());
  }
}
