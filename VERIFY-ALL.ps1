# ============================================================
# INSIDE CODE - FULL PRODUCTION VERIFICATION
# ============================================================

$ErrorActionPreference = "Continue"

$ROOT = Split-Path -Parent $MyInvocation.MyCommand.Path
$WEB  = Join-Path $ROOT "web"
$SUPA = Join-Path $ROOT "supabase"

$EXPECTED_PROJECT_REF = "nxjwctumtkgcyghuzfwm"
$PRODUCTION_URL       = "https://inside-code.yasinikhhsan2.workers.dev"

$PASS = 0
$FAIL = 0
$WARN = 0

function Pass($msg) {
    Write-Host "[PASS] $msg" -ForegroundColor Green
    $script:PASS++
}

function Fail($msg) {
    Write-Host "[FAIL] $msg" -ForegroundColor Red
    $script:FAIL++
}

function Warn($msg) {
    Write-Host "[WARN] $msg" -ForegroundColor Yellow
    $script:WARN++
}

function Info($msg) {
    Write-Host "[INFO] $msg" -ForegroundColor Cyan
}

function Section($msg) {
    Write-Host ""
    Write-Host "============================================================" -ForegroundColor DarkCyan
    Write-Host $msg -ForegroundColor White
    Write-Host "============================================================" -ForegroundColor DarkCyan
}

function Test-CommandExists($name) {
    return $null -ne (Get-Command $name -ErrorAction SilentlyContinue)
}

function Run-Command($cmd, $args) {
    try {
        & $cmd @args 2>&1
        return $LASTEXITCODE
    }
    catch {
        return 1
    }
}

Section "1. DIRECTORY"

if (Test-Path $ROOT) {
    Pass "Project root ditemukan: $ROOT"
} else {
    Fail "Project root tidak ditemukan."
    exit 1
}

if (Test-Path $WEB) {
    Pass "web/ ditemukan"
} else {
    Fail "web/ tidak ditemukan"
}

if (Test-Path $SUPA) {
    Pass "supabase/ ditemukan"
} else {
    Fail "supabase/ tidak ditemukan"
}

Section "2. NODE / NPM"

if (Test-CommandExists "node") {
    $nodeVersion = node --version
    Pass "Node.js: $nodeVersion"
} else {
    Fail "Node.js tidak ditemukan"
}

if (Test-CommandExists "npm") {
    $npmVersion = npm --version
    Pass "npm: $npmVersion"
} else {
    Fail "npm tidak ditemukan"
}

Section "3. PACKAGE FILES"

$packageJson = Join-Path $WEB "package.json"
$packageLock = Join-Path $WEB "package-lock.json"

if (Test-Path $packageJson) {
    Pass "package.json ditemukan"
} else {
    Fail "package.json tidak ditemukan"
}

if (Test-Path $packageLock) {
    Pass "package-lock.json ditemukan"
} else {
    Fail "package-lock.json TIDAK ditemukan"
}

Section "4. PACKAGE JSON"

if (Test-Path $packageJson) {

    try {
        $pkg = Get-Content $packageJson -Raw | ConvertFrom-Json

        Info "Package: $($pkg.name)"
        Info "Version: $($pkg.version)"

        if ($pkg.dependencies.typescript -or $pkg.devDependencies.typescript) {
            Pass "TypeScript tercantum di package.json"
        } else {
            Fail "TypeScript tidak ditemukan di package.json"
        }

        if ($pkg.dependencies.vite -or $pkg.devDependencies.vite) {
            Pass "Vite tercantum di package.json"
        } else {
            Fail "Vite tidak ditemukan di package.json"
        }

        if ($pkg.devDependencies."@types/react") {
            Info "@types/react: $($pkg.devDependencies.'@types/react')"
        }

        if ($pkg.devDependencies."@types/react-dom") {
            Info "@types/react-dom: $($pkg.devDependencies.'@types/react-dom')"
        }

    }
    catch {
        Fail "package.json tidak valid JSON"
    }
}

Section "5. LOCKFILE SYNC CHECK"

Push-Location $WEB

if (Test-Path $packageLock) {

    Info "Menjalankan npm ci --dry-run untuk memeriksa sinkronisasi..."

    npm ci --dry-run --ignore-scripts --include=dev --no-audit --no-fund 2>&1 |
        Tee-Object -Variable NpmDryRunOutput

    if ($LASTEXITCODE -eq 0) {
        Pass "package.json dan package-lock.json sinkron"
    } else {
        Fail "package.json dan package-lock.json TIDAK sinkron"
    }

} else {
    Fail "Tidak dapat memeriksa lockfile karena package-lock.json tidak ada"
}

