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
Assert-Contains $source '<span className="text-[10px]">{"\u2197"}</span>' 'Missing valid external-link glyph span.'
Assert-Contains $source '{lang === "zh" ? "AI/ML \u5e38\u89c1\u95ee\u9898\u77e5\u8bc6\u5e93" : "AI/ML FAQ Knowledge Base"}' 'Missing valid FAQ title copy.'
Assert-Contains $source '{"\u4e2d\u6587"}' 'Missing valid Chinese language label.'
Assert-Contains $source '<span className="mr-1">{"\u2605"}</span>' 'Missing valid focus star glyph span.'

Write-Host '[faq-toolbar-layout-contract] PASS'
