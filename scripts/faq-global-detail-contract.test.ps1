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
$source = Get-Content $faqListPath -Raw

Assert-Contains $source 'const handleToggleItem = useCallback((id: number): void => {' 'Missing item toggle handler.'
Assert-Contains $source 'setOpenItems((prev) => {' 'Missing inline expand/collapse behavior.'
Assert-NotContains $source 'if (globalDetailedRef.current) {' 'Global detail mode must not hijack item click behavior.'
Assert-NotContains $source 'const item = itemsRef.current.find((i) => i.id === id);' 'Item click handler should not resolve modal item from a ref.'
Assert-NotContains $source 'if (item && onOpenItem) {' 'Item click handler should not open modal directly from global detail mode.'

Write-Host '[faq-global-detail-contract] PASS'
