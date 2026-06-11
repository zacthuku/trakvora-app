# ============================================================
#  Trakvora Backend — Windows Server startup script (VPS 2)
#  Run this script to start the FastAPI backend.
#  For production, register it as a Windows Service via NSSM
#  (see infra/scripts/windows-setup-vps2.ps1).
#
#  Usage (manual):
#    cd C:\Trakvora\backend
#    powershell -ExecutionPolicy Bypass -File start.ps1
# ============================================================

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

# ── Load .env file into process environment ───────────────────────────────────
$envFile = Join-Path $PSScriptRoot "..\env.prod"
if (Test-Path $envFile) {
    Get-Content $envFile | ForEach-Object {
        if ($_ -match "^\s*([^#][^=]+)=(.*)$") {
            $key   = $Matches[1].Trim()
            $value = $Matches[2].Trim().Trim('"').Trim("'")
            [System.Environment]::SetEnvironmentVariable($key, $value, "Process")
        }
    }
    Write-Host "[trakvora] Loaded environment from $envFile"
} else {
    Write-Host "[trakvora] WARNING: $envFile not found — relying on system environment variables"
}

# ── Change to backend directory ───────────────────────────────────────────────
Set-Location $PSScriptRoot

# ── Run Alembic migrations ────────────────────────────────────────────────────
Write-Host "[trakvora] Running database migrations..."
python -m alembic upgrade head
if ($LASTEXITCODE -ne 0) {
    Write-Error "[trakvora] Alembic migration failed. Aborting."
    exit 1
}
Write-Host "[trakvora] Migrations complete."

# ── Start uvicorn ─────────────────────────────────────────────────────────────
Write-Host "[trakvora] Starting FastAPI server on port 8000..."
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 4
