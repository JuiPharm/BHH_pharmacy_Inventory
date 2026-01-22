// pages/login.js
import { callApi, formatError, DEFAULT_GAS_URL, LOCK_GAS_URL } from "../api.js";
import { login } from "../auth.js";
import { renderSkeleton, showToast, escapeHtml } from "../ui.js";

export function render(container) {
  container.className = ""; // in login, container is #app (no shell)

  // Determine effective GAS URL
  const savedUrl = (localStorage.getItem("GAS_URL") || "").trim();
  const defaultUrl = (DEFAULT_GAS_URL || "").trim();
  const initialUrl = savedUrl || defaultUrl || "";
  let currentUrl = initialUrl;
  // If user hasn't saved yet but DEFAULT_GAS_URL is set, persist it to satisfy the constraint "store GAS_URL in localStorage".
  if (!savedUrl && defaultUrl) localStorage.setItem("GAS_URL", defaultUrl);

  // If URL is locked and we already have one, hide editable input entirely.
  // If URL is missing, allow input even if locked (otherwise user cannot proceed).
  const canEditUrl = !LOCK_GAS_URL || !initialUrl;

  container.innerHTML = `
    <div class="container py-4 py-lg-5">
      <div class="row justify-content-center">
        <div class="col-12 col-md-8 col-lg-5">
          <div class="text-center mb-4">
            <div class="h3 mb-1">Inventory / เบิกจ่าย</div>
            <div class="text-muted">Frontend (Static) + Google Apps Script API</div>
          </div>

          <div class="card shadow-sm">
            <div class="card-body p-4">
              <div id="alertHost"></div>

              <div class="mb-3">
                <div class="d-flex align-items-center justify-content-between">
                  <div class="small text-muted">Server</div>
                  ${canEditUrl ? `
                    <button class="btn btn-sm btn-outline-secondary" type="button" data-bs-toggle="collapse" data-bs-target="#advServer" aria-expanded="false" aria-controls="advServer">
                      <i class="bi bi-gear me-1"></i>เปลี่ยนเซิร์ฟเวอร์ (Advanced)
                    </button>
                  ` : `
                    <span class="badge text-bg-light">Locked</span>
                  `}
                </div>

                <div class="mt-1">
                  <div class="d-flex align-items-center gap-2">
                    <i class="bi bi-hdd-network text-muted"></i>
                    <div class="small">
                      <span class="text-muted" id="serverUrlLabel">${escapeHtml(currentUrl ? currentUrl : "ยังไม่ได้ตั้งค่า")}</span>
                    </div>
                    ${currentUrl ? `
                      <button class="btn btn-sm btn-link p-0" type="button" id="btnCopyUrl" title="Copy URL">
                        <i class="bi bi-clipboard"></i>
                      </button>
                    ` : ""}
                  </div>
                </div>

                ${canEditUrl ? `
                  <div class="collapse mt-2" id="advServer">
                    <div class="border rounded p-3 bg-body-tertiary">
                      <label class="form-label">GAS_URL</label>
                      <input type="url" class="form-control" id="gasUrl" placeholder="https://script.google.com/macros/s/....../exec" ${initialUrl ? "" : "required"}>
                      <div class="form-text">ระบุ URL ของ Google Apps Script Web App (Deploy เป็น Web app)</div>
                      <div class="d-flex justify-content-end mt-2">
                        <button class="btn btn-sm btn-outline-primary" type="button" id="btnSaveUrl">
                          <i class="bi bi-save me-1"></i>บันทึก
                        </button>
                      </div>
                    </div>
                  </div>
                ` : ""}
              </div>

              <div class="mb-3">
                <label class="form-label">Username</label>
                <input type="text" class="form-control" id="username" autocomplete="username" required>
              </div>

              <div class="mb-3">
                <label class="form-label">Password</label>
                <input type="password" class="form-control" id="password" autocomplete="current-password" required>
              </div>

              <div class="d-grid gap-2">
                <button class="btn btn-outline-primary" id="btnTest">
                  <i class="bi bi-plug me-1"></i>Test Connection
                </button>
                <button class="btn btn-primary" id="btnLogin">
                  <i class="bi bi-box-arrow-in-right me-1"></i>Login
                </button>
              </div>

              <div class="mt-3 small text-muted">
                หมายเหตุ: ระบบจะเก็บ session ไว้ใน localStorage ของเบราว์เซอร์
              </div>
            </div>
          </div>

          <div class="text-center mt-4 small text-muted">
            ใช้ Hash routing เช่น <span class="code-badge">#/dashboard</span>
          </div>
        </div>
      </div>
    </div>
  `;

  const gasUrlEl = container.querySelector("#gasUrl");
  const usernameEl = container.querySelector("#username");
  const passwordEl = container.querySelector("#password");
  const alertHost = container.querySelector("#alertHost");
  const btnTest = container.querySelector("#btnTest");
  const btnLogin = container.querySelector("#btnLogin");
  const btnCopyUrl = container.querySelector("#btnCopyUrl");
  const btnSaveUrl = container.querySelector("#btnSaveUrl");
  const serverUrlLabel = container.querySelector("#serverUrlLabel");

  // Prefill advanced input (if present)
  if (gasUrlEl) gasUrlEl.value = initialUrl;

  const getGasUrl = () => {
    if (gasUrlEl) return gasUrlEl.value.trim();
    return (localStorage.getItem("GAS_URL") || DEFAULT_GAS_URL || "").trim();
  };

  const persistGasUrl = (url) => {
    const u = String(url || "").trim();
    if (u) {
      localStorage.setItem("GAS_URL", u);
      currentUrl = u;
      if (serverUrlLabel) serverUrlLabel.textContent = u;
    }
  };

  const setAlert = (type, msg) => {
    alertHost.innerHTML = `
      <div class="alert alert-${type} d-flex align-items-start gap-2" role="alert">
        <i class="bi ${type === "success" ? "bi-check-circle-fill" : type === "warning" ? "bi-exclamation-circle-fill" : "bi-exclamation-triangle-fill"} mt-1"></i>
        <div>${escapeHtml(msg)}</div>
      </div>
    `;
  };

  btnTest.addEventListener("click", async () => {
    alertHost.innerHTML = "";
    const gasUrl = getGasUrl();
    if (!gasUrl) {
      setAlert("warning", "กรุณาตั้งค่า GAS_URL (กดปุ่ม Advanced เพื่อกรอก URL)");
      return;
    }
    persistGasUrl(gasUrl);
    btnTest.disabled = true;
    btnTest.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>กำลังทดสอบ...';

    const res = await callApi("health", {}, { gasUrlOverride: gasUrl, sessionTokenOverride: "" });

    btnTest.disabled = false;
    btnTest.innerHTML = '<i class="bi bi-plug me-1"></i>Test Connection';

    if (res?.ok) {
      setAlert("success", "เชื่อมต่อสำเร็จ (health OK)");
    } else {
      setAlert("danger", "เชื่อมต่อไม่สำเร็จ: " + (res?.message || res?.error || "ไม่ทราบสาเหตุ"));
    }
  });

  btnLogin.addEventListener("click", async () => {
    alertHost.innerHTML = "";
    const gasUrl = getGasUrl();
    const username = usernameEl.value.trim();
    const password = passwordEl.value;

    if (!gasUrl || !username || !password) {
      setAlert("warning", gasUrl ? "กรุณากรอก username และ password ให้ครบ" : "กรุณาตั้งค่า GAS_URL (Advanced) และกรอก username/password");
      return;
    }

    persistGasUrl(gasUrl);

    btnLogin.disabled = true;
    btnLogin.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>กำลังเข้าสู่ระบบ...';

    const res = await login(username, password, gasUrl);

    btnLogin.disabled = false;
    btnLogin.innerHTML = '<i class="bi bi-box-arrow-in-right me-1"></i>Login';

    if (res?.ok) {
      showToast("เข้าสู่ระบบสำเร็จ", "success");
      location.hash = "#/dashboard";
    } else {
      setAlert("danger", "เข้าสู่ระบบไม่สำเร็จ: " + (res?.message || res?.error || "กรุณาตรวจสอบข้อมูล"));
    }
  });

  // Optional helpers
  if (btnCopyUrl) {
    btnCopyUrl.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(currentUrl || "");
        showToast("คัดลอก GAS_URL แล้ว", "success");
      } catch {
        showToast("คัดลอกไม่สำเร็จ", "danger");
      }
    });
  }

  if (btnSaveUrl && gasUrlEl) {
    btnSaveUrl.addEventListener("click", () => {
      const u = gasUrlEl.value.trim();
      if (!u) {
        setAlert("warning", "กรุณากรอก GAS_URL ก่อนบันทึก");
        return;
      }
      persistGasUrl(u);
      showToast("บันทึก GAS_URL แล้ว", "success");
    });
  }

  return { cleanup() {} };
}
