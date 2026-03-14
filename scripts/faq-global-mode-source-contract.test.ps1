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

function Assert-NotContains {
  param(
    [string]$Content,
    [string]$Needle,
    [string]$Message
  )

  if ($Content.Contains($Needle)) {
    throw $Message
  }
}

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot '..')
$faqListPath = Join-Path $repoRoot 'components/FAQList.tsx'
$faqPagePath = Join-Path $repoRoot 'app/FAQPage.tsx'
$faqList = Get-Content $faqListPath -Raw
$faqPage = Get-Content $faqPagePath -Raw

Assert-Contains $faqList 'globalDetailed: boolean;' 'FAQList should receive globalDetailed from its parent.'
Assert-Contains $faqList 'onGlobalDetailedChange?: (value: boolean) => void;' 'FAQList should dispatch global detail changes upward.'
Assert-NotContains $faqList 'const [globalDetailed, setGlobalDetailed] = useState' 'FAQList must not keep its own globalDetailed state.'
Assert-NotContains $faqList 'initialGlobalDetailed?: boolean;' 'FAQList should not treat global detail as initialization-only state.'
Assert-NotContains $faqList 'setGlobalDetailed(initialGlobalDetailed);' 'FAQList must not resync global detail from an init prop.'
Assert-Contains $faqPage 'globalDetailed={preferences.defaultDetailed ?? false}' 'FAQPage should provide the global detail source of truth.'
Assert-Contains $faqPage 'onGlobalDetailedChange={(value) => {' 'FAQPage should own global detail updates.'

Write-Host '[faq-global-mode-source-contract] PASS'
