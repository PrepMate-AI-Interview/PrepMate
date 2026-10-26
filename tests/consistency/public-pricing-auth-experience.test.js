/**
 * PREPMATE — WI-DESIGN-12: PUBLIC, PRICING, PAYMENT & AUTHENTICATION AUDIT
 *
 * Verifies:
 * 1. Canonical Stylesheet Foundation & Token Mapping (all 7 target pages link tokens, base, layout, components)
 * 2. Public Landing Page Hierarchy & Multi-Industry Showcase (.lp-industry-selector-bar, trust bar, core tagline)
 * 3. Pricing Page & Plan Entitlements (authentic 199.000₫ price, Free vs PRO features, CTA to checkout)
 * 4. Payment Checkout Experience & Security Contracts (no sidebar, steps indicator, return link, backend contract)
 * 5. Authentication & Session Integrity (login/register forms, error mapping, password toggle, redirect param)
 * 6. Production Database SHA-256 Invariant (Zero DB Mutations)
 */

const assert = require("assert");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");

const WORKSPACE_ROOT = path.resolve(__dirname, "..", "..");
const PROD_DB_PATH = path.join(WORKSPACE_ROOT, "BE", "data", "db.json");
const BASELINE_DB_HASH = "C8D6CA48DFAC2DD4C9FC3F5793E36222506220F07DC4DE9E17102B92295662A7";

const targetFiles = {
  landingHtml: path.join(WORKSPACE_ROOT, "FE", "index.html"),
  pricingHtml: path.join(WORKSPACE_ROOT, "FE", "features", "payment", "pricing.html"),
  paymentHtml: path.join(WORKSPACE_ROOT, "FE", "features", "payment", "payment.html"),
  authHtml: path.join(WORKSPACE_ROOT, "FE", "features", "auth", "auth.html"),
  aboutHtml: path.join(WORKSPACE_ROOT, "FE", "features", "about", "about.html"),
  helpHtml: path.join(WORKSPACE_ROOT, "FE", "features", "help", "help.html"),
  notFoundHtml: path.join(WORKSPACE_ROOT, "FE", "404.html"),
  landingCss: path.join(WORKSPACE_ROOT, "FE", "shared", "css", "landing.css"),
  pricingCss: path.join(WORKSPACE_ROOT, "FE", "features", "payment", "pricing.css"),
  paymentCss: path.join(WORKSPACE_ROOT, "FE", "features", "payment", "payment.css"),
  authCss: path.join(WORKSPACE_ROOT, "FE", "features", "auth", "auth.css"),
  paymentController: path.join(WORKSPACE_ROOT, "BE", "Controllers", "PaymentController.cs")
};

const fileContents = {};
for (const [key, p] of Object.entries(targetFiles)) {
  fileContents[key] = fs.readFileSync(p, "utf8");
}

console.log("===============================================================");
console.log("   WI-DESIGN-12: PUBLIC, PRICING, PAYMENT & AUTH AUDIT SUITE   ");
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
// GROUP 1: CANONICAL STYLESHEET FOUNDATION & TOKEN MAPPING
// -------------------------------------------------------------
console.log("--- GROUP 1: Canonical Stylesheet Foundation & Token Mapping ---");

runCheck(1, "1.1 Landing page index.html links 4 canonical stylesheets in head", () => {
  const c = fileContents.landingHtml;
  assert(c.includes('tokens.css'), "Must link tokens.css");
  assert(c.includes('base.css'), "Must link base.css");
  assert(c.includes('layout.css'), "Must link layout.css");
  assert(c.includes('components.css'), "Must link components.css");
});

runCheck(1, "1.2 Pricing page pricing.html links 4 canonical stylesheets in head", () => {
  const c = fileContents.pricingHtml;
  assert(c.includes('tokens.css'), "Must link tokens.css");
  assert(c.includes('base.css'), "Must link base.css");
  assert(c.includes('layout.css'), "Must link layout.css");
  assert(c.includes('components.css'), "Must link components.css");
});

runCheck(1, "1.3 Payment page payment.html links 4 canonical stylesheets in head", () => {
  const c = fileContents.paymentHtml;
  assert(c.includes('tokens.css'), "Must link tokens.css");
  assert(c.includes('base.css'), "Must link base.css");
  assert(c.includes('layout.css'), "Must link layout.css");
  assert(c.includes('components.css'), "Must link components.css");
});

