// pages/requisitions.js
import { callApi, formatError } from "../api.js";
import { renderSkeleton, renderErrorBanner, showToast, escapeHtml, confirmModal, fmtDateTime, getLocalCache, setLocalCache } from "../ui.js";
import { getRole } from "../auth.js";

let items = [];

function canCreate() {
  const role = getRole();
  return role === "REQUESTER" || role === "ADMIN";
}


async function loadItems() {
  const cached = getLocalCache("masters_items");
  if (Array.isArray(cached) && cached.length) {
    items = cached;
    return;
  }
  const res = await callApi("list_items", {});
  if (res?.ok) items = res.data?.items || res.items || res.data || [];
  setLocalCache("masters_items", items, 5 * 60 * 1000);
}

function itemDatalist() {
  return items.map(i => {
    const code = i.item_code || i.itemCode || i.code || "";
    const name = i.name_th || i.name || "";
    return `<option value="${escapeHtml(code)}">${escapeHtml(name)}</option>`;
  }).join("");
}

function validateEmail(email) {
  if (!email) return true;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function buildListTable(rows) {
  return `
    <div class="card shadow-sm">
      <div class="card-body p-0">
        <div class="table-responsive">
          <table class="table table-hover align-middle mb-0">
            <thead>
              <tr>
                <th>Req No</th>
                <th>Status</th>
                <th>Dept</th>
                <th>Requester</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              ${rows.length ? rows.map(r => `
                <tr role="button" data-id="${escapeHtml(r.req_id || r.id || r.reqNo || "")}">
                  <td class="fw-semibold">${escapeHtml(r.req_id || r.id || r.reqNo || "")}</td>
                  <td><span class="badge text-bg-${(['ISSUED','SUBMITTED'].includes((r.status||'').toUpperCase()) ? 'success' : 'secondary')}">${escapeHtml(r.status || "")}</span></td>
                  <td>${escapeHtml(r.dept || "")}</td>
                  <td>${escapeHtml(r.requester || "")}</td>
                  <td>${escapeHtml(r.created_at ? fmtDateTime(r.created_at) : (r.created || ""))}</td>
                </tr>
              `).join("") : `<tr><td colspan="5" class="text-center text-muted py-4">ไม่มีรายการ</td></tr>`}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;
}

function newLineRow(idx) {
  return `
    <tr data-idx="${idx}">
      <td style="min-width: 180px;">
        <input class="form-control form-control-sm" name="item_code_${idx}" list="dlReqItems" required placeholder="item_code">
        <div class="invalid-feedback">required</div>
      </td>
      <td style="min-width: 110px;">
        <input type="number" min="0.01" step="0.01" class="form-control form-control-sm" name="qty_${idx}" required>
        <div class="invalid-feedback">&gt; 0</div>
      </td>
      <td style="min-width: 90px;">
        <input class="form-control form-control-sm" name="uom_${idx}" required placeholder="EA">
        <div class="invalid-feedback">required</div>
      </td>
      <td style="min-width: 240px;">
        <input class="form-control form-control-sm" name="remark_${idx}" placeholder="(optional)">
      </td>
      <td class="text-end" style="width: 60px;">
        <button class="btn btn-sm btn-outline-danger" type="button" data-remove="${idx}" title="ลบแถว">
          <i class="bi bi-trash"></i>
        </button>
      </td>
    </tr>
  `;
}

function collectLines(tbody) {
  const rows = Array.from(tbody.querySelectorAll("tr"));
  const lines = rows.map((tr) => {
    const idx = tr.getAttribute("data-idx");
    const item_code = tr.querySelector(`[name="item_code_${idx}"]`)?.value.trim();
    const qty = Number(tr.querySelector(`[name="qty_${idx}"]`)?.value);
    const uom = tr.querySelector(`[name="uom_${idx}"]`)?.value.trim();
    const remark = tr.querySelector(`[name="remark_${idx}"]`)?.value.trim();
    return { item_code, qty, uom, remark };
  });

  // filter empty rows defensively
  return lines.filter(l => l.item_code && l.qty > 0 && l.uom);
}

async function renderListView(container) {
  container.innerHTML = `
    <div class="d-flex flex-column flex-md-row justify-content-between align-items-start align-items-md-center gap-2 mb-3">
      <div class="d-flex flex-column flex-md-row gap-2 align-items-start align-items-md-center">
        <select class="form-select" id="status" style="min-width: 180px;">
          <option value="">ทุกสถานะ</option>
          <option value="DRAFT">DRAFT</option>
          <option value="ISSUED">ISSUED</option>
          <option value="SUBMITTED">SUBMITTED (legacy)</option>
        </select>
        <input type="date" class="form-control" id="dateFrom">
        <input type="date" class="form-control" id="dateTo">
        <button class="btn btn-outline-primary" id="btnFilter"><i class="bi bi-funnel me-1"></i>Filter</button>
      </div>
      ${canCreate() ? `<a class="btn btn-primary" href="#/requisitions?mode=create"><i class="bi bi-plus-lg me-1"></i>Create</a>` : ""}
    </div>

    <div id="listHost"></div>
  `;

  const listHost = container.querySelector("#listHost");
  renderSkeleton(listHost, { rows: 7 });

  const fetchList = async () => {
    renderSkeleton(listHost, { rows: 7 });
    const status = container.querySelector("#status").value;
    const dateFrom = container.querySelector("#dateFrom").value;
    const dateTo = container.querySelector("#dateTo").value;

    const res = await callApi("list_requisitions", { status, dateFrom, dateTo });
    if (!res?.ok) {
      listHost.innerHTML = "";
      renderErrorBanner(listHost, res?.message || formatError(res), fetchList);
      return;
    }
    const rows = res.data?.requisitions || res.requisitions || res.data || [];
    listHost.innerHTML = buildListTable(rows);

    listHost.querySelectorAll("tr[data-id]").forEach((tr) => {
      tr.addEventListener("click", () => {
        const id = tr.getAttribute("data-id");
        if (id) location.hash = `#/requisitions?id=${encodeURIComponent(id)}`;
      });
    });
  };

  container.querySelector("#btnFilter").addEventListener("click", fetchList);
  await fetchList();
}

