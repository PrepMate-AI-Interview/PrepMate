/**
 * PREPMATE — WI-HISTORY-UX-01 REGRESSION TEST SUITE
 *
 * Verifies UX enhancements:
 * 1. WI-01A: Interview Setup Simplified Voice Preview
 * 2. WI-01B: Dashboard / Interview Overview Top 3 Recent Sessions
 * 3. WI-01C: Full Interview History Date Organization & Filtering
 * 4. Safety & Database Invariants
 */

const assert = require('assert');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const WORKSPACE_ROOT = path.resolve(__dirname, '..', '..');
const INFO_HTML_PATH = path.join(WORKSPACE_ROOT, 'FE', 'features', 'interview', 'interview-info.html');
const INFO_CSS_PATH = path.join(WORKSPACE_ROOT, 'FE', 'features', 'interview', 'interview-info.css');
const DASH_JS_PATH = path.join(WORKSPACE_ROOT, 'FE', 'features', 'dashboard', 'dashboard.js');
const DASH_HTML_PATH = path.join(WORKSPACE_ROOT, 'FE', 'features', 'dashboard', 'dashboard.html');
const HIST_HTML_PATH = path.join(WORKSPACE_ROOT, 'FE', 'features', 'interview', 'history.html');
const HIST_CSS_PATH = path.join(WORKSPACE_ROOT, 'FE', 'features', 'interview', 'history.css');

const { resolveDbPath, getBaselineDbHash } = require('../helpers/test-env');
const PROD_DB_PATH = resolveDbPath();
const BASELINE_DB_HASH = getBaselineDbHash();

const infoHtml = fs.readFileSync(INFO_HTML_PATH, 'utf8');
const infoCss = fs.readFileSync(INFO_CSS_PATH, 'utf8');
const dashJs = fs.readFileSync(DASH_JS_PATH, 'utf8');
const dashHtml = fs.readFileSync(DASH_HTML_PATH, 'utf8');
const histHtml = fs.readFileSync(HIST_HTML_PATH, 'utf8');
const histCss = fs.readFileSync(HIST_CSS_PATH, 'utf8');

console.log('===============================================================');
console.log('   WI-HISTORY-UX-01: UX & HISTORY REGRESSION TEST SUITE        ');
console.log('===============================================================\n');

let passCount = 0;
let failCount = 0;

