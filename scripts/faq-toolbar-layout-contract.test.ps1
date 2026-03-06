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

Assert-Contains $source '<div className="flex flex-wrap items-start justify-between gap-3">' 'Missing wrapping toolbar shell.'
Assert-Contains $source '<div className="min-w-0 flex-1">' 'Missing flexible left toolbar region.'
Assert-Contains $source '<div className="flex flex-wrap items-center gap-2">' 'Missing wrapping toolbar action cluster.'
Assert-Contains $source '<div className="shrink-0 text-xs text-subtext sm:text-right">' 'Missing dedicated pagination summary block.'
Assert-Contains $source '{paginationInfo(sorted.length, safePage, totalPages, lang)}' 'Missing pagination summary content.'

Write-Host '[faq-toolbar-layout-contract] PASS'
