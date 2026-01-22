// api.js - reusable API client for Google Apps Script Web App (JSON API)
// Constraint: must POST with Content-Type text/plain;charset=utf-8

import { forceLogout } from "./auth.js";

// Optional: set a default Web App URL here so users don't need to type it on the login screen.
// Example:
// export const DEFAULT_GAS_URL = "https://script.google.com/macros/s/XXXX/exec";
// Default GAS URL (recommend setting this in production to avoid asking users)
// Example:
// export const DEFAULT_GAS_URL = "https://script.google.com/macros/s/XXXX/exec";
export const DEFAULT_GAS_URL = "https://script.google.com/macros/s/AKfycbwz6YOLJmxuy8-8Pqg6B35wQfiyKPNiCqvpdbekCZVg_xkJXEIQScsX_-O8jBg43h2h/exec";

// If true and a GAS URL is available (DEFAULT_GAS_URL or saved GAS_URL), the login page will not show an
// editable GAS_URL field. This prevents end users from accidentally pointing to the wrong backend.
// To allow changing server from the login page, set this to false.
export const LOCK_GAS_URL = true;

const STORAGE_KEYS = {
  GAS_URL: "GAS_URL",
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

  let resp;
  let text;
  try {
    resp = await fetch(gasUrl, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(payload),
      cache: "no-store",
      mode: "cors",
    });
    text = await resp.text();
  } catch (networkErr) {
    return { ok: false, errorCode: "NETWORK_ERROR", message: "เชื่อมต่อไม่ได้ โปรดตรวจสอบเครือข่าย/URL", details: String(networkErr) };
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

  // Some backends return ok boolean; some use success
  const ok = result?.ok ?? result?.success ?? false;

  if (!ok && isSessionInvalid(result)) {
    // Force logout and redirect to login to prevent loops
    forceLogout();
    return { ok: false, errorCode: "SESSION_INVALID", message: "เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่" };
  }

  // Attach httpStatus for debugging
  if (typeof result === "object" && result) result.httpStatus = resp?.status;

  return result;
}