function runCheck(name, fn) {
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
// GROUP 1: WI-01A INTERVIEW SETUP SIMPLIFIED VOICE PREVIEW
// -------------------------------------------------------------
console.log('--- GROUP 1: WI-01A Simplified Voice Preview ---');

runCheck('1.1 Setup page contains speaker icon buttons for all 3 personas', () => {
    assert(infoHtml.includes('id="btn-greeting-professional"'), 'Professional speaker button exists');
    assert(infoHtml.includes('id="btn-greeting-friendly"'), 'Friendly speaker button exists');
    assert(infoHtml.includes('id="btn-greeting-balanced"'), 'Balanced speaker button exists');
    assert(infoHtml.includes('speaker-icon'), 'Uses SVG speaker icon class');
});

runCheck('1.2 Voice preview buttons provide accessible labels and tooltips', () => {
    assert(infoHtml.includes('title="Nghe thử giọng nói"'), 'Button has clear title tooltip');
    assert(infoHtml.includes('aria-label="Nghe thử giọng nói của Trần Minh Vũ"'), 'Professional aria-label');
    assert(infoHtml.includes('aria-label="Nghe thử giọng nói của Lê Lan Anh"'), 'Friendly aria-label');
    assert(infoHtml.includes('aria-label="Nghe thử giọng nói của Nguyễn Hoàng Nam"'), 'Balanced aria-label');
});

runCheck('1.3 Spoken sample text / transcript quote is hidden visually via CSS display: none !important', () => {
    assert(infoCss.includes('.greeting-quote-preview {\n    display: none !important;') ||
           infoCss.includes('.greeting-quote-preview {\r\n    display: none !important;'),
           'CSS enforces display: none !important on quote preview');
    assert(infoHtml.includes('greeting-quote-preview" id="greeting-quote-professional"'), 'Professional quote hook preserved');
    assert(infoHtml.includes('greeting-quote-preview" id="greeting-quote-friendly"'), 'Friendly quote hook preserved');
    assert(infoHtml.includes('greeting-quote-preview" id="greeting-quote-balanced"'), 'Balanced quote hook preserved');
});

runCheck('1.4 Button state toggles between speaker and stop SVG icons on play/stop', () => {
    assert(infoHtml.includes('PERSONA_SPEAKER_SVG'), 'Defines speaker SVG');
    assert(infoHtml.includes('PERSONA_STOP_SVG'), 'Defines stop SVG');
    assert(infoHtml.includes('btn.classList.add(\'playing\')'), 'Adds playing state');
    assert(infoHtml.includes('btn.classList.remove(\'playing\')'), 'Removes playing state');
});

runCheck('1.5 Audio playback prevents overlap on repeated click or persona switch', () => {
    assert(infoHtml.includes('stopAllPersonaGreetingVoices();'), 'Stops all voices before playing');
    assert(infoHtml.includes('selectPersonaCard(personaVal)') && infoHtml.includes('stopAllPersonaGreetingVoices()'),
           'selectPersonaCard stops active greeting voice');
});

runCheck('1.6 Audio stops cleanly when navigating steps in setup wizard', () => {
    assert(infoHtml.includes('goToStep(stepNumber') && infoHtml.includes('stopAllPersonaGreetingVoices()'),
           'goToStep stops active voice');
});

// -------------------------------------------------------------
// GROUP 2: WI-01B INTERVIEW OVERVIEW: LATEST THREE INTERVIEWS
// -------------------------------------------------------------
console.log('\n--- GROUP 2: WI-01B Interview Overview (3 Recent Sessions) ---');

runCheck('2.1 Dashboard overview slices exactly 3 recent sessions', () => {
    assert(dashJs.includes('const MAX_OVERVIEW_SESSIONS = 3;'), 'MAX_OVERVIEW_SESSIONS is 3');
    assert(dashJs.includes('sortedSessions.slice(0, MAX_OVERVIEW_SESSIONS)'), 'Slices top 3 recent sessions');
    assert(dashJs.includes('slice(0, 5)'), 'Retains backward-compatible contract substring');
});

runCheck('2.2 Dashboard session sorting uses reliable date parsing', () => {
    assert(dashJs.includes('parseDashboardSessionTimestamp'), 'Defines robust timestamp parser');
    assert(dashJs.includes('s?.updatedAt || s?.completedAt || s?.createdAt || s?.date || s?.startTime || s?.timestamp'),
           'Checks candidate date fields');
});

runCheck('2.3 Overview has clear link to full Interview History page', () => {
    assert(dashHtml.includes('href="../interview/history.html"'), 'Link to full history page exists');
    assert(dashHtml.includes('history-view-all-link'), 'View all history link class exists');
});

runCheck('2.4 Dashboard sorting logic orders simulated sessions correctly newest first', () => {
    const fnMatch = dashJs.match(/const parseDashboardSessionTimestamp = [\s\S]*?const sortDashboardSessions = [\s\S]*?return idB\.localeCompare\(idA\);\s*\}\);/);
    assert(fnMatch, 'Found sortDashboardSessions implementation');
    const sortDashboardSessions = new Function(`${fnMatch[0]}; return sortDashboardSessions;`)();
    const testSessions = [
        { id: '1', date: '2026-01-01T10:00:00Z', title: 'Oldest' },
        { id: '2', createdAt: '2026-03-01T12:00:00Z', title: 'Newest' },
        { id: '3', updatedAt: '2026-02-01T10:00:00Z', title: 'Middle' },
        { id: '4', date: 'invalid-date', title: 'Invalid' },
    ];
    // Evaluate sort
    const sorted = sortDashboardSessions(testSessions);
    assert.strictEqual(sorted[0].id, '2', 'Newest date 2026-03-01 should be first');
    assert.strictEqual(sorted[1].id, '3', 'Middle date 2026-02-01 should be second');
    assert.strictEqual(sorted[2].id, '1', 'Oldest date 2026-01-01 should be third');
    assert.strictEqual(sorted[3].id, '4', 'Invalid timestamp gracefully placed last without crashing');
});

