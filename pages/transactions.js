// pages/transactions.js
// Backward-compatible landing page (the menu now exposes Receive and Issue as separate entries).

export async function render(container) {
  container.innerHTML = `
    <div class="row g-3">
      <div class="col-12 col-lg-6">
        <div class="card shadow-sm h-100">
          <div class="card-body">
            <div class="d-flex align-items-center gap-2 mb-2">
              <i class="bi bi-box-arrow-in-down fs-4"></i>
              <div class="h5 mb-0">Receive</div>
            </div>
            <div class="text-muted mb-3">บันทึกรับเข้า เพิ่มยอดคงคลัง</div>
            <a class="btn btn-primary" href="#/receive"><i class="bi bi-arrow-right me-1"></i>ไปหน้า Receive</a>
          </div>
        </div>
      </div>
      <div class="col-12 col-lg-6">
        <div class="card shadow-sm h-100">
          <div class="card-body">
            <div class="d-flex align-items-center gap-2 mb-2">
              <i class="bi bi-box-arrow-up fs-4"></i>
              <div class="h5 mb-0">Issue</div>
            </div>
            <div class="text-muted mb-3">บันทึกเบิกออก ตัดยอดทันที และสร้าง PDF สรุปการเบิก</div>
            <a class="btn btn-primary" href="#/issue"><i class="bi bi-arrow-right me-1"></i>ไปหน้า Issue</a>
          </div>
        </div>
      </div>
    </div>
    <div class="mt-3 small text-muted">
      หมายเหตุ: เมนู Transactions ยังคงมีไว้เพื่อรองรับลิงก์เดิม แต่การใช้งานหลักคือแยกเป็น Receive / Issue
    </div>
  `;
  return { cleanup() {} };
}
