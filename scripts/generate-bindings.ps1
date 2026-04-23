# scripts/generate-bindings.ps1
# Requires soroban-cli to be installed

$RepoRoot = Resolve-Path "$PSScriptRoot\.."
Set-Location -Path $RepoRoot

# Build contract
Write-Host "Building contract..." -ForegroundColor Cyan
Set-Location -Path "apps/onchain"
cargo build --target wasm32-unknown-unknown --release
if ($LASTEXITCODE -ne 0) {
    Write-Host "Failed to build contract" -ForegroundColor Red
    exit $LASTEXITCODE
}
Set-Location -Path $RepoRoot

# Generate bindings
Write-Host "Generating TypeScript bindings..." -ForegroundColor Cyan
$WasmPath = "apps/onchain/target/wasm32-unknown-unknown/release/onchain.wasm"
$OutputDir = "apps/contract-bindings"

# Ensure output directory exists
if (-not (Test-Path $OutputDir)) {
    New-Item -ItemType Directory -Path $OutputDir
}

# Use full path to stellar.exe if not in PATH
$StellarExe = "C:\Program Files (x86)\Stellar CLI\stellar.exe"
if (-not (Test-Path $StellarExe)) {
    $StellarExe = "stellar" # Fallback to PATH
}

& $StellarExe contract bindings typescript `
    --wasm $WasmPath `
    --output-dir $OutputDir `
    --overwrite

if ($LASTEXITCODE -ne 0) {
    Write-Host "Failed to generate bindings" -ForegroundColor Red
    exit $LASTEXITCODE
}

Write-Host "Bindings generated successfully in $OutputDir" -ForegroundColor Green