Pop-Location

Section "6. NODE_MODULES"

if (Test-Path (Join-Path $WEB "node_modules")) {
    Pass "node_modules ditemukan"
} else {
    Warn "node_modules belum ada. Akan dibuat ketika npm install dijalankan."
}

Section "7. TYPESCRIPT"

Push-Location $WEB

$typecheckScript = $null

try {
    $pkg = Get-Content "package.json" -Raw | ConvertFrom-Json

    if ($pkg.scripts.typecheck) {
        $typecheckScript = $pkg.scripts.typecheck
    }
}
catch {}

if ($typecheckScript) {

    Info "Menjalankan npm run typecheck..."

    npm run typecheck

    if ($LASTEXITCODE -eq 0) {
        Pass "TypeScript typecheck berhasil"
    } else {
        Fail "TypeScript typecheck gagal"
    }

} else {

    Info "Script typecheck tidak tersedia, menggunakan npx tsc -b..."

    npx tsc -b --pretty false

    if ($LASTEXITCODE -eq 0) {
        Pass "TypeScript compilation berhasil"
    } else {
        Fail "TypeScript compilation gagal"
    }
}

Pop-Location

Section "8. PRODUCTION BUILD"

Push-Location $WEB

Info "Menjalankan npm run build..."

npm run build

if ($LASTEXITCODE -eq 0) {
    Pass "Production build berhasil"
} else {
    Fail "Production build gagal"
}

if (Test-Path (Join-Path $WEB "dist")) {
    Pass "dist/ berhasil dibuat"
} else {
    Fail "dist/ tidak terbentuk"
}

Pop-Location

Section "9. PRODUCTION ENV"

$envFiles = @(
    ".env",
    ".env.production",
    ".env.local",
    ".env.production.local"
)

$envFound = $false

foreach ($name in $envFiles) {

    $path = Join-Path $WEB $name

    if (Test-Path $path) {
        $envFound = $true
        Info "$name ditemukan"

        $content = Get-Content $path -Raw

        if ($content -match "VITE_DEMO_MODE\s*=\s*false") {
            Pass "$name: VITE_DEMO_MODE=false"
        } else {
            Warn "$name: VITE_DEMO_MODE bukan false atau tidak ditemukan"
        }

        if ($content -match "VITE_SUPABASE_URL\s*=\s*https://nxjwctumtkgcyghuzfwm\.supabase\.co") {
            Pass "$name: Supabase URL benar"
        } else {
            Warn "$name: Supabase URL perlu dicek"
        }

        if ($content -match "VITE_SUPABASE_PUBLISHABLE_KEY\s*=\s*\S+") {
            Pass "$name: publishable key terisi"
        } else {
            Warn "$name: publishable key kosong"
        }

        if ($content -match "VITE_TURNSTILE_SITE_KEY\s*=\s*\S+") {
            Pass "$name: Turnstile site key terisi"
        } else {
            Warn "$name: Turnstile site key kosong"
        }

        if ($content -match "VITE_VAPID_PUBLIC_KEY\s*=\s*\S+") {
            Pass "$name: VAPID public key terisi"
        } else {
            Warn "$name: VAPID public key kosong"
        }
    }
}

if (-not $envFound) {
    Warn "Tidak ada .env lokal. Ini normal jika konfigurasi production hanya berada di Cloudflare."
}

Section "10. SENSITIVE FILE CHECK"

$dangerous = @(
    ".env",
    ".env.local",
    ".env.production",
    ".env.production.local",
    ".dev.vars",
    ".dev.vars.local"
)

foreach ($f in $dangerous) {

    $path = Join-Path $ROOT $f

    if (Test-Path $path) {
        Warn "File sensitive ditemukan di root: $f"
    }
}

$forbiddenNames = @(
    "service_role",
    "service-role",
    "SUPABASE_SERVICE_ROLE_KEY",
    "TURNSTILE_SECRET",
    "VAPID_PRIVATE",
    "SMTP_PASSWORD",
    "SUPABASE_DB_PASSWORD"
)

$sourceDirs = @(
    (Join-Path $WEB "src"),
    (Join-Path $SUPA "scripts"),
    (Join-Path $SUPA "functions")
)

