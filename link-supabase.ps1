# Liga orçamento-familiar ao Apps Secundários (NÃO PedagoFlow).
# Uso: npx supabase link --project-ref brpfklddehlxorjxcodk
$ErrorActionPreference = 'Stop'
Set-Location 'D:\Projetos\orcamento-familiar'
$ref = 'brpfklddehlxorjxcodk'
Write-Host "Linking to Apps Secundarios $ref (never qrjmvqedoypxmnvfdetg)..."
npx supabase link --project-ref $ref
if ($LASTEXITCODE -ne 0) {
  Write-Host @"
FALHOU o link. Causas típicas:
- SUPABASE_ACCESS_TOKEN só vê o projecto PedagoFlow
- Gera um Access Token em https://supabase.com/dashboard/account/tokens com acesso à org dos Apps Secundários
- Ou corre o SQL no SQL Editor do projecto brpfklddehlxorjxcodk no dashboard
"@
  exit $LASTEXITCODE
}
Get-Content 'supabase\.temp\project-ref'
Write-Host 'OK linked'
