param(
  [int]$FrontendPort = 5174,
  [int]$BackendPort = 5000,
  [int]$OcrPort = 8001,
  [string]$PostgresContainer = "ss360-postgres",
  [switch]$NoBrowser
)

$ErrorActionPreference = "Stop"

$RepoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$BackendRoot = Join-Path $RepoRoot "backend"
$OcrRoot = Join-Path $RepoRoot "ocr-service"
$LogRoot = Join-Path $RepoRoot "logs"
$PostgresImage = "postgres:16-alpine"
$PostgresVolume = "ss360-postgres-data"
$PostgresDatabase = "ss360_erp"
$PostgresUser = "postgres"
$PostgresPassword = "postgres"

New-Item -ItemType Directory -Force -Path $LogRoot | Out-Null

function Write-Step($message) {
  Write-Host ""
  Write-Host "==> $message" -ForegroundColor Cyan
}

function Write-Ok($message) {
  Write-Host "OK  $message" -ForegroundColor Green
}

function Write-Warn($message) {
  Write-Host "WARN $message" -ForegroundColor Yellow
}

function Get-ToolPath($names, $friendlyName) {
  foreach ($name in $names) {
    $command = Get-Command $name -ErrorAction SilentlyContinue
    if ($command) {
      return $command.Source
    }
  }

  throw "$friendlyName is required but was not found on PATH."
}

function Test-Http($url) {
  try {
    $response = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 4
    return ($response.StatusCode -ge 200 -and $response.StatusCode -lt 500)
  } catch {
    return $false
  }
}

function Wait-Http($name, $url, $timeoutSeconds) {
  $deadline = (Get-Date).AddSeconds($timeoutSeconds)
  while ((Get-Date) -lt $deadline) {
    if (Test-Http $url) {
      Write-Ok "$name is healthy at $url"
      return
    }

    Start-Sleep -Seconds 2
  }

  throw "$name did not become healthy at $url within $timeoutSeconds seconds."
}

function Get-PortOwner($port) {
  $connection = Get-NetTCPConnection -State Listen -LocalPort $port -ErrorAction SilentlyContinue |
    Select-Object -First 1

  if (-not $connection) {
    return $null
  }

  $process = Get-CimInstance Win32_Process -Filter "ProcessId=$($connection.OwningProcess)" -ErrorAction SilentlyContinue
  [PSCustomObject]@{
    Port = $port
    ProcessId = $connection.OwningProcess
    Name = $process.Name
    CommandLine = $process.CommandLine
  }
}

function Assert-PortAvailableOrHealthy($name, $port, $healthUrl) {
  if (Test-Http $healthUrl) {
    Write-Ok "$name is already running on port $port"
    return $true
  }

  $owner = Get-PortOwner $port
  if ($owner) {
    throw "$name port $port is already occupied by PID $($owner.ProcessId) ($($owner.Name)), but $healthUrl is not healthy. Command: $($owner.CommandLine)"
  }

  return $false
}

function Start-LoggedProcess($name, $filePath, $arguments, $workingDirectory, $logName) {
  $outLog = Join-Path $LogRoot "$logName.out.log"
  $errLog = Join-Path $LogRoot "$logName.err.log"

  Remove-Item -LiteralPath $outLog, $errLog -Force -ErrorAction SilentlyContinue

  $process = Start-Process `
    -FilePath $filePath `
    -ArgumentList $arguments `
    -WorkingDirectory $workingDirectory `
    -WindowStyle Hidden `
    -RedirectStandardOutput $outLog `
    -RedirectStandardError $errLog `
    -PassThru

  Write-Ok "Started $name as PID $($process.Id)"
  Write-Host "    stdout: $outLog"
  Write-Host "    stderr: $errLog"
}

function Ensure-NodeDependencies($path, $name) {
  if (-not (Test-Path (Join-Path $path "node_modules"))) {
    throw "$name dependencies are missing. Run npm install in $path before using the one-click launcher."
  }
}

function Ensure-OcrPython($ocrRoot) {
  $venvPython = Join-Path $ocrRoot ".venv\Scripts\python.exe"
  if (Test-Path $venvPython) {
    return $venvPython
  }

  Write-Warn "OCR virtual environment was not found at ocr-service\.venv. Falling back to python on PATH."
  return Get-ToolPath @("python.exe", "python") "Python"
}

function Invoke-Prisma {
  param([string[]]$PrismaArguments)

  $npx = Get-ToolPath @("npx.cmd", "npx") "npx"
  Push-Location $BackendRoot
  try {
    & $npx @PrismaArguments
    if ($LASTEXITCODE -ne 0) {
      throw "Prisma command failed: npx $($PrismaArguments -join ' ')"
    }
  } finally {
    Pop-Location
  }
}

function Ensure-Postgres {
  Write-Step "Checking PostgreSQL"

  $docker = Get-Command docker -ErrorAction SilentlyContinue
  if (-not $docker) {
    $owner = Get-PortOwner 5432
    if ($owner) {
      Write-Warn "Docker was not found, but something is listening on PostgreSQL port 5432."
      return
    }

    throw "Docker is required to start local PostgreSQL automatically."
  }

  $existingContainer = docker ps -a --filter "name=^/$PostgresContainer$" --format "{{.Names}}"
  if ($existingContainer -eq $PostgresContainer) {
    $runningContainer = docker ps --filter "name=^/$PostgresContainer$" --format "{{.Names}}"
    if ($runningContainer -eq $PostgresContainer) {
      Write-Ok "PostgreSQL container $PostgresContainer is already running"
    } else {
      docker start $PostgresContainer | Out-Null
      Write-Ok "Started PostgreSQL container $PostgresContainer"
    }
  } else {
    docker run `
      --name $PostgresContainer `
      -e "POSTGRES_USER=$PostgresUser" `
      -e "POSTGRES_PASSWORD=$PostgresPassword" `
      -e "POSTGRES_DB=$PostgresDatabase" `
      -p "5432:5432" `
      -v "$PostgresVolume`:/var/lib/postgresql/data" `
      -d $PostgresImage | Out-Null
    Write-Ok "Created and started PostgreSQL container $PostgresContainer"
  }

  $ready = $false
  for ($index = 0; $index -lt 45; $index += 1) {
    docker exec $PostgresContainer pg_isready -U $PostgresUser -d $PostgresDatabase | Out-Null
    if ($LASTEXITCODE -eq 0) {
      $ready = $true
      break
    }

    Start-Sleep -Seconds 1
  }

  if (-not $ready) {
    docker logs --tail 60 $PostgresContainer
    throw "PostgreSQL did not become ready."
  }

  Write-Ok "PostgreSQL is accepting connections on localhost:5432"
}