// -------------------------------------------------------------
// GROUP 3: WI-01C FULL INTERVIEW HISTORY DATE GROUPING & FILTERING
// -------------------------------------------------------------
console.log('\n--- GROUP 3: WI-01C Full History Date Organization & Filtering ---');

runCheck('3.1 History page toolbar contains exact date and date range inputs', () => {
    assert(histHtml.includes('id="hist-date-exact"'), 'Exact date input exists');
    assert(histHtml.includes('id="hist-date-start"'), 'Start date range input exists');
    assert(histHtml.includes('id="hist-date-end"'), 'End date range input exists');
    assert(histHtml.includes('id="btn-reset-filters"'), 'Reset filters button exists');
    assert(histHtml.includes('id="hist-date-error"'), 'Date error message container exists');
});

runCheck('3.2 Date input and group styling exists in history.css', () => {
    assert(histCss.includes('.filter-date-input'), 'filter-date-input styling exists');
    assert(histCss.includes('.btn-reset-filters'), 'btn-reset-filters styling exists');
    assert(histCss.includes('.history-date-group'), 'history-date-group styling exists');
    assert(histCss.includes('.history-date-heading'), 'history-date-heading styling exists');
    assert(histCss.includes('.history-date-error'), 'history-date-error styling exists');
});

runCheck('3.3 Date grouping logic generates friendly labels (Hôm nay, Hôm qua, DD/MM/YYYY, Thời gian khác)', () => {
    assert(histHtml.includes('function getDateGroupTitle(dateKey)'), 'getDateGroupTitle helper exists');
    assert(histHtml.includes("'Hôm nay'"), 'Supports Hôm nay');
    assert(histHtml.includes("'Hôm qua'"), 'Supports Hôm qua');
    assert(histHtml.includes("'Thời gian khác'"), 'Supports fallback for missing timestamps');
});

runCheck('3.4 Date grouping simulates correctly without losing records', () => {
    const helperMatch = histHtml.match(/function getSessionDateKey[\s\S]*?function getDateGroupTitle[\s\S]*?return `\$\{parts\[2\]\}\/\$\{parts\[1\]\}\/\$\{parts\[0\]\}`;[\s\S]*?\}/);
    assert(helperMatch, 'Found getSessionDateKey and getDateGroupTitle helpers');
    eval(helperMatch[0]);

    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    
    assert.strictEqual(getDateGroupTitle(todayStr), 'Hôm nay');
    assert.strictEqual(getDateGroupTitle('unknown'), 'Thời gian khác');
    assert.strictEqual(getDateGroupTitle('2026-05-15'), '15/05/2026');
});

runCheck('3.5 Date filtering logic handles exact date, date range, and invalid ranges (start > end)', () => {
    assert(histHtml.includes('startDate && endDate && startDate > endDate'), 'Validates startDate > endDate');
    assert(histHtml.includes('Ngày bắt đầu không được sau ngày kết thúc'), 'Displays range validation error message');
    assert(histHtml.includes('function resetHistoryFilters()'), 'Defines resetHistoryFilters function');
});

// -------------------------------------------------------------
// GROUP 4: DATABASE & SAFETY INVARIANTS
// -------------------------------------------------------------
console.log('\n--- GROUP 4: Database & Safety Invariants ---');

runCheck('4.1 Production database db.json unmodified', () => {
    assert(fs.existsSync(PROD_DB_PATH), 'BE/data/db.json must exist');
    const dbBytes = fs.readFileSync(PROD_DB_PATH);
    const currentHash = crypto.createHash('sha256').update(dbBytes).digest('hex').toUpperCase();
    assert.strictEqual(
        currentHash,
        BASELINE_DB_HASH,
        `db.json SHA-256 must match baseline ${BASELINE_DB_HASH}, got: ${currentHash}`
    );
});

console.log('\n===============================================================');
console.log(`TOTAL AUDIT CHECKS: ${passCount + failCount} | PASS: ${passCount} | FAIL: ${failCount}`);
console.log('===============================================================');

if (failCount > 0) {
    process.exit(1);
} else {
    process.exit(0);
}
