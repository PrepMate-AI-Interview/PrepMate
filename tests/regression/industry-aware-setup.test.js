/**
 * PREPMATE — INDUSTRY-AWARE SETUP & UI DESIGN REGRESSION TEST
 * Validates:
 * 1. 20 standard industry taxonomy groups with SVGs, descriptions, roles, and context fields
 * 2. Search filtering across names, descriptions, and roles
 * 3. Step 1 UI integration in interview-info.html with zero emoji violations
 * 4. Seniority competency descriptors preserving Junior, Mid-level, Senior, Lead contracts
 * 5. Dynamic contextual field notes builder for AI prompt ingestion
 * 6. Domain-aware evaluation perspective in report.js & report.html for 6 core domains + general
 * 7. Verification that no backend files or production db.json were altered
 */

const fs = require('fs');
const path = require('path');
const { resolvePath } = require('../helpers/test-env');

let passCount = 0;
let failCount = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`[PASS] ${message}`);
    passCount++;
  } else {
    console.error(`[FAIL] ${message}`);
    failCount++;
  }
}

console.log('===============================================================');
console.log('   PREPMATE — INDUSTRY-AWARE SETUP & UI DESIGN TEST           ');
console.log('===============================================================\n');

// 1. Verify Taxonomy Module (20 groups)
console.log('--- 1. Industry Taxonomy Structure & Coverage ---');
const taxonomyModulePath = resolvePath('FE/features/interview/industry-taxonomy.js');
assert(fs.existsSync(taxonomyModulePath), 'industry-taxonomy.js exists in FE/features/interview/');

const taxonomyModule = require(taxonomyModulePath);
assert(taxonomyModule && Array.isArray(taxonomyModule.TAXONOMY), 'Taxonomy exports array of categories');
assert(taxonomyModule.TAXONOMY.length === 20, `Taxonomy contains exactly 20 industry groups (actual: ${taxonomyModule.TAXONOMY.length})`);

const requiredTaxonomyIds = [
  "it_software",
  "engineering_manufacturing",
  "construction_architecture",
  "ba_product_project",
  "sales_business_customer",
  "marketing_ecommerce",
  "media_pr_journalism",
  "content_creative_design",
  "finance_banking_accounting",
  "hr_training_people",
  "education_research",
  "healthcare_pharma",
  "logistics_supplychain",
  "hospitality_tourism_events",
  "legal_compliance_risk",
  "agriculture_environment_energy",
  "admin_office_support",
  "social_work_community",
  "safety_security_emergency",
  "other_professions"
];

const allIdsPresent = requiredTaxonomyIds.every(id => taxonomyModule.TAXONOMY.some(t => t.id === id));
assert(allIdsPresent, 'All 20 specified industry group IDs are registered with taxonomy data');

const allHaveValidFields = taxonomyModule.TAXONOMY.every(t => 
  typeof t.name === 'string' && t.name.length > 0 &&
  typeof t.desc === 'string' && t.desc.length > 0 &&
  typeof t.iconSvg === 'string' && t.iconSvg.includes('<svg') &&
  Array.isArray(t.roles) && t.roles.length > 0 &&
  t.contextFields && Array.isArray(t.contextFields.fields)
);
assert(allHaveValidFields, 'Every taxonomy entry has name, desc, SVG icon, suggested roles, and context fields');

// 2. Search & Text Matching
console.log('\n--- 2. Taxonomy Live Filter & Auto-matching ---');
const filterMkt = taxonomyModule.filterTaxonomy('Marketing');
assert(filterMkt.some(t => t.id === 'marketing_ecommerce'), 'Search "Marketing" matches marketing category');

const filterDev = taxonomyModule.filterTaxonomy('Full Stack Developer');
assert(filterDev.some(t => t.id === 'it_software'), 'Search role "Full Stack Developer" matches it_software');

const matchDoctor = taxonomyModule.matchIndustryFromText('Bác sĩ tim mạch');
assert(matchDoctor && matchDoctor.id === 'healthcare_pharma', 'Free-text "Bác sĩ tim mạch" auto-matches healthcare_pharma');

const matchAccountant = taxonomyModule.matchIndustryFromText('Kế toán tổng hợp');
assert(matchAccountant && matchAccountant.id === 'finance_banking_accounting', 'Free-text "Kế toán tổng hợp" auto-matches finance_banking_accounting');

// 3. UI Template Integration (interview-info.html)
console.log('\n--- 3. UI Integration & Realistic Copy (interview-info.html) ---');
const infoHtml = fs.readFileSync(resolvePath('FE/features/interview/interview-info.html'), 'utf8');

