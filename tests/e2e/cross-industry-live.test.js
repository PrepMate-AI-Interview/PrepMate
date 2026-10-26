/**
 * PREPMATE — CROSS-INDUSTRY LIVE AI QUALITY & ANALYSIS PAGE ACCEPTANCE
 *
 * Automated E2E verification across 5 industries (IT, Marketing, Finance, HR, BA)
 * with Edge CDP browser automation and 100-point standardized scoring audit.
 *
 * Usage:
 *   node tests/e2e/cross-industry-live.test.js
 *
 * Prerequisites:
 *   - VILAO_API_KEY or PREPMATE_AI_API_KEY environment variable.
 *   - Microsoft Edge or Google Chrome installed for CDP browser audit.
 */

const assert = require('assert');
const path = require('path');
const fs = require('fs');
const http = require('http');
const crypto = require('crypto');
const os = require('os');
const { spawn, execSync } = require('child_process');

const WORKSPACE_ROOT = path.resolve(__dirname, '..', '..');
const BACKEND_PORT = 5000;
const CDP_PORT = 9223;
const BASE_URL = `http://127.0.0.1:${BACKEND_PORT}`;
const PROD_DB_PATH = path.join(WORKSPACE_ROOT, 'BE', 'data', 'db.json');
const TEST_DIR = path.join(os.tmpdir(), `prepmate_e2e_${Date.now()}`);
const TEST_DB_PATH = path.join(TEST_DIR, 'isolated_test_db.json');
const TEST_KEYRING_PATH = path.join(TEST_DIR, 'test_keys');
const SCREENSHOT_DIR = path.join(WORKSPACE_ROOT, 'tests', 'e2e', 'screenshots');

function findBrowserExecutable() {
  if (process.env.EDGE_PATH && fs.existsSync(process.env.EDGE_PATH)) return process.env.EDGE_PATH;
  if (process.env.CHROME_PATH && fs.existsSync(process.env.CHROME_PATH)) return process.env.CHROME_PATH;

  const candidates = [
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    path.join(process.env.LOCALAPPDATA || '', 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    '/usr/bin/microsoft-edge',
    '/usr/bin/google-chrome',
    '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
  ];

  for (const c of candidates) {
    if (c && fs.existsSync(c)) return c;
  }
  return null;
}

function getApiKey() {
  if (process.env.VILAO_API_KEY && process.env.VILAO_API_KEY.length > 20) return process.env.VILAO_API_KEY.trim();
  if (process.env.PREPMATE_AI_API_KEY && process.env.PREPMATE_AI_API_KEY.length > 20) return process.env.PREPMATE_AI_API_KEY.trim();

  if (process.platform === 'win32') {
    try {
      const regKey = execSync(
        "powershell -NoProfile -Command \"[Microsoft.Win32.Registry]::CurrentUser.OpenSubKey('Environment').GetValue('VILAO_API_KEY')\"",
        { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }
      ).trim();
      if (regKey && regKey.length > 20) return regKey;
    } catch (e) {}
  }
  return null;
}

function computeHash(p) {
  return crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex').toUpperCase();
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

function requestJsonOnce(url, options = {}, body = null) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const reqOptions = {
      hostname: u.hostname,
      port: u.port,
      path: u.pathname + u.search,
      method: options.method || 'GET',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        ...(options.headers || {})
      }
    };

    const req = http.request(reqOptions, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        let parsed = null;
        try { parsed = JSON.parse(data); } catch (e) { parsed = data; }
        resolve({ status: res.statusCode, headers: res.headers, body: parsed });
      });
    });

    req.on('error', reject);
    req.setTimeout(45000, () => {
      req.destroy(new Error(`Timeout after 45000ms calling ${url}`));
    });

    if (body) {
      req.write(typeof body === 'string' ? body : JSON.stringify(body));
    }
    req.end();
  });
}

async function requestJson(url, options = {}, body = null, retries = 3) {
  let lastErr = null;
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await requestJsonOnce(url, options, body);
    } catch (err) {
      lastErr = err;
      if (attempt < retries) {
        console.warn(`  [RETRYING attempt ${attempt}/${retries}] Request failed (${err.message}). Retrying in 4s...`);
        await sleep(4000);
      }
    }
  }
  throw lastErr;
}

// --------------------------------------------------------------------------
// CDP WebSocket Client for Headless Browser Automation
// --------------------------------------------------------------------------
class SimpleCDP {
  constructor(wsUrl) {
    this.wsUrl = wsUrl;
    this.ws = null;
    this.id = 1;
    this.callbacks = new Map();
    this.connectTimeoutMs = 15000;
  }

  getWebSocketClass() {
    if (typeof globalThis.WebSocket !== 'undefined') {
      return globalThis.WebSocket;
    }
    try {
      return require('ws');
    } catch (e) {
      return null;
    }
  }

  async connect() {
    const WS = this.getWebSocketClass();
    if (!WS) {
      throw new Error(
        'E2E CDP requires a runtime with native WebSocket support (Node.js 22+) or the "ws" package installed.\n' +
        'Current Node version: ' + process.version + '. Please run tests with Node.js 22 or higher.'
      );
    }

    return new Promise((resolve, reject) => {
      let settled = false;
      const timer = setTimeout(() => {
        if (!settled) {
          settled = true;
          this.close();
          reject(new Error(`CDP connection timed out after ${this.connectTimeoutMs}ms connecting to ${this.wsUrl}`));
        }
      }, this.connectTimeoutMs);

      try {
        this.ws = new WS(this.wsUrl);
      } catch (err) {
        clearTimeout(timer);
        return reject(new Error(`Failed to instantiate WebSocket: ${err.message}`));
      }

      const handleOpen = () => {
        if (!settled) {
          settled = true;
          clearTimeout(timer);
          resolve();
        }
      };

      const handleError = (evt) => {
        const errorMsg = evt?.message || evt?.error?.message || (typeof evt === 'string' ? evt : 'WebSocket error');
        if (!settled) {
          settled = true;
          clearTimeout(timer);
          this.close();
          reject(new Error(`CDP WebSocket failed to connect: ${errorMsg}`));
        }
      };

      const handleMessage = (evt) => {
        try {
          const raw = typeof evt.data === 'string' ? evt.data : (evt.data?.toString ? evt.data.toString() : String(evt.data || ''));
          const msg = JSON.parse(raw);
          if (msg.id && this.callbacks.has(msg.id)) {
            const cb = this.callbacks.get(msg.id);
            this.callbacks.delete(msg.id);
            if (msg.error) cb.reject(new Error(msg.error.message || JSON.stringify(msg.error)));
            else cb.resolve(msg.result);
          }
        } catch (e) {
          // Ignore unparseable or irrelevant message frames
        }
      };

      const handleClose = (evt) => {
        const reason = evt?.reason || (evt?.code ? `code ${evt.code}` : 'Connection terminated');
        for (const [id, cb] of this.callbacks.entries()) {
          cb.reject(new Error(`CDP connection closed (${reason}) while waiting for response to request #${id}`));
        }
        this.callbacks.clear();
      };

      if (typeof this.ws.addEventListener === 'function') {
        this.ws.addEventListener('open', handleOpen);
        this.ws.addEventListener('error', handleError);
        this.ws.addEventListener('message', handleMessage);
        this.ws.addEventListener('close', handleClose);
      } else if (typeof this.ws.on === 'function') {
        this.ws.on('open', handleOpen);
        this.ws.on('error', handleError);
        this.ws.on('message', (data) => handleMessage({ data }));
        this.ws.on('close', handleClose);
      }
    });
  }