function Ensure-BackendDatabase {
  Write-Step "Preparing Prisma client and database migrations"
  Invoke-Prisma -PrismaArguments @("prisma", "generate")
  Invoke-Prisma -PrismaArguments @("prisma", "migrate", "deploy")
  Write-Ok "Database schema is ready"
}

function Start-OcrService {
  Write-Step "Checking OCR service"
  $healthUrl = "http://127.0.0.1:$OcrPort/health"

  if (Assert-PortAvailableOrHealthy "OCR service" $OcrPort $healthUrl) {
    return
  }

  $python = Ensure-OcrPython $OcrRoot
  Start-LoggedProcess `
    -name "OCR service" `
    -filePath $python `
    -arguments @("-m", "uvicorn", "main:app", "--host", "127.0.0.1", "--port", "$OcrPort") `
    -workingDirectory $OcrRoot `
    -logName "ocr"

  Wait-Http "OCR service" $healthUrl 120
}

function Start-BackendService {
  Write-Step "Checking backend API"
  $healthUrl = "http://127.0.0.1:$BackendPort/health"

  if (Assert-PortAvailableOrHealthy "Backend API" $BackendPort $healthUrl) {
    return
  }

  $npm = Get-ToolPath @("npm.cmd", "npm") "npm"
  Start-LoggedProcess `
    -name "Backend API" `
    -filePath $npm `
    -arguments @("run", "start") `
    -workingDirectory $BackendRoot `
    -logName "backend"

  Wait-Http "Backend API" $healthUrl 60
}

function Start-FrontendService {
  Write-Step "Checking frontend"
  $healthUrl = "http://127.0.0.1:$FrontendPort/"

  if (Assert-PortAvailableOrHealthy "Frontend" $FrontendPort $healthUrl) {
    return
  }

  $npm = Get-ToolPath @("npm.cmd", "npm") "npm"
  Start-LoggedProcess `
    -name "Frontend" `
    -filePath $npm `
    -arguments @("run", "dev", "--", "--host", "127.0.0.1", "--port", "$FrontendPort") `
    -workingDirectory $RepoRoot `
    -logName "frontend"

  Wait-Http "Frontend" $healthUrl 60
}

function Test-ErpRoutes {
  Write-Step "Smoke testing ERP routes"
  $routes = @("/", "/suppliers", "/inventory", "/inventory/intake", "/inventory/invoices", "/production", "/customers", "/sales", "/shipping")

  foreach ($route in $routes) {
    $url = "http://127.0.0.1:$FrontendPort$route"
    if (-not (Test-Http $url)) {
      throw "Route smoke test failed for $url"
    }
    Write-Ok "$route returned HTTP success"
  }
}

try {
  Write-Host "SS360 ERP one-click launcher" -ForegroundColor Cyan
  Write-Host "Repository: $RepoRoot"

  Ensure-NodeDependencies $RepoRoot "Frontend"
  Ensure-NodeDependencies $BackendRoot "Backend"
  Ensure-Postgres
  Ensure-BackendDatabase
  Start-OcrService
  Start-BackendService
  Start-FrontendService
  Test-ErpRoutes

  $appUrl = "http://127.0.0.1:$FrontendPort/inventory"
  Write-Step "System ready"
  Write-Ok "Frontend: http://127.0.0.1:$FrontendPort/"
  Write-Ok "Backend:  http://127.0.0.1:$BackendPort/health"
  Write-Ok "OCR:      http://127.0.0.1:$OcrPort/health"
  Write-Ok "Postgres: localhost:5432 via Docker container $PostgresContainer"

  if (-not $NoBrowser) {
    Start-Process $appUrl
    Write-Ok "Opened $appUrl"
  } else {
    Write-Ok "Open $appUrl"
  }
} catch {
  Write-Host ""
  Write-Host "SS360 launch failed:" -ForegroundColor Red
  Write-Host $_.Exception.Message -ForegroundColor Red
  Write-Host ""
  Write-Host "Check logs in: $LogRoot" -ForegroundColor Yellow
  exit 1
}