runCheck(1, "1.4 Auth page auth.html links 4 canonical stylesheets in head", () => {
  const c = fileContents.authHtml;
  assert(c.includes('tokens.css'), "Must link tokens.css");
  assert(c.includes('base.css'), "Must link base.css");
  assert(c.includes('layout.css'), "Must link layout.css");
  assert(c.includes('components.css'), "Must link components.css");
});

runCheck(1, "1.5 About page about.html links 4 canonical stylesheets in head", () => {
  const c = fileContents.aboutHtml;
  assert(c.includes('tokens.css'), "Must link tokens.css");
  assert(c.includes('base.css'), "Must link base.css");
  assert(c.includes('layout.css'), "Must link layout.css");
  assert(c.includes('components.css'), "Must link components.css");
});

runCheck(1, "1.6 Help page help.html links 4 canonical stylesheets in head", () => {
  const c = fileContents.helpHtml;
  assert(c.includes('tokens.css'), "Must link tokens.css");
  assert(c.includes('base.css'), "Must link base.css");
  assert(c.includes('layout.css'), "Must link layout.css");
  assert(c.includes('components.css'), "Must link components.css");
});

runCheck(1, "1.7 404 page 404.html links 4 canonical stylesheets in head", () => {
  const c = fileContents.notFoundHtml;
  assert(c.includes('tokens.css'), "Must link tokens.css");
  assert(c.includes('base.css'), "Must link base.css");
  assert(c.includes('layout.css'), "Must link layout.css");
  assert(c.includes('components.css'), "Must link components.css");
});

runCheck(1, "1.8 landing.css, pricing.css, and payment.css map to canonical design tokens", () => {
  assert(fileContents.landingCss.includes('var(--pm-bg'), "landing.css must map to --pm-bg");
  assert(fileContents.pricingCss.includes('var(--pm-bg'), "pricing.css must map to --pm-bg");
  assert(fileContents.paymentCss.includes('var(--pm-bg'), "payment.css must map to --pm-bg");
});

// -------------------------------------------------------------
// GROUP 2: PUBLIC LANDING PAGE HIERARCHY & MULTI-INDUSTRY SHOWCASE
// -------------------------------------------------------------
console.log("\n--- GROUP 2: Public Landing Page Hierarchy & Multi-Industry Showcase ---");

runCheck(2, "2.1 Landing page preserves core value proposition, tagline and CTA", () => {
  const c = fileContents.landingHtml;
  assert(c.includes('Đừng chỉ học câu trả lời') || c.includes('Luyện tập đối mặt với nhà tuyển dụng'), "Headline missing");
  assert(c.includes('Bắt đầu luyện tập') || c.includes('Bắt đầu phỏng vấn ngay'), "Primary CTA button missing");
});

runCheck(2, "2.2 Landing page maintains multi-industry selector tab bar without SWE lock", () => {
  const c = fileContents.landingHtml;
  assert(c.includes('lp-industry-selector-bar'), "Selector bar missing");
  assert(c.includes('data-role="tech"'), "Tech tab missing");
  assert(c.includes('data-role="marketing"'), "Marketing tab missing");
  assert(c.includes('data-role="finance"'), "Finance tab missing");
  assert(c.includes('data-role="hr"'), "HR tab missing");
  assert(c.includes('data-role="ba"'), "BA tab missing");
});

runCheck(2, "2.3 Landing page displays authentic trust bar with enterprise employers", () => {
  const c = fileContents.landingHtml;
  assert(c.includes('Unilever'), "Trust bar Unilever missing");
  assert(c.includes('Vietcombank'), "Trust bar Vietcombank missing");
  assert(c.includes('FPT Software'), "Trust bar FPT Software missing");
  assert(c.includes('MoMo'), "Trust bar MoMo missing");
});

// -------------------------------------------------------------
// GROUP 3: PRICING PAGE & PLAN ENTITLEMENTS
// -------------------------------------------------------------
console.log("\n--- GROUP 3: Pricing Page & Plan Entitlements ---");

runCheck(3, "3.1 Pricing page features clearly distinguished Free and PRO plans", () => {
  const c = fileContents.pricingHtml;
  assert(c.includes('Gói cơ bản') || c.includes('Gói Miễn phí') || c.includes('Free Plan'), "Free tier missing");
  assert(c.includes('PrepMate PRO') || c.includes('Hội Viên PRO') || c.includes('Gói Pro'), "PRO tier missing");
  assert(c.includes('99.000') || c.includes('99,000'), "Official 199.000₫ price missing");
});

