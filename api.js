// api.js - reusable API client for Google Apps Script Web App (Single API Gateway)
// Supports:
//  - GET  GAS_URL?action=...&sessionToken=...&data={...}  (read actions)
//  - POST GAS_URL  body {action,data,sessionToken} (write actions)

import { forceLogout } from "./auth.js";

// Optional: set a default Web App URL here so users don't need to type it on the login screen.
// Example:
// export const DEFAULT_GAS_URL = "https://script.google.com/macros/s/XXXX/exec";
// Default GAS URL (recommend setting this in production to avoid asking users)
// Example:
// export const DEFAULT_GAS_URL = "https://script.google.com/macros/s/XXXX/exec";
export const DEFAULT_GAS_URL = "";

// If true and a GAS URL is available (DEFAULT_GAS_URL or saved GAS_URL), the login page will not show an
// editable GAS_URL field. This prevents end users from accidentally pointing to the wrong backend.
// To allow changing server from the login page, set this to false.
export const LOCK_GAS_URL = true;

const STORAGE_KEYS = {
  GAS_URL: "https://script.google.com/macros/s/AKfycbwz6YOLJmxuy8-8Pqg6B35wQfiyKPNiCqvpdbekCZVg_xkJXEIQScsX_-O8jBg43h2h/exec",
  SESSION_TOKEN: "sessionToken",
};

export function getConfig() {
  const gasUrl = localStorage.getItem(STORAGE_KEYS.GAS_URL) || DEFAULT_GAS_URL || "";
  const sessionToken = localStorage.getItem(STORAGE_KEYS.SESSION_TOKEN) || "";
  return { gasUrl, sessionToken };
}

export function safeJsonParse(text) {
  try {
    return { ok: true, value: JSON.parse(text) };
  } catch (e) {
    return { ok: false, value: null, error: e };
  }
}

export function formatError(err) {
  if (!err) return "เกิดข้อผิดพลาดที่ไม่ทราบสาเหตุ";
  if (typeof err === "string") return err;

  // Common response patterns
  const code = err.errorCode || err.code || err.name;
  const msg = err.message || err.error || err.msg;

  if (code && msg) return `[${code}] ${msg}`;
  if (msg) return msg;

  try {
    return JSON.stringify(err);
  } catch {
    return String(err);
  }
}

function isSessionInvalid(payload) {
  const code = (payload?.errorCode || payload?.code || "").toString().toUpperCase();
  const msg = (payload?.message || payload?.error || "").toString().toUpperCase();

  // Accept multiple backend naming conventions
  const codeHints = ["INVALID_TOKEN", "SESSION_EXPIRED", "UNAUTHORIZED", "AUTH_REQUIRED", "TOKEN_INVALID"];
  const msgHints = ["INVALID", "EXPIRED", "UNAUTHORIZED", "TOKEN", "SESSION"];

  return codeHints.includes(code) || msgHints.some((h) => msg.includes(h));
}

/**
 * callApi(action, data, opts)
 * - Always POST to GAS_URL
 * - Must set Content-Type: text/plain;charset=utf-8
 * - Body: JSON.stringify({action, data, sessionToken})
 *
 * opts:
 *  - gasUrlOverride: use this GAS URL (e.g., before storage is set on login)
 *  - sessionTokenOverride: use this token (rare)
 */
export async function callApi(action, data = {}, opts = {}) {
  const { gasUrl: storedUrl, sessionToken: storedToken } = getConfig();
  const gasUrl = (opts.gasUrlOverride ?? storedUrl ?? "").trim();
  const sessionToken = (opts.sessionTokenOverride ?? storedToken ?? "").trim();

  if (!gasUrl) {
    return { ok: false, errorCode: "NO_GAS_URL", message: "กรุณาระบุ GAS_URL ก่อนเรียกใช้งานระบบ" };
  }

  const payload = { action, data, sessionToken };

  // Read actions can go via GET (easier to debug; avoids some POST overhead).
  // Writes always use POST (server validates; FE must not be trusted).
  const READ_ACTIONS = new Set([
    "health",
    "dashboard_snapshot",
    "get_stock_summary",
    "get_stock_summary_all",
    "list_items",
    "list_vendors",
    "list_warehouses",
    "list_requisitions",
    "get_requisition_detail",
  ]);

  const forcePost = Boolean(opts.forcePost);
  const method = forcePost ? "POST" : (READ_ACTIONS.has(action) ? "GET" : "POST");

  let resp;
  let text;
  try {
    if (method === "GET") {
      const url = buildGatewayUrl_(gasUrl, action, sessionToken, data);
      resp = await fetch(url, { method: "GET", cache: "no-store", mode: "cors" });
      text = await resp.text();
    } else {
      resp = await fetch(gasUrl, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify(payload),
        cache: "no-store",
        mode: "cors",
      });
      text = await resp.text();
    }
  } catch (networkErr) {
    return { ok: false, success: false, errorCode: "NETWORK_ERROR", message: "เชื่อมต่อไม่ได้ โปรดตรวจสอบเครือข่าย/URL", error: String(networkErr) };
  }

  const parsed = safeJsonParse(text);
  if (!parsed.ok) {
    return {
      ok: false,
      errorCode: "INVALID_JSON",
      message: "รูปแบบข้อมูลตอบกลับไม่ถูกต้อง (ไม่ใช่ JSON)",
      details: text?.slice(0, 500),
      httpStatus: resp?.status,
    };
  }

  const result = parsed.value;

  // Standard contract uses success; legacy uses ok. Normalize both.
  const ok = result?.ok ?? result?.success ?? false;
  if (typeof result === "object" && result) {
    if (typeof result.ok === "undefined") result.ok = Boolean(ok);
    if (typeof result.success === "undefined") result.success = Boolean(ok);
    if (!result.updatedAt && result.updated_at) result.updatedAt = result.updated_at;
  }

  if (!ok && isSessionInvalid(result)) {
    // Force logout and redirect to login to prevent loops
    forceLogout();
    return { ok: false, errorCode: "SESSION_INVALID", message: "เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่" };
  }

  // Attach httpStatus for debugging
  if (typeof result === "object" && result) result.httpStatus = resp?.status;

  return result;
}

function buildGatewayUrl_(baseUrl, action, sessionToken, data) {
  const u = new URL(baseUrl);
  u.searchParams.set("action", action);
  if (sessionToken) u.searchParams.set("sessionToken", sessionToken);
  if (data && Object.keys(data).length) {
    // Keep nested data safe by sending a JSON string.
    u.searchParams.set("data", JSON.stringify(data));
  }
  return u.toString();
}
