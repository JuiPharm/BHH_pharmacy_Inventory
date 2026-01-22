// pages/transactions.js (STORE/ADMIN)
import { callApi, formatError } from "../api.js";
import { renderSkeleton, renderErrorBanner, showToast, escapeHtml, fmtNumber, dispatchAppEvent } from "../ui.js";

let items = [];
let warehouses = [];

function buildDatalistOptions(list) {
  return list.map(i => `<option value="${escapeHtml(i.item_code || i.itemCode || i.code || "")}">${escapeHtml(i.name_th || i.name || "")}</option>`).join("");
}

function buildWarehouseOptions(list) {
  return list.map(w => {
    const code = w.warehouse_code || w.code || w.id || w.name || "";
    const label = w.name_th || w.name || code;
    return `<option value="${escapeHtml(code)}">${escapeHtml(label)}</option>`;
  }).join("");
}

function validateEmail(email) {
  if (!email) return true;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

async function loadMasters() {
  const [rItems, rWh] = await Promise.all([
    callApi("list_items", {}),
    callApi("list_warehouses", {}),
  ]);
  if (rItems?.ok) items = rItems.data?.items || rItems.items || rItems.data || [];
  if (rWh?.ok) warehouses = rWh.data?.warehouses || rWh.warehouses || rWh.data || [];
}

async function refreshStockSummaryQuick() {
  // Requirement: refresh stock summary immediately after submit success
  await callApi("get_stock_summary", {});
  dispatchAppEvent("stock-updated", { at: Date.now() });
}

function renderTabs(container) {
  container.innerHTML = `
    <ul class="nav nav-tabs" id="txTabs" role="tablist">
      <li class="nav-item" role="presentation">
        <button class="nav-link active" id="receive-tab" data-bs-toggle="tab" data-bs-target="#receive" type="button" role="tab">Receive</button>
      </li>
      <li class="nav-item" role="presentation">
        <button class="nav-link" id="issue-tab" data-bs-toggle="tab" data-bs-target="#issue" type="button" role="tab">Issue</button>
      </li>
    </ul>

    <div class="tab-content pt-3">
      <div class="tab-pane fade show active" id="receive" role="tabpanel">
        <div id="receiveHost"></div>
      </div>
      <div class="tab-pane fade" id="issue" role="tabpanel">
        <div id="issueHost"></div>
      </div>
    </div>
  `;
}

function renderReceiveForm(host) {
  const itemOptions = buildDatalistOptions(items);
  const whOptions = buildWarehouseOptions(warehouses);

  host.innerHTML = `
    <div class="card shadow-sm">
      <div class="card-body">
        <div id="rAlert"></div>
        <form id="frmReceive" class="row g-3 needs-validation" novalidate>
          <div class="col-12 col-md-6">
            <label class="form-label">ref_no</label>
            <input class="form-control" name="ref_no" required>
            <div class="invalid-feedback">กรุณาระบุ ref_no</div>
          </div>
          <div class="col-12 col-md-6">
            <label class="form-label">warehouse_code</label>
            <select class="form-select" name="warehouse_code" required>
              <option value="">เลือกคลัง</option>
              ${whOptions}
            </select>
            <div class="invalid-feedback">กรุณาเลือกคลัง</div>
          </div>

          <div class="col-12 col-md-8">
            <label class="form-label">item_code</label>
            <input class="form-control" name="item_code" list="dlItems" required placeholder="พิมพ์เพื่อค้นหา">
            <datalist id="dlItems">${itemOptions}</datalist>
            <div class="invalid-feedback">กรุณาระบุ item_code</div>
          </div>
          <div class="col-6 col-md-2">
            <label class="form-label">qty</label>
            <input type="number" step="0.01" min="0.01" class="form-control" name="qty" required>
            <div class="invalid-feedback">qty ต้องมากกว่า 0</div>
          </div>
          <div class="col-6 col-md-2">
            <label class="form-label">uom</label>
            <input class="form-control" name="uom" required placeholder="เช่น EA">
            <div class="invalid-feedback">กรุณาระบุ uom</div>
          </div>

          <div class="col-12 d-flex justify-content-end">
            <button class="btn btn-primary" type="submit" id="btnSubmitReceive">
              <i class="bi bi-box-arrow-in-down me-1"></i>บันทึกรับเข้า (Receive)
            </button>
          </div>
        </form>
      </div>
    </div>
  `;

  const form = host.querySelector("#frmReceive");
  const btn = host.querySelector("#btnSubmitReceive");
  const alert = host.querySelector("#rAlert");

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    e.stopPropagation();

    if (!form.checkValidity()) {
      form.classList.add("was-validated");
      return;
    }

    const data = Object.fromEntries(new FormData(form).entries());
    data.qty = Number(data.qty);

    btn.disabled = true;
    btn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>กำลังบันทึก...';
    alert.innerHTML = "";

    const res = await callApi("create_receipt", data);

    btn.disabled = false;
    btn.innerHTML = '<i class="bi bi-box-arrow-in-down me-1"></i>บันทึกรับเข้า (Receive)';

    if (res?.ok) {
      showToast("บันทึก Receive สำเร็จ", "success");
      form.reset();
      form.classList.remove("was-validated");
      await refreshStockSummaryQuick();
    } else {
      alert.innerHTML = `<div class="alert alert-danger">ไม่สำเร็จ: ${escapeHtml(res?.message || formatError(res))}</div>`;
    }
  });
}

