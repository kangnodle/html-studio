[CmdletBinding()]
param(
    [ValidateSet('x64', 'arm64', 'all')]
    [string]$Architecture = 'x64'
)

$ErrorActionPreference = 'Stop'
$projectRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))

function Invoke-ReleaseStep {
    param([string]$Label, [string]$Executable, [string[]]$CommandArgs)
    Write-Host ''
    Write-Host "==> $Label" -ForegroundColor Cyan
    & $Executable @CommandArgs
    if ($LASTEXITCODE -ne 0) {
        throw "Step failed: $Label (exit code $LASTEXITCODE)"
    }
}

function Assert-BuildExecutableNotRunning {
    param([string]$ExecutablePath)
    $runningProcesses = @(Get-CimInstance Win32_Process -Filter "Name = 'html-studio.exe'" |
        Where-Object { $_.ExecutablePath -and [string]::Equals($_.ExecutablePath, $ExecutablePath, [StringComparison]::OrdinalIgnoreCase) })
    if ($runningProcesses.Count -gt 0) {
        $processIds = ($runningProcesses.ProcessId -join ', ')
        throw "HTML Studio is running from the build output (PID: $processIds): $ExecutablePath. Save your edits and close this app, then rerun release.ps1. Windows locks running EXE files; the release script will not force-stop the app and lose unsaved edits."
    }
}

try {
    if ([Environment]::OSVersion.Platform -ne [PlatformID]::Win32NT) {
        throw 'This release script must run on Windows.'
    }
    foreach ($requiredCommand in @('vp', 'cargo', 'rustup')) {
        if (-not (Get-Command $requiredCommand -ErrorAction SilentlyContinue)) {
            throw "$requiredCommand is required. Install Vite+ and Rust, and ensure they are on PATH."
        }
    }
    Push-Location -LiteralPath $projectRoot
    $previousCargoTargetDirectory = $env:CARGO_TARGET_DIR
    $env:CARGO_TARGET_DIR = Join-Path $projectRoot 'src-tauri/target'
    try {
        $package = Get-Content -Raw -LiteralPath (Join-Path $projectRoot 'package.json') | ConvertFrom-Json
        $cargoManifestPath = Join-Path $projectRoot 'src-tauri/Cargo.toml'
        $architectures = if ($Architecture -eq 'all') { @('x64', 'arm64') } else { @($Architecture) }
        $targets = @{ x64 = 'x86_64-pc-windows-msvc'; arm64 = 'aarch64-pc-windows-msvc' }

        foreach ($targetArchitecture in $architectures) {
            Assert-BuildExecutableNotRunning -ExecutablePath (Join-Path $projectRoot "src-tauri/target/$($targets[$targetArchitecture])/release/html-studio.exe")
        }

        Invoke-ReleaseStep -Label 'Install locked JS dependencies' -Executable vp -CommandArgs @('install', '--frozen-lockfile')
        Invoke-ReleaseStep -Label 'Format TypeScript, CSS and configuration' -Executable vp -CommandArgs @('fmt', '.')
        Invoke-ReleaseStep -Label 'Format Rust' -Executable cargo -CommandArgs @('fmt', '--manifest-path', $cargoManifestPath)
        Invoke-ReleaseStep -Label 'Check lint and types' -Executable vp -CommandArgs @('check', '--no-fmt')
        Invoke-ReleaseStep -Label 'Build frontend' -Executable vp -CommandArgs @('build')
        Invoke-ReleaseStep -Label 'Run frontend tests' -Executable vp -CommandArgs @('test')
        Invoke-ReleaseStep -Label 'Run Rust tests' -Executable cargo -CommandArgs @('test', '--locked', '--manifest-path', $cargoManifestPath)

        foreach ($targetArchitecture in $architectures) {
            $rustTarget = $targets[$targetArchitecture]
            Invoke-ReleaseStep -Label "Ensure Rust target ($rustTarget)" -Executable rustup -CommandArgs @('target', 'add', $rustTarget)
            $buildTargetDirectory = Join-Path $projectRoot "src-tauri/target/$rustTarget"
            Assert-BuildExecutableNotRunning -ExecutablePath (Join-Path $buildTargetDirectory 'release/html-studio.exe')
            # The frontend was built above; suppress only the duplicate beforeBuild hook.
            # Explicit Cargo paths ignore caller CARGO_TARGET_DIR.
            Invoke-ReleaseStep -Label "Build Tauri NSIS installer ($targetArchitecture)" -Executable vp -CommandArgs @(
                'exec', 'tauri', 'build', '--bundles', 'nsis', '--target', $rustTarget,
                '--config', '{"build":{"beforeBuildCommand":""}}',
                '--', '--locked', '--target-dir', (Join-Path $projectRoot 'src-tauri/target')
            )
            $bundleDirectory = Join-Path $buildTargetDirectory 'release/bundle/nsis'
            $installerCandidates = @(Get-ChildItem -LiteralPath $bundleDirectory -Filter "*$($package.version)*-setup.exe")
            if ($installerCandidates.Count -ne 1) {
                throw "Expected exactly one Tauri installer in $bundleDirectory, found $($installerCandidates.Count)."
            }
            $outputDirectory = Join-Path $projectRoot "release/$targetArchitecture"
            New-Item -ItemType Directory -Path $outputDirectory -Force | Out-Null
            $installerName = "HTML-Studio-$($package.version)-$targetArchitecture-Setup.exe"
            $installerPath = Join-Path $outputDirectory $installerName
            Copy-Item -LiteralPath $installerCandidates[0].FullName -Destination $installerPath -Force
            $hash = (Get-FileHash -LiteralPath $installerPath -Algorithm SHA256).Hash.ToLowerInvariant()
            [System.IO.File]::WriteAllText("$installerPath.sha256", "$hash  $installerName$([Environment]::NewLine)", [System.Text.UTF8Encoding]::new($false))
            $manifest = [ordered]@{
                product = 'HTML Studio'
                version = $package.version
                framework = 'Tauri'
                platform = 'Windows 11'
                architecture = $targetArchitecture
                rustTarget = $rustTarget
                installer = $installerName
                sha256 = $hash
                sizeBytes = (Get-Item -LiteralPath $installerPath).Length
                builtAtUtc = [DateTime]::UtcNow.ToString('o')
            } | ConvertTo-Json
            [System.IO.File]::WriteAllText((Join-Path $outputDirectory 'release-manifest.json'), "$manifest$([Environment]::NewLine)", [System.Text.UTF8Encoding]::new($false))
            Write-Host "Installer: $installerPath" -ForegroundColor Green
            Write-Host "SHA256: $hash"
        }
        Write-Host ''
        Write-Host 'Release complete. Installers are unsigned unless Windows signing is configured.' -ForegroundColor Green
    }
    finally {
        $env:CARGO_TARGET_DIR = $previousCargoTargetDirectory
        Pop-Location
    }
}
catch {
    Write-Error $_ -ErrorAction Continue
    exit 1
}