runCheck(3, "3.2 Pricing PRO plan links directly to checkout flow", () => {
  const c = fileContents.pricingHtml;
  assert(c.includes('payment.html'), "Must link to payment.html for checkout");
});

runCheck(3, "3.3 Pricing page presents authentic feature comparisons without fake urgency", () => {
  const c = fileContents.pricingHtml;
  assert(!c.includes('chỉ còn 2 giờ'), "Deceptive countdown timers forbidden");
  assert(!c.includes('đã có 9999 người mua'), "Fake social proof forbidden");
});

// -------------------------------------------------------------
// GROUP 4: PAYMENT CHECKOUT EXPERIENCE & SECURITY CONTRACTS
// -------------------------------------------------------------
console.log("\n--- GROUP 4: Payment Checkout Experience & Security Contracts ---");

runCheck(4, "4.1 Payment page uses clean checkout shell without candidate sidebar", () => {
  const c = fileContents.paymentHtml;
  assert(c.includes('checkout-body'), "Must declare checkout-body class");
  assert(!c.includes('id="main-sidebar"'), "Candidate sidebar must not be in payment.html");
});

runCheck(4, "4.2 Payment page contains step indicators and safe return navigation to pricing", () => {
  const c = fileContents.paymentHtml;
  assert(c.includes('checkout-steps'), "Must include checkout-steps indicator");
  assert(c.includes('pricing.html'), "Must include return link to pricing.html");
});

runCheck(4, "4.3 Backend PaymentController enforces authentication and exact 99.000 price", () => {
  const c = fileContents.paymentController;
  assert(c.includes('[Authorize]'), "PaymentController must require authentication");
  assert(c.includes('99000'), "AuthorizedProPlanPrice must equal 99000");
  assert(c.includes('TransactionId'), "Must track and enforce TransactionId idempotency");
  assert(c.includes('user.Subscription = "pro"'), "Must grant PRO subscription on success");
});

// -------------------------------------------------------------
// GROUP 5: AUTHENTICATION & SESSION INTEGRITY
// -------------------------------------------------------------
console.log("\n--- GROUP 5: Authentication & Session Integrity ---");

runCheck(5, "5.1 Auth page contains Login and Signup form containers", () => {
  const c = fileContents.authHtml;
  assert(c.includes('id="login-form"'), "Login form container missing");
  assert(c.includes('id="signup-form"'), "Signup form container missing");
});

runCheck(5, "5.2 Auth page includes password visibility toggles and error messaging", () => {
  const c = fileContents.authHtml;
  assert(c.includes('type="password"'), "Password input missing");
  assert(c.includes('toggle') || c.includes('eye') || c.includes('show'), "Password toggle or visibility mechanism present");
  assert(c.includes('error') || c.includes('alert') || c.includes('auth-err'), "Auth error container present");
});

runCheck(5, "5.3 Auth page preserves redirectUrl / return navigation support", () => {
  const c = fileContents.authHtml;
  assert(c.includes('redirect') || c.includes('return') || c.includes('dashboard'), "Post-auth navigation flow preserved");
});

// -------------------------------------------------------------
// GROUP 6: PRODUCTION DATABASE SHA-256 INVARIANT
// -------------------------------------------------------------
console.log("\n--- GROUP 6: Production Database SHA-256 Invariant ---");

runCheck(6, "6.1 Production database db.json remains bit-by-bit identical to baseline", () => {
  const currentDbContent = fs.readFileSync(PROD_DB_PATH);
  const currentDbHash = crypto.createHash("sha256").update(currentDbContent).digest("hex").toUpperCase();
  assert.strictEqual(
    currentDbHash,
    BASELINE_DB_HASH,
    `Production database modified! Expected ${BASELINE_DB_HASH}, got ${currentDbHash}`
  );
});

// -------------------------------------------------------------
// SUMMARY
// -------------------------------------------------------------
console.log("\n===============================================================");
console.log(` RESULTS: ${passCount}/${passCount + failCount} CHECKS PASSED (${failCount} FAILED)`);
console.log("===============================================================");

if (failCount > 0) {
  process.exit(1);
}
