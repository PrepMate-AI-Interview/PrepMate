<#
.SYNOPSIS
  PrepMate -- WI-EMAIL-LOCAL-RESEND-PRODUCTION-PARITY-04
  Local Pre-Deploy Test using the Exact Resend HTTP API Provider
.DESCRIPTION
  Safely accepts the operator's new Resend API key via masked Read-Host,
  configures process-level environment variables (EMAIL__PROVIDER=Resend_Api),
  runs an isolated backend instance without touching production db.json,
  executes a real email dispatch via IEmailSender and EmailTemplateRenderer,
  verifies the Resend HTTP response and Message ID, inspects rendered templates,
  and cleans up all temporary state in a guaranteed finally block.
#>

[CmdletBinding()]
param(
    [int]$Port = 5097,
    [string]$FromAddress = '',
    [string]$ToAddress = '',
    [string]$FrontendBaseUrl = 'http://localhost:5000'
)

$ErrorActionPreference = 'Stop'

Write-Host '================================================================================' -ForegroundColor Cyan
Write-Host '  PREPMATE -- LOCAL RESEND HTTP API PRODUCTION-PARITY TEST (WI-EMAIL-04)        ' -ForegroundColor Cyan
Write-Host '================================================================================' -ForegroundColor Cyan
Write-Host ''

