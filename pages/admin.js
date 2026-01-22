// pages/admin.js (ADMIN only)
import { callApi, formatError } from "../api.js";
import { renderSkeleton, renderErrorBanner, showToast, escapeHtml, confirmModal } from "../ui.js";

function modalTemplate({ id, title, bodyHtml, saveText = "Save" }) {
  return `
    <div class="modal fade" id="${id}" tabindex="-1" aria-hidden="true">
      <div class="modal-dialog modal-dialog-scrollable modal-lg">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title">${escapeHtml(title)}</h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
          </div>
          <div class="modal-body">${bodyHtml}</div>
          <div class="modal-footer">
            <button type="button" class="btn btn-outline-secondary" data-bs-dismiss="modal">Close</button>
            <button type="button" class="btn btn-primary" id="${id}_save">${escapeHtml(saveText)}</button>
          </div>
        </div>
      </div>
    </div>
  `;
}

async function loadAll() {
  const [ri, rv, rw] = await Promise.all([
    callApi("list_items", {}),
    callApi("list_vendors", {}),
    callApi("list_warehouses", {}),
  ]);
  return {
    items: ri?.ok ? (ri.data?.items || ri.items || ri.data || []) : null,
    vendors: rv?.ok ? (rv.data?.vendors || rv.vendors || rv.data || []) : null,
    warehouses: rw?.ok ? (rw.data?.warehouses || rw.warehouses || rw.data || []) : null,
    errors: [ri, rv, rw].filter(r => !r?.ok),
  };
}

function renderTabs(container) {
  container.innerHTML = `
    <ul class="nav nav-tabs" id="adminTabs" role="tablist">
      <li class="nav-item" role="presentation">
        <button class="nav-link active" data-bs-toggle="tab" data-bs-target="#tabItems" type="button" role="tab">Items</button>
      </li>
      <li class="nav-item" role="presentation">
        <button class="nav-link" data-bs-toggle="tab" data-bs-target="#tabVendors" type="button" role="tab">Vendors</button>
      </li>
      <li class="nav-item" role="presentation">
        <button class="nav-link" data-bs-toggle="tab" data-bs-target="#tabWarehouses" type="button" role="tab">Warehouses</button>
      </li>
    </ul>

    <div class="tab-content pt-3">
      <div class="tab-pane fade show active" id="tabItems" role="tabpanel"><div id="itemsHost"></div></div>
      <div class="tab-pane fade" id="tabVendors" role="tabpanel"><div id="vendorsHost"></div></div>
      <div class="tab-pane fade" id="tabWarehouses" role="tabpanel"><div id="warehousesHost"></div></div>
    </div>
  `;
}

function openModal(id) {
  const el = document.getElementById(id);
  const modal = new bootstrap.Modal(el, { backdrop: "static" });
  modal.show();
  return modal;
}

function closeModal(id) {
  const el = document.getElementById(id);
  const modal = bootstrap.Modal.getInstance(el);
  if (modal) modal.hide();
}