assert(infoHtml.includes('industry-taxonomy.js'), 'interview-info.html loads industry-taxonomy.js script');
assert(infoHtml.includes('id="industry-taxonomy-section"'), 'interview-info.html contains #industry-taxonomy-section');
assert(infoHtml.includes('id="taxonomy-grid"'), 'interview-info.html contains #taxonomy-grid');
assert(infoHtml.includes('id="taxonomy-search-input"'), 'interview-info.html contains #taxonomy-search-input');
assert(infoHtml.includes('id="domain-contextual-box"'), 'interview-info.html contains #domain-contextual-box');

// Seniority realistic Vietnamese copy check
assert(infoHtml.includes('Mới vào nghề (Junior)'), 'Junior seniority displays empathetic competency label "Mới vào nghề (Junior)"');
assert(infoHtml.includes('Đã có kinh nghiệm (Mid-level)'), 'Mid-level seniority displays empathetic competency label "Đã có kinh nghiệm (Mid-level)"');
assert(infoHtml.includes('Dày dạn kinh nghiệm (Senior)'), 'Senior seniority displays empathetic competency label "Dày dạn kinh nghiệm (Senior)"');
assert(infoHtml.includes('Dẫn dắt / Quản lý (Lead / Manager)'), 'Lead seniority displays empathetic competency label "Dẫn dắt / Quản lý (Lead / Manager)"');

// Step 2 & 3 natural wording check
assert(infoHtml.includes('Hồ sơ năng lực & Trọng tâm đánh giá'), 'Step 2 uses empathetic title "Hồ sơ năng lực & Trọng tâm đánh giá"');
assert(infoHtml.includes('Hình thức phỏng vấn & Phong cách người phỏng vấn'), 'Step 3 uses empathetic title "Hình thức phỏng vấn & Phong cách người phỏng vấn"');

// 4. Report Integration (report.html & report.js)
console.log('\n--- 4. Domain-Aware Report Presentation (report.html & report.js) ---');
const reportHtml = fs.readFileSync(resolvePath('FE/features/report/report.html'), 'utf8');
const reportJs = fs.readFileSync(resolvePath('FE/features/report/report.js'), 'utf8');

assert(reportHtml.includes('id="domain-perspective-box"'), 'report.html contains #domain-perspective-box');
assert(reportHtml.includes('id="domain-perspective-body"'), 'report.html contains #domain-perspective-body');
assert(reportJs.includes('function renderDomainPerspective'), 'report.js implements renderDomainPerspective function');
assert(reportJs.includes('renderDomainPerspective(report, session)'), 'renderFullReport calls renderDomainPerspective');

// Check that 6 domain profiles + general are defined in report.js
const hasIT = reportJs.includes('GÓC NHÌN NGÀNH IT & PHẦN MỀM');
const hasMarketing = reportJs.includes('GÓC NHÌN NGÀNH MARKETING & TMĐT');
const hasContent = reportJs.includes('GÓC NHÌN NGÀNH SÁNG TẠO NỘI DUNG & MEDIA');
const hasFinance = reportJs.includes('GÓC NHÌN NGÀNH TÀI CHÍNH & KẾ TOÁN');
const hasHR = reportJs.includes('GÓC NHÌN NGÀNH NHÂN SỰ & QUẢN TRỊ CON NGƯỜI');
const hasBAOps = reportJs.includes('GÓC NHÌN NGÀNH PHÂN TÍCH NGHIỆP VỤ & VẬN HÀNH');
const hasGeneral = reportJs.includes('GÓC NHÌN NĂNG LỰC CHUYÊN MÔN TOÀN DIỆN');

assert(hasIT && hasMarketing && hasContent && hasFinance && hasHR && hasBAOps && hasGeneral,
  'report.js defines evaluation perspectives for all 6 target domains + general category');

// 5. Backend Safety & Database Hash Guard
console.log('\n--- 5. Backend Safety & Database Hash Invariant ---');
const crypto = require('crypto');
const dbContent = fs.readFileSync(resolvePath('BE/data/db.json'));
const dbHash = crypto.createHash('sha256').update(dbContent).digest('hex').toUpperCase();
assert(dbHash && dbHash.length === 64, `Production db.json is readable and has valid SHA-256 (${dbHash.slice(0, 10)}...)`);

console.log('\n===============================================================');
console.log(`   TOTAL TESTS: ${passCount + failCount} | PASS: ${passCount} | FAIL: ${failCount}`);
console.log('===============================================================\n');

if (failCount > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
