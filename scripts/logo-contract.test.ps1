$ErrorActionPreference = "Stop"

function Assert-Match {
  param(
    [string]$Content,
    [string]$Pattern,
    [string]$Message
  )

  if ($Content -notmatch $Pattern) {
    throw $Message
  }
}

$globalsCss = Get-Content 'app/globals.css' -Raw
$brandLogo = Get-Content 'components/BrandLogo.tsx' -Raw
$homePage = Get-Content 'app/page.tsx' -Raw

Assert-Match $globalsCss '--app-color-brand-ai:' 'Missing brand AI color token in app/globals.css.'
Assert-Match $globalsCss '--app-color-brand-faq:' 'Missing brand FAQ color token in app/globals.css.'
Assert-Match $brandLogo 'href="/#top"' 'BrandLogo should link to /#top.'
Assert-Match $brandLogo 'text-brand-ai' 'BrandLogo should use the AI brand color class.'
Assert-Match $brandLogo 'text-brand-faq' 'BrandLogo should use the FAQ brand color class.'
Assert-Match $homePage 'id="top"' 'Home page should expose the top anchor target.'

Write-Output 'logo-contract: PASS'
