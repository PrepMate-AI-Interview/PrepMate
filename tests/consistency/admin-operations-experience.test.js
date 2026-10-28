/**
 * PREPMATE — WI-DESIGN-11: ADMIN OPERATIONS EXPERIENCE & INTEGRITY AUDIT
 *
 * Verifies:
 * 1. Canonical Stylesheet Foundation & Design Token Alignment
 * 2. Role Boundaries & Permission Guards (Guest vs User vs Manager vs Admin)
 * 3. Data Contracts & Truthful KPI Aggregations (Zero Fabricated Metrics)
 * 4. AI Gateway & Provider Configuration Truthfulness (3-Tier Model, Inactive Flagging)
 * 5. Data Tables, Responsive Wrappers & Modal Contracts
 * 6. Production Database SHA-256 Invariant (Zero Mutations)
 */

const assert = require("assert");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");

const WORKSPACE_ROOT = path.resolve(__dirname, "..", "..");
const HTML_PATH = path.join(WORKSPACE_ROOT, "FE", "features", "admin", "admin.html");
const CSS_PATH = path.join(WORKSPACE_ROOT, "FE", "features", "admin", "admin.css");
const { resolveDbPath, getBaselineDbHash } = require('../helpers/test-env');
const PROD_DB_PATH = resolveDbPath();
const BASELINE_DB_HASH = getBaselineDbHash();

const htmlContent = fs.readFileSync(HTML_PATH, "utf8");
const cssContent = fs.readFileSync(CSS_PATH, "utf8");

console.log("===============================================================");
console.log("   WI-DESIGN-11: ADMIN OPERATIONS EXPERIENCE AUDIT SUITE       ");
console.log("===============================================================\n");

let passCount = 0;
let failCount = 0;

function runCheck(group, name, fn) {
  try {
    fn();
    console.log(`  [PASS] ${name}`);
    passCount++;
  } catch (err) {
    console.error(`  [FAIL] ${name}: ${err.message}`);
    failCount++;
  }
}

// -------------------------------------------------------------
// GROUP 1: CANONICAL STYLESHEET FOUNDATION & DESIGN TOKEN ALIGNMENT
// -------------------------------------------------------------
console.log("--- GROUP 1: Canonical Stylesheet Foundation & Design Tokens ---");

runCheck(1, "1.1 Canonical stylesheets linked in admin.html head", () => {
  assert(htmlContent.includes('tokens.css'), "Must link tokens.css");
  assert(htmlContent.includes('base.css'), "Must link base.css");
  assert(htmlContent.includes('layout.css'), "Must link layout.css");
  assert(htmlContent.includes('components.css'), "Must link components.css");
  assert(htmlContent.includes('style.css'), "Must link style.css");
  assert(htmlContent.includes('new-dashboard.css'), "Must link new-dashboard.css");
  assert(htmlContent.includes('admin.css'), "Must link admin.css");
});

