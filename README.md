# Cascata

**Price waterfall por cliente.** Da receita bruta ao custo de servir, cliente a cliente.

Cada departamento sobe os arquivos que conhece (PDF, XLSX, CSV). A IA lê, identifica os
campos por cliente, reconcilia as chaves (código, nome ou CNPJ) e monta o waterfall: 29
marcos do P&L, com drill-down nos 33 subtipos de desconto comercial e separação por BU.

**Ao vivo:** [cascata.pereirasaraiva.com](https://cascata.pereirasaraiva.com) · demo sem cadastro.

## O problema
O price waterfall por cliente mora em planilhas isoladas: vendas num arquivo, frete noutro,
descontos num PDF escaneado, custo de atendimento sem chave comum. São dias de reconciliação
manual antes de ver a margem real por conta.

## Como funciona
1. **Defina clientes e organograma:** BU, departamentos, contas. Salários e custos da
   hierarquia entram como gasto, com rateio quando faltar valor.
2. **Cada depto alimenta o seu:** upload por linha; a IA extrai os campos por cliente.
3. **Waterfall com drill-down:** 29 marcos do bruto ao custo de servir; a linha de descontos
   abre um segundo waterfall com as 33 sublinhas, auditáveis e exportáveis.

## Stack
React · TanStack Router · Tailwind · shadcn · Supabase · Cloudflare.

---
Construído por [J P Saraiva](https://pereirasaraiva.com) · Engenharia de Go-to-Market.
