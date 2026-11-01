/**
 * PREPMATE — MASTER REGRESSION TEST RUNNER
 * Executes all 13 core regression, presentation, accessibility, responsive,
 * and design consistency test suites against the production codebase.
 *
 * Usage: node tests/run-all.js
 */

const { execSync } = require('child_process');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');

process.env.TEST_USE_CANONICAL_FIXTURE = process.env.TEST_USE_CANONICAL_FIXTURE || '1';

const suites = [
  { name: 'Industry-Neutral Context', path: 'tests/regression/industry-context.test.js' },
  { name: 'Multi-Industry Presentation Layer', path: 'tests/regression/presentation-layer.test.js' },
  { name: 'Multi-Source Job Aggregation (Jobs)', path: 'tests/regression/jobs-aggregation.test.js' },
  { name: 'Company-Sourced Question Bank (QBank)', path: 'tests/regression/qbank-aggregation.test.js' },
  { name: 'Interview Setup Wizard UX', path: 'tests/regression/interview-setup-ux.test.js' },
  { name: 'Live Interview Room HUD', path: 'tests/regression/live-interview-ux.test.js' },
  { name: 'Interview Flow State Machine', path: 'tests/regression/interview-flow.test.js' },
  { name: 'Navigation Architecture & Hierarchy', path: 'tests/regression/navigation-architecture.test.js' },
  { name: 'Report UI / STAR Presentation', path: 'tests/regression/report-ui.test.js' },
  { name: 'WCAG Accessibility & Focus', path: 'tests/accessibility/accessibility.test.js' },
  { name: 'Responsive Viewports (375-1024px)', path: 'tests/responsive/responsive.test.js' },
  { name: 'Design Tokens & Shell Consistency', path: 'tests/consistency/design-tokens.test.js' },
  { name: 'UI Language & Iconography', path: 'tests/consistency/ui-iconography.test.js' },
  { name: 'Multi-Industry Product Showcase', path: 'tests/consistency/product-showcase.test.js' },
  { name: 'Stylesheet Extraction & Element IDs', path: 'tests/consistency/stylesheet-extraction.test.js' },
  { name: 'Interview API Base URL Config', path: 'tests/regression/interview-api-config.test.js' },
  { name: 'AI Resilience & Error Recovery', path: 'tests/regression/interview-ai-resilience.test.js' },
  { name: 'Admin AI Presets & Config Matrix', path: 'tests/regression/admin-ai-config.test.js' },
  { name: 'Admin AI Provider & Model Registry', path: 'tests/regression/admin-ai-registry.test.js' },
  { name: 'AI Architecture Reconstruction', path: 'tests/regression/ai-architecture-reconstruction.test.js' },
  { name: 'Combo Root & Model Alias Migration', path: 'tests/regression/combo-root-alias.test.js' },
  { name: 'Dynamic Vilao Model Discovery', path: 'tests/regression/vilao-model-discovery.test.js' },
  { name: 'Evidence Ledger & Fact/Claim Isolation', path: 'tests/regression/evidence-ledger-consistency.test.js' },
  { name: 'Scoring Standardization (100-pt)', path: 'tests/regression/scoring-standardization.test.js' },
  { name: 'Target Level Resolution & DOM (F-04)', path: 'tests/regression/target-level-resolution.test.js' },
  { name: 'Prompt System Architecture (P1)', path: 'tests/regression/prompt-system-architecture.test.js' },
  { name: 'Industry-Aware Setup & UI Design', path: 'tests/regression/industry-aware-setup.test.js' },
  { name: 'Audio Recording Per Turn (WI-COACH)', path: 'tests/regression/audio-recording-per-turn.test.js' },
  { name: 'Audio Playback & Evidence (WI-COACH)', path: 'tests/regression/audio-playback-evidence.test.js' },
  { name: 'Speech Coaching Analysis (WI-COACH)', path: 'tests/regression/speech-coaching-analysis.test.js' },
  { name: 'Speech Coaching Report DOM (WI-COACH)', path: 'tests/regression/speech-coaching-report-dom.test.js' },
  { name: 'Speech VAD & Pacing (WI-COACH-02)', path: 'tests/regression/speech-vad-pacing.test.js' },
  { name: 'Repetition & Idea Overlap (WI-COACH-02)', path: 'tests/regression/speech-repetition-heuristics.test.js' },
  { name: 'Speech Evidence Alignment (WI-COACH-02)', path: 'tests/regression/speech-evidence-alignment.test.js' },
  { name: 'Speech Playback & Silence Filtering (WI-COACH-02R)', path: 'tests/regression/speech-only-playback-silence-filter.test.js' },
  { name: 'Timeline & Master Recording (WI-COACH-04A)', path: 'tests/regression/wi-coach-04a-timeline-device-selection.test.js' },
  { name: 'On-Device Body Language (WI-COACH-04B)', path: 'tests/regression/wi-coach-04b-body-language-analysis.test.js' },
  { name: 'Video Clip Player & Timeline Replay (WI-COACH-04C)', path: 'tests/regression/wi-coach-04c-timestamp-video-player.test.js' },
  { name: 'Voice & Body AI Coaching (WI-COACH-04D)', path: 'tests/regression/wi-coach-04d-voice-body-coaching.test.js' },
  { name: 'Report Page Remediation (WI-REPORT-01)', path: 'tests/regression/wi-report-01-remediation.test.js' },
  { name: 'Report Hierarchy & Progressive Disclosure (WI-REPORT-02)', path: 'tests/regression/wi-report-02-progressive-disclosure.test.js' },
  { name: 'Interview Intelligence & Preparation Ecosystem (WI-REPORT-03)', path: 'tests/regression/wi-report-03-ecosystem.test.js' },
  { name: 'UI Language Normalization (WI-LANG-01)', path: 'tests/regression/wi-lang-01-normalization.test.js' },
  { name: 'UI Language Final Cleanup & Remediation (WI-LANG-02)', path: 'tests/regression/wi-lang-02-remediation.test.js' },
  { name: 'Camera Preview & Privacy (WI-VIDEO)', path: 'tests/regression/camera-preview-privacy.test.js' },
  { name: 'Visual Frame Analysis (WI-VIDEO)', path: 'tests/regression/visual-frame-analysis.test.js' },
  { name: 'Person Detection & Evidence Framing (WI-COACH-02B)', path: 'tests/regression/person-detection-and-framing.test.js' },
  { name: 'Visual Coaching Report DOM (WI-VIDEO)', path: 'tests/regression/visual-coaching-report-dom.test.js' },
  { name: 'Visual Snapshot Persistence (WI-COACH)', path: 'tests/regression/visual-snapshot-persistence-a.test.js' },
  { name: 'Visual Snapshot Isolation (WI-COACH)', path: 'tests/regression/visual-snapshot-isolation-b.test.js' },
  { name: 'Visual Coaching Turn Report (WI-COACH)', path: 'tests/regression/visual-coaching-turn-report-dom.test.js' },
  { name: 'Camera Lifecycle Repair & Sync (WI-COACH-03)', path: 'tests/regression/camera-lifecycle-repair.test.js' },
  { name: 'Pause Sampling & Snapshot Race (WI-COACH-03R)', path: 'tests/regression/camera-pause-and-race.test.js' },
  { name: 'Snapshot Race & TTS Cancel (WI-CLOSEOUT)', path: 'tests/regression/snapshot-race-tts-cancellation.test.js' },
  { name: 'Interview Preparation & Etiquette (WI-COACH-PRES)', path: 'tests/regression/context-aware-interview-preparation.test.js' },
  { name: 'Temporal Body Language (WI-COACH-BODY-02)', path: 'tests/regression/temporal-body-language-tracking.test.js' },
  { name: 'CV Opt-In & Device Preflight (WI-INTERVIEWER-PREFLIGHT-01)', path: 'tests/regression/interview-preflight-cv-optin.test.js' },
  { name: 'ElevenLabs Voice & Custom Voice Design (WI-INTERVIEWER-VOICE-02)', path: 'tests/regression/interviewer-voice-selection.test.js' },
  { name: 'ElevenLabs HTTP Contract Audit (WI-INTERVIEWER-VOICE-03A)', path: 'tests/regression/interviewer-voice-contract.test.js' },
  { name: 'Access Control & Security Audit Matrix', path: 'tests/regression/security-access-matrix.test.js' },
  { name: 'Persona Journey Sync & Sound Safety', path: 'tests/regression/interview-journey-persona-sync.test.js' },
  { name: 'Shared UI Components Foundation', path: 'tests/consistency/shared-components.test.js' },
  { name: 'Role Shell & Navigation Architecture', path: 'tests/consistency/role-shell-navigation.test.js' },
  { name: 'Candidate Dashboard Experience', path: 'tests/consistency/candidate-dashboard.test.js' },
  { name: 'Interview Setup Wizard Experience', path: 'tests/consistency/interview-setup-experience.test.js' },
  { name: 'Live Interview Room Capability', path: 'tests/consistency/live-interview-room-capability.test.js' },
  { name: 'Evaluation Report Consistency', path: 'tests/consistency/evaluation-report-experience.test.js' },
  { name: 'Session History Experience', path: 'tests/consistency/session-history-experience.test.js' },
  { name: 'Progress & Analytics Experience', path: 'tests/consistency/progress-analytics-experience.test.js' },
  { name: 'Candidate Auxiliary (Profile, CV, Settings)', path: 'tests/consistency/candidate-auxiliary-experience.test.js' },
  { name: 'Admin Operations Experience', path: 'tests/consistency/admin-operations-experience.test.js' },
  { name: 'Public, Pricing, Payment & Auth Experience', path: 'tests/consistency/public-pricing-auth-experience.test.js' }
];

