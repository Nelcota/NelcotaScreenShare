param(
    [switch]$Publish,
    [int]$PullRequest = 0
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$PSNativeCommandUseErrorActionPreference = $false

if ($Publish -and $PullRequest -lt 1) {
    throw 'Publishing requires -PullRequest with the PR number.'
}

$taskRequiredCommands = @('git', 'node', 'pnpm', 'docker')
if ($Publish) { $taskRequiredCommands += 'gh' }
foreach ($taskCommand in $taskRequiredCommands) {
    if (-not (Get-Command $taskCommand -ErrorAction SilentlyContinue)) {
        throw "Install $taskCommand before running local CI."
    }
}

$taskRepository = 'Nelcota/NelcotaScreenShare'
$taskRoot = Split-Path -Parent $PSScriptRoot
$taskOriginalDatabaseUrl = $env:TEST_DATABASE_URL
$taskResults = [System.Collections.Generic.List[object]]::new()
$taskCurrentContext = $null
$taskCurrentLog = $null
$taskReceiptPath = $null
Push-Location $taskRoot

function Invoke-LocalCommand {
    param([string]$Program, [string[]]$CommandArguments)
    Write-Host "> $Program $($CommandArguments -join ' ')"
    & $Program @CommandArguments 2>&1 | Tee-Object -FilePath $taskCurrentLog -Append
    if ($LASTEXITCODE -ne 0) {
        throw "$Program failed with exit code $LASTEXITCODE. See $taskCurrentLog."
    }
}

function Assert-VerifiedCommit {
    if ((& git rev-parse HEAD).Trim() -ne $taskSha) {
        throw 'HEAD changed during validation. Run CI again on the new commit.'
    }
    if ((& git status --porcelain)) {
        throw 'Publishing requires a clean working tree, including untracked project files.'
    }
    $taskPr = & gh pr view $PullRequest --repo $taskRepository --json headRefOid,url |
        ConvertFrom-Json
    if ($LASTEXITCODE -ne 0 -or $taskPr.headRefOid -ne $taskSha) {
        throw 'The PR head must match the exact commit validated locally.'
    }
}

function Set-LocalStatus {
    param([string]$Context, [string]$State, [string]$Description)
    if (-not $Publish) { return }
    & gh api --method POST "repos/$taskRepository/statuses/$taskSha" --silent `
        -f "context=$Context" -f "state=$State" -f "description=$Description" `
        -f "target_url=$taskPrUrl"
    if ($LASTEXITCODE -ne 0) { throw "Could not publish $Context." }
}

function Save-LocalReceipt {
    if (-not $taskReceiptPath) { return }
    [PSCustomObject]@{
        commit = $taskSha
        node = $taskNodeVersion
        platform = [Environment]::OSVersion.ToString()
        working_tree_clean = -not [bool](& git status --porcelain)
        results = $taskResults.ToArray()
    } | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath $taskReceiptPath -Encoding utf8
}

try {
    $taskNodeVersion = (& node --version).Trim()
    if ([version]$taskNodeVersion.TrimStart('v') -lt [version]'26.9.0') {
        throw 'Local CI requires Node 26.9 or newer.'
    }
    $taskSha = (& git rev-parse HEAD).Trim()
    if ($LASTEXITCODE -ne 0) { throw 'Run local CI inside the Git repository.' }

    # Read only the disposable test database setting; never print its credentials.
    $taskDatabaseLookup = @'
import { existsSync, readFileSync } from 'node:fs';
import { parseEnv } from 'node:util';
const local = existsSync('.env.local') ? parseEnv(readFileSync('.env.local', 'utf8')) : {};
process.stdout.write(process.env.TEST_DATABASE_URL || local.TEST_DATABASE_URL || '');
'@
    $taskDatabaseUrl = & node --input-type=module -e $taskDatabaseLookup
    if ($LASTEXITCODE -ne 0 -or -not $taskDatabaseUrl) {
        throw 'Set TEST_DATABASE_URL to a disposable Postgres database. Integration and E2E checks are mandatory.'
    }
    $env:TEST_DATABASE_URL = $taskDatabaseUrl

    $taskPrUrl = ''
    if ($Publish) {
        Assert-VerifiedCommit
        & git fetch origin main
        if ($LASTEXITCODE -ne 0) { throw 'Could not fetch main.' }
        & git merge-base --is-ancestor origin/main HEAD
        if ($LASTEXITCODE -ne 0) { throw 'Rebase onto origin/main before publishing local checks.' }
        $taskPrUrl = (& gh pr view $PullRequest --repo $taskRepository --json url --jq '.url').Trim()
        if ($LASTEXITCODE -ne 0) { throw 'Could not resolve the PR.' }
    }

    $taskLogDirectory = Join-Path $taskRoot "output/local-ci/$taskSha"
    New-Item -ItemType Directory -Path $taskLogDirectory -Force | Out-Null
    $taskReceiptPath = Join-Path $taskLogDirectory 'results.json'
    $taskJobs = @(
        @{
            Key = 'quality'; Context = 'Local CI / quality'
            Commands = @(
                @{ Program = 'pnpm'; Arguments = @('format:check') },
                @{ Program = 'pnpm'; Arguments = @('lint') },
                @{ Program = 'pnpm'; Arguments = @('typecheck') },
                @{ Program = 'pnpm'; Arguments = @('knip') },
                @{ Program = 'pnpm'; Arguments = @('dup') },
                @{ Program = 'pnpm'; Arguments = @('db:generate') },
                @{ Program = 'pnpm'; Arguments = @('audit', '--prod', '--audit-level=high') }
            )
        },
        @{
            Key = 'tests'; Context = 'Local CI / tests'
            Commands = @(@{ Program = 'pnpm'; Arguments = @('test:coverage') })
        },
        @{
            Key = 'build'; Context = 'Local CI / build'
            Commands = @(@{
                Program = 'docker'
                Arguments = @('build', '--build-arg', "APP_VERSION=$taskSha", '--tag', "nelcota-local-ci:$taskSha", '.')
            })
        },
        @{
            Key = 'e2e'; Context = 'Local CI / e2e'
            Commands = @(
                @{ Program = 'pnpm'; Arguments = @('exec', 'playwright', 'install', 'chromium') },
                @{ Program = 'pnpm'; Arguments = @('test:e2e') }
            )
        }
    )
    foreach ($taskJob in $taskJobs) {
        Set-LocalStatus $taskJob.Context 'pending' 'Waiting for full local validation; no GitHub-hosted runner.'
    }

    foreach ($taskJob in $taskJobs) {
        $taskCurrentContext = $taskJob.Context
        $taskCurrentLog = Join-Path $taskLogDirectory "$($taskJob.Key).log"
        Set-Content -LiteralPath $taskCurrentLog -Value "Commit: $taskSha" -Encoding utf8
        $taskStartedAt = [DateTimeOffset]::UtcNow
        Write-Host "Running $taskCurrentContext on $taskSha"
        foreach ($taskStep in $taskJob.Commands) {
            Invoke-LocalCommand $taskStep.Program $taskStep.Arguments
        }
        if ($taskJob.Key -eq 'quality' -and (& git status --porcelain -- drizzle)) {
            throw 'Schema generation changed drizzle files. Commit the migrations and run CI again.'
        }
        if ($Publish) { Assert-VerifiedCommit }
        $taskResults.Add([PSCustomObject]@{
            context = $taskCurrentContext
            state = 'success'
            started_at = $taskStartedAt.ToString('o')
            completed_at = [DateTimeOffset]::UtcNow.ToString('o')
            log = $taskCurrentLog
        })
        Save-LocalReceipt
        Set-LocalStatus $taskCurrentContext 'success' "Passed locally on Node $taskNodeVersion; receipt in output/local-ci/$taskSha."
        $taskCurrentContext = $null
    }
    Write-Host "All local checks passed. Receipt: $taskReceiptPath"
} catch {
    if ($taskCurrentContext) {
        $taskResults.Add([PSCustomObject]@{
            context = $taskCurrentContext
            state = 'failure'
            completed_at = [DateTimeOffset]::UtcNow.ToString('o')
            log = $taskCurrentLog
        })
        Save-LocalReceipt
        Set-LocalStatus $taskCurrentContext 'failure' 'Local validation failed. Review the local log before merging.'
    }
    throw
} finally {
    $env:TEST_DATABASE_URL = $taskOriginalDatabaseUrl
    Pop-Location
}
