[CmdletBinding()]
param(
    # Run all TypeScript and Rust checks/builds/tests without launching the Tauri desktop app.
    [switch]$CheckOnly
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$projectRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$cargoManifest = 'src-tauri/Cargo.toml'

function Invoke-Step {
    param(
        [Parameter(Mandatory = $true)][string]$Label,
        [Parameter(Mandatory = $true)][string]$Executable,
        [Parameter()][string[]]$Arguments = @()
    )
    Write-Host "`n==> $Label" -ForegroundColor Cyan
    Write-Host "  `$ $Executable $($Arguments -join ' ')" -ForegroundColor DarkGray
    & $Executable @Arguments
    if ($LASTEXITCODE -ne 0) {
        throw "Step failed: $Label (exit code $LASTEXITCODE)"
    }
}

try {
    foreach ($tool in @('vp', 'cargo', 'rustc')) {
        if (-not (Get-Command $tool -ErrorAction SilentlyContinue)) {
            throw "Required tool '$tool' was not found. Ensure Vite+ (vp) and Rust (cargo, rustc) are on PATH."
        }
    }
    Push-Location -LiteralPath $projectRoot
    $previousCargoTargetDir = $env:CARGO_TARGET_DIR
    $env:CARGO_TARGET_DIR = Join-Path $projectRoot 'src-tauri/target'
    try {
        # 0. Install dependencies
        Invoke-Step -Label 'Install dependencies (TypeScript)' -Executable 'vp' -Arguments @('install', '--frozen-lockfile')

        # 1. Format (TypeScript + Rust)
        Invoke-Step -Label 'Format TypeScript codebase' -Executable 'vp' -Arguments @('fmt', '.')
        Invoke-Step -Label 'Format Rust codebase' -Executable 'cargo' -Arguments @('fmt', '--manifest-path', $cargoManifest)

        # 2. Lint & Static Checks (TypeScript + Rust)
        Invoke-Step -Label 'Lint and typecheck TypeScript codebase' -Executable 'vp' -Arguments @('check', '--no-fmt')
        Invoke-Step -Label 'Lint Rust codebase (Clippy)' -Executable 'cargo' -Arguments @('clippy', '--locked', '--manifest-path', $cargoManifest, '--all-targets', '--', '-D', 'warnings')

        # 3. Build (TypeScript + Rust/Tauri)
        Invoke-Step -Label 'Build TypeScript frontend' -Executable 'vp' -Arguments @('build')
        Invoke-Step -Label 'Build Rust/Tauri backend' -Executable 'cargo' -Arguments @('build', '--locked', '--manifest-path', $cargoManifest)

        # 4. Test (TypeScript + Rust)
        Invoke-Step -Label 'Run TypeScript tests' -Executable 'vp' -Arguments @('test')
        Invoke-Step -Label 'Run Rust tests' -Executable 'cargo' -Arguments @('test', '--locked', '--manifest-path', $cargoManifest)

        # 5. Launch Tauri desktop app
        if (-not $CheckOnly) {
            Invoke-Step -Label 'Start Tauri desktop application (Ctrl+C to stop)' -Executable 'vp' -Arguments @('exec', 'tauri', 'dev')
        }
    }
    finally {
        $env:CARGO_TARGET_DIR = $previousCargoTargetDir
        Pop-Location
    }
}
catch {
    Write-Error $_ -ErrorAction Continue
    exit 1
}
