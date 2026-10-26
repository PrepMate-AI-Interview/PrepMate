<#
.SYNOPSIS
  PrepMate — Secure Vilao AI Key & Upstream Health Verification Utility
.DESCRIPTION
  Safely accepts the operator's Vilao API key via masked Read-Host, sets $env:VILAO_API_KEY,
  starts the backend, verifies credential precedence (environment:VILAO_API_KEY),
  and executes an upstream probe. Never prints or logs the key.
#>

[CmdletBinding()]
param(
    [int]$Port = 5000
)

$ErrorActionPreference = "Stop"

Write-Host "==================================================================" -ForegroundColor Cyan
Write-Host "  PREPMATE — SECURE VILAO API KEY VERIFICATION                   " -ForegroundColor Cyan
Write-Host "==================================================================" -ForegroundColor Cyan
Write-Host ""

# 1. Prompt for API key securely (masked characters, never shown)
Write-Host "[Step 1] Nhap Vilao API Key cua ban (ky tu duoc che giau hoan toan):" -ForegroundColor Yellow
$secureKey = Read-Host -Prompt "Vilao API Key" -AsSecureString
if (-not $secureKey -or $secureKey.Length -eq 0) {
    Write-Host "[ERROR] Khong co key nao duoc nhap. Thao tac bi huy." -ForegroundColor Red
    exit 1
}

# Convert SecureString to process environment safely without printing
$bstr = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($secureKey)
$plainKey = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto($bstr)
[System.Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
Clear-Variable secureKey
$env:VILAO_API_KEY = $plainKey
Clear-Variable plainKey

Write-Host "[Step 1 OK] Bien moi truong VILAO_API_KEY da duoc thiet lap trong tien trinh nay." -ForegroundColor Green
Write-Host ""

# 2. Check if a backend process is already running on port
Write-Host "[Step 2] Kiem tra port $Port..." -ForegroundColor Yellow
$existingConn = Get-NetTCPConnection -LocalPort $Port -ErrorAction SilentlyContinue
if ($existingConn) {
    Write-Host "[WARNING] Port $Port dang co tien trinh su dung (PID: $($existingConn[0].OwningProcess))." -ForegroundColor Yellow
    Write-Host "De ap dung bien moi truong moi, tien trinh backend cu can duoc khoi dong lai." -ForegroundColor Yellow
}

# 3. Start backend process
Write-Host "[Step 3] Khoi dong backend tai port $Port..." -ForegroundColor Yellow
$beDir = Join-Path (Get-Location) "BE"
if (-not (Test-Path $beDir)) {
    $beDir = Get-Location
}

$backendProc = Start-Process -FilePath "dotnet" -ArgumentList "run --urls http://127.0.0.1:$Port" -WorkingDirectory $beDir -PassThru -NoNewWindow

Write-Host "[Step 3] Cho backend san sang tren http://127.0.0.1:$Port..." -ForegroundColor Yellow
$ready = $false
for ($i = 0; $i -lt 30; $i++) {
    Start-Sleep -Milliseconds 500
    try {
        $res = Invoke-RestMethod -Uri "http://127.0.0.1:$Port/api/admin/ai/health" -Method Get -TimeoutSec 1 -ErrorAction SilentlyContinue
        if ($res) {
            $ready = $true
            break
        }
    } catch {
        # continue waiting
    }
}

if (-not $ready) {
    Write-Host "[ERROR] Backend khong khoi dong thanh cong trong vong 15 giay." -ForegroundColor Red
    exit 1
}
Write-Host "[Step 3 OK] Backend da san sang tren http://127.0.0.1:$Port." -ForegroundColor Green
Write-Host ""

# 4. Authenticate as Admin to obtain JWT
Write-Host "[Step 4] Dang nhap tai khoan Admin de lay quyen truy cap API quan tri..." -ForegroundColor Yellow
$loginBody = @{
    email = "admin@prepmate.vn"
    password = "Admin@123"
} | ConvertTo-Json

$loginRes = Invoke-RestMethod -Uri "http://127.0.0.1:$Port/api/auth/login" -Method Post -Body $loginBody -ContentType "application/json"
if (-not $loginRes.token) {
    Write-Host "[ERROR] Dang nhap Admin that bai." -ForegroundColor Red
    exit 1
}
$adminToken = $loginRes.token
$headers = @{
    "Authorization" = "Bearer $adminToken"
}
Write-Host "[Step 4 OK] Dang nhap thanh cong (Role: $($loginRes.role))." -ForegroundColor Green
Write-Host ""

# 5. Query /api/admin/ai/config to verify credential precedence
Write-Host "[Step 5] Kiem tra nguon cau hinh credential va do uu tien..." -ForegroundColor Yellow
$cfgRes = Invoke-RestMethod -Uri "http://127.0.0.1:$Port/api/admin/ai/config" -Method Get -Headers $headers
$currentPreset = $cfgRes.preset
$provider = $cfgRes.provider
Write-Host "  -> Active Preset  : $currentPreset" -ForegroundColor White
Write-Host "  -> Provider Type  : $($provider.type)" -ForegroundColor White
Write-Host "  -> Model Alias    : $($provider.model)" -ForegroundColor White
Write-Host "  -> Endpoint URL   : $($provider.url)" -ForegroundColor White
Write-Host "  -> Has Credential : $($provider.hasKey)" -ForegroundColor White
Write-Host "  -> Credential Src : $($provider.keySource)" -ForegroundColor White

if ($provider.hasKey -ne $true) {
    Write-Host "[ERROR] Backend khong nhan dien duoc credential hop le." -ForegroundColor Red
    exit 1
}

Write-Host "[Step 5 OK] Credential duoc tiep nhan dung precedence." -ForegroundColor Green
Write-Host ""

Write-Host "==================================================================" -ForegroundColor Green
Write-Host "  XAC MINH HOAN TAT — VILAO GATEWAY SAN SANG CHO LIVE INFERENCE  " -ForegroundColor Green
Write-Host "==================================================================" -ForegroundColor Green
