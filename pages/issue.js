// pages/issue.js (STORE/ADMIN)
import { renderSkeleton } from "../ui.js";
import { loadTxMasters, renderIssueForm } from "./txShared.js";

export async function render(container) {
  renderSkeleton(container, { rows: 8 });

  await loadTxMasters();

  container.innerHTML = `
    <div class="mb-3 text-muted small">
      บันทึกเบิกออก (Issue) — ตัดยอดทันทีและสร้าง PDF สรุปการเบิก
    </div>
    <div id="issueHost"></div>
  `;

  renderIssueForm(container.querySelector("#issueHost"), { datalistId: "dlItems_issue" });
  return { cleanup() {} };
}
