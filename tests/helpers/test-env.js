/**
 * PrepMate — Centralized Test Environment Helper
 * Provides stable repository-root relative path resolution for all test suites.
 */
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const rootDir = path.resolve(__dirname, '../..');
const CANONICAL_DB_FIXTURE_PATH = path.join(rootDir, 'tests', 'fixtures', 'test_db_fixture.json');

function ensureCanonicalFixture() {
  const fixturesDir = path.join(rootDir, 'tests', 'fixtures');
  if (!fs.existsSync(fixturesDir)) {
    fs.mkdirSync(fixturesDir, { recursive: true });
  }
  if (!fs.existsSync(CANONICAL_DB_FIXTURE_PATH)) {
    const fixtureData = {
      Users: {
        user_admin: {
          Id: "user_admin",
          Fullname: "System Administrator",
          Email: "admin@prepmate.vn",
          Username: "admin",
          Password: "",
          PasswordHash: "AAAAAAAAAAAAAAAAAAAAAA==.LQEQyPd1b2YtLYcAPUbXDCBCy2zLIeYZRRUE4jXQwOU=",
          CreatedAt: "2026-01-01T00:00:00.0000000Z",
          Subscription: "pro",
          SubscriptionDate: "2026-01-01T00:00:00.0000000Z",
          SubscriptionExpiry: "2126-01-01T00:00:00.0000000Z",
          Role: "admin",
          Phone: "",
          Bio: "",
          TargetRole: "",
          ExperienceLevel: "",
          Skills: [],
          Location: "",
          UpdatedAt: null,
          IsAdmin: true,
          IsManager: false
        },
        user_mgr1: {
          Id: "user_mgr1",
          Fullname: "Manager Fixture",
          Email: "lan.nguyen@prepmate.vn",
          Username: "manager_lan",
          Password: "",
          PasswordHash: "AAAAAAAAAAAAAAAAAAAAAA==.nnPadeKqbxGpos+LtuHqwZ/6egwpo8IEjOR0hHAIAhM=",
          CreatedAt: "2026-01-01T00:00:00.0000000Z",
          Subscription: "pro",
          SubscriptionDate: "2026-01-01T00:00:00.0000000Z",
          SubscriptionExpiry: "2126-01-01T00:00:00.0000000Z",
          Role: "manager",
          Phone: "",
          Bio: "",
          TargetRole: "",
          ExperienceLevel: "",
          Skills: [],
          Location: "",
          UpdatedAt: null,
          IsAdmin: false,
          IsManager: true
        },
        user_001: {
          Id: "user_001",
          Fullname: "Candidate Fixture",
          Email: "nam.le@gmail.com",
          Username: "hoangnam99",
          Password: "",
          PasswordHash: "AAAAAAAAAAAAAAAAAAAAAA==.KkbgBpmePjJLsQLencI0AL6fAP5649ly0961dhxiAGc=",
          CreatedAt: "2026-01-01T00:00:00.0000000Z",
          Subscription: "pro",
          SubscriptionDate: "2026-01-01T00:00:00.0000000Z",
          SubscriptionExpiry: "2126-01-01T00:00:00.0000000Z",
          Role: "user",
          Phone: "",
          Bio: "",
          TargetRole: "Software Engineer",
          ExperienceLevel: "Mid",
          Skills: ["C#", ".NET", "SQL"],
          Location: "Hà Nội",
          UpdatedAt: null,
          IsAdmin: false,
          IsManager: false
        },
        user_002: {
          Id: "user_002",
          Fullname: "Candidate Two",
          Email: "mai.vo@gmail.com",
          Username: "maivo_ux",
          Password: "",
          PasswordHash: "AAAAAAAAAAAAAAAAAAAAAA==.KkbgBpmePjJLsQLencI0AL6fAP5649ly0961dhxiAGc=",
          CreatedAt: "2026-01-01T00:00:00.0000000Z",
          Subscription: "pro",
          SubscriptionDate: "2026-01-01T00:00:00.0000000Z",
          SubscriptionExpiry: "2126-01-01T00:00:00.0000000Z",
          Role: "user",
          Phone: "",
          Bio: "",
          TargetRole: "UI/UX Designer",
          ExperienceLevel: "Junior",
          Skills: ["Figma", "Design System"],
          Location: "TP. HCM",
          UpdatedAt: null,
          IsAdmin: false,
          IsManager: false
        }
      },
      Sessions: {},
      Transactions: [],
      AIConfigurations: {
        default: {
          Id: "default",
          Provider: "Vilao AI",
          Protocol: "openai-chat-completions",
          BaseUrl: "https://api.vilao.ai/v1/",
          ApiKey: "",
          Model: "PrepMate",
          Enabled: true,
          Temperature: 0.7,
          MaxTokens: 1000,
          CredentialMode: "auto"
        }
      },
      CVs: {},
      ProviderConnections: {
        default: {
          Id: "default",
          Name: "Vilao AI",
          Protocol: "openai-chat-completions",
          BaseUrl: "https://api.vilao.ai/v1/",
          CredentialMode: "auto",
          Enabled: true,
          CurrentVersionId: "v1-init",
          CreatedAt: "2026-01-01T00:00:00.0000000Z",
          UpdatedAt: "2026-01-01T00:00:00.0000000Z"
        }
      },
      ModelRegistrations: {
        default: {
          Id: "default",
          DisplayName: "Default Vilao Model",
          ProviderConnectionId: "default",
          UpstreamModelId: "PrepMate",
          SupportedTasks: [
            "IntroductionAnalysis",
            "QuestionGeneration",
            "AnswerEvaluation",
            "TechnicalDeepDive",
            "BehavioralSTAR",
            "SituationalJudgement",
            "CandidateQuestionResponse",
            "InterviewReport",
            "CvAnalysis",
            "JobRecommendations",
            "CareerRoadmap",
            "RealTimeFeedback"
          ],
          MaxContextTokens: 128000,
          DefaultMaxTokens: 1000,
          DefaultTemperature: 0.7,
          SupportsStructuredJson: true,
          VerificationStatus: "Verified",
          CreatedAt: "2026-01-01T00:00:00.0000000Z",
          UpdatedAt: "2026-01-01T00:00:00.0000000Z"
        },
        PrepMate: {
          Id: "PrepMate",
          DisplayName: "PrepMate (Combo Root Engine)",
          ProviderConnectionId: "default",
          UpstreamModelId: "PrepMate",
          SupportedTasks: [
            "IntroductionAnalysis",
            "QuestionGeneration",
            "AnswerEvaluation",
            "TechnicalDeepDive",
            "BehavioralSTAR",
            "SituationalJudgement",
            "CandidateQuestionResponse",
            "InterviewReport",
            "CvAnalysis",
            "JobRecommendations",
            "CareerRoadmap",
            "RealTimeFeedback"
          ],
          MaxContextTokens: 128000,
          DefaultMaxTokens: 1000,
          DefaultTemperature: 0.7,
          SupportsStructuredJson: true,
          VerificationStatus: "Verified",
          CreatedAt: "2026-01-01T00:00:00.0000000Z",
          UpdatedAt: "2026-01-01T00:00:00.0000000Z"
        }
      },
      ConfigurationVersions: {}
    };
    fs.writeFileSync(CANONICAL_DB_FIXTURE_PATH, JSON.stringify(fixtureData, null, 2));
  }
}

