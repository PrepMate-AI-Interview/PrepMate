/**
 * PREPMATE - PROMPT SYSTEM ARCHITECTURE REGRESSION TEST SUITE
 * Validates:
 * 1. Modular domain layout under BE/Prompts/ (Shared, Career, Company, Context, Interview, Knowledge, Reports).
 * 2. Complete extraction of inline prompts from Services (Zero business prompt strings in services).
 * 3. Elimination of few-shot bias & IT metric leakage (Redis, Kafka, 10,000 req/s) from generic rules.
 * 4. Context boundary wrapping (<<<TAG>>> delimiters and injection defense).
 * 5. Language consistency policy (vi-VN default, en-US support, technical noun preservation).
 * 6. Strict JSON contract enforcement (prohibiting markdown fences).
 * 7. Contract stability & backward-compatibility facade integrity.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

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
  console.log('   PREPMATE: PROMPT SYSTEM ARCHITECTURE VERIFICATION SUITE      ');
  console.log('================================================================\n');

  const { rootDir } = require('../helpers/test-env');

  // --- SECTION 1: PROMPT DIRECTORY & FILES EXISTENCE ---
  const requiredPromptFiles = [
    'BE/Prompts/PROMPT_GUIDELINES.md',
    'BE/Prompts/Shared/PromptLanguagePolicy.cs',
    'BE/Prompts/Shared/PromptGroundingPolicy.cs',
    'BE/Prompts/Shared/PromptContextBoundary.cs',
    'BE/Prompts/Shared/PromptOutputPolicy.cs',
    'BE/Prompts/Career/CvAnalysisPrompt.cs',
    'BE/Prompts/Career/JobRecommendationPrompt.cs',
    'BE/Prompts/Career/CareerRoadmapPrompt.cs',
    'BE/Prompts/Company/CompanyIntelligencePrompt.cs',
    'BE/Prompts/Context/InterviewContextPrompt.cs',
    'BE/Prompts/Interview/QuestionGenerationPrompt.cs',
    'BE/Prompts/Interview/QuestionPrompt.cs',
    'BE/Prompts/Interview/IntroductionPrompt.cs',
    'BE/Prompts/Interview/AnalysisPrompt.cs',
    'BE/Prompts/Interview/BehavioralPrompt.cs',
    'BE/Prompts/Interview/SituationalPrompt.cs',
    'BE/Prompts/Interview/InterviewerIntelligencePrompt.cs',
    'BE/Prompts/Interview/CandidateQuestionPrompt.cs',
    'BE/Prompts/Interview/ClosingPrompt.cs',
    'BE/Prompts/Interview/LegacyQuestionPrompt.cs',
    'BE/Prompts/Knowledge/BlueprintPrompt.cs',
    'BE/Prompts/Knowledge/BlueprintEnrichmentPrompt.cs',
    'BE/Prompts/Reports/ReportPrompt.cs',
    'BE/Prompts/Interview/ReportPrompt.cs' // Facade
  ];

  for (const relPath of requiredPromptFiles) {
    const fullPath = path.join(rootDir, relPath);
    assert(fs.existsSync(fullPath), `Prompt file exists: ${relPath}`);
  }

  // --- SECTION 2: SHARED POLICIES INTEGRITY ---
  const langPolicyContent = fs.readFileSync(path.join(rootDir, 'BE/Prompts/Shared/PromptLanguagePolicy.cs'), 'utf8');
  assert(langPolicyContent.includes('OUTPUT LANGUAGE: TIẾNG VIỆT'), 'PromptLanguagePolicy defines Vietnamese instruction');
  assert(langPolicyContent.includes('OUTPUT LANGUAGE: ENGLISH'), 'PromptLanguagePolicy defines English instruction');
  assert(langPolicyContent.includes('InterviewLanguage.Vietnamese'), 'PromptLanguagePolicy supports Vietnamese default');
  assert(langPolicyContent.includes('GetInstruction'), 'PromptLanguagePolicy has GetInstruction method');

  const groundingPolicyContent = fs.readFileSync(path.join(rootDir, 'BE/Prompts/Shared/PromptGroundingPolicy.cs'), 'utf8');
  assert(groundingPolicyContent.includes('Instruction'), 'PromptGroundingPolicy defines Instruction constant');
  assert(groundingPolicyContent.includes('Facts'), 'PromptGroundingPolicy covers Fact classification');
  assert(groundingPolicyContent.includes('Claims'), 'PromptGroundingPolicy covers Claim classification');
  assert(groundingPolicyContent.includes('Inferences'), 'PromptGroundingPolicy covers Inference classification');

  const boundaryContent = fs.readFileSync(path.join(rootDir, 'BE/Prompts/Shared/PromptContextBoundary.cs'), 'utf8');
  assert(boundaryContent.includes('<<<') && boundaryContent.includes('>>>'), 'PromptContextBoundary uses delimiter brackets');
  assert(boundaryContent.includes('Sanitize'), 'PromptContextBoundary sanitizes input against delimiter tampering');

  const outputPolicyContent = fs.readFileSync(path.join(rootDir, 'BE/Prompts/Shared/PromptOutputPolicy.cs'), 'utf8');
  assert(outputPolicyContent.includes('STRICT JSON ONLY'), 'PromptOutputPolicy specifies STRICT JSON ONLY');
  assert(outputPolicyContent.includes('TUYỆT ĐỐI KHÔNG sử dụng markdown code fences'), 'PromptOutputPolicy explicitly bans markdown code fences');

  // --- SECTION 3: SERVICES INLINE PROMPT EXTRACTION VERIFICATION ---
  const cvService = fs.readFileSync(path.join(rootDir, 'BE/Services/AI/CvAnalysisService.cs'), 'utf8');
  assert(cvService.includes('CvAnalysisPrompt.Build'), 'CvAnalysisService delegates to CvAnalysisPrompt.Build');
  assert(!cvService.includes('Bạn là chuyên gia phân tích CV hàng đầu'), 'CvAnalysisService has no inline prompt block');

  const jobRecService = fs.readFileSync(path.join(rootDir, 'BE/Services/AI/JobRecommendationService.cs'), 'utf8');
  assert(jobRecService.includes('JobRecommendationPrompt.Build'), 'JobRecommendationService delegates to JobRecommendationPrompt.Build');
  assert(!jobRecService.includes('Bạn là chuyên gia tư vấn nghề nghiệp'), 'JobRecommendationService has no inline prompt block');

  const careerRoadmapService = fs.readFileSync(path.join(rootDir, 'BE/Services/AI/CareerRoadmapService.cs'), 'utf8');
  assert(careerRoadmapService.includes('CareerRoadmapPrompt.Build'), 'CareerRoadmapService delegates to CareerRoadmapPrompt.Build');
  assert(!careerRoadmapService.includes('Bạn là chuyên gia hoạch định lộ trình sự nghiệp'), 'CareerRoadmapService has no inline prompt block');

  const contextBuilder = fs.readFileSync(path.join(rootDir, 'BE/Services/Context/InterviewContextBuilder.cs'), 'utf8');
  assert(contextBuilder.includes('InterviewContextPrompt.Build'), 'InterviewContextBuilder delegates to InterviewContextPrompt.Build');
  assert(!contextBuilder.includes('Dưới đây là thông tin về ứng viên và buổi phỏng vấn:'), 'InterviewContextBuilder has no inline prompt block');

  const questionGenService = fs.readFileSync(path.join(rootDir, 'BE/Services/Question/QuestionGenerationService.cs'), 'utf8');
  assert(questionGenService.includes('QuestionGenerationPrompt.BuildFirstQuestion'), 'QuestionGenerationService delegates to QuestionGenerationPrompt.BuildFirstQuestion');
  assert(!questionGenService.includes('Bạn là một chuyên gia phỏng vấn chuyên nghiệp và khách quan.'), 'QuestionGenerationService has no inline prompt block');

  const interviewerService = fs.readFileSync(path.join(rootDir, 'BE/Services/Interview/InterviewerIntelligenceService.cs'), 'utf8');
  assert(interviewerService.includes('InterviewerIntelligencePrompt.BuildNaturalWordingPrompt'), 'InterviewerIntelligenceService delegates to InterviewerIntelligencePrompt.BuildNaturalWordingPrompt');

  const companyService = fs.readFileSync(path.join(rootDir, 'BE/Services/Company/CompanyIntelligenceService.cs'), 'utf8');
  assert(companyService.includes('CompanyIntelligencePrompt.BuildExtractionPrompt'), 'CompanyIntelligenceService delegates to CompanyIntelligencePrompt');

  const legacyQuestionService = fs.readFileSync(path.join(rootDir, 'BE/Services/Interview/LegacyQuestionService.cs'), 'utf8');
  assert(legacyQuestionService.includes('LegacyQuestionPrompt.Build'), 'LegacyQuestionService delegates to LegacyQuestionPrompt.Build');

  // --- SECTION 4: FEW-SHOT BIAS & IT LEAKAGE ELIMINATION ---
  const questionGenPrompt = fs.readFileSync(path.join(rootDir, 'BE/Prompts/Interview/QuestionGenerationPrompt.cs'), 'utf8');
  assert(!questionGenPrompt.includes('Redis'), 'QuestionGenerationPrompt contains zero hardcoded Redis references');
  assert(!questionGenPrompt.includes('Kafka'), 'QuestionGenerationPrompt contains zero hardcoded Kafka references');
  assert(!questionGenPrompt.includes('10,000 req/s'), 'QuestionGenerationPrompt contains zero hardcoded 10,000 req/s references');
  assert(questionGenPrompt.includes('PromptContextBoundary.Wrap'), 'QuestionGenerationPrompt wraps context in boundaries');
  assert(questionGenPrompt.includes('PromptLanguagePolicy.GetInstruction'), 'QuestionGenerationPrompt uses PromptLanguagePolicy');

  const blueprintPrompt = fs.readFileSync(path.join(rootDir, 'BE/Prompts/Knowledge/BlueprintPrompt.cs'), 'utf8');
  assert(!blueprintPrompt.includes('Redis'), 'BlueprintPrompt contains zero hardcoded Redis references');
  assert(!blueprintPrompt.includes('Kafka'), 'BlueprintPrompt contains zero hardcoded Kafka references');

  // --- SECTION 5: JSON CONTRACT STABILITY ---
  const companyPrompt = fs.readFileSync(path.join(rootDir, 'BE/Prompts/Company/CompanyIntelligencePrompt.cs'), 'utf8');
  assert(companyPrompt.includes('"CompanyName"'), 'CompanyIntelligencePrompt preserves PascalCase CompanyName key');
  assert(companyPrompt.includes('"KnownFacts"'), 'CompanyIntelligencePrompt preserves PascalCase KnownFacts key');
  assert(companyPrompt.includes('"Inferences"'), 'CompanyIntelligencePrompt preserves PascalCase Inferences key');

  const reportPrompt = fs.readFileSync(path.join(rootDir, 'BE/Prompts/Reports/ReportPrompt.cs'), 'utf8');
  assert(reportPrompt.includes('"criteria"'), 'ReportPrompt preserves criteria key');
  assert(reportPrompt.includes('"strengths"'), 'ReportPrompt preserves strengths key');
  assert(reportPrompt.includes('"improvements"'), 'ReportPrompt preserves improvements key');
  assert(reportPrompt.includes('"overallScore"'), 'ReportPrompt preserves overallScore key');

  // --- SECTION 6: BACKWARD COMPATIBILITY FACADES ---
  const questionGenContent = fs.readFileSync(path.join(rootDir, 'BE/Prompts/Interview/QuestionGenerationPrompt.cs'), 'utf8');
  assert(questionGenContent.includes('QuestionPrompt.Build'), 'QuestionGenerationPrompt delegates BuildFollowUp cleanly to QuestionPrompt');

  const reportPromptFacade = fs.readFileSync(path.join(rootDir, 'BE/Prompts/Interview/ReportPrompt.cs'), 'utf8');
  assert(reportPromptFacade.includes('Reports.ReportPrompt.Build'), 'ReportPrompt facade in Interview routes cleanly to Reports.ReportPrompt');

  console.log('\n----------------------------------------------------------------');
  console.log(`Results: ${passedTests}/${totalTests} tests passed (${failedTests} failed)`);
  console.log('================================================================\n');

  if (failedTests > 0) {
    process.exit(1);
  }
}

runTests();