foreach ($dir in $sourceDirs) {

    if (-not (Test-Path $dir)) {
        continue
    }

    foreach ($pattern in $forbiddenNames) {

        $hits = Get-ChildItem $dir -Recurse -File -ErrorAction SilentlyContinue |
            Select-String -Pattern [regex]::Escape($pattern) -SimpleMatch `
            -ErrorAction SilentlyContinue

        if ($hits) {
            Warn "Kemungkinan secret ditemukan di source: $pattern"
        }
    }
}

Section "11. SUPABASE MIGRATIONS"

$migrationDir = Join-Path $SUPA "migrations"

if (Test-Path $migrationDir) {

    $migrationFiles = Get-ChildItem $migrationDir -Filter "*.sql" |
        Sort-Object Name

    $migrationNumbers = @()

    foreach ($file in $migrationFiles) {

        if ($file.Name -match "^(\d+)_") {
            $migrationNumbers += [int]$Matches[1]
        }
    }

    $missing = @()

    for ($i = 1; $i -le 31; $i++) {

        if ($migrationNumbers -notcontains $i) {
            $missing += $i
        }
    }

    if ($missing.Count -eq 0) {
        Pass "Migration 001 sampai 031 lengkap"
    } else {
        Fail "Migration hilang: $($missing -join ', ')"
    }

    $m030 = Get-ChildItem $migrationDir -Filter "030_*.sql" -ErrorAction SilentlyContinue

    if ($m030) {
        Pass "Migration 030 security hardening ditemukan"
    } else {
        Fail "Migration 030 tidak ditemukan"
    }

    $m031 = Get-ChildItem $migrationDir -Filter "031_*.sql" -ErrorAction SilentlyContinue

    if ($m031) {
        Pass "Migration 031 branding/normalization ditemukan"
    } else {
        Warn "Migration 031 tidak ditemukan"
    }

} else {
    Fail "Folder migration tidak ditemukan"
}

Section "12. AUTH SOURCE CHECK"

$authPage = Join-Path $WEB "src\pages\AuthPage.tsx"

if (Test-Path $authPage) {

    $authText = Get-Content $authPage -Raw

    if ($authText -match "emailRedirectTo\s*:\s*window\.location\.origin") {
        Pass "Signup menggunakan emailRedirectTo=window.location.origin"
    } else {
        Fail "emailRedirectTo signup belum ditemukan"
    }

    if ($authText -match "auth\.resend") {
        Pass "Resend verification tersedia"
    } else {
        Warn "auth.resend tidak ditemukan"
    }

    if ($authText -match "captchaToken") {
        Pass "captchaToken digunakan di Auth"
    } else {
        Warn "captchaToken tidak ditemukan"
    }

} else {
    Fail "AuthPage.tsx tidak ditemukan"
}

Section "13. SERVICE WORKER"

$sw = Join-Path $WEB "public\sw.js"

if (Test-Path $sw) {

    $swText = Get-Content $sw -Raw

    if ($swText -match "inside-code-v1\.8\.12") {
        Pass "Service Worker cache v1.8.12"
    } elseif ($swText -match "inside-code-v1\.8") {
        Warn "Service Worker memakai cache versi 1.8.x, cek versinya"
    } else {
        Warn "Cache version Service Worker tidak dapat dipastikan"
    }

} else {
    Fail "public/sw.js tidak ditemukan"
}

Section "14. GIT"

if (Test-CommandExists "git") {

    Push-Location $ROOT

    git status --short

    if ($LASTEXITCODE -eq 0) {
        Pass "Git repository dapat dibaca"
    } else {
        Fail "Git status gagal"
    }

    Pop-Location

} else {
    Warn "Git tidak tersedia"
}

Section "15. PRODUCTION URL"

try {

    $response = Invoke-WebRequest `
        -Uri $PRODUCTION_URL `
        -Method Head `
        -UseBasicParsing `
        -TimeoutSec 20 `
        -ErrorAction Stop

    if ($response.StatusCode -ge 200 -and $response.StatusCode -lt 400) {
        Pass "Production URL dapat diakses: HTTP $($response.StatusCode)"
    } else {
        Warn "Production URL merespons HTTP $($response.StatusCode)"
    }

}
catch {
    Fail "Production URL tidak dapat diakses"
    Info $_.Exception.Message
}

Section "16. SUPABASE MANAGEMENT API"

$token = $env:SUPABASE_ACCESS_TOKEN

if ($token) {

    $prefix = if ($token.Length -ge 6) {
        $token.Substring(0,6)
    } else {
        ""
    }

    Info "PAT prefix: $prefix"
    Info "PAT length: $($token.Length)"

    if ($prefix -eq "sbp_fc") {
        Pass "PAT terlihat seperti scoped Supabase PAT"
    } else {
        Warn "PAT prefix bukan sbp_fc"
    }

    $headers = @{
        Authorization = "Bearer $token"
    }

    try {

        $authUrl = "https://api.supabase.com/v1/projects/$EXPECTED_PROJECT_REF/config/auth"

        $authConfig = Invoke-RestMethod `
            -Method Get `
            -Uri $authUrl `
            -Headers $headers `
            -ErrorAction Stop

        Pass "Supabase Management API dapat diakses"

        if ($authConfig.external_email_enabled -eq $true) {
            Pass "Supabase email authentication aktif"
        } else {
            Warn "Supabase external email tidak aktif"
        }

        if ($authConfig.mailer_autoconfirm -eq $false) {
            Pass "Email verification wajib"
        } else {
            Warn "Mailer autoconfirm aktif"
        }

        if ($authConfig.site_url -eq $PRODUCTION_URL) {
            Pass "Supabase Site URL benar"
        } else {
            Warn "Supabase Site URL: $($authConfig.site_url)"
        }

        if ($authConfig.uri_allow_list -match [regex]::Escape($PRODUCTION_URL)) {
            Pass "Production redirect URL terdaftar"
        } else {
            Fail "Production redirect URL tidak ditemukan"
        }

        if ($authConfig.uri_allow_list -match "http://localhost:5173") {
            Pass "localhost:5173 terdaftar"
        } else {
            Warn "localhost:5173 tidak terdaftar"
        }

        if ($authConfig.smtp_host) {
            Pass "SMTP host terkonfigurasi: $($authConfig.smtp_host)"
        } else {
            Fail "SMTP host kosong"
        }

        if ($authConfig.smtp_port) {
            Pass "SMTP port terkonfigurasi: $($authConfig.smtp_port)"
        } else {
            Fail "SMTP port kosong"
        }

        if ($authConfig.smtp_user) {
            Pass "SMTP username terkonfigurasi"
        } else {
            Fail "SMTP username kosong"
        }

        if ($authConfig.smtp_pass) {
            Pass "SMTP password terkonfigurasi"
        } else {
            Fail "SMTP password kosong"
        }

        if ($authConfig.smtp_sender_name) {
            Info "SMTP sender name: $($authConfig.smtp_sender_name)"
        }

        if ($authConfig.mailer_subjects_confirmation) {
            Info "Confirmation subject: $($authConfig.mailer_subjects_confirmation)"
        }

        if ($authConfig.mailer_templates_custom_contents) {

            $custom = "$($authConfig.mailer_templates_custom_contents)"

            if ($custom -match "MAILER_TEMPLATES_CONFIRMATION_CONTENT=True") {
                Pass "Confirmation email template custom"
            } else {
                Warn "Confirmation email template belum custom"
            }

            if ($custom -match "MAILER_TEMPLATES_RECOVERY_CONTENT=True") {
                Pass "Recovery email template custom"
            } else {
                Warn "Recovery email template belum custom"
            }
        }

        if ($authConfig.security_captcha_enabled -eq $true) {
            Pass "Supabase CAPTCHA aktif"

            Info "CAPTCHA provider: $($authConfig.security_captcha_provider)"

            if ($authConfig.security_captcha_provider -eq "turnstile") {
                Pass "CAPTCHA provider = Turnstile"
            } else {
                Warn "CAPTCHA provider bukan Turnstile"
            }

        } else {
            Warn "Supabase CAPTCHA masih OFF"
        }

    }
    catch {

        Fail "Supabase Management API gagal"

        if ($_.Exception.Response) {

            try {
                $status = $_.Exception.Response.StatusCode.value__
                Info "HTTP status: $status"
            }
            catch {}
        }

        Info $_.Exception.Message
    }

} else {

    Warn "SUPABASE_ACCESS_TOKEN belum diset."
    Info "Supabase Management API check dilewati."
}

Section "17. FINAL RESULT"

Write-Host ""
Write-Host "PASS : $PASS" -ForegroundColor Green
Write-Host "WARN : $WARN" -ForegroundColor Yellow
Write-Host "FAIL : $FAIL" -ForegroundColor Red
Write-Host ""

if ($FAIL -eq 0) {

    Write-Host "============================================================"
    Write-Host "   INSIDE CODE VERIFICATION: TIDAK ADA FAIL" -ForegroundColor Green
    Write-Host "============================================================"

} else {

    Write-Host "============================================================"
    Write-Host "   INSIDE CODE MASIH MEMILIKI MASALAH" -ForegroundColor Red
    Write-Host "============================================================"
}

Write-Host ""