// pages/receive.js (STORE/ADMIN)
import { renderSkeleton } from "../ui.js";
import { loadTxMasters, renderReceiveForm } from "./txShared.js";

export async function render(container) {
  renderSkeleton(container, { rows: 8 });

  await loadTxMasters();

  container.innerHTML = `
    <div class="mb-3 text-muted small">
      บันทึกรับเข้า (Receive) — เลือกคลัง, สินค้า, qty และหน่วยนับ (uom)
    </div>
    <div id="receiveHost"></div>
  `;

  renderReceiveForm(container.querySelector("#receiveHost"), { datalistId: "dlItems_receive" });
  return { cleanup() {} };
}
