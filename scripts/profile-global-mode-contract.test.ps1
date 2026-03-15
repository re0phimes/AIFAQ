$ErrorActionPreference = 'Stop'

function Assert-Contains {
  param(
    [string]$Content,
    [string]$Needle,
    [string]$Message
  )

  if (-not $Content.Contains($Needle)) {
    throw $Message
  }
}

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot '..')
$profileClientPath = Join-Path $repoRoot 'app/profile/ProfileClient.tsx'
$source = Get-Content $profileClientPath -Raw

Assert-Contains $source 'function saveDefaultDetailedPreference(value: boolean): void {' 'ProfileClient should centralize defaultDetailed persistence.'
Assert-Contains $source 'localStorage.setItem("aifaq-defaultDetailed", String(value));' 'ProfileClient should keep the legacy defaultDetailed key in sync.'
Assert-Contains $source 'localStorage.setItem("aifaq-global-detailed", String(value));' 'ProfileClient should keep the globalDetailed legacy key in sync.'
Assert-Contains $source 'localStorage.setItem(' 'ProfileClient should persist updated defaultDetailed preferences.'
Assert-Contains $source '"aifaq-prefs-v2"' 'ProfileClient should update the shared preferences snapshot used by FAQPage.'
Assert-Contains $source 'const handleGlobalDetailedChange = useCallback((value: boolean) => {' 'ProfileClient should own global detail changes behind a single handler.'
Assert-Contains $source 'defaultDetailed: boolean;' 'SettingsTab should receive defaultDetailed from the parent source of truth.'
Assert-Contains $source 'onDefaultDetailedChange: (value: boolean) => void;' 'SettingsTab should dispatch detail mode updates upward.'

Write-Host '[profile-global-mode-contract] PASS'
