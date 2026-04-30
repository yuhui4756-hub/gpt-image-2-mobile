$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$uploadRoot = Join-Path (Split-Path -Parent $projectRoot) "GPT-image-2.0-deno-upload"
$distSource = Join-Path $projectRoot "dist"
$distTarget = Join-Path $uploadRoot "dist"

if (-not (Test-Path $distSource)) {
    throw "dist folder not found. Run npm run build in the project root first."
}

if (Test-Path $uploadRoot) {
    Remove-Item -LiteralPath $uploadRoot -Recurse -Force
}

New-Item -ItemType Directory -Path $uploadRoot | Out-Null
New-Item -ItemType Directory -Path $distTarget | Out-Null

Copy-Item -LiteralPath (Join-Path $projectRoot "deno-deploy-app.mjs") -Destination $uploadRoot
Copy-Item -LiteralPath (Join-Path $projectRoot "deno.json") -Destination $uploadRoot
Copy-Item -LiteralPath (Join-Path $distSource "*") -Destination $distTarget -Recurse

$readme = @"
This is the clean upload folder for Deno Deploy.

Run this command inside this folder:
deno deploy . --org yuhui4756 --app gpt-image-2-mobile-deno --prod
"@

Set-Content -LiteralPath (Join-Path $uploadRoot "DEPLOY.txt") -Value $readme -Encoding UTF8

Write-Host "Clean upload folder created: $uploadRoot"
Write-Host "Next, enter that folder and run:"
Write-Host "deno deploy . --org yuhui4756 --app gpt-image-2-mobile-deno --prod"