async function renderDetailView(container, reqId) {
  renderSkeleton(container, { rows: 10 });

  const res = await callApi("get_requisition_detail", { req_id: reqId });
  if (!res?.ok) {
    container.innerHTML = "";
    renderErrorBanner(container, res?.message || formatError(res), () => renderDetailView(container, reqId));
    return;
  }

  const data = res.data || res;
  const header = data.header || data;
  const lines = data.lines || [];

  container.innerHTML = `
    <div class="d-flex justify-content-between align-items-start gap-2 mb-3">
      <div>
        <div class="h5 mb-1">Requisition: ${escapeHtml(reqId)}</div>
        <div class="text-muted small">Status: <span class="badge text-bg-${(['ISSUED','SUBMITTED'].includes((header.status||'').toUpperCase()) ? 'success' : 'secondary')}">${escapeHtml(header.status || "")}</span></div>
      </div>
      <div class="d-flex gap-2">
        <a class="btn btn-outline-secondary" href="#/requisitions"><i class="bi bi-arrow-left me-1"></i>Back</a>
        ${header.pdf_url ? `<a class="btn btn-primary" target="_blank" rel="noopener" href="${escapeHtml(header.pdf_url)}"><i class="bi bi-file-earmark-pdf me-1"></i>Open PDF</a>` : ""}
      </div>
    </div>

    <div class="row g-3">
      <div class="col-12 col-lg-5">
        <div class="card shadow-sm">
          <div class="card-body">
            <div class="row g-2 small">
              <div class="col-5 text-muted">Dept</div><div class="col-7">${escapeHtml(header.dept || "")}</div>
              <div class="col-5 text-muted">Requester</div><div class="col-7">${escapeHtml(header.requester || "")}</div>
              <div class="col-5 text-muted">Requester Email</div><div class="col-7">${escapeHtml(header.requester_email || "")}</div>
              <div class="col-5 text-muted">Warehouse</div><div class="col-7">${escapeHtml(header.warehouse_code || "")}</div>              <div class="col-5 text-muted">Remark</div><div class="col-7">${escapeHtml(header.remark || "")}</div>
            </div>
          </div>
        </div>
      </div>
      <div class="col-12 col-lg-7">
        <div class="card shadow-sm">
          <div class="card-header fw-semibold">Lines</div>
          <div class="card-body p-0">
            <div class="table-responsive">
              <table class="table table-sm mb-0 align-middle">
                <thead>
                  <tr>
                    <th>item_code</th>
                    <th class="text-end">qty</th>
                    <th>uom</th>
                    <th>remark</th>
                  </tr>
                </thead>
                <tbody>
                  ${lines.length ? lines.map(l => `
                    <tr>
                      <td class="fw-semibold">${escapeHtml(l.item_code || "")}</td>
                      <td class="text-end">${escapeHtml(l.qty ?? "")}</td>
                      <td>${escapeHtml(l.uom || "")}</td>
                      <td>${escapeHtml(l.remark || "")}</td>
                    </tr>
                  `).join("") : `<tr><td colspan="4" class="text-center text-muted py-4">ไม่มีรายการ</td></tr>`}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}

async function renderCreateView(container) {
  if (!canCreate()) {
    container.innerHTML = `
      <div class="alert alert-warning">
        คุณไม่มีสิทธิ์สร้าง Requisition (เฉพาะ REQUESTER/ADMIN)
      </div>
      <a class="btn btn-outline-secondary" href="#/requisitions"><i class="bi bi-arrow-left me-1"></i>Back</a>
    `;
    return;
  }

  await loadItems();

  container.innerHTML = `
    <div class="d-flex justify-content-between align-items-start gap-2 mb-3">
      <div>
        <div class="h5 mb-1">Create Requisition</div>
        <div class="text-muted small">บันทึกเป็น Draft หรือ Submit เพื่อ “ตัดสต็อกทันที” และสร้าง PDF</div>
      </div>
      <div>
        <a class="btn btn-outline-secondary" href="#/requisitions"><i class="bi bi-arrow-left me-1"></i>Back</a>
      </div>
    </div>

    <div id="resultHost"></div>

    <form id="frmReq" class="needs-validation" novalidate>
      <div class="card shadow-sm mb-3">
        <div class="card-header fw-semibold">Header</div>
        <div class="card-body">
          <div class="row g-3">
            <div class="col-12 col-md-6">
              <label class="form-label">dept</label>
              <select class="form-select" name="dept" required>
                <option value="">เลือกหน่วยงาน</option>
                <option value="OPD">OPD</option>
                <option value="IPD">IPD</option>
                <option value="IV Chemo">IV Chemo</option>
              </select>
              <div class="invalid-feedback">required</div>
            </div>
            <div class="col-12 col-md-6">
              <label class="form-label">requester</label>
              <input class="form-control" name="requester" required>
              <div class="invalid-feedback">required</div>
            </div>
            <div class="col-12 col-md-6">
              <label class="form-label">requester_email</label>
              <input class="form-control" name="requester_email" type="email" required>
              <div class="invalid-feedback">email ไม่ถูกต้อง</div>
            </div>
            <div class="col-12 col-md-6">
              <label class="form-label">remark</label>
              <input class="form-control" name="remark" placeholder="(optional)">
            </div>
          </div>
        </div>
      </div>

      <div class="card shadow-sm mb-3">
        <div class="card-header d-flex justify-content-between align-items-center">
          <div class="fw-semibold">Lines</div>
          <button class="btn btn-sm btn-outline-primary" type="button" id="btnAddLine">
            <i class="bi bi-plus-lg me-1"></i>เพิ่มแถว
          </button>
        </div>
        <div class="card-body p-0">
          <datalist id="dlReqItems">${itemDatalist()}</datalist>
          <div class="table-responsive">
            <table class="table mb-0 align-middle">
              <thead>
                <tr>
                  <th>item_code</th>
                  <th class="text-end">qty</th>
                  <th>uom</th>
                  <th>remark</th>
                  <th></th>
                </tr>
              </thead>
              <tbody id="linesBody"></tbody>
            </table>
          </div>
        </div>
      </div>

      <div class="d-flex gap-2 justify-content-end">
        <button class="btn btn-outline-primary" type="button" id="btnSaveDraft">
          <i class="bi bi-save me-1"></i>Save Draft
        </button>
        <button class="btn btn-primary" type="button" id="btnSubmit">
          <i class="bi bi-send me-1"></i>Submit
        </button>
      </div>
    </form>
  `;

  const form = container.querySelector("#frmReq");
  const linesBody = container.querySelector("#linesBody");
  const resultHost = container.querySelector("#resultHost");

  let lineIdx = 0;
  const addLine = () => {
    linesBody.insertAdjacentHTML("beforeend", newLineRow(lineIdx++));
    wireRemove();
  };

  const wireRemove = () => {
    linesBody.querySelectorAll("[data-remove]").forEach((btn) => {
      btn.onclick = () => {
        const idx = btn.getAttribute("data-remove");
        linesBody.querySelector(`tr[data-idx="${idx}"]`)?.remove();
      };
    });
  };

  const showResult = (type, html) => {
    resultHost.innerHTML = `<div class="alert alert-${type}">${html}</div>`;
  };

  container.querySelector("#btnAddLine").addEventListener("click", addLine);

  // Add initial 1 line
  addLine();

  const validateAll = () => {
    // header + line required fields are handled by HTML5 validation
    // also validate email format (some browsers treat email differently)
    const requesterEmail = form.querySelector('[name="requester_email"]').value.trim();
    const requesterEmail = form.querySelector('[name="requester_email"]').value.trim();
    if (!validateEmail(requesterEmail)) return false;

    // Ensure at least 1 line
    const lines = collectLines(linesBody);
    return lines.length > 0;
  };

  const buildPayload = () => {
    const fd = new FormData(form);
    const header = {
      dept: (fd.get('dept') || '').toString().trim(),
      requester: (fd.get('requester') || '').toString().trim(),
      requester_email: (fd.get('requester_email') || '').toString().trim(),
      remark: (fd.get('remark') || '').toString().trim(),
    };
    const lines = collectLines(linesBody);
    return { header, lines };
  };

  container.querySelector("#btnSaveDraft").addEventListener("click", async () => {
    resultHost.innerHTML = "";
    form.classList.add("was-validated");

    if (!form.checkValidity() || !validateAll()) {
      showResult("warning", "กรุณากรอกข้อมูลให้ครบ และต้องมีอย่างน้อย 1 รายการใน Lines");
      return;
    }

    const payload = buildPayload();
    const btn = container.querySelector("#btnSaveDraft");
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>กำลังบันทึก...';

    const res = await callApi("create_requisition", payload);

    btn.disabled = false;
    btn.innerHTML = '<i class="bi bi-save me-1"></i>Save Draft';

    if (res?.ok) {
      const reqId = res.req_id || res.data?.req_id || res.data?.id || "";
      showToast("บันทึก Draft สำเร็จ", "success");
      showResult("success", `บันทึก Draft สำเร็จ เลขที่: <span class="fw-semibold">${escapeHtml(reqId)}</span>`);
    } else {
      showResult("danger", `ไม่สำเร็จ: ${escapeHtml(res?.message || formatError(res))}`);
    }
  });

  container.querySelector("#btnSubmit").addEventListener("click", async () => {
    resultHost.innerHTML = "";
    form.classList.add("was-validated");

    if (!form.checkValidity() || !validateAll()) {
      showResult("warning", "กรุณากรอกข้อมูลให้ครบ และต้องมีอย่างน้อย 1 รายการใน Lines");
      return;
    }

    const ok = await confirmModal({
      title: "ยืนยันการ Submit",
      body: `<div>เมื่อ Submit แล้วระบบจะ “ตัดสต็อกทันที” และสร้าง PDF สรุปรายการเบิก</div><div class="mt-2 text-muted small">คุณต้องการดำเนินการต่อหรือไม่?</div>`,
      confirmText: "Submit",
      variant: "primary",
    });
    if (!ok) return;

    const payload = buildPayload();
    const btn = container.querySelector("#btnSubmit");
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>กำลัง Submit...';

    const res = await callApi("submit_requisition", payload);

    btn.disabled = false;
    btn.innerHTML = '<i class="bi bi-send me-1"></i>Submit';

    const code = (res?.errorCode || res?.code || "").toString().toUpperCase();
    if (!res?.ok && code === "ALREADY_SUBMITTED") {
      showResult("warning", "รายการนี้ถูก Submit ไปแล้ว (ALREADY_SUBMITTED) โปรดตรวจสอบรายการใน List");
      return;
    }

    if (res?.ok) {
      const pdfUrl = res.pdf_url || res.data?.pdf_url || res.data?.pdfUrl || "";
      const reqId = res.req_id || res.data?.req_id || res.data?.id || "";
      showToast("Submit สำเร็จ", "success");
      showResult("success", `Submit สำเร็จ เลขที่: <span class="fw-semibold">${escapeHtml(reqId)}</span><br/>
        ${pdfUrl ? `PDF: <a href="${escapeHtml(pdfUrl)}" target="_blank" rel="noopener">เปิดไฟล์ PDF</a><br/>` : ""}
        ตัดสต็อกเรียบร้อยแล้ว
      );
    } else {
      showResult("danger", `ไม่สำเร็จ: ${escapeHtml(res?.message || formatError(res))}`);
    }
  });
}

export async function render(container, { params } = {}) {
  const reqId = params?.get("id");
  const mode = params?.get("mode"); // create

  if (reqId) {
    await renderDetailView(container, reqId);
  } else if (mode === "create") {
    await renderCreateView(container);
  } else {
    await renderListView(container);
  }

  return { cleanup() {} };
}