function renderIssueForm(host) {
  const itemOptions = buildDatalistOptions(items);
  const whOptions = buildWarehouseOptions(warehouses);

  host.innerHTML = `
    <div class="card shadow-sm">
      <div class="card-body">
        <div id="iAlert"></div>
        <form id="frmIssue" class="row g-3 needs-validation" novalidate>
          <div class="col-12 col-md-6">
            <label class="form-label">ref_no</label>
            <input class="form-control" name="ref_no" required>
            <div class="invalid-feedback">กรุณาระบุ ref_no</div>
          </div>
          <div class="col-12 col-md-6">
            <label class="form-label">warehouse_code</label>
            <select class="form-select" name="warehouse_code" required>
              <option value="">เลือกคลัง</option>
              ${whOptions}
            </select>
            <div class="invalid-feedback">กรุณาเลือกคลัง</div>
          </div>

          <div class="col-12 col-md-8">
            <label class="form-label">item_code</label>
            <input class="form-control" name="item_code" list="dlItems2" required placeholder="พิมพ์เพื่อค้นหา">
            <datalist id="dlItems2">${itemOptions}</datalist>
            <div class="invalid-feedback">กรุณาระบุ item_code</div>
          </div>
          <div class="col-6 col-md-2">
            <label class="form-label">qty</label>
            <input type="number" step="0.01" min="0.01" class="form-control" name="qty" required>
            <div class="invalid-feedback">qty ต้องมากกว่า 0</div>
          </div>
          <div class="col-6 col-md-2">
            <label class="form-label">dept</label>
            <select class="form-select" name="dept" required>
              <option value="">เลือกหน่วยงาน</option>
              <option value="OPD">OPD</option>
              <option value="IPD">IPD</option>
              <option value="IV Chemo">IV Chemo</option>
            </select>
            <div class="invalid-feedback">กรุณาระบุ dept</div>
          </div>

          <div class="col-12 col-md-6">
            <label class="form-label">requester</label>
            <input class="form-control" name="requester" required>
            <div class="invalid-feedback">กรุณาระบุ requester</div>
          </div>
          <div class="col-12 col-md-6">
            <label class="form-label">remark</label>
            <input class="form-control" name="remark" placeholder="(optional)">
          </div>

          <div class="col-12 d-flex justify-content-end">
            <button class="btn btn-primary" type="submit" id="btnSubmitIssue">
              <i class="bi bi-box-arrow-up me-1"></i>บันทึกเบิกออก (Issue)
            </button>
          </div>
        </form>
      </div>
    </div>
  `;

  const form = host.querySelector("#frmIssue");
  const btn = host.querySelector("#btnSubmitIssue");
  const alert = host.querySelector("#iAlert");

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    e.stopPropagation();

    if (!form.checkValidity()) {
      form.classList.add("was-validated");
      return;
    }

    const data = Object.fromEntries(new FormData(form).entries());
    data.qty = Number(data.qty);

    btn.disabled = true;
    btn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>กำลังบันทึก...';
    alert.innerHTML = "";

    const res = await callApi("create_issue", data);

    btn.disabled = false;
    btn.innerHTML = '<i class="bi bi-box-arrow-up me-1"></i>บันทึกเบิกออก (Issue)';

    if (res?.ok) {
      const pdfUrl = res?.data?.pdf_url || res?.pdf_url || '';
      showToast('บันทึก Issue สำเร็จ', 'success');
      if (pdfUrl) {
        alert.innerHTML = `<div class="alert alert-success">บันทึกสำเร็จ — PDF: <a target="_blank" rel="noopener" href="${escapeHtml(pdfUrl)}">เปิดไฟล์ PDF</a></div>`;
      }
      form.reset();
      form.classList.remove('was-validated');
      await refreshStockSummaryQuick();
    } else {
      // Handle INSUFFICIENT_STOCK with friendly guidance
      const code = (res?.errorCode || res?.code || "").toString().toUpperCase();
      if (code === "INSUFFICIENT_STOCK") {
        const onHand = res?.on_hand ?? res?.details?.on_hand ?? res?.data?.on_hand ?? res?.data?.onHand;
        alert.innerHTML = `
          <div class="alert alert-warning">
            <div class="fw-semibold mb-1">สต็อกไม่พอ (INSUFFICIENT_STOCK)</div>
            <div>คงเหลือปัจจุบัน: <span class="fw-semibold">${escapeHtml(fmtNumber(onHand))}</span></div>
            <div class="mt-1">คำแนะนำ: ตรวจสอบคลัง/ยอดรับเข้า หรือปรับ qty ให้ไม่เกินยอดคงเหลือ</div>
          </div>
        `;
      } else {
        alert.innerHTML = `<div class="alert alert-danger">ไม่สำเร็จ: ${escapeHtml(res?.message || formatError(res))}</div>`;
      }
    }
  });
}

async function loadPage(container) {
  renderSkeleton(container, { rows: 8 });

  await loadMasters();

  container.innerHTML = `
    <div class="mb-3 text-muted small">
      ฟอร์มนี้ใช้ autocomplete รายการสินค้า (จาก <span class="code-badge">list_items</span>) และคลัง (จาก <span class="code-badge">list_warehouses</span>)
    </div>
    <div id="tabsHost"></div>
  `;

  const tabsHost = container.querySelector("#tabsHost");
  renderTabs(tabsHost);
  renderReceiveForm(container.querySelector("#receiveHost"));
  renderIssueForm(container.querySelector("#issueHost"));
}

export async function render(container) {
  await loadPage(container);
  return { cleanup() {} };
}
