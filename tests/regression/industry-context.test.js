/**
 * PREPMATE - P1.3 WAVE A VERIFICATION SUITE
 * Industry-Neutral Context & Classifier Verification
 * Tests Cases A through F and ensures zero hardcoded SWE assumptions
 */

const fs = require('fs');
const path = require('path');

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function assert(condition, message) {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`[PASS] Test ${totalTests}: ${message}`);
  } else {
    failedTests++;
    console.error(`[FAIL] Test ${totalTests}: ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
}

function runTests() {
  console.log('================================================================');
  console.log('   P1.3 WAVE A VERIFICATION: INDUSTRY-NEUTRAL CONTEXT SUITE    ');
  console.log('================================================================\n');

  const { rootDir } = require('../helpers/test-env');

  // 1. Inspect JobFamily.cs
  const jobFamilyPath = path.join(rootDir, 'BE/Models/Interview/JobFamily.cs');
  assert(fs.existsSync(jobFamilyPath), 'BE/Models/Interview/JobFamily.cs exists');
  const jobFamilyContent = fs.readFileSync(jobFamilyPath, 'utf8');

  // Verify all 12 job families
  const expectedFamilies = [
    'SOFTWARE_ENGINEERING',
    'DATA_ANALYTICS',
    'PRODUCT_PROJECT',
    'BUSINESS_ANALYSIS',
    'MARKETING_GROWTH',
    'SALES_BUSINESS_DEVELOPMENT',
    'FINANCE_ACCOUNTING',
    'HR_PEOPLE',
    'DESIGN_UX',
    'OPERATIONS_SUPPLY_CHAIN',
    'CUSTOMER_SUCCESS',
    'GENERAL_PROFESSIONAL'
  ];

  for (const fam of expectedFamilies) {
    assert(jobFamilyContent.includes(fam), `JobFamily enum defines ${fam}`);
  }

  assert(
    jobFamilyContent.includes('DefaultPositionTitle = "Chuyên viên chuyên môn"'),
    'ProfessionalDomainClassifier.DefaultPositionTitle is "Chuyên viên chuyên môn"'
  );

  // 2. Inspect InterviewerPersona.cs
  const personaPath = path.join(rootDir, 'BE/Models/Interview/InterviewerPersona.cs');
  assert(fs.existsSync(personaPath), 'InterviewerPersona.cs exists');
  const personaContent = fs.readFileSync(personaPath, 'utf8');

  assert(
    personaContent.includes('ProfessionalDomainClassifier.Classify(targetPosition)'),
    'InterviewerPersona.CreateDefault classifies targetPosition dynamically'
  );
  assert(
    personaContent.includes('Marketing & Growth Director Interviewer'),
    'Marketing persona defined in InterviewerPersona'
  );
  assert(
    personaContent.includes('Finance Controller & Senior Auditor Interviewer'),
    'Finance persona defined in InterviewerPersona'
  );
  assert(
    personaContent.includes('Business Analysis Lead Interviewer'),
    'BA persona defined in InterviewerPersona'
  );
  assert(
    personaContent.includes('Senior Engineering Interviewer / Tech Lead'),
    'SWE persona preserved for tech positions'
  );
  assert(
    personaContent.includes('Senior Hiring Manager / Professional Interviewer'),
    'Neutral fallback persona defined for general professionals'
  );

  // 3. Inspect QuestionPrompt.cs
  const questionPromptPath = path.join(rootDir, 'BE/Prompts/Interview/QuestionPrompt.cs');
  assert(fs.existsSync(questionPromptPath), 'QuestionPrompt.cs exists');
  const questionPromptContent = fs.readFileSync(questionPromptPath, 'utf8');

  assert(
    questionPromptContent.includes('ProfessionalDomainClassifier.Classify'),
    'QuestionPrompt classifies session domain'
  );
  assert(
    !questionPromptContent.includes('Hãy nói như một Tech Lead thật sự'),
    'Eliminated unconditional "Hãy nói như một Tech Lead thật sự" prompt directive'
  );
  assert(
    questionPromptContent.includes('toneSection') && questionPromptContent.includes('clarifySection'),
    'QuestionPrompt contains domain-gated tone and clarification sections'
  );
  assert(
    questionPromptContent.includes('challengeSection') && questionPromptContent.includes('transitionExamples'),
    'QuestionPrompt contains domain-gated challenge and transition sections'
  );

  // 4. Inspect CandidateQuestionPrompt.cs
  const candidatePromptPath = path.join(rootDir, 'BE/Prompts/Interview/CandidateQuestionPrompt.cs');
  const candidatePromptContent = fs.readFileSync(candidatePromptPath, 'utf8');

  assert(
    candidatePromptContent.includes('ProfessionalDomainClassifier.DefaultPositionTitle'),
    'CandidateQuestionPrompt uses ProfessionalDomainClassifier.DefaultPositionTitle fallback'
  );
  assert(
    !candidatePromptContent.includes('"Software Engineer"'),
    'CandidateQuestionPrompt has zero hardcoded "Software Engineer" string'
  );
  assert(
    !candidatePromptContent.includes('phạm vi phỏng vấn kỹ thuật'),
    'CandidateQuestionPrompt neutralized "phạm vi phỏng vấn kỹ thuật" to "phạm vi phỏng vấn chuyên môn"'
  );

  // 5. Inspect Evaluation & Preparation Services
  const finalEvalContent = fs.readFileSync(path.join(rootDir, 'BE/Services/Evaluation/FinalEvaluationService.cs'), 'utf8');
  assert(
    finalEvalContent.includes('ProfessionalDomainClassifier.DefaultPositionTitle') &&
    !finalEvalContent.includes(': (!string.IsNullOrWhiteSpace(session.JobTitle) ? session.JobTitle : "Software Engineer");'),
    'FinalEvaluationService uses ProfessionalDomainClassifier.DefaultPositionTitle'
  );

  const perfEvalContent = fs.readFileSync(path.join(rootDir, 'BE/Services/Evaluation/InterviewPerformanceService.cs'), 'utf8');
  assert(
    perfEvalContent.includes('ProfessionalDomainClassifier.DefaultPositionTitle') &&
    !perfEvalContent.includes(': (!string.IsNullOrWhiteSpace(session.JobTitle) ? session.JobTitle : "Software Engineer");'),
    'InterviewPerformanceService uses ProfessionalDomainClassifier.DefaultPositionTitle'
  );

  const roadmapContent = fs.readFileSync(path.join(rootDir, 'BE/Services/Evaluation/ImprovementRoadmapService.cs'), 'utf8');
  assert(
    roadmapContent.includes('ProfessionalDomainClassifier.DefaultPositionTitle') &&
    !roadmapContent.includes(': "Software Engineer"));'),
    'ImprovementRoadmapService uses ProfessionalDomainClassifier.DefaultPositionTitle'
  );

  const prepContent = fs.readFileSync(path.join(rootDir, 'BE/Services/Preparation/InterviewPreparationService.cs'), 'utf8');
  assert(
    prepContent.includes('ProfessionalDomainClassifier.DefaultPositionTitle') &&
    !prepContent.includes(': "Software Engineer"));'),
    'InterviewPreparationService uses ProfessionalDomainClassifier.DefaultPositionTitle'
  );
  assert(
    prepContent.includes('ProfessionalDomainClassifier.Classify(targetPosition)') &&
    prepContent.includes('bối cảnh nghiệp vụ, mục tiêu ưu tiên'),
    'InterviewPreparationService domain-gates execution clarification guidance'
  );
  assert(
    prepContent.includes('Mô phỏng Chiến lược Tăng trưởng & Phân bổ Ngân sách') &&
    prepContent.includes('Mô phỏng Báo cáo Tài chính & Kiểm soát Chi phí'),
    'InterviewPreparationService domain-gates mock interview recommendations across industries'
  );

  // 6. Inspect Behavioral and Situational Interview Services
  const behavioralContent = fs.readFileSync(path.join(rootDir, 'BE/Services/Interview/BehavioralInterviewService.cs'), 'utf8');
  assert(
    behavioralContent.includes('ProfessionalDomainClassifier.DefaultPositionTitle') &&
    !behavioralContent.includes('?? "Software Engineer";'),
    'BehavioralInterviewService uses ProfessionalDomainClassifier.DefaultPositionTitle'
  );

  const situationalContent = fs.readFileSync(path.join(rootDir, 'BE/Services/Interview/SituationalInterviewService.cs'), 'utf8');
  assert(
    situationalContent.includes('ProfessionalDomainClassifier.DefaultPositionTitle') &&
    !situationalContent.includes('?? "Software Engineer";'),
    'SituationalInterviewService uses ProfessionalDomainClassifier.DefaultPositionTitle'
  );

  // 7. Inspect AI Career and Recommendation Services
  const careerRoadmapContent = fs.readFileSync(path.join(rootDir, 'BE/Services/AI/CareerRoadmapService.cs'), 'utf8');
  assert(
    careerRoadmapContent.includes('ProfessionalDomainClassifier.DefaultPositionTitle') &&
    !careerRoadmapContent.includes('{{request.JobTitle ?? "Developer"}}'),
    'CareerRoadmapService uses ProfessionalDomainClassifier.DefaultPositionTitle'
  );

  const jobRecContent = fs.readFileSync(path.join(rootDir, 'BE/Services/AI/JobRecommendationService.cs'), 'utf8');
  assert(
    jobRecContent.includes('ProfessionalDomainClassifier.DefaultPositionTitle') &&
    !jobRecContent.includes('{{request.JobTitle ?? "Developer"}}'),
    'JobRecommendationService uses ProfessionalDomainClassifier.DefaultPositionTitle'
  );

  // 8. Inspect Frontend main.js (Simulate test cases A through F)
  const mainJsContent = fs.readFileSync(path.join(rootDir, 'FE/shared/js/main.js'), 'utf8');

  // Evaluate MOCK_QUESTIONS and getMockQuestionsForJob in sandbox
  const vm = require('vm');
  const sandbox = { console: { log: () => {} } };
  // Extract mock questions code
  const mockStart = mainJsContent.indexOf('const MOCK_QUESTIONS = {');
  const mockEnd = mainJsContent.indexOf('const MOCK_EVALUATIONS = {');
  assert(mockStart !== -1 && mockEnd !== -1, 'main.js mock questions block located');
  const mockCode = mainJsContent.substring(mockStart, mockEnd) +
    '\nthis.MOCK_QUESTIONS = MOCK_QUESTIONS;\nthis.getMockQuestionsForJob = getMockQuestionsForJob;';
  vm.runInNewContext(mockCode, sandbox);

  const MOCK_QUESTIONS = sandbox.MOCK_QUESTIONS;
  const getMockQuestionsForJob = sandbox.getMockQuestionsForJob;

  assert(Array.isArray(MOCK_QUESTIONS['General Professional']), 'MOCK_QUESTIONS contains General Professional');
  assert(MOCK_QUESTIONS['General Professional'].length === 6, 'General Professional contains 6 universal questions');

  // CASE A: Marketing Specialist -> Marketing questions, not Frontend Developer
  const caseAQuestions = getMockQuestionsForJob('Marketing Specialist');
  assert(
    caseAQuestions === MOCK_QUESTIONS['Digital Marketing Specialist'],
    'Case A: Marketing Specialist matches Digital Marketing Specialist'
  );
  assert(
    !caseAQuestions[1].includes('React') && !caseAQuestions[1].includes('Vue'),
    'Case A: Zero React/Vue in Marketing questions'
  );

  // CASE B: Financial Analyst -> Accounting/Finance questions
  const caseBQuestions = getMockQuestionsForJob('Chuyên viên Tài chính Doanh nghiệp');
  assert(
    caseBQuestions === MOCK_QUESTIONS['Chuyên viên Kế toán / Kiểm toán'],
    'Case B: Financial Analyst matches Kế toán / Kiểm toán questions'
  );
  assert(
    !caseBQuestions[0].includes('Frontend') && !caseBQuestions[0].includes('CSS'),
    'Case B: Zero Frontend/CSS in Finance questions'
  );

  // CASE C: Business Analyst -> BA questions
  const caseCQuestions = getMockQuestionsForJob('Lead Business Analyst');
  assert(
    caseCQuestions === MOCK_QUESTIONS['Business Analyst'],
    'Case C: Business Analyst matches Business Analyst questions'
  );

  // CASE D: Software Engineer -> Frontend Developer or Backend Developer
  const caseDQuestions = getMockQuestionsForJob('Frontend Engineer');
  assert(
    caseDQuestions === MOCK_QUESTIONS['Frontend Developer'],
    'Case D: Frontend Engineer matches Frontend Developer'
  );

  // CASE E: Non-tech position (Corporate Lawyer) -> General Professional fallback
  const caseEQuestions = getMockQuestionsForJob('Luật sư Doanh nghiệp / Corporate Lawyer');
  assert(
    caseEQuestions === MOCK_QUESTIONS['General Professional'],
    'Case E: Corporate Lawyer falls back to General Professional (not Frontend Developer!)'
  );
  assert(
    !caseEQuestions.some(q => q.includes('React') || q.includes('Vue') || q.includes('API') || q.includes('database')),
    'Case E: General Professional questions have zero tech/coding terminology'
  );

  // CASE F: Missing / Empty job title -> General Professional fallback
  const caseFEmpty = getMockQuestionsForJob('');
  const caseFNull = getMockQuestionsForJob(null);
  const caseFUndefined = getMockQuestionsForJob(undefined);
  assert(
    caseFEmpty === MOCK_QUESTIONS['General Professional'] &&
    caseFNull === MOCK_QUESTIONS['General Professional'] &&
    caseFUndefined === MOCK_QUESTIONS['General Professional'],
    'Case F: Empty/null/undefined jobTitle safely falls back to General Professional'
  );

  // 9. Inspect FE/features/interview/interview.js
  const interviewJsContent = fs.readFileSync(path.join(rootDir, 'FE/features/interview/interview.js'), 'utf8');
  assert(
    interviewJsContent.includes('currentInterviewSession?.jobTitle || "Chuyên viên chuyên môn"'),
    'interview.js fallback jobTitle is "Chuyên viên chuyên môn"'
  );
  assert(
    !interviewJsContent.includes('currentInterviewSession?.jobTitle || "Chuyên viên Kỹ thuật"'),
    'Eliminated "Chuyên viên Kỹ thuật" fallback in interview.js'
  );
  assert(
    interviewJsContent.includes('<span class="debrief-metric-label">Chuyên môn</span>'),
    'Debrief metric card label is "Chuyên môn"'
  );

  console.log('\n================================================================');
  console.log(`   TOTAL TESTS: ${totalTests} | PASS: ${passedTests} | FAIL: ${failedTests}`);
  console.log('================================================================\n');

  if (failedTests === 0) {
    console.log('[SUCCESS] ALL P1.3 WAVE A CONTEXT CORE REMEDIATION TESTS PASSED!\n');
  } else {
    process.exit(1);
  }
}

try {
  runTests();
} catch (e) {
  console.error('\nSuite Execution Failed:', e.message);
  process.exit(1);
}