function resolveDbPath(canonicalOnly = false) {
  ensureCanonicalFixture();
  if (canonicalOnly || process.env.TEST_USE_CANONICAL_FIXTURE || !process.env.TEST_USE_REAL_PROD_DB) {
    return CANONICAL_DB_FIXTURE_PATH;
  }
  const prodDb = path.join(rootDir, 'BE', 'data', 'db.json');
  return fs.existsSync(prodDb) ? prodDb : CANONICAL_DB_FIXTURE_PATH;
}

function resolvePath(relativePath) {
  if (relativePath === 'BE/data/db.json' || relativePath === 'BE\\data\\db.json') {
    return resolveDbPath();
  }
  return path.join(rootDir, relativePath);
}

function getBaselineDbHash() {
  ensureCanonicalFixture();
  const dbPath = resolveDbPath(true);
  const bytes = fs.readFileSync(dbPath);
  return crypto.createHash('sha256').update(bytes).digest('hex').toUpperCase();
}

function read(relativePath, encoding = 'utf8') {
  return fs.readFileSync(resolvePath(relativePath), encoding);
}

function exists(relativePath) {
  return fs.existsSync(resolvePath(relativePath));
}

module.exports = {
  rootDir,
  resolvePath,
  resolveDbPath,
  CANONICAL_DB_FIXTURE_PATH,
  getBaselineDbHash,
  ensureCanonicalFixture,
  read,
  exists
};
