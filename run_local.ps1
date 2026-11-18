# Starts Reconcile Core Engine without Docker (Windows PowerShell 5.1 or later).
# Requires Python 3.13+ and Node.js 20.19+ on PATH.
# Backend: http://127.0.0.1:8001   UI: http://127.0.0.1:5174

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$backend = Join-Path $root 'backend'
$frontend = Join-Path $root 'frontend'

foreach ($tool in 'python', 'npm') {
    if (-not (Get-Command $tool -ErrorAction SilentlyContinue)) {
        throw "$tool was not found on PATH. Install it and run this script again."
    }
}
python -c "import sys; sys.exit(sys.version_info < (3, 13))"
if ($LASTEXITCODE -ne 0) { throw "Python 3.13+ is required; found $(python --version 2>&1)." }

# "Does pip work" rather than "does the folder exist": a half-built environment
# left by an interrupted run is rebuilt instead of being kept forever.
$venvDir = Join-Path $backend '.venv'
$venvPython = Join-Path $venvDir 'Scripts\python.exe'
$venvReady = $false
if (Test-Path $venvPython) {
    # Windows PowerShell 5.1 turns redirected stderr of a native command into a
    # terminating error under 'Stop'. A missing pip writes to stderr, so the
    # preference is relaxed for this one probe and the exit code decides.
    $ErrorActionPreference = 'SilentlyContinue'
    & $venvPython -m pip --version *> $null
    $venvReady = ($LASTEXITCODE -eq 0)
    $ErrorActionPreference = 'Stop'
}
if (-not $venvReady) {
    Write-Host 'Creating Python virtual environment...'
    if (Test-Path $venvDir) { Remove-Item -Recurse -Force $venvDir }
    python -m venv $venvDir
    if ($LASTEXITCODE -ne 0) { throw 'Could not create the virtual environment.' }
}

Write-Host 'Installing backend dependencies...'
& $venvPython -m pip install --quiet --disable-pip-version-check -r (Join-Path $backend 'requirements.txt')
if ($LASTEXITCODE -ne 0) { throw 'Backend dependency installation failed.' }

# If something already listens on port 8001, the health check below could be
# answered by that other program, so refuse to start instead.
$probe = New-Object System.Net.Sockets.TcpClient
try {
    $probe.Connect('127.0.0.1', 8001)
    $portInUse = $true
}
catch { $portInUse = $false }
finally { $probe.Close() }
if ($portInUse) { throw 'Port 8001 is already in use. Stop the program using it and run this script again.' }

Write-Host 'Starting backend on http://127.0.0.1:8001 ...'
# One worker only: the batch lives in memory and must be shared by all clients.
$apiArgs = @(
    '-m', 'uvicorn', 'app.main:app',
    '--host', '127.0.0.1', '--port', '8001',
    '--workers', '1', '--timeout-graceful-shutdown', '3'
)
$api = Start-Process -FilePath $venvPython -ArgumentList $apiArgs `
    -WorkingDirectory $backend -PassThru -NoNewWindow

try {
    # Fail fast if the backend did not come up. The process is checked as well as
    # the port, and the probe ignores proxy settings: a proxy variable (often set
    # so pip can download packages) must not hide a healthy local backend.
    $startupSeconds = 30
    $healthProbe = "import urllib.request; urllib.request.build_opener(urllib.request.ProxyHandler({})).open('http://127.0.0.1:8001/api/v1/health', timeout=1)"
    $deadline = (Get-Date).AddSeconds($startupSeconds)
    $healthy = $false
    while (-not $healthy -and (Get-Date) -lt $deadline) {
        if ($api.HasExited) {
            throw 'The backend stopped during start-up. See its error message above.'
        }
        $ErrorActionPreference = 'SilentlyContinue'
        & $venvPython -c $healthProbe *> $null
        $healthy = ($LASTEXITCODE -eq 0)
        $ErrorActionPreference = 'Stop'
        if (-not $healthy) { Start-Sleep -Milliseconds 500 }
    }
    if (-not $healthy) {
        throw "The backend did not answer on http://127.0.0.1:8001 within $startupSeconds seconds."
    }

    Push-Location $frontend
    try {
        # npm writes this marker when an install completes, so an interrupted
        # install is repeated instead of being mistaken for a finished one.
        if (-not (Test-Path 'node_modules\.package-lock.json')) {
            Write-Host 'Installing frontend dependencies...'
            npm ci --no-fund --no-audit
            if ($LASTEXITCODE -ne 0) { throw 'Frontend dependency installation failed.' }
        }
        Write-Host ''
        Write-Host 'Open http://127.0.0.1:5174 in your browser. Press Ctrl+C to stop.'
        Write-Host ''
        npm run dev
    }
    finally {
        Pop-Location
    }
}
finally {
    if ($api -and -not $api.HasExited) {
        # /T also stops the interpreter started by the virtual environment launcher.
        taskkill /PID $api.Id /T /F | Out-Null
    }
}
