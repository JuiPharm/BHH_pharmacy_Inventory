// pages/login.js
import { callApi, formatError } from "../api.js";
import { login } from "../auth.js";
import { renderSkeleton, showToast, escapeHtml } from "../ui.js";

export function render(container) {
  container.className = ""; // in login, container is #app (no shell)
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
                <label class="form-label">GAS_URL</label>
                <input type="url" class="form-control" id="gasUrl" placeholder="https://script.google.com/macros/s/....../exec" required>
                <div class="form-text">URL ของ Google Apps Script Web App (Deploy เป็น Web app)</div>
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

  // Prefill GAS_URL if exists
  gasUrlEl.value = localStorage.getItem("GAS_URL") || "";

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
    const gasUrl = gasUrlEl.value.trim();
    if (!gasUrl) {
      setAlert("warning", "กรุณากรอก GAS_URL");
      return;
    }
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
    const gasUrl = gasUrlEl.value.trim();
    const username = usernameEl.value.trim();
    const password = passwordEl.value;

    if (!gasUrl || !username || !password) {
      setAlert("warning", "กรุณากรอก GAS_URL, username และ password ให้ครบ");
      return;
    }

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

  return { cleanup() {} };
}