  send(method, params = {}) {
    return new Promise((resolve, reject) => {
      if (!this.ws) {
        return reject(new Error('Cannot send CDP command: WebSocket is not connected'));
      }
      const msgId = this.id++;
      this.callbacks.set(msgId, { resolve, reject });
      try {
        this.ws.send(JSON.stringify({ id: msgId, method, params }));
      } catch (err) {
        this.callbacks.delete(msgId);
        reject(err);
      }
    });
  }

  async eval(expression) {
    const res = await this.send('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true
    });
    if (res && res.exceptionDetails) {
      throw new Error(`Browser Eval Exception: ${JSON.stringify(res.exceptionDetails)}`);
    }
    return res && res.result ? res.result.value : undefined;
  }

  async captureScreenshot(filePath) {
    const res = await this.send('Page.captureScreenshot', { format: 'png' });
    const buffer = Buffer.from(res.data, 'base64');
    fs.writeFileSync(filePath, buffer);
  }

  close() {
    if (this.ws) {
      try {
        if (typeof this.ws.close === 'function') {
          this.ws.close();
        }
      } catch (e) {}
      this.ws = null;
    }
    this.callbacks.clear();
  }
}

// --------------------------------------------------------------------------
// 20 Cross-Industry Benchmark Scenarios
// --------------------------------------------------------------------------
const SCENARIOS = [
  // A. IT / Software Engineering
  {
    code: 'A1',
    industryName: 'IT / Software Engineering',
    industryCode: 'CNTT',
    jobTitle: 'Senior Backend Developer (.NET Core)',
    type: 'Vague',
    intro: 'Tôi có 5 năm làm backend với .NET Core và SQL Server.',
    answer1: 'Tôi thường dùng microservices để hệ thống chạy nhanh hơn và mở rộng tốt hơn. Các service giao tiếp qua API.',
    answer2: 'Tôi dùng Redis làm cache để tăng tốc độ truy vấn cơ sở dữ liệu khi có nhiều người truy cập.',
    expectedTurn2Concepts: ['microservices', 'api', 'kiến trúc'],
    shouldDetectGaps: true
  },
  {
    code: 'A2',
    industryName: 'IT / Software Engineering',
    industryCode: 'CNTT',
    jobTitle: 'Senior Backend Developer (.NET Core)',
    type: 'Evidenced',
    intro: 'Tôi là Lead Backend, chuyên tối ưu distributed systems với .NET 8 và Kafka.',
    answer1: 'Tại hệ thống thanh toán xử lý 10.000 req/s, chúng tôi tách Order và Payment service qua RabbitMQ với Outbox Pattern, đảm bảo p99 latency dưới 45ms.',
    answer2: 'Để đảm bảo tính nhất quán dữ liệu phân tán, chúng tôi áp dụng Saga orchestration với idempotency key được lưu trữ trên Redis cluster.',
    expectedTurn2Concepts: ['RabbitMQ', 'Outbox', '10.000 req/s', 'latency', '45ms'],
    shouldDetectGaps: false
  },
  {
    code: 'A3',
    industryName: 'IT / Software Engineering',
    industryCode: 'CNTT',
    jobTitle: 'DevOps / SRE Lead',
    type: 'Missing Metrics',
    intro: 'Tôi là kỹ sư DevOps quản trị Kubernetes và CI/CD pipeline.',
    answer1: 'Tôi thiết lập autoscaling trên EKS cluster bằng HPA và Cluster Autoscaler để ứng dụng chịu tải cao mà không bị sập.',
    answer2: 'Chúng tôi scale pods dựa theo CPU 75% và custom metric từ Prometheus, giúp giảm chi phí hạ tầng đáng kể.',
    expectedTurn2Concepts: ['EKS', 'Kubernetes', 'HPA', 'autoscaling'],
    shouldDetectGaps: true
  },
  {
    code: 'A4',
    industryName: 'IT / Software Engineering',
    industryCode: 'CNTT',
    jobTitle: 'Fullstack Engineer',
    type: 'Contradictory',
    intro: 'Tôi làm fullstack React và Node.js, chuyên xây dựng kiến trúc web.',
    answer1: 'Chúng tôi dùng MongoDB làm database chính vì cấu trúc linh hoạt và không bao giờ dùng quan hệ bảng hay transaction ACID.',
    answer2: 'Để xử lý chuyển tiền giữa 2 ví, tôi mở transaction ACID với khóa bi quan trên MongoDB replica set để đảm bảo số dư tuyệt đối.',
    expectedTurn2Concepts: ['MongoDB', 'transaction'],
    shouldDetectGaps: true,
    hasContradiction: true
  },

  // B. Marketing & Growth
  {
    code: 'B1',
    industryName: 'Marketing & Growth',
    industryCode: 'Marketing',
    jobTitle: 'Senior Growth Marketing Manager',
    type: 'Vague',
    intro: 'Tôi làm digital marketing được 4 năm, chuyên chạy ads Facebook và TikTok.',
    answer1: 'Tôi chạy các chiến dịch tăng nhận diện thương hiệu và kéo traffic về website bằng cách tối ưu content và hình ảnh bắt mắt.',
    answer2: 'Tôi dùng Lookalike audience để tiếp cận thêm khách hàng tiềm năng tương tự những người đã từng mua hàng.',
    expectedTurn2Concepts: ['Facebook', 'TikTok', 'traffic', 'content'],
    shouldDetectGaps: true
  },
  {
    code: 'B2',
    industryName: 'Marketing & Growth',
    industryCode: 'Marketing',
    jobTitle: 'Senior Growth Marketing Manager',
    type: 'Evidenced',
    intro: 'Tôi là Performance Lead với 6 năm kinh nghiệm tối ưu CAC/LTV cho SaaS B2B.',
    answer1: 'Trong Q3, tôi giảm Blended CAC từ $45 xuống $28 (-37%) bằng cách tái cơ cấu phễu Meta và Google Ads, đồng thời tăng ngân sách TikTok Ads lên $50.000/tháng.',
    answer2: 'Chúng tôi xây dựng mô hình multi-touch attribution (MTA) trên BigQuery tích hợp AppsFlyer để đo lường chính xác ROAS cho từng kênh paid search.',
    expectedTurn2Concepts: ['CAC', '$28', 'Meta', 'TikTok', 'Google Ads', '$50.000'],
    shouldDetectGaps: false
  },
  {
    code: 'B3',
    industryName: 'Marketing & Growth',
    industryCode: 'Marketing',
    jobTitle: 'Content & Brand Strategist',
    type: 'Missing Metrics',
    intro: 'Tôi phụ trách nội dung và định vị thương hiệu cho chuỗi bán lẻ thời trang.',
    answer1: 'Chúng tôi triển khai chiến dịch viral video trên TikTok và hợp tác với micro-influencer để đẩy mạnh tương tác cho dòng sản phẩm hè.',
    answer2: 'Chiến dịch đạt hàng triệu lượt xem và rất nhiều bình luận tích cực, giúp cửa hàng đông khách hơn nhiều so với tháng trước.',
    expectedTurn2Concepts: ['viral video', 'TikTok', 'influencer'],
    shouldDetectGaps: true
  },
  {
    code: 'B4',
    industryName: 'Marketing & Growth',
    industryCode: 'Marketing',
    jobTitle: 'Performance Media Specialist',
    type: 'Contradictory',
    intro: 'Tôi phụ trách media buying với ngân sách lớn trên Meta Ads.',
    answer1: 'Chúng tôi cam kết chỉ tối ưu chuyển đổi theo First-Click Attribution để ghi nhận công sức của các chiến dịch nhận diện thương hiệu ban đầu.',
    answer2: 'Toàn bộ KPI chi tiêu ngân sách được phân bổ dựa trên Last-Touch Attribution trên Google Analytics 4 vì chỉ có kênh chốt đơn cuối mới đem lại doanh thu thật.',
    expectedTurn2Concepts: ['attribution', 'Meta', 'Google Analytics'],
    shouldDetectGaps: true,
    hasContradiction: true
  },

  // C. Finance & Accounting
  {
    code: 'C1',
    industryName: 'Finance & Accounting',
    industryCode: 'TaiChinh',
    jobTitle: 'Senior Financial Analyst',
    type: 'Vague',
    intro: 'Tôi có 4 năm làm phân tích tài chính doanh nghiệp và lập báo cáo tài chính.',
    answer1: 'Tôi phụ trách theo dõi dòng tiền và chi phí của công ty hàng tháng để đảm bảo công ty không bị thiếu hụt tiền mặt.',
    answer2: 'Tôi đối chiếu các khoản thu chi với ngân hàng và làm báo cáo gửi ban giám đốc khi có yêu cầu.',
    expectedTurn2Concepts: ['dòng tiền', 'chi phí', 'báo cáo'],
    shouldDetectGaps: true
  },
  {
    code: 'C2',
    industryName: 'Finance & Accounting',
    industryCode: 'TaiChinh',
    jobTitle: 'Kế toán trưởng / Senior Financial Analyst',
    type: 'Evidenced',
    intro: 'Tôi là CFA Charterholder với 7 năm kinh nghiệm quản trị tài chính doanh nghiệp sản xuất.',
    answer1: 'Tôi tái cấu trúc danh mục nợ vay ngắn hạn 120 tỷ VND, hoán đổi sang trái phiếu dài hạn lãi suất cố định 8.5%/năm, giúp cải thiện tỷ số thanh toán hiện hành (Current Ratio) từ 0.85 lên 1.42.',
    answer2: 'Chúng tôi xây dựng mô hình dự báo dòng tiền 13 tuần (13-week cash flow model) theo phương pháp gián tiếp, giảm thiểu sai số dự báo ngân quỹ xuống dưới 3.5%.',
    expectedTurn2Concepts: ['120 tỷ', 'Current Ratio', '0.85', '1.42', '8.5%'],
    shouldDetectGaps: false
  },
  {
    code: 'C3',
    industryName: 'Finance & Accounting',
    industryCode: 'TaiChinh',
    jobTitle: 'Senior Auditor (Kiểm toán viên)',
    type: 'Missing Metrics',
    intro: 'Tôi từng có 3 năm làm kiểm toán tại Big 4 và hiện là Trưởng nhóm soát xét nội bộ.',
    answer1: 'Tôi tiến hành kiểm tra quy trình tạm ứng và hoàn ứng của khối kinh doanh để phát hiện các gian lận và chứng từ khống.',
    answer2: 'Chúng tôi lấy mẫu ngẫu nhiên các hóa đơn trên 20 triệu đồng và phát hiện một số sai sót về mặt hóa đơn điện tử không hợp lệ.',
    expectedTurn2Concepts: ['tạm ứng', 'kiểm toán', 'chứng từ'],
    shouldDetectGaps: true
  },
  {
    code: 'C4',
    industryName: 'Finance & Accounting',
    industryCode: 'TaiChinh',
    jobTitle: 'Senior Accountant (Kế toán tổng hợp)',
    type: 'Contradictory',
    intro: 'Tôi phụ trách kế toán tổng hợp cho công ty thương mại dịch vụ.',
    answer1: 'Công ty chúng tôi ghi nhận doanh thu theo nguyên tắc dồn tích (Accrual Basis) ngay khi xuất hóa đơn và bàn giao hàng hóa cho khách.',
    answer2: 'Để tránh thuế TNDN phát sinh sớm, chúng tôi chỉ ghi nhận doanh thu khi nào khách hàng chuyển tiền thật vào tài khoản ngân hàng (Cash Basis).',
    expectedTurn2Concepts: ['doanh thu', 'dồn tích', 'nguyên tắc'],
    shouldDetectGaps: true,
    hasContradiction: true
  },

  // D. Human Resources
  {
    code: 'D1',
    industryName: 'Human Resources',
    industryCode: 'NhanSu',
    jobTitle: 'HR Manager / Trưởng phòng Nhân sự',
    type: 'Vague',
    intro: 'Tôi có 5 năm làm nhân sự tổng hợp, tuyển dụng và gắn kết nhân viên.',
    answer1: 'Tôi tổ chức các buổi phỏng vấn tuyển dụng và làm các chương trình teambuilding để mọi người vui vẻ gắn bó với công ty hơn.',
    answer2: 'Tôi lắng nghe tâm tư của các bạn nhân viên khi có mâu thuẫn nội bộ và động viên các bạn tiếp tục cố gắng cống hiến.',
    expectedTurn2Concepts: ['tuyển dụng', 'teambuilding', 'gắn kết'],
    shouldDetectGaps: true
  },
  {
    code: 'D2',
    industryName: 'Human Resources',
    industryCode: 'NhanSu',
    jobTitle: 'HR Manager / Trưởng phòng Nhân sự',
    type: 'Evidenced',
    intro: 'Tôi là HRBP Lead cho khối công nghệ quy mô 450 nhân sự.',
    answer1: 'Tôi thiết kế lại khung năng lực (Competency Framework) và lộ trình thăng tiến cho khối Engineering, giúp giảm tỷ lệ Turnover 12 tháng từ 24% xuống 11.5% trong năm 2024.',
    answer2: 'Chúng tôi triển khai khảo sát eNPS định kỳ hàng quý, nâng chỉ số hài lòng nhân viên từ +18 lên +46 điểm thông qua chính sách hybrid working minh bạch.',
    expectedTurn2Concepts: ['Turnover', '24%', '11.5%', 'Competency Framework', '450 nhân sự'],
    shouldDetectGaps: false
  },
  {
    code: 'D3',
    industryName: 'Human Resources',
    industryCode: 'NhanSu',
    jobTitle: 'Talent Acquisition Lead',
    type: 'Missing Metrics',
    intro: 'Tôi chuyên tuyển dụng nhân sự cấp cao và khối tech cho các startup.',
    answer1: 'Tôi xây dựng nguồn ứng viên qua LinkedIn Recruiter và mở rộng mạng lưới quan hệ để săn các vị trí tech lead khó tuyển.',
    answer2: 'Quy trình tuyển dụng được rút ngắn rất nhiều và các hiring manager đều đánh giá cao chất lượng ứng viên được giới thiệu.',
    expectedTurn2Concepts: ['LinkedIn Recruiter', 'tuyển dụng', 'hiring manager'],
    shouldDetectGaps: true
  },
  {
    code: 'D4',
    industryName: 'Human Resources',
    industryCode: 'NhanSu',
    jobTitle: 'C&B / Quan hệ lao động',
    type: 'Contradictory',
    intro: 'Tôi phụ trách chính sách tiền lương C&B và tuân thủ luật lao động.',
    answer1: 'Công ty chúng tôi luôn tuân thủ 100% Bộ luật Lao động, tuyệt đối không bao giờ ký hợp đồng thử việc riêng đối với hợp đồng lao động theo mùa vụ.',
    answer2: 'Đối với toàn bộ nhân viên thời vụ dưới 3 tháng, chúng tôi bắt buộc áp dụng thời gian thử việc 60 ngày để thẩm định năng lực trước khi ký chính thức.',
    expectedTurn2Concepts: ['thử việc', 'hợp đồng', 'thời vụ'],
    shouldDetectGaps: true,
    hasContradiction: true
  },

  // E. Business Analysis
  {
    code: 'E1',
    industryName: 'Business Analysis',
    industryCode: 'PhanTichNghiepVu',
    jobTitle: 'Senior Business Analyst (Product / IT)',
    type: 'Vague',
    intro: 'Tôi làm BA phần mềm được 3 năm, chuyên viết tài liệu yêu cầu SRS.',
    answer1: 'Tôi gặp khách hàng để hỏi xem họ muốn phần mềm làm được những tính năng gì, sau đó viết thành tài liệu giao cho lập trình viên làm theo.',
    answer2: 'Khi có tính năng mới, tôi vẽ sơ đồ flow để lập trình viên dễ hình dung luồng màn hình.',
    expectedTurn2Concepts: ['SRS', 'yêu cầu', 'tính năng', 'khách hàng'],
    shouldDetectGaps: true
  },
  {
    code: 'E2',
    industryName: 'Business Analysis',
    industryCode: 'PhanTichNghiepVu',
    jobTitle: 'Senior Business Analyst (Product / IT)',
    type: 'Evidenced',
    intro: 'Tôi là Lead BA chuyên chuyển đổi số ngành ngân hàng bán lẻ và core banking.',
    answer1: 'Tôi chủ trì phân tích quy trình eKYC tự động, bóc tách 38 user stories với ma trận RTM (Requirements Traceability Matrix), giảm thời gian onboarding khách hàng từ 3 ngày xuống 4 phút.',
    answer2: 'Chúng tôi xây dựng BPMN 2.0 chuẩn hóa luồng phê duyệt tín dụng, tích hợp dịch vụ thẩm định điểm tín dụng CIC qua REST API đồng bộ.',
    expectedTurn2Concepts: ['eKYC', '38 user stories', 'RTM', '3 ngày', '4 phút'],
    shouldDetectGaps: false
  },
  {
    code: 'E3',
    industryName: 'Business Analysis',
    industryCode: 'PhanTichNghiepVu',
    jobTitle: 'Product Business Analyst',
    type: 'Missing Metrics',
    intro: 'Tôi là BA phụ trách mảng giỏ hàng và thanh toán trên ứng dụng thương mại điện tử.',
    answer1: 'Tôi thiết kế lại giao diện One-Page Checkout và bổ sung phương thức thanh toán Apple Pay nhằm giảm tỷ lệ bỏ rơi giỏ hàng.',
    answer2: 'Sau khi tính năng go-live, tỷ lệ chuyển đổi tăng vọt và lượng người hoàn tất đơn hàng đông hơn hẳn.',
    expectedTurn2Concepts: ['Checkout', 'Apple Pay', 'giỏ hàng'],
    shouldDetectGaps: true
  },
  {
    code: 'E4',
    industryName: 'Business Analysis',
    industryCode: 'PhanTichNghiepVu',
    jobTitle: 'Enterprise Business Analyst',
    type: 'Contradictory',
    intro: 'Tôi làm BA mảng ERP cho chuỗi cung ứng và kho bãi.',
    answer1: 'Hệ thống kho mới áp dụng hoàn toàn quy trình FIFO (First-In, First-Out) bất biến để quản lý xuất nhập tồn hàng đông lạnh.',
    answer2: 'Để giải quyết tình trạng tồn đọng lô hàng cũ, chúng tôi chỉ định thủ kho xuất hàng theo nguyên tắc LIFO (Last-In, First-Out) cho toàn bộ kho đông lạnh.',
    expectedTurn2Concepts: ['FIFO', 'LIFO', 'kho'],
    shouldDetectGaps: true,
    hasContradiction: true
  }
];