function renderItems(host, rows, onReload) {
  host.innerHTML = `
    <div class="d-flex justify-content-between align-items-center mb-2">
      <div class="text-muted small">จัดการรายการสินค้า (list_items / upsert_item)</div>
      <button class="btn btn-sm btn-primary" id="btnAddItem"><i class="bi bi-plus-lg me-1"></i>Add</button>
    </div>
    <div class="card shadow-sm">
      <div class="card-body p-0">
        <div class="table-responsive">
          <table class="table table-hover align-middle mb-0">
            <thead>
              <tr>
                <th>item_code</th>
                <th>name_th</th>
                <th>uom</th>
                <th class="text-end">minimum</th>
                <th class="text-end">active</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              ${rows.length ? rows.map((r, idx) => `
                <tr>
                  <td class="fw-semibold">${escapeHtml(r.item_code || r.itemCode || "")}</td>
                  <td>${escapeHtml(r.name_th || r.name || "")}</td>
                  <td>${escapeHtml(r.uom || "")}</td>
                  <td class="text-end">${escapeHtml(r.minimum ?? "")}</td>
                  <td class="text-end">${escapeHtml(r.active ?? r.is_active ?? "")}</td>
                  <td class="text-end">
                    <button class="btn btn-sm btn-outline-secondary" data-edit="${idx}"><i class="bi bi-pencil"></i></button>
                  </td>
                </tr>
              `).join("") : `<tr><td colspan="6" class="text-center text-muted py-4">ไม่มีข้อมูล</td></tr>`}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;

  const openEditor = (item = {}) => {
    const id = "modalItem";
    document.getElementById(id)?.remove();

    const body = `
      <form id="frmItem" class="needs-validation" novalidate>
        <div class="row g-3">
          <div class="col-12 col-md-6">
            <label class="form-label">item_code</label>
            <input class="form-control" name="item_code" required value="${escapeHtml(item.item_code || item.itemCode || "")}">
            <div class="invalid-feedback">required</div>
          </div>
          <div class="col-12 col-md-6">
            <label class="form-label">uom</label>
            <input class="form-control" name="uom" required value="${escapeHtml(item.uom || "")}">
            <div class="invalid-feedback">required</div>
          </div>
          <div class="col-12">
            <label class="form-label">name_th</label>
            <input class="form-control" name="name_th" required value="${escapeHtml(item.name_th || item.name || "")}">
            <div class="invalid-feedback">required</div>
          </div>
          <div class="col-12 col-md-6">
            <label class="form-label">minimum</label>
            <input type="number" class="form-control" name="minimum" min="0" step="0.01" value="${escapeHtml(item.minimum ?? 0)}">
          </div>
          <div class="col-12 col-md-6">
            <label class="form-label">active</label>
            <select class="form-select" name="active">
              <option value="true" ${(String(item.active ?? item.is_active ?? "true") === "true") ? "selected" : ""}>true</option>
              <option value="false" ${(String(item.active ?? item.is_active ?? "true") === "false") ? "selected" : ""}>false</option>
            </select>
          </div>
        </div>
      </form>
      <div id="itemErr" class="mt-3"></div>
    `;

    document.body.insertAdjacentHTML("beforeend", modalTemplate({ id, title: "Upsert Item", bodyHtml: body }));
    const modal = openModal(id);

    document.getElementById(id + "_save").onclick = async () => {
      const form = document.getElementById("frmItem");
      form.classList.add("was-validated");
      if (!form.checkValidity()) return;

      const data = Object.fromEntries(new FormData(form).entries());
      data.minimum = Number(data.minimum || 0);
      data.active = String(data.active) === "true";

      const btn = document.getElementById(id + "_save");
      btn.disabled = true;
      btn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Saving...';

      const res = await callApi("upsert_item", data);

      btn.disabled = false;
      btn.textContent = "Save";

      if (res?.ok) {
        showToast("บันทึก Item สำเร็จ", "success");
        clearLocalCache("admin_all_masters");
        clearLocalCache("masters_items");
        closeModal(id);
        document.getElementById(id)?.remove();
        await onReload();
      } else {
        document.getElementById("itemErr").innerHTML = `<div class="alert alert-danger">${escapeHtml(res?.message || formatError(res))}</div>`;
      }
    };

    document.getElementById(id).addEventListener("hidden.bs.modal", () => document.getElementById(id)?.remove());
  };

  host.querySelector("#btnAddItem").onclick = () => openEditor({});

  host.querySelectorAll("[data-edit]").forEach((btn) => {
    btn.onclick = () => {
      const idx = Number(btn.getAttribute("data-edit"));
      openEditor(rows[idx] || {});
    };
  });
}

function renderVendors(host, rows, onReload) {
  host.innerHTML = `
    <div class="d-flex justify-content-between align-items-center mb-2">
      <div class="text-muted small">จัดการ Vendor (list_vendors / upsert_vendor)</div>
      <button class="btn btn-sm btn-primary" id="btnAddVendor"><i class="bi bi-plus-lg me-1"></i>Add</button>
    </div>
    <div class="card shadow-sm">
      <div class="card-body p-0">
        <div class="table-responsive">
          <table class="table table-hover align-middle mb-0">
            <thead>
              <tr>
                <th>vendor_code</th>
                <th>name</th>
                <th>email</th>
                <th>phone</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              ${rows.length ? rows.map((r, idx) => `
                <tr>
                  <td class="fw-semibold">${escapeHtml(r.vendor_code || r.code || "")}</td>
                  <td>${escapeHtml(r.name || r.name_th || "")}</td>
                  <td>${escapeHtml(r.email || "")}</td>
                  <td>${escapeHtml(r.phone || "")}</td>
                  <td class="text-end">
                    <button class="btn btn-sm btn-outline-secondary" data-edit="${idx}"><i class="bi bi-pencil"></i></button>
                  </td>
                </tr>
              `).join("") : `<tr><td colspan="5" class="text-center text-muted py-4">ไม่มีข้อมูล</td></tr>`}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;

  const openEditor = (vendor = {}) => {
    const id = "modalVendor";
    document.getElementById(id)?.remove();

    const body = `
      <form id="frmVendor" class="needs-validation" novalidate>
        <div class="row g-3">
          <div class="col-12 col-md-6">
            <label class="form-label">vendor_code</label>
            <input class="form-control" name="vendor_code" required value="${escapeHtml(vendor.vendor_code || vendor.code || "")}">
            <div class="invalid-feedback">required</div>
          </div>
          <div class="col-12 col-md-6">
            <label class="form-label">name</label>
            <input class="form-control" name="name" required value="${escapeHtml(vendor.name || vendor.name_th || "")}">
            <div class="invalid-feedback">required</div>
          </div>
          <div class="col-12 col-md-6">
            <label class="form-label">email</label>
            <input type="email" class="form-control" name="email" value="${escapeHtml(vendor.email || "")}">
          </div>
          <div class="col-12 col-md-6">
            <label class="form-label">phone</label>
            <input class="form-control" name="phone" value="${escapeHtml(vendor.phone || "")}">
          </div>
        </div>
      </form>
      <div id="vendorErr" class="mt-3"></div>
    `;

    document.body.insertAdjacentHTML("beforeend", modalTemplate({ id, title: "Upsert Vendor", bodyHtml: body }));
    openModal(id);

    document.getElementById(id + "_save").onclick = async () => {
      const form = document.getElementById("frmVendor");
      form.classList.add("was-validated");
      if (!form.checkValidity()) return;

      const data = Object.fromEntries(new FormData(form).entries());
      const btn = document.getElementById(id + "_save");
      btn.disabled = true;
      btn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Saving...';

      const res = await callApi("upsert_vendor", data);

      btn.disabled = false;
      btn.textContent = "Save";

      if (res?.ok) {
        showToast("บันทึก Vendor สำเร็จ", "success");
        clearLocalCache("admin_all_masters");
        closeModal(id);
        document.getElementById(id)?.remove();
        await onReload();
      } else {
        document.getElementById("vendorErr").innerHTML = `<div class="alert alert-danger">${escapeHtml(res?.message || formatError(res))}</div>`;
      }
    };

    document.getElementById(id).addEventListener("hidden.bs.modal", () => document.getElementById(id)?.remove());
  };

  host.querySelector("#btnAddVendor").onclick = () => openEditor({});
  host.querySelectorAll("[data-edit]").forEach((btn) => {
    btn.onclick = () => {
      const idx = Number(btn.getAttribute("data-edit"));
      openEditor(rows[idx] || {});
    };
  });
}