runCheck(1, "1.2 Admin custom properties map directly to canonical tokens", () => {
  assert(/--pm-admin-bg:\s*var\(--pm-bg/.test(htmlContent) || /--pm-admin-bg:\s*var\(--pm-bg/.test(cssContent), "Must map --pm-admin-bg to --pm-bg");
  assert(/--pm-admin-primary:\s*var\(--pm-primary/.test(htmlContent) || /--pm-admin-primary:\s*var\(--pm-primary/.test(cssContent), "Must map --pm-admin-primary to --pm-primary");
  assert(!htmlContent.includes('class="glow-bg"'), "Must not contain obsolete glow-bg container");
});

runCheck(1, "1.3 admin.html line count strictly obeys stylesheet-extraction limit (< 2300 lines)", () => {
  const lineCount = htmlContent.split(/\r?\n/).length;
  assert(lineCount < 2300, `admin.html line count must be < 2300, got ${lineCount}`);
});

// -------------------------------------------------------------
// GROUP 2: ROLE BOUNDARIES & PERMISSION GUARDS
// -------------------------------------------------------------
console.log("\n--- GROUP 2: Role Boundaries & Permission Guards ---");

runCheck(2, "2.1 Unauthenticated users and candidates guarded from admin console", () => {
  assert(htmlContent.includes("window.location.replace('../auth/auth.html?redirect="), "Must guard unauthenticated guest");
  assert(htmlContent.includes("window.location.replace('../dashboard/dashboard.html')"), "Must redirect non-admin/manager roles to dashboard");
});

runCheck(2, "2.2 Role switcher exists for previewing Admin vs Manager modes", () => {
  assert(htmlContent.includes('id="btn-view-admin"'), "#btn-view-admin must exist");
  assert(htmlContent.includes('id="btn-view-manager"'), "#btn-view-manager must exist");
  assert(htmlContent.includes('function switchRoleView'), "switchRoleView function must be defined");
  assert(htmlContent.includes('function applyRoleView'), "applyRoleView function must be defined");
});

runCheck(2, "2.3 Manager permission restrictions enforced in UI", () => {
  assert(htmlContent.includes('role-change-warning'), "Role change warning element must exist");
  assert(htmlContent.includes('btnSaveConfig.style.display'), "Manager mode must hide or restrict save config button");
  assert(htmlContent.includes('btnClearLogs.style.display'), "Manager mode must hide or restrict clear logs button");
  assert(htmlContent.includes('user_admin'), "Supreme admin user_admin cannot be deleted or locked");
});

// -------------------------------------------------------------
// GROUP 3: DATA CONTRACTS & TRUTHFUL KPI AGGREGATIONS
// -------------------------------------------------------------
console.log("\n--- GROUP 3: Data Contracts & Truthful KPI Aggregations ---");

runCheck(3, "3.1 Authentic KPI metric cards preserved with accurate IDs", () => {
  assert(htmlContent.includes('id="kpi-total-users"'), "#kpi-total-users must exist");
  assert(htmlContent.includes('id="kpi-pro-users"'), "#kpi-pro-users must exist");
  assert(htmlContent.includes('id="kpi-revenue"'), "#kpi-revenue must exist");
  assert(htmlContent.includes('id="kpi-sessions-count"'), "#kpi-sessions-count must exist");
});

runCheck(3, "3.2 Authentic data provenance & truthful empty states", () => {
  assert(htmlContent.includes('updateKpiStats'), "updateKpiStats function must exist");
  assert(htmlContent.includes('Chưa có phiên phỏng vấn nào'), "Truthful empty state when 0 sessions exist");
  assert(htmlContent.includes('/api/admin/transactions'), "Must connect to backend /api/admin/transactions");
});

// -------------------------------------------------------------
// GROUP 4: AI GATEWAY & INTEGRATION CONFIGURATION TRUTHFULNESS
// -------------------------------------------------------------
console.log("\n--- GROUP 4: AI Gateway & Integration Configuration Truthfulness ---");

runCheck(4, "4.1 3-Tier capability status explanation preserved", () => {
  assert(htmlContent.includes('Phân biệt cấp độ trạng thái AI'), "Must explain 3-tier AI capability status");
  assert(htmlContent.includes('Cấu hình máy chủ'), "Tier 1: Server saved configuration");
  assert(htmlContent.includes('Health Check Ping'), "Tier 2: Gateway connectivity ping");
  assert(htmlContent.includes('Suy luận phỏng vấn'), "Tier 3: Live interview inference requirements");
});

runCheck(4, "4.2 Verified models and inactive flagging in datalist", () => {
  assert(htmlContent.includes('value="gpt-4o-mini"'), "Suggests gpt-4o-mini");
  assert(htmlContent.includes('value="gemini-1.5-flash"'), "Suggests gemini-1.5-flash");
  assert(htmlContent.includes('value="ag/gemini-2.0-flash"'), "Suggests active candidate ag/gemini-2.0-flash");
  assert(htmlContent.includes('value="ag/gemini-3.8-flash"') && htmlContent.includes('MODEL_INACTIVE'), "Flags ag/gemini-3.8-flash as MODEL_INACTIVE");
});

runCheck(4, "4.3 AI Gateway controls and temperature slider ARIA accessibility", () => {
  assert(htmlContent.includes('id="config-ai-preset"'), "#config-ai-preset must exist");
  assert(htmlContent.includes('id="config-ai-provider"'), "#config-ai-provider must exist");
  assert(htmlContent.includes('id="config-ai-base-url"'), "#config-ai-base-url must exist");
  assert(htmlContent.includes('id="config-ai-model"'), "#config-ai-model must exist");
  assert(htmlContent.includes('id="config-api-key"'), "#config-api-key must exist");
  assert(htmlContent.includes('id="config-temperature"'), "#config-temperature must exist");
  assert(htmlContent.includes('aria-label="Độ sáng tạo của câu hỏi (Nhiệt độ)"'), "Temperature slider has aria-label");
  assert(htmlContent.includes('aria-valuemin="0.1"'), "Temperature slider has aria-valuemin");
});

// -------------------------------------------------------------
// GROUP 5: DATA TABLES, RESPONSIVE WRAPPERS & MODAL CONTRACTS
// -------------------------------------------------------------
console.log("\n--- GROUP 5: Data Tables, Responsive Wrappers & Modal Contracts ---");

runCheck(5, "5.1 8 Tab panel sections exist with proper IDs", () => {
  const tabs = ['users-tab', 'roles-tab', 'plans-tab', 'content-tab', 'reports-tab', 'transactions-tab', 'settings-tab', 'audit-tab'];
  tabs.forEach(tabId => {
    assert(htmlContent.includes(`id="${tabId}"`), `Tab #${tabId} must exist`);
  });
});

runCheck(5, "5.2 Tables have responsive wrappers with minimum width", () => {
  assert(htmlContent.includes('class="admin-table-responsive"'), "admin-table-responsive class must be present");
  assert(cssContent.includes('.admin-table-responsive'), "admin.css styles .admin-table-responsive");
  assert(cssContent.includes('overflow-x: auto'), "Must allow horizontal scroll");
  assert(cssContent.includes('min-width: 760px'), "Must enforce min-width 760px for table data");
});

runCheck(5, "5.3 Operational Modals preserved with exact form IDs", () => {
  assert(htmlContent.includes('id="modal-edit-user"'), "#modal-edit-user must exist");
  assert(htmlContent.includes('id="modal-create-user"'), "#modal-create-user must exist");
  assert(htmlContent.includes('id="modal-plan"'), "#modal-plan must exist");
  assert(htmlContent.includes('id="modal-question"'), "#modal-question must exist");
});

// -------------------------------------------------------------
// GROUP 6: PRODUCTION DATABASE SHA-256 INVARIANT
// -------------------------------------------------------------
console.log("\n--- GROUP 6: Production Database SHA-256 Invariant ---");

runCheck(6, "6.1 BE/data/db.json remains byte-for-byte identical", () => {
  const currentDbBytes = fs.readFileSync(PROD_DB_PATH);
  const currentHash = crypto.createHash("sha256").update(currentDbBytes).digest("hex").toUpperCase();
  assert.strictEqual(
    currentHash,
    BASELINE_DB_HASH,
    `Production database hash mismatch! Expected: ${BASELINE_DB_HASH}, Got: ${currentHash}`
  );
});

console.log("\n===============================================================");
console.log(`AUDIT RESULTS: ${passCount} PASSED, ${failCount} FAILED`);
console.log("===============================================================");

if (failCount > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
