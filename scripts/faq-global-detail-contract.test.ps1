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
$faqListPath = Join-Path $repoRoot 'components/FAQList.tsx'
$source = Get-Content $faqListPath -Raw

Assert-Contains $source 'const handleToggleItem = useCallback((id: number): void => {' 'Missing item toggle handler.'
Assert-Contains $source 'if (globalDetailed) {' 'Detailed mode must branch before inline expansion.'
Assert-Contains $source 'const item = items.find((entry) => entry.id === id);' 'Detailed mode must resolve the clicked item.'
Assert-Contains $source 'if (item && onOpenItem) {' 'Detailed mode must open the parent modal when available.'
Assert-Contains $source 'onOpenItem(item);' 'Detailed mode must forward the clicked item to the modal opener.'
Assert-Contains $source 'return;' 'Detailed mode branch must skip inline expansion.'
Assert-Contains $source 'setOpenItems((prev) => {' 'Missing inline expand/collapse behavior.'

Write-Host '[faq-global-detail-contract] PASS'