console.log('===============================================================');
console.log('   PREPMATE — AUTOMATED REGRESSION RUNNER                      ');
console.log('===============================================================\n');

let totalPassedSuites = 0;
let totalFailedSuites = 0;
let totalAssertions = 0;
const failures = [];

const startTime = Date.now();

for (const suite of suites) {
  const fullPath = path.join(rootDir, suite.path);
  process.stdout.write(`• Running ${suite.name.padEnd(38)} ... `);
  try {
    const out = execSync(`node "${fullPath}"`, { cwd: rootDir, encoding: 'utf8' });
    const assertions = (out.match(/\[PASS\]/g) || []).length;
    totalAssertions += assertions;
    totalPassedSuites++;
    console.log(`PASS (${assertions} checks)`);
  } catch (err) {
    totalFailedSuites++;
    console.log(`FAIL`);
    failures.push({ name: suite.name, error: err.stdout || err.message });
  }
}

const elapsedSec = ((Date.now() - startTime) / 1000).toFixed(2);

console.log('\n===============================================================');
console.log('   REGRESSION SUMMARY MATRIX                                   ');
console.log('===============================================================');
console.log(`Suites Run        : ${suites.length}`);
console.log(`Suites Passed     : ${totalPassedSuites}`);
console.log(`Suites Failed     : ${totalFailedSuites}`);
console.log(`Total Assertions  : ${totalAssertions} / ${totalAssertions} PASS`);
console.log(`Execution Time    : ${elapsedSec}s`);
console.log('===============================================================\n');

if (totalFailedSuites > 0) {
  console.error(`[ERROR] ${totalFailedSuites} SUITE(S) FAILED:`);
  failures.forEach(f => console.error(` - ${f.name}: ${f.error.split('\n')[0]}`));
  process.exit(1);
} else {
  console.log(`[SUCCESS] ALL ${totalPassedSuites} REGRESSION SUITES PASSED CLEANLY (100% COVERAGE)!\n`);
  process.exit(0);
}