function renderWarehouses(host, rows, onReload) {
  host.innerHTML = `
    <div class="d-flex justify-content-between align-items-center mb-2">
      <div class="text-muted small">จัดการ Warehouse (list_warehouses / upsert_warehouse)</div>
      <button class="btn btn-sm btn-primary" id="btnAddWH"><i class="bi bi-plus-lg me-1"></i>Add</button>
    </div>
    <div class="card shadow-sm">
      <div class="card-body p-0">
        <div class="table-responsive">
          <table class="table table-hover align-middle mb-0">
            <thead>
              <tr>
                <th>warehouse_code</th>
                <th>name</th>
                <th>location</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              ${rows.length ? rows.map((r, idx) => `
                <tr>
                  <td class="fw-semibold">${escapeHtml(r.warehouse_code || r.code || "")}</td>
                  <td>${escapeHtml(r.name || r.name_th || "")}</td>
                  <td>${escapeHtml(r.location || "")}</td>
                  <td class="text-end">
                    <button class="btn btn-sm btn-outline-secondary" data-edit="${idx}"><i class="bi bi-pencil"></i></button>
                  </td>
                </tr>
              `).join("") : `<tr><td colspan="4" class="text-center text-muted py-4">ไม่มีข้อมูล</td></tr>`}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;

  const openEditor = (wh = {}) => {
    const id = "modalWH";
    document.getElementById(id)?.remove();

    const body = `
      <form id="frmWH" class="needs-validation" novalidate>
        <div class="row g-3">
          <div class="col-12 col-md-6">
            <label class="form-label">warehouse_code</label>
            <input class="form-control" name="warehouse_code" required value="${escapeHtml(wh.warehouse_code || wh.code || "")}">
            <div class="invalid-feedback">required</div>
          </div>
          <div class="col-12 col-md-6">
            <label class="form-label">name</label>
            <input class="form-control" name="name" required value="${escapeHtml(wh.name || wh.name_th || "")}">
            <div class="invalid-feedback">required</div>
          </div>
          <div class="col-12">
            <label class="form-label">location</label>
            <input class="form-control" name="location" value="${escapeHtml(wh.location || "")}">
          </div>
        </div>
      </form>
      <div id="whErr" class="mt-3"></div>
    `;

    document.body.insertAdjacentHTML("beforeend", modalTemplate({ id, title: "Upsert Warehouse", bodyHtml: body }));
    openModal(id);

    document.getElementById(id + "_save").onclick = async () => {
      const form = document.getElementById("frmWH");
      form.classList.add("was-validated");
      if (!form.checkValidity()) return;

      const data = Object.fromEntries(new FormData(form).entries());
      const btn = document.getElementById(id + "_save");
      btn.disabled = true;
      btn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Saving...';

      const res = await callApi("upsert_warehouse", data);

      btn.disabled = false;
      btn.textContent = "Save";

      if (res?.ok) {
        showToast("บันทึก Warehouse สำเร็จ", "success");
        clearLocalCache("admin_all_masters");
        clearLocalCache("masters_warehouses");
        closeModal(id);
        document.getElementById(id)?.remove();
        await onReload();
      } else {
        document.getElementById("whErr").innerHTML = `<div class="alert alert-danger">${escapeHtml(res?.message || formatError(res))}</div>`;
      }
    };

    document.getElementById(id).addEventListener("hidden.bs.modal", () => document.getElementById(id)?.remove());
  };

  host.querySelector("#btnAddWH").onclick = () => openEditor({});
  host.querySelectorAll("[data-edit]").forEach((btn) => {
    btn.onclick = () => {
      const idx = Number(btn.getAttribute("data-edit"));
      openEditor(rows[idx] || {});
    };
  });
}

async function loadAndRender(container) {
  renderSkeleton(container, { rows: 10 });

  const data = await loadAll();
  if (data.errors?.length) {
    // show first error
    const first = data.errors[0];
    container.innerHTML = "";
    renderErrorBanner(container, first?.message || formatError(first), () => loadAndRender(container));
    return;
  }

  renderTabs(container);

  const reload = async () => loadAndRender(container);

  renderItems(container.querySelector("#itemsHost"), data.items || [], reload);
  renderVendors(container.querySelector("#vendorsHost"), data.vendors || [], reload);
  renderWarehouses(container.querySelector("#warehousesHost"), data.warehouses || [], reload);
}

export async function render(container) {
  await loadAndRender(container);
  return { cleanup() {} };
}