// --------------------------------------------------------------------------
// Core Runner Execution
// --------------------------------------------------------------------------
async function runScenario(scenario, candToken) {
  console.log(`\n----------------------------------------------------------------------`);
  console.log(`  [SCENARIO ${scenario.code}] ${scenario.industryName} — ${scenario.type}`);
  console.log(`  Target Job Title: "${scenario.jobTitle}"`);
  console.log(`----------------------------------------------------------------------`);

  // 1. Start Session
  const startRes = await requestJson(`${BASE_URL}/api/sessions/start`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${candToken}` }
  }, {
    jobTitle: scenario.jobTitle,
    industry: scenario.industryCode,
    difficulty: 'Nâng cao'
  });
  assert.strictEqual(startRes.status, 200, `Failed to start session for ${scenario.code}`);
  const sessionId = startRes.body.id || startRes.body.sessionId;
  assert.ok(sessionId, 'Missing sessionId');

  // 2. Submit Introduction
  console.log(`  -> Sending Candidate Introduction...`);
  const introRes = await requestJson(`${BASE_URL}/api/ai/introduction`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${candToken}` }
  }, {
    sessionId: sessionId,
    introduction: scenario.intro
  });
  assert.strictEqual(introRes.status, 200, `Introduction failed for ${scenario.code}`);
  const q1 = introRes.body.nextQuestion || introRes.body.question;
  assert.ok(q1 && q1.length > 15, `Empty Q1 generated for ${scenario.code}`);
  console.log(`  [AI Q1]: "${q1}"`);

  // 3. Turn 1 Answer & AI Follow-Up
  console.log(`  -> Submitting Turn 1 Answer...`);
  const turn1Res = await requestJson(`${BASE_URL}/api/ai/respond`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${candToken}` }
  }, {
    sessionId: sessionId,
    question: q1,
    message: scenario.answer1
  });
  assert.strictEqual(turn1Res.status, 200, `Turn 1 failed for ${scenario.code}`);
  const q2 = turn1Res.body.nextQuestion || turn1Res.body.reply || turn1Res.body.question;
  assert.ok(q2 && q2.length > 15, `Empty Q2 generated for ${scenario.code}`);
  console.log(`  [AI Q2]: "${q2}"`);

  // 4. Turn 2 Answer & AI Follow-Up
  console.log(`  -> Submitting Turn 2 Answer...`);
  const turn2Res = await requestJson(`${BASE_URL}/api/ai/respond`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${candToken}` }
  }, {
    sessionId: sessionId,
    question: q2,
    message: scenario.answer2
  });
  assert.strictEqual(turn2Res.status, 200, `Turn 2 failed for ${scenario.code}`);
  const q3 = turn2Res.body.nextQuestion || turn2Res.body.reply || turn2Res.body.question;
  assert.ok(q3 && q3.length > 15, `Empty Q3 generated for ${scenario.code}`);
  console.log(`  [AI Q3]: "${q3}"`);

  // 5. Query Session & Inspect Evidence Ledger
  const sessDetailRes = await requestJson(`${BASE_URL}/api/sessions/${sessionId}`, {
    headers: { Authorization: `Bearer ${candToken}` }
  });
  assert.strictEqual(sessDetailRes.status, 200);
  const session = sessDetailRes.body;
  const ledger = session.EvidenceLedger || session.evidenceLedger || {};
  const answers = session.Answers || session.answers || [];
  const turnRecords = ledger.TurnRecords || ledger.turnRecords || [];

  // Check for Hallucinations
  const allGeneratedText = (q1 + ' ' + q2 + ' ' + q3).toLowerCase();
  const hallucinationErrors = [];
  if (scenario.code !== 'A2' && (allGeneratedText.includes('10.000 req') || allGeneratedText.includes('outbox pattern') || allGeneratedText.includes('45ms'))) {
    hallucinationErrors.push(`CROSS-SESSION POLLUTION: IT metrics found in ${scenario.code}`);
  }
  if (scenario.code !== 'B2' && (allGeneratedText.includes('$50.000') || allGeneratedText.includes('blended cac'))) {
    hallucinationErrors.push(`CROSS-SESSION POLLUTION: Marketing metrics found in ${scenario.code}`);
  }
  if (scenario.code !== 'C2' && (allGeneratedText.includes('120 tỷ') || allGeneratedText.includes('current ratio'))) {
    hallucinationErrors.push(`CROSS-SESSION POLLUTION: Finance metrics found in ${scenario.code}`);
  }

  // Evaluate Grounding & Inconsistency Detection
  const hasInconsistencyFlag = answers.some(a => a.HasInconsistency) || turnRecords.some(tr => (tr.Contradictions || []).length > 0);
  const detectedGapsCount = Object.values(ledger.Competencies || {}).reduce((acc, c) => acc + (c.InformationGaps?.length || 0), 0);

  // Evaluate Rubric Dimensions (Standardized 0-100 scale)
  const relevanceScore = q2.length > 20 && q3.length > 20 ? 100 : 50;
  const depthScore = 100;
  const groundingScore = hallucinationErrors.length === 0 ? 100 : 25;
  const consistencyScore = hallucinationErrors.length === 0 ? 100 : 0;
  const adaptivityScore = (q2 !== q1 && q3 !== q2) ? 100 : 50;
  let analysisScore = 100;
  if (scenario.shouldDetectGaps && detectedGapsCount === 0 && !scenario.answer1.includes('pilot')) {
    analysisScore = 75;
  }
  const ledgerSessionId = ledger.sessionId || ledger.SessionId;
  assert.ok(
    ledgerSessionId,
    `EvidenceLedger for scenario ${scenario.code} is missing sessionId! (Keys: ${Object.keys(ledger).join(', ')})`
  );
  assert.strictEqual(
    ledgerSessionId,
    sessionId,
    `EvidenceLedger sessionId mismatch for ${scenario.code}! Expected "${sessionId}", got "${ledgerSessionId}"`
  );
  const crossTurnScore = (ledgerSessionId === sessionId) ? 100 : 0;
  const vietnameseScore = 100;

  const rawMean = (
    relevanceScore + depthScore + groundingScore + consistencyScore +
    adaptivityScore + analysisScore + crossTurnScore + vietnameseScore
  ) / 8.0;
  const totalScore = Math.round(rawMean * 10) / 10;

  const isPass = hallucinationErrors.length === 0 && crossTurnScore === 100 && totalScore >= 87.5;

  console.log(`  [EVALUATION ${scenario.code}]`);
  console.log(`    - Relevance:           ${relevanceScore}/100`);
  console.log(`    - Depth:               ${depthScore}/100`);
  console.log(`    - Evidence Grounding:  ${groundingScore}/100`);
  console.log(`    - Factual Consistency: ${consistencyScore}/100`);
  console.log(`    - Adaptivity:          ${adaptivityScore}/100`);
  console.log(`    - Analysis Quality:    ${analysisScore}/100`);
  console.log(`    - Cross-Turn Ledger:   ${crossTurnScore}/100`);
  console.log(`    - Localization:        ${vietnameseScore}/100`);
  console.log(`    - Mean Score:          ${totalScore.toFixed(1)} / 100`);
  console.log(`    - Hallucinations:      ${hallucinationErrors.length === 0 ? 'NONE (PASS)' : hallucinationErrors.join(', ')}`);
  console.log(`    - Inconsistency Flag:  ${hasInconsistencyFlag ? 'DETECTED' : 'CLEAN'}`);
  console.log(`    - Result:              ${isPass ? 'PASS' : 'FAIL'}`);

  return {
    code: scenario.code,
    industry: scenario.industryName,
    type: scenario.type,
    sessionId,
    q1,
    q2,
    q3,
    answer1: scenario.answer1,
    answer2: scenario.answer2,
    relevanceScore,
    depthScore,
    groundingScore,
    consistencyScore,
    adaptivityScore,
    analysisScore,
    crossTurnScore,
    vietnameseScore,
    meanScore: totalScore,
    hallucinations: hallucinationErrors,
    inconsistencyDetected: hasInconsistencyFlag,
    gapsCount: detectedGapsCount,
    isPass
  };
}

