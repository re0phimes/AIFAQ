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
$faqPagePath = Join-Path $repoRoot 'app/FAQPage.tsx'
$source = Get-Content $faqPagePath -Raw

Assert-Contains $source 'const requestStartLocalHash = buildPrefsHash(toSnapshot(preferencesRef.current));' 'FAQPage should capture the local preference hash before fetching server preferences.'
Assert-Contains $source 'if (currentLocalHash !== requestStartLocalHash) {' 'FAQPage should detect local preference edits made while server sync is in flight.'
Assert-Contains $source 'const syncedCurrentPrefs = await patchRemotePreferences({' 'FAQPage should push the current local preferences when local edits win the race.'
Assert-Contains $source 'applyPreferencesLocalOnly(syncedCurrentPrefs);' 'FAQPage should normalize local state from the synced server response after resolving a sync race.'

Write-Host '[faq-preference-sync-race-contract] PASS'
