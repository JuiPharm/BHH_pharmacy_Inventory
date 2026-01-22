// auth.js - authentication + RBAC helpers
import { callApi } from "./api.js";

const STORAGE_KEYS = {
  GAS_URL: "GAS_URL",
  SESSION_TOKEN: "sessionToken",
  ROLE: "role",
  PROFILE: "profile",
};

export function setSession({ gasUrl, sessionToken, role, profile }) {
  if (gasUrl) localStorage.setItem(STORAGE_KEYS.GAS_URL, gasUrl);
  if (sessionToken) localStorage.setItem(STORAGE_KEYS.SESSION_TOKEN, sessionToken);
  if (role) localStorage.setItem(STORAGE_KEYS.ROLE, role);
  if (profile) localStorage.setItem(STORAGE_KEYS.PROFILE, JSON.stringify(profile ?? {}));
}

export function clearSession() {
  localStorage.removeItem(STORAGE_KEYS.GAS_URL);
  localStorage.removeItem(STORAGE_KEYS.SESSION_TOKEN);
  localStorage.removeItem(STORAGE_KEYS.ROLE);
  localStorage.removeItem(STORAGE_KEYS.PROFILE);
}

export function getRole() {
  return (localStorage.getItem(STORAGE_KEYS.ROLE) || "").toUpperCase();
}

export function getProfile() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEYS.PROFILE) || "{}");
  } catch {
    return {};
  }
}

export function getGasUrl() {
  return localStorage.getItem(STORAGE_KEYS.GAS_URL) || "";
}

export function isAuthed() {
  return Boolean(localStorage.getItem(STORAGE_KEYS.SESSION_TOKEN));
}

export function requireAuth() {
  if (!isAuthed()) {
    location.hash = "#/login";
    return false;
  }
  return true;
}

/**
 * UI-side RBAC enforcement (Frontend gate only)
 * Routes:
 *  - dashboard
 *  - stock
 *  - transactions
 *  - requisitions
 *  - admin
 */
export function enforceRouteRBAC(route) {
  const role = getRole();

  const allow = {
    REQUESTER: new Set(["dashboard", "stock", "requisitions"]),
    STORE: new Set(["dashboard", "stock", "transactions", "requisitions"]),
    ADMIN: new Set(["dashboard", "stock", "transactions", "requisitions", "admin"]),
  };

  // default deny if unknown role
  const permitted = allow[role];
  if (!permitted) return false;

  // stock is read-only for REQUESTER; editable aspects are handled in page UI
  return permitted.has(route);
}

export async function login(username, password, gasUrl) {
  const res = await callApi(
    "auth_login",
    { username, password },
    { gasUrlOverride: gasUrl, sessionTokenOverride: "" }
  );

  if (!res?.ok) return res;

  // Expected: sessionToken, role, profile
  const sessionToken = res.sessionToken || res.data?.sessionToken || "";
  const role = res.role || res.data?.role || "";
  const profile = res.profile || res.data?.profile || {};

  setSession({ gasUrl, sessionToken, role, profile });
  return { ok: true, sessionToken, role, profile };
}

export async function logout() {
  // Best-effort: call backend logout, then clear storage
  try {
    await callApi("auth_logout", {});
  } catch {
    // ignore
  } finally {
    clearSession();
  }
}

export function forceLogout() {
  clearSession();
  // Avoid infinite loops: only redirect if not already on login
  if (!location.hash.startsWith("#/login")) {
    location.hash = "#/login";
  }
}