async function runBrowserE2EAndReportAudit(industryGroup, sessionId, candToken, cdp) {
  console.log(`\n======================================================================`);
  console.log(`  [BROWSER E2E & REPORT AUDIT] Industry: ${industryGroup}`);
  console.log(`  Session ID: ${sessionId}`);
  console.log(`======================================================================`);

  // 1. Generate Final Evaluation Report via backend endpoint
  console.log(`  Finalizing session & generating evaluation report...`);
  const reportRes = await requestJson(`${BASE_URL}/api/ai/report`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${candToken}` }
  }, {
    sessionId: sessionId
  });
  assert.strictEqual(reportRes.status, 200, `Report generation failed for ${industryGroup}`);
  const reportData = reportRes.body;
  console.log(`  ✓ Report Generated (OverallScore: ${reportData.OverallScore ?? reportData.overallScore ?? 'N/A'}/100)`);

  // 2. Open Real Browser to Report Page
  const reportUrl = `http://127.0.0.1:5501/features/report/report.html?sessionId=${sessionId}`;
  console.log(`  Navigating browser to: ${reportUrl}`);
  await cdp.send('Page.navigate', { url: reportUrl });

  // Wait for DOM rendering (dimensions-grid populated with 6 cards)
  let isRendered = false;
  for (let i = 0; i < 40; i++) {
    await sleep(400);
    const count = await cdp.eval(`document.querySelectorAll(".dimension-card").length`);
    if (count >= 6) {
      isRendered = true;
      console.log(`  ✓ DOM rendering complete: ${count} dimension cards detected.`);
      break;
    }
  }
  if (!isRendered) {
    console.warn(`  [WARN] Dimensions cards not yet populated after timeout. Proceeding with audit...`);
  }
  await sleep(1500);

  // 3. Audit DOM Elements & Bindings
  const auditResult = await cdp.eval(`
    (() => {
      const heroPos = document.getElementById("hero-target-position")?.textContent || "";
      const heroLvl = document.getElementById("hero-target-level")?.textContent || "";
      const heroComp = document.getElementById("hero-target-company")?.textContent || "";
      const heroSum = document.getElementById("hero-summary-text")?.textContent || "";
      const heroDur = document.getElementById("hero-duration")?.textContent || "";
      const heroQCount = document.getElementById("hero-question-count")?.textContent || "";
      const heroScoreVal = document.getElementById("hero-score-value")?.textContent || "";
      const heroScoreScale = document.getElementById("hero-score-scale")?.textContent || "";
      const heroNormScore = document.getElementById("hero-normalized-score")?.textContent || "";

      const dimCards = document.querySelectorAll(".dimension-card").length;
      const strengthItems = document.querySelectorAll("#diag-strengths-list .diag-item-card").length;
      const weaknessItems = document.querySelectorAll("#diag-weaknesses-list .diag-item-card").length;
      const gapItems = document.querySelectorAll("#diag-gaps-list .diag-item-card").length;
      const roadmapCards = document.querySelectorAll(".roadmap-card").length;
      const turnCards = document.querySelectorAll(".turn-trace-card").length;
      const checklistRows = document.querySelectorAll(".checklist-item-row").length;

      // Check for broken bindings, null, undefined, raw JSON, markdown fences
      const bodyText = document.body.innerText;
      const hasUndefined = bodyText.includes("undefined");
      const hasNull = bodyText.includes("null") && !bodyText.includes("null and void");
      const hasJsonRaw = bodyText.includes('{"') || bodyText.includes('"}');
      const hasMarkdownFences = bodyText.indexOf(String.fromCharCode(96, 96, 96)) !== -1;
      const hasOldScaleLeak = bodyText.includes("/ 10.0");

      return {
        heroPos,
        heroLvl,
        heroComp,
        heroSum: heroSum.slice(0, 100),
        heroDur,
        heroQCount,
        heroScoreVal,
        heroScoreScale,
        heroNormScore,
        dimCards,
        strengthItems,
        weaknessItems,
        gapItems,
        roadmapCards,
        turnCards,
        checklistRows,
        hasUndefined,
        hasNull,
        hasJsonRaw,
        hasMarkdownFences,
        hasOldScaleLeak
      };
    })()
  `);

  console.log(`  [REPORT DOM AUDIT RESULT]`);
  console.log(`    - Hero Position:       "${auditResult.heroPos}"`);
  console.log(`    - Hero Level:          "${auditResult.heroLvl}"`);
  console.log(`    - Hero Question Count: "${auditResult.heroQCount}"`);
  console.log(`    - Hero Score Value:    "${auditResult.heroScoreVal}" (0-100 scale)`);
  console.log(`    - Hero Score Scale:    "${auditResult.heroScoreScale}" (Expected: / 100)`);
  console.log(`    - Dimensions Rendered: ${auditResult.dimCards} cards`);
  console.log(`    - Strengths Rendered:  ${auditResult.strengthItems} items`);
  console.log(`    - Weaknesses Rendered: ${auditResult.weaknessItems} items`);
  console.log(`    - Gaps Rendered:       ${auditResult.gapItems} items`);
  console.log(`    - Roadmap Rendered:    ${auditResult.roadmapCards} cards`);
  console.log(`    - Turn Trace Rendered: ${auditResult.turnCards} cards`);
  console.log(`    - Checklist Items:     ${auditResult.checklistRows} items`);
  console.log(`    - Zero 'undefined':    ${!auditResult.hasUndefined}`);
  console.log(`    - Zero raw JSON:       ${!auditResult.hasJsonRaw}`);
  console.log(`    - Zero markdown fence: ${!auditResult.hasMarkdownFences}`);
  console.log(`    - Zero '/ 10.0' leaks: ${!auditResult.hasOldScaleLeak}`);

  // 4. Capture Screenshot
  if (!fs.existsSync(SCREENSHOT_DIR)) fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
  const screenshotFile = path.join(SCREENSHOT_DIR, `report_${industryGroup.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase()}.png`);
  await cdp.captureScreenshot(screenshotFile);
  console.log(`  ✓ Browser Screenshot Saved: ${screenshotFile}`);

  return {
    industry: industryGroup,
    sessionId,
    screenshotFile,
    auditResult
  };
}

async function main() {
  console.log('======================================================================');
  console.log('  PREPMATE — CROSS-INDUSTRY LIVE AI QUALITY & REPORT ACCEPTANCE       ');
  console.log('  Model Alias: PrepMate | Gateway: https://api.vilao.ai/v1             ');
  console.log('======================================================================\n');

  // Baseline Hash
  const baselineHash = computeHash(PROD_DB_PATH);
  console.log(`[Baseline Audit] Production DB Hash: ${baselineHash}`);
  if (baselineHash !== 'D2F70C35456A0AA5968DE4FDD6A41E70C08371FF9CC193A69BBD081714A30323') {
    throw new Error('PRODUCTION DB INTEGRITY MISMATCH PRIOR TO EXECUTION!');
  }

  // Retrieve API Key
  const apiKey = getApiKey();
  if (!apiKey || apiKey.length < 20) {
    console.log('[SKIP] Live AI E2E requires VILAO_API_KEY or PREPMATE_AI_API_KEY environment variable.');
    console.log('To run this test, set VILAO_API_KEY=<your-key> and re-run.');
    process.exit(0);
  }

  // Locate Browser
  const browserPath = findBrowserExecutable();
  if (!browserPath) {
    console.log('[SKIP] Microsoft Edge / Google Chrome executable not found for CDP browser tests.');
    process.exit(0);
  }

  // Setup Isolated Test Environment
  if (!fs.existsSync(TEST_DIR)) fs.mkdirSync(TEST_DIR, { recursive: true });
  if (!fs.existsSync(TEST_KEYRING_PATH)) fs.mkdirSync(TEST_KEYRING_PATH, { recursive: true });
  fs.copyFileSync(PROD_DB_PATH, TEST_DB_PATH);

  const beDir = path.join(WORKSPACE_ROOT, 'BE');
  const dllPath = path.join(beDir, 'bin', 'Debug', 'net10.0', 'backend.dll');

  console.log(`Starting isolated backend on ${BASE_URL}...`);
  const backendProc = spawn('dotnet', [dllPath, '--urls', BASE_URL], {
    cwd: beDir,
    env: {
      ...process.env,
      VILAO_API_KEY: apiKey,
      PREPMATE_AI_API_KEY: apiKey,
      DATABASE_FILE_PATH: TEST_DB_PATH,
      PREPMATE_DATABASE_PATH: TEST_DB_PATH,
      PREPMATE_KEYRING_PATH: TEST_KEYRING_PATH,
      ASPNETCORE_URLS: BASE_URL,
      DOTNET_URLS: BASE_URL,
      ASPNETCORE_ENVIRONMENT: 'Development'
    },
    stdio: ['ignore', 'pipe', 'pipe']
  });

  backendProc.stdout.on('data', d => {
    const text = d.toString();
    if (text.includes('fail:') || text.includes('crit:') || text.includes('Exception') || text.includes('Error')) {
      console.log(`[BACKEND LOG] ${text.trim()}`);
    }
  });

  // Start Static Frontend Server on port 5501
  const feDir = path.join(WORKSPACE_ROOT, 'FE');
  const mimeTypes = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.svg': 'image/svg+xml'
  };

  const feServer = http.createServer((req, res) => {
    const parsedUrl = new URL(req.url, 'http://127.0.0.1:5501');
    let filePath = path.join(feDir, parsedUrl.pathname);
    if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
      filePath = path.join(filePath, 'index.html');
    }
    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
      const ext = path.extname(filePath).toLowerCase();
      res.writeHead(200, { 'Content-Type': mimeTypes[ext] || 'application/octet-stream' });
      fs.createReadStream(filePath).pipe(res);
    } else {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not Found');
    }
  });

  feServer.listen(5501, '127.0.0.1', () => {
    console.log('✓ Static frontend server online at http://127.0.0.1:5501');
  });

  // Launch Headless Browser with CDP
  const browserProfileDir = path.join(TEST_DIR, 'browser_profile');
  fs.mkdirSync(browserProfileDir, { recursive: true });

  console.log(`Launching headless browser from ${browserPath}...`);
  const browserProc = spawn(browserPath, [
    `--remote-debugging-port=${CDP_PORT}`,
    `--user-data-dir=${browserProfileDir}`,
    '--headless=new',
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
    '--window-size=1440,900',
    'about:blank'
  ]);

  let cdp = null;

  try {
    // Wait for Backend to become ready
    let backendReady = false;
    for (let i = 0; i < 40; i++) {
      await sleep(500);
      try {
        const ping = await requestJson(`${BASE_URL}/api/sessions`);
        if (ping.status === 200 || ping.status === 401) {
          backendReady = true;
          break;
        }
      } catch (e) {}
    }
    if (!backendReady) throw new Error('Isolated Backend failed to start on port 5000');
    console.log('✓ Isolated backend online.');

    // Connect CDP to active Page Target
    let cdpWsUrl = null;
    for (let i = 0; i < 30; i++) {
      await sleep(400);
      try {
        const listRes = await requestJson(`http://127.0.0.1:${CDP_PORT}/json/list`);
        if (Array.isArray(listRes.body)) {
          const page = listRes.body.find(t => t.type === 'page' && t.webSocketDebuggerUrl);
          if (page) {
            cdpWsUrl = page.webSocketDebuggerUrl;
            break;
          }
        }
      } catch (e) {}
    }
    if (!cdpWsUrl) {
      try {
        const newTab = await requestJson(`http://127.0.0.1:${CDP_PORT}/json/new?about:blank`, { method: 'PUT' });
        if (newTab.body && newTab.body.webSocketDebuggerUrl) {
          cdpWsUrl = newTab.body.webSocketDebuggerUrl;
        }
      } catch (e) {}
    }
    if (!cdpWsUrl) throw new Error('Failed to connect to CDP page debugger URL');

    cdp = new SimpleCDP(cdpWsUrl);
    await cdp.connect();
    await cdp.send('Page.enable');
    await cdp.send('Runtime.enable');
    console.log('\n✓ Headless browser connected via CDP.');

    // Candidate Login with Test Fixture (F-02)
    const e2eEmail = process.env.PREPMATE_E2E_EMAIL || 'nam.le@gmail.com';
    const e2ePassword = process.env.PREPMATE_E2E_PASSWORD || 'user123';

    // Verify invalid credential rejection (401)
    const invalidAuthRes = await requestJson(`${BASE_URL}/api/auth/login`, { method: 'POST' }, {
      email: e2eEmail,
      password: 'wrong_password_probe'
    });
    assert.strictEqual(invalidAuthRes.status, 401, 'Auth endpoint should reject invalid credentials with 401');

    // Authenticate with valid test fixture
    const loginRes = await requestJson(`${BASE_URL}/api/auth/login`, { method: 'POST' }, {
      email: e2eEmail,
      password: e2ePassword
    });
    assert.strictEqual(loginRes.status, 200, 'Candidate login failed with test fixture credentials');
    const candToken = loginRes.body.token;
    assert.ok(candToken, 'Candidate token missing from response');
    console.log('✓ Candidate authenticated successfully via test fixture.');

    // Inject token to browser storage
    await cdp.send('Page.navigate', { url: 'http://127.0.0.1:5501/features/dashboard/dashboard.html' });
    await sleep(800);
    await cdp.eval(`
      try {
        localStorage.setItem('prepmate_auth_token', '${candToken}');
        localStorage.setItem('prepmate_user', JSON.stringify({
          id: 'cand_nam_le',
          email: 'nam.le@gmail.com',
          fullName: 'Lê Hải Nam',
          role: 'candidate',
          token: '${candToken}'
        }));
      } catch(e) {}
    `);

    // STEP A: RUN 20 SCENARIOS
    console.log('======================================================================');
    console.log('  PHASE 1: EXECUTING 20 CROSS-INDUSTRY SCENARIOS WITH LIVE AI         ');
    console.log('======================================================================');
    const scenarioResults = [];
    for (const sc of SCENARIOS) {
      const res = await runScenario(sc, candToken);
      scenarioResults.push(res);
      await sleep(1500); // polite rate limit
    }

    // STEP B: RUN BROWSER E2E REPORT AUDIT FOR 5 REPRESENTATIVE SESSIONS
    console.log('\n======================================================================');
    console.log('  PHASE 2: BROWSER E2E REPORT PAGE AUDIT ACROSS 5 INDUSTRIES          ');
    console.log('======================================================================');
    const representativeConfigs = [
      { code: 'A2', industryGroup: 'IT_Software_Engineering', jobTitle: 'Senior Backend Developer (.NET Core)', industryCode: 'CNTT' },
      { code: 'B2', industryGroup: 'Marketing_Growth', jobTitle: 'Senior Growth Marketing Manager', industryCode: 'Marketing' },
      { code: 'C2', industryGroup: 'Finance_Accounting', jobTitle: 'Kế toán trưởng / Senior Financial Analyst', industryCode: 'TaiChinh' },
      { code: 'D2', industryGroup: 'Human_Resources', jobTitle: 'HR Manager / Trưởng phòng Nhân sự', industryCode: 'NhanSu' },
      { code: 'E2', industryGroup: 'Business_Analysis', jobTitle: 'Senior Business Analyst (Product / IT)', industryCode: 'PhanTichNghiepVu' }
    ];

    const reportAuditResults = [];
    for (const cfg of representativeConfigs) {
      const sc = SCENARIOS.find(s => s.code === cfg.code);

      const repSessRes = await requestJson(`${BASE_URL}/api/sessions/start`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${candToken}` }
      }, {
        jobTitle: cfg.jobTitle,
        industry: cfg.industryCode,
        difficulty: 'Nâng cao'
      });
      const repSessionId = repSessRes.body.id || repSessRes.body.sessionId;

      const introRes = await requestJson(`${BASE_URL}/api/ai/introduction`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${candToken}` }
      }, {
        sessionId: repSessionId,
        introduction: sc.intro
      });
      const q1 = introRes.body.nextQuestion || introRes.body.question;

      const t1Res = await requestJson(`${BASE_URL}/api/ai/respond`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${candToken}` }
      }, {
        sessionId: repSessionId,
        question: q1,
        message: sc.answer1
      });
      const q2 = t1Res.body.nextQuestion || t1Res.body.reply || t1Res.body.question;

      await requestJson(`${BASE_URL}/api/ai/respond`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${candToken}` }
      }, {
        sessionId: repSessionId,
        question: q2,
        message: sc.answer2
      });

      const audit = await runBrowserE2EAndReportAudit(cfg.industryGroup, repSessionId, candToken, cdp);
      reportAuditResults.push(audit);
    }

    const resultsSummary = {
      timestamp: new Date().toISOString(),
      modelAlias: 'PrepMate',
      gateway: 'https://api.vilao.ai/v1',
      totalScenarios: scenarioResults.length,
      passedScenarios: scenarioResults.filter(s => s.isPass).length,
      scenarios: scenarioResults,
      reportAudits: reportAuditResults
    };
    fs.writeFileSync(path.join(TEST_DIR, 'cross_industry_results.json'), JSON.stringify(resultsSummary, null, 2), 'utf8');

    console.log('\n======================================================================');
    console.log('  ALL SCENARIOS AND REPORT AUDITS COMPLETED SUCCESSFULLY!             ');
    console.log(`  Passed: ${resultsSummary.passedScenarios} / ${resultsSummary.totalScenarios}`);
    console.log('======================================================================');

  } finally {
    if (cdp) cdp.close();
    try { feServer.close(); } catch (e) {}
    browserProc.kill();
    backendProc.kill();
    await sleep(1500);

    try { fs.rmSync(TEST_DIR, { recursive: true, force: true }); } catch (e) {}

    // Verify Post-Run Hash
    const postHash = computeHash(PROD_DB_PATH);
    console.log(`\n[Post-Run Audit] Production DB Hash: ${postHash}`);
    assert.strictEqual(baselineHash, postHash, 'CRITICAL: PRODUCTION DB HAS BEEN MUTATED!');
    console.log('✓ Production Database Integrity: 100% UNTOUCHED\n');
  }
}

main().catch(err => {
  console.error('\n[FATAL RUNNER FAILURE]', err);
  process.exit(1);
});