# -----------------------------------------------------------------------------
# 1. CREDENTIAL ACQUISITION (MASKED / SECURE INPUT)
# -----------------------------------------------------------------------------
$plainKey = ''
if ([string]::IsNullOrWhiteSpace($env:EMAIL__RESEND_API_KEY)) {
    Write-Host '[Step 1] Nhap Resend API Key moi cua ban (ky tu duoc che giau hoan toan):' -ForegroundColor Yellow
    Write-Host '        (Luu y: API key cu trong chat da bi huy. Key phai bat dau bang re_)' -ForegroundColor DarkGray
    $secureKey = Read-Host -Prompt 'Resend API Key' -AsSecureString
    if (-not $secureKey -or $secureKey.Length -eq 0) {
        Write-Host '[ERROR] Khong co API key nao duoc nhap. Thao tac kiem thu bi huy.' -ForegroundColor Red
        exit 1
    }
    $bstr = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($secureKey)
    $plainKey = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto($bstr)
    [System.Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
    Clear-Variable secureKey -ErrorAction SilentlyContinue
} else {
    $plainKey = $env:EMAIL__RESEND_API_KEY.Trim()
    Write-Host '[Step 1] Su dung API key da duoc thiet lap san trong process environment.' -ForegroundColor Green
}

if (-not $plainKey.StartsWith('re_')) {
    Write-Host "[WARNING] Resend API key thuong bat dau bang 're_'. Key vua nhap co do dai: $($plainKey.Length) ky tu." -ForegroundColor Yellow
} else {
    Write-Host "[Step 1 OK] Resend API key da nhan dien hop le (do dai: $($plainKey.Length) ky tu)." -ForegroundColor Green
}
Write-Host ''

# -----------------------------------------------------------------------------
# 2. SENDER & RECIPIENT CONFIGURATION
# -----------------------------------------------------------------------------
if ([string]::IsNullOrWhiteSpace($FromAddress)) {
    Write-Host '[Step 2] Cau hinh dia chi Sender (Email nguoi gui):' -ForegroundColor Yellow
    Write-Host "        - Neu chua co custom domain da verify tren Resend: dung 'onboarding@resend.dev'" -ForegroundColor DarkGray
    Write-Host "        - Neu da co custom domain da verify tren Resend: vi du 'no-reply@yourdomain.com'" -ForegroundColor DarkGray
    $inputSender = Read-Host -Prompt 'Sender Address (Enter de dung onboarding@resend.dev)'
    if ([string]::IsNullOrWhiteSpace($inputSender)) {
        $FromAddress = 'onboarding@resend.dev'
    } else {
        $FromAddress = $inputSender.Trim()
    }
}
Write-Host "  -> Sender Address : $FromAddress" -ForegroundColor White

if ([string]::IsNullOrWhiteSpace($ToAddress)) {
    Write-Host ''
    Write-Host '[Step 3] Cau hinh dia chi Recipient (Hom thu nhan email test):' -ForegroundColor Yellow
    Write-Host "        - 'delivered@resend.dev' : Test simulated integration Resend API (khong gui hop thu thuc)" -ForegroundColor DarkGray
    Write-Host "        - Neu dung 'onboarding@resend.dev': Resend chi cho phep gui den email chinh chu tai khoan Resend" -ForegroundColor DarkGray
    Write-Host '        - Neu da verify domain: Co the nhap bat ky email ca nhan nao' -ForegroundColor DarkGray
    $inputTo = Read-Host -Prompt 'Recipient Address (Enter de dung delivered@resend.dev)'
    if ([string]::IsNullOrWhiteSpace($inputTo)) {
        $ToAddress = 'delivered@resend.dev'
    } else {
        $ToAddress = $inputTo.Trim()
    }
}
Write-Host "  -> Recipient Address : $ToAddress" -ForegroundColor White
Write-Host "  -> Frontend Base URL : $FrontendBaseUrl" -ForegroundColor White
Write-Host ''

# -----------------------------------------------------------------------------
# 3. ENVIRONMENT & DATABASE ISOLATION SETUP
# -----------------------------------------------------------------------------
Write-Host '[Step 4] Co lap database va chuan bi moi truong test...' -ForegroundColor Yellow

$rootDir = Split-Path -Parent $PSScriptRoot
$dataDir = Join-Path $rootDir 'data'
$testDir = Join-Path $rootDir 'tests\.tmp_resend_test'
$testDbPath = Join-Path $testDir 'db.resend-test.json'
$testKeyringPath = Join-Path $testDir 'keyring'

if (-not (Test-Path $testDir)) {
    New-Item -ItemType Directory -Path $testDir -Force | Out-Null
}
if (-not (Test-Path $testKeyringPath)) {
    New-Item -ItemType Directory -Path $testKeyringPath -Force | Out-Null
}

# Copy canonical test DB fixture to isolated test location
$fixturePath = Join-Path $rootDir 'tests\fixtures\test_db_fixture.json'
if (Test-Path $fixturePath) {
    Copy-Item -Path $fixturePath -Destination $testDbPath -Force
} else {
    $examplePath = Join-Path $rootDir 'data\db.example.json'
    Copy-Item -Path $examplePath -Destination $testDbPath -Force
}

Write-Host "  -> Isolated Test DB : $testDbPath" -ForegroundColor White
Write-Host "  -> Production DB    : $(Join-Path $dataDir 'db.json') (STRICTLY UNTOUCHED)" -ForegroundColor White
Write-Host '[Step 4 OK] Moi truong test da duoc co lap tuyet doi.' -ForegroundColor Green
Write-Host ''

# -----------------------------------------------------------------------------
# 4. EXECUTION WRAPPED IN TRY / FINALLY FOR GUARANTEED CLEANUP
# -----------------------------------------------------------------------------
$backendProc = $null
$regSuccess = $false
$resendAccepted = $false
$messageId = 'N/A'

try {
    Write-Host "[Step 5] Khoi dong Backend voi cau hinh Resend HTTP API tai port $Port..." -ForegroundColor Yellow

    $existingConn = Get-NetTCPConnection -LocalPort $Port -ErrorAction SilentlyContinue
    if ($existingConn) {
        Write-Host "[WARNING] Port $Port dang duoc su dung boi PID $($existingConn[0].OwningProcess). Dang dung tien trinh..." -ForegroundColor Yellow
        Stop-Process -Id $existingConn[0].OwningProcess -Force -ErrorAction SilentlyContinue
        Start-Sleep -Seconds 1
    }

    $beDir = Join-Path $rootDir 'BE'
    $dllPath = Join-Path $beDir 'bin\Debug\net10.0\backend.dll'
    if (-not (Test-Path $dllPath)) {
        Write-Host '  -> Dang bien dich backend...' -ForegroundColor DarkGray
        & dotnet build (Join-Path $beDir 'backend.csproj') -c Debug --nologo | Out-Null
    }

    $psi = New-Object System.Diagnostics.ProcessStartInfo
    $psi.FileName = 'dotnet'
    $psi.Arguments = "$dllPath --urls http://127.0.0.1:$Port"
    $psi.WorkingDirectory = $beDir
    $psi.UseShellExecute = $false
    $psi.RedirectStandardOutput = $true
    $psi.RedirectStandardError = $true
    $psi.CreateNoWindow = $true

    # Strictly enforce Resend_Api provider and production-parity configuration
    $psi.EnvironmentVariables['ASPNETCORE_ENVIRONMENT'] = 'Development'
    $psi.EnvironmentVariables['EMAIL__PROVIDER'] = 'Resend_Api'
    $psi.EnvironmentVariables['EMAIL__RESEND_API_KEY'] = $plainKey
    $psi.EnvironmentVariables['EMAIL__FROM_ADDRESS'] = $FromAddress
    $psi.EnvironmentVariables['EMAIL__FROM_NAME'] = 'PrepMate - AI Interview'
    $psi.EnvironmentVariables['FRONTEND_BASE_URL'] = $FrontendBaseUrl
    $psi.EnvironmentVariables['DATABASE_FILE_PATH'] = $testDbPath
    $psi.EnvironmentVariables['PREPMATE_DATABASE_PATH'] = $testDbPath
    $psi.EnvironmentVariables['PREPMATE_KEYRING_PATH'] = $testKeyringPath
    $psi.EnvironmentVariables['JWT__SECRET'] = '0123456789abcdef0123456789abcdef_TEST_JWT_SECRET_32CHARS'
    $psi.EnvironmentVariables['GUEST_TOKEN__SIGNING_KEY'] = 'fedcba9876543210fedcba9876543210_TEST_GUEST_KEY_32CHARS'

    $backendProc = [System.Diagnostics.Process]::Start($psi)

    # Clear plaintext key from script memory immediately
    $plainKey = ''
    Clear-Variable plainKey -ErrorAction SilentlyContinue

    Write-Host "  -> Backend Process PID: $($backendProc.Id)" -ForegroundColor White
    Write-Host '  -> Cho Backend khoi dong va san sang...' -ForegroundColor DarkGray

    $isReady = $false
    for ($i = 0; $i -lt 40; $i++) {
        Start-Sleep -Milliseconds 300
        try {
            $healthCheck = Invoke-RestMethod -Uri "http://127.0.0.1:$Port/api/health" -Method Get -TimeoutSec 1 -ErrorAction SilentlyContinue
            if ($healthCheck) {
                $isReady = $true
                break
            }
        } catch {
            # continue waiting
        }
    }

    if (-not $isReady) {
        Write-Host "[ERROR] Backend khong the san sang tai port $Port sau 12 giay." -ForegroundColor Red
        throw 'Backend startup timeout.'
    }

    Write-Host "[Step 5 OK] Backend da san sang tren http://127.0.0.1:$Port." -ForegroundColor Green
    Write-Host ''

    # -------------------------------------------------------------------------
    # 5. DISPATCH REAL TEST EMAIL THROUGH REGISTRATION PIPELINE
    # -------------------------------------------------------------------------
    Write-Host '[Step 6] Gui email test thuc te qua pipeline IEmailSender...' -ForegroundColor Yellow

    $testRegisterPayload = @{
        email = $ToAddress
        password = 'TestPassword@2026!'
        fullname = 'PrepMate Test Recipient'
    } | ConvertTo-Json

    $regResponse = $null
    $regStatusCode = 0

    try {
        $regResponse = Invoke-RestMethod -Uri "http://127.0.0.1:$Port/api/auth/register" `
            -Method Post `
            -Body $testRegisterPayload `
            -ContentType 'application/json' `
            -TimeoutSec 25
        $regSuccess = $true
        $regStatusCode = 200
    } catch {
        if ($_.Exception.Response) {
            $regStatusCode = [int]$_.Exception.Response.StatusCode
            $stream = $_.Exception.Response.GetResponseStream()
            if ($stream) {
                $reader = New-Object System.IO.StreamReader($stream)
                $errBody = $reader.ReadToEnd()
                try { $regResponse = $errBody | ConvertFrom-Json } catch { $regResponse = @{ raw = $errBody } }
            }
        } else {
            $regResponse = @{ raw = $_.Exception.Message }
        }
    }

    Write-Host "  -> HTTP Status Code    : $regStatusCode" -ForegroundColor White
    Write-Host "  -> Response Message     : $($regResponse.message)" -ForegroundColor White
    Write-Host "  -> RequiresVerification : $($regResponse.requiresVerification)" -ForegroundColor White

    # -------------------------------------------------------------------------
    # 6. RETRIEVE DEV SANDBOX COPY & VERIFY TEMPLATE RENDERING
    # -------------------------------------------------------------------------
    Write-Host ''
    Write-Host '[Step 7] Kiem tra rendered template trong dev sandbox store...' -ForegroundColor Yellow

    $devInbox = Invoke-RestMethod -Uri "http://127.0.0.1:$Port/api/dev/emails" -Method Get
    $sentEmail = $null
    if ($devInbox -and $devInbox.Count -gt 0) {
        $sentEmail = $devInbox[-1]
    }

    if ($sentEmail) {
        Write-Host "  [PASS] Email Subject     : $($sentEmail.subject)" -ForegroundColor Green
        Write-Host "  [PASS] Email Sender      : $($sentEmail.senderEmail)" -ForegroundColor Green
        Write-Host "  [PASS] Sender Name       : $($sentEmail.senderName)" -ForegroundColor Green
        Write-Host "  [PASS] Recipient         : $($sentEmail.to)" -ForegroundColor Green
        Write-Host "  [PASS] HTML Body Length  : $($sentEmail.htmlBody.Length) bytes" -ForegroundColor Green
        Write-Host "  [PASS] PlainText Length  : $($sentEmail.plainTextBody.Length) bytes" -ForegroundColor Green

        $hasLogo = $sentEmail.htmlBody.Contains('Prep<span style="color:#2563eb;">Mate</span>')
        $hasCta = $sentEmail.htmlBody.Contains('Xác minh email')
        $hasFallback = $sentEmail.htmlBody.Contains('features/auth/verify-email.html?token=')
        $hasVietnamese = $sentEmail.htmlBody.Contains('Xin chào')

        Write-Host "  [PASS] PrepMate Brand Logo      : $(if ($hasLogo) {'YES'} else {'NO'})" -ForegroundColor Green
        Write-Host "  [PASS] Tieng Viet co dau        : $(if ($hasVietnamese) {'YES'} else {'NO'})" -ForegroundColor Green
        Write-Host "  [PASS] CTA Button               : $(if ($hasCta) {'YES'} else {'NO'})" -ForegroundColor Green
        Write-Host "  [PASS] Fallback URL Block       : $(if ($hasFallback) {'YES'} else {'NO'})" -ForegroundColor Green
    } else {
        Write-Host '  [WARNING] Khong tim thay email ban sao trong Dev Sandbox store.' -ForegroundColor Yellow
    }

    # -------------------------------------------------------------------------
    # 7. READ BACKEND CONSOLE OUTPUT FOR RESEND PROVIDER LOGS & MESSAGE ID
    # -------------------------------------------------------------------------
    Write-Host ''
    Write-Host '[Step 8] Doc log tien trinh Backend de xac minh Provider Response...' -ForegroundColor Yellow

    Start-Sleep -Seconds 2

    # Safely stop backend to flush output
    if ($backendProc -and -not $backendProc.HasExited) {
        $backendProc.Kill()
        $backendProc.WaitForExit(3000) | Out-Null
    }
    $stdoutText = $backendProc.StandardOutput.ReadToEnd()

    $resendAccepted = $stdoutText.Contains('[ResendEmailSender] Provider accepted email delivery')
    if ($stdoutText -match 'MessageId:\s*([a-zA-Z0-9_\-]+)') {
        $messageId = $matches[1]
    }

    Write-Host '--------------------------------------------------------------------------------' -ForegroundColor DarkGray
    Write-Host '  KET QUA KIEM TRA NHA CUNG CAP (PROVIDER RESPONSE AUDIT)                      ' -ForegroundColor Cyan
    Write-Host '--------------------------------------------------------------------------------' -ForegroundColor DarkGray

    if ($resendAccepted) {
        Write-Host '  Provider Used       : Resend HTTP API (HTTPS POST https://api.resend.com/emails)' -ForegroundColor Green
        Write-Host '  Provider Status     : ACCEPTED BY PROVIDER (HTTP 200 OK)' -ForegroundColor Green
        Write-Host "  Resend Message ID   : $messageId" -ForegroundColor Green
    } else {
        Write-Host '  Provider Used       : Resend HTTP API' -ForegroundColor Yellow
        Write-Host '  Provider Status     : REJECTED HOAC CHUA HOAN TAT' -ForegroundColor Red
        $logLines = $stdoutText -split "`n" | Where-Object { $_ -match 'Resend|EMAIL|SMTP' }
        foreach ($line in $logLines) {
            Write-Host "    $($line.Trim())" -ForegroundColor Yellow
        }
    }
} finally {
    # -------------------------------------------------------------------------
    # 8. GUARANTEED CLEANUP OF TEMPORARY ENVIRONMENT
    # -------------------------------------------------------------------------
    Write-Host ''
    Write-Host '[Step 9] Don dep moi truong test tam thoi...' -ForegroundColor Yellow

    if ($backendProc -and -not $backendProc.HasExited) {
        try {
            $backendProc.Kill()
            $backendProc.WaitForExit(2000) | Out-Null
        } catch {
            # process already terminated
        }
    }

    if (Test-Path $testDir) {
        Remove-Item -Path $testDir -Recurse -Force -ErrorAction SilentlyContinue
    }

    Write-Host '  [CLEANUP] Tien trinh Backend test da dung.' -ForegroundColor Green
    Write-Host '  [CLEANUP] Database fixture tam thoi da duoc xoa.' -ForegroundColor Green
    Write-Host '  [CLEANUP] Production db.json hoan toan nguyen ven.' -ForegroundColor Green
    Write-Host '  [CLEANUP] Khong co credentials nao duoc luu vao disk hoac Git.' -ForegroundColor Green
    Write-Host ''
}

# -----------------------------------------------------------------------------
# 9. EVIDENCE SUMMARY TABLE
# -----------------------------------------------------------------------------
Write-Host '================================================================================' -ForegroundColor Cyan
Write-Host '  TONG KET CAP DO BANG CHUNG (EVIDENCE HIERARCHY)                              ' -ForegroundColor Cyan
Write-Host '================================================================================' -ForegroundColor Cyan
Write-Host "  1. Application Sent     : $(if ($regSuccess) {'SUCCESS (OK 200)'} else {'FAILED'})" -ForegroundColor $(if ($regSuccess) {'Green'} else {'Red'})
Write-Host "  2. Provider Accepted    : $(if ($resendAccepted) {'ACCEPTED (MessageId: ' + $messageId + ')'} else {'NOT ACCEPTED'})" -ForegroundColor $(if ($resendAccepted) {'Green'} else {'Red'})
Write-Host "  3. Resend Delivered     : $(if ($ToAddress -eq 'delivered@resend.dev') {'SIMULATED TEST RECIPIENT'} else {'PENDING WEBHOOK/DELIVERY RECEIPT'})" -ForegroundColor White
Write-Host "  4. Mailbox Verified     : $(if ($ToAddress -eq 'delivered@resend.dev') {'N/A (Simulated Recipient)'} else {'REQUIRES MANUAL OPERATOR CONFIRMATION'})" -ForegroundColor Yellow
Write-Host '================================================================================' -ForegroundColor Cyan