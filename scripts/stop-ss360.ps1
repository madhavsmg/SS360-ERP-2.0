param(
  [int[]]$Ports = @(5174, 5000, 8001),
  [string]$PostgresContainer = "ss360-postgres",
  [switch]$StopDatabase
)

$ErrorActionPreference = "Stop"
$RepoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")

function Write-Ok($message) {
  Write-Host "OK  $message" -ForegroundColor Green
}

function Write-Warn($message) {
  Write-Host "WARN $message" -ForegroundColor Yellow
}

function Get-PortOwners($port) {
  $connections = Get-NetTCPConnection -State Listen -LocalPort $port -ErrorAction SilentlyContinue
  foreach ($connection in $connections) {
    $process = Get-CimInstance Win32_Process -Filter "ProcessId=$($connection.OwningProcess)" -ErrorAction SilentlyContinue
    [PSCustomObject]@{
      Port = $port
      ProcessId = $connection.OwningProcess
      Name = $process.Name
      CommandLine = $process.CommandLine
    }
  }
}

function Test-OwnedBySs360($owner) {
  $commandLine = [string]$owner.CommandLine
  $repo = [string]$RepoRoot

  return (
    $commandLine.Contains($repo) -or
    $commandLine.Contains("src/server.js") -or
    $commandLine.Contains("uvicorn main:app")
  )
}

Write-Host "Stopping SS360 frontend, backend, and OCR services..." -ForegroundColor Cyan

$stopped = @{}
foreach ($port in $Ports) {
  $owners = Get-PortOwners $port
  if (-not $owners) {
    Write-Ok "No process is listening on port $port"
    continue
  }

  foreach ($owner in $owners) {
    if ($stopped.ContainsKey($owner.ProcessId)) {
      continue
    }

    if (-not (Test-OwnedBySs360 $owner)) {
      Write-Warn "Skipped PID $($owner.ProcessId) on port $port because it does not look like an SS360 process."
      Write-Warn "Command: $($owner.CommandLine)"
      continue
    }

    Stop-Process -Id $owner.ProcessId -Force
    $stopped[$owner.ProcessId] = $true
    Write-Ok "Stopped PID $($owner.ProcessId) on port $port"
  }
}

if ($StopDatabase) {
  $docker = Get-Command docker -ErrorAction SilentlyContinue
  if (-not $docker) {
    Write-Warn "Docker was not found, so the PostgreSQL container was not stopped."
  } else {
    $running = docker ps --filter "name=^/$PostgresContainer$" --format "{{.Names}}"
    if ($running -eq $PostgresContainer) {
      docker stop $PostgresContainer | Out-Null
      Write-Ok "Stopped PostgreSQL container $PostgresContainer"
    } else {
      Write-Ok "PostgreSQL container $PostgresContainer is not running"
    }
  }
} else {
  Write-Warn "PostgreSQL was left running for faster next startup."
  Write-Warn "To stop it too, run: powershell -File scripts\stop-ss360.ps1 -StopDatabase"
}
