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
$faqItemPath = Join-Path $repoRoot 'components/FAQItem.tsx'
$source = Get-Content $faqItemPath -Raw

Assert-Contains $source 'const [detailedOverride, setDetailedOverride] = useState<boolean | null>(null);' 'Missing per-item detail override state.'
Assert-Contains $source 'const detailed = detailedOverride ?? globalDetailed;' 'Missing merged detailed mode state.'
Assert-Contains $source 'useEffect(() => { setDetailedOverride(null); }, [globalDetailed]);' 'Missing override reset when globalDetailed changes.'

Write-Host '[faq-detail-mode-contract] PASS'
