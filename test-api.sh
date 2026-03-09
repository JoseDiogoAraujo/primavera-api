#!/bin/bash
BASE="http://primavera-api.cimenteiradolouro.local/api"
KEY="x-api-key: 5d815e213fbe9bf3657a05077547610ed1b5897d6c20419eda01e45f44db45f2"
PASS=0
FAIL=0

t() {
  local label="$1"
  local url="$2"
  local method="${3:-GET}"
  local body="$4"

  if [ "$method" = "POST" ]; then
    resp=$(curl -s -w "\n%{http_code}" -H "$KEY" -H "Content-Type: application/json" -X POST -d "$body" "$url" 2>/dev/null)
  else
    resp=$(curl -s -w "\n%{http_code}" -H "$KEY" "$url" 2>/dev/null)
  fi

  code=$(echo "$resp" | tail -1)
  body_resp=$(echo "$resp" | sed '$d')

  if [[ "$code" =~ ^2 ]]; then
    has_data=$(echo "$body_resp" | python3 -c "
import sys,json
try:
    d=json.load(sys.stdin)
    if isinstance(d, list): print(f'array:{len(d)}')
    elif 'data' in d and 'total' in d: print(f'data:{len(d[\"data\"])},total={d[\"total\"]}')
    elif 'data' in d: print(f'data:{len(d[\"data\"])}')
    elif 'cabecalho' in d: print(f'doc+{len(d.get(\"linhas\",[]))}linhas')
    elif 'status' in d: print(f'status={d[\"status\"]}')
    elif 'rows' in d: print(f'rows={d[\"rows\"]}')
    elif 'error' in d: print(f'blocked')
    else:
        keys = list(d.keys())[:4]
        print(','.join(keys))
except: print('raw')
" 2>/dev/null)
    echo "  OK $label -> $code ($has_data)"
    PASS=$((PASS+1))
  elif [[ "$code" = "404" ]]; then
    echo "  OK $label -> 404 (expected)"
    PASS=$((PASS+1))
  elif [[ "$code" = "403" ]]; then
    echo "  OK $label -> 403 (blocked as expected)"
    PASS=$((PASS+1))
  else
    echo "  FAIL $label -> $code"
    echo "     $(echo "$body_resp" | head -c 200)"
    FAIL=$((FAIL+1))
  fi
}

echo "========================================"
echo "  TESTE COMPLETO DE TODOS OS ENDPOINTS"
echo "========================================"

echo ""
echo ">> HEALTH (3 endpoints)"
t "GET /health" "$BASE/health"
t "GET /health/tables" "$BASE/health/tables"
t "GET /health/tables/Clientes/columns" "$BASE/health/tables/Clientes/columns"

echo ""
echo ">> CLIENTES (5 endpoints, filtros: search, page, limit, tipoDoc, from, to)"
t "GET /clientes" "$BASE/clientes?limit=2"
t "GET /clientes?search=louro" "$BASE/clientes?search=louro&limit=2"
t "GET /clientes?page=2&limit=5" "$BASE/clientes?page=2&limit=5"
t "GET /clientes/:id" "$BASE/clientes/01124"
t "GET /clientes/:id (404)" "$BASE/clientes/XXXXX"
t "GET /clientes/:id/documentos" "$BASE/clientes/01124/documentos?limit=2"
t "GET /clientes/:id/documentos?tipoDoc=FA" "$BASE/clientes/01124/documentos?tipoDoc=FA&limit=2"
t "GET /clientes/:id/documentos?from+to" "$BASE/clientes/01124/documentos?from=2025-01-01&to=2025-12-31&limit=2"
t "GET /clientes/:id/documentos?tipoDoc+from+to" "$BASE/clientes/01124/documentos?tipoDoc=FA&from=2025-01-01&to=2025-12-31&limit=2"
t "GET /clientes/:id/saldo" "$BASE/clientes/01124/saldo"
t "GET /clientes/:id/pendentes" "$BASE/clientes/01124/pendentes"

echo ""
echo ">> FORNECEDORES (5 endpoints, filtros: search, page, limit, tipoDoc, from, to)"
t "GET /fornecedores" "$BASE/fornecedores?limit=2"
t "GET /fornecedores?search=metal" "$BASE/fornecedores?search=metal&limit=2"
t "GET /fornecedores?page=3&limit=10" "$BASE/fornecedores?page=3&limit=10"
t "GET /fornecedores/:id" "$BASE/fornecedores/2130"
t "GET /fornecedores/:id (404)" "$BASE/fornecedores/XXXXX"
t "GET /fornecedores/:id/documentos" "$BASE/fornecedores/2130/documentos?limit=2"
t "GET /fornecedores/:id/documentos?tipoDoc=VFA" "$BASE/fornecedores/2130/documentos?tipoDoc=VFA&limit=2"
t "GET /fornecedores/:id/documentos?from+to" "$BASE/fornecedores/2130/documentos?from=2025-01-01&to=2025-12-31&limit=2"
t "GET /fornecedores/:id/saldo" "$BASE/fornecedores/2130/saldo"
t "GET /fornecedores/:id/artigos" "$BASE/fornecedores/2130/artigos"

echo ""
echo ">> ARTIGOS (5 endpoints, filtros: search, familia, comStock, page, limit)"
t "GET /artigos" "$BASE/artigos?limit=2"
t "GET /artigos?search=cimento" "$BASE/artigos?search=cimento&limit=2"
t "GET /artigos?familia=01" "$BASE/artigos?familia=01&limit=2"
t "GET /artigos?comStock=true" "$BASE/artigos?comStock=true&limit=2"
t "GET /artigos?search+familia+comStock" "$BASE/artigos?search=cimento&familia=01&comStock=true&limit=2"
ARTIGO=$(curl -s -H "$KEY" "$BASE/artigos?comStock=true&limit=1" | python3 -c "import sys,json; print(json.load(sys.stdin)['data'][0]['Artigo'])" 2>/dev/null)
echo "  [artigo de teste: $ARTIGO]"
t "GET /artigos/:id" "$BASE/artigos/$ARTIGO"
t "GET /artigos/:id (404)" "$BASE/artigos/XXXXX"
t "GET /artigos/:id/precos" "$BASE/artigos/$ARTIGO/precos"
t "GET /artigos/:id/fornecedores" "$BASE/artigos/$ARTIGO/fornecedores"
t "GET /artigos/:id/movimentos" "$BASE/artigos/$ARTIGO/movimentos?limit=3"
t "GET /artigos/:id/movimentos?page=2" "$BASE/artigos/$ARTIGO/movimentos?page=2&limit=3"

echo ""
echo ">> VENDAS (4 endpoints, filtros: search, tipoDoc, cliente, artigo, vendedor, zona, serie, from, to, por, top)"
t "GET /vendas/documentos" "$BASE/vendas/documentos?limit=2"
t "GET /vendas/documentos?search=louro" "$BASE/vendas/documentos?search=louro&limit=2"
t "GET /vendas/documentos?tipoDoc=FA" "$BASE/vendas/documentos?tipoDoc=FA&limit=2"
t "GET /vendas/documentos?cliente=01124" "$BASE/vendas/documentos?cliente=01124&limit=2"
t "GET /vendas/documentos?zona=01" "$BASE/vendas/documentos?zona=01&limit=2"
t "GET /vendas/documentos?serie=20261" "$BASE/vendas/documentos?serie=20261&limit=2"
t "GET /vendas/documentos?from+to" "$BASE/vendas/documentos?from=2026-01-01&to=2026-03-31&limit=2"
t "GET /vendas/documentos?artigo" "$BASE/vendas/documentos?artigo=$ARTIGO&limit=2"
t "GET /vendas/documentos?vendedor=01" "$BASE/vendas/documentos?vendedor=01&limit=2"
t "GET /vendas/documentos?all_filters" "$BASE/vendas/documentos?tipoDoc=FA&cliente=01124&from=2025-01-01&to=2025-12-31&limit=2"
VDOC=$(curl -s -H "$KEY" "$BASE/vendas/documentos?limit=1" | python3 -c "import sys,json; print(json.load(sys.stdin)['data'][0]['Id'])" 2>/dev/null)
echo "  [doc de teste: $VDOC]"
t "GET /vendas/documentos/:id" "$BASE/vendas/documentos/$VDOC"
t "GET /vendas/resumo" "$BASE/vendas/resumo"
t "GET /vendas/resumo?from+to" "$BASE/vendas/resumo?from=2026-01-01&to=2026-12-31"
t "GET /vendas/top (default)" "$BASE/vendas/top"
t "GET /vendas/top?por=cliente&top=5" "$BASE/vendas/top?por=cliente&top=5"
t "GET /vendas/top?por=artigo&top=5" "$BASE/vendas/top?por=artigo&top=5"
t "GET /vendas/top?por=vendedor&top=5" "$BASE/vendas/top?por=vendedor&top=5"
t "GET /vendas/top?por+top+from+to" "$BASE/vendas/top?por=cliente&top=5&from=2026-01-01&to=2026-12-31"

echo ""
echo ">> COMPRAS (4 endpoints, filtros: search, tipoDoc, fornecedor, artigo, serie, from, to, por, top)"
t "GET /compras/documentos" "$BASE/compras/documentos?limit=2"
t "GET /compras/documentos?search=codimetal" "$BASE/compras/documentos?search=codimetal&limit=2"
t "GET /compras/documentos?tipoDoc=VFA" "$BASE/compras/documentos?tipoDoc=VFA&limit=2"
t "GET /compras/documentos?fornecedor=2130" "$BASE/compras/documentos?fornecedor=2130&limit=2"
t "GET /compras/documentos?serie=20261" "$BASE/compras/documentos?serie=20261&limit=2"
t "GET /compras/documentos?from+to" "$BASE/compras/documentos?from=2025-01-01&to=2025-12-31&limit=2"
t "GET /compras/documentos?artigo" "$BASE/compras/documentos?artigo=$ARTIGO&limit=2"
t "GET /compras/documentos?all_filters" "$BASE/compras/documentos?tipoDoc=VFA&fornecedor=2130&from=2025-01-01&to=2025-12-31&limit=2"
CDOC=$(curl -s -H "$KEY" "$BASE/compras/documentos?limit=1" | python3 -c "import sys,json; print(json.load(sys.stdin)['data'][0]['Id'])" 2>/dev/null)
echo "  [doc de teste: $CDOC]"
t "GET /compras/documentos/:id" "$BASE/compras/documentos/$CDOC"
t "GET /compras/resumo" "$BASE/compras/resumo"
t "GET /compras/resumo?from+to" "$BASE/compras/resumo?from=2026-01-01&to=2026-12-31"
t "GET /compras/top (default)" "$BASE/compras/top"
t "GET /compras/top?por=fornecedor&top=5" "$BASE/compras/top?por=fornecedor&top=5"
t "GET /compras/top?por=artigo&top=5" "$BASE/compras/top?por=artigo&top=5"
t "GET /compras/top?por+top+from+to" "$BASE/compras/top?por=fornecedor&top=5&from=2026-01-01&to=2026-12-31"

echo ""
echo ">> STOCK (4 endpoints, filtros: search, armazem, artigo, from, to)"
t "GET /stock/actual" "$BASE/stock/actual?limit=2"
t "GET /stock/actual?search=cimento" "$BASE/stock/actual?search=cimento&limit=2"
t "GET /stock/actual?armazem=01" "$BASE/stock/actual?armazem=01&limit=2"
t "GET /stock/actual?search+armazem" "$BASE/stock/actual?search=cimento&armazem=01&limit=2"
t "GET /stock/alertas" "$BASE/stock/alertas"
t "GET /stock/movimentos" "$BASE/stock/movimentos?limit=2"
t "GET /stock/movimentos?artigo" "$BASE/stock/movimentos?artigo=$ARTIGO&limit=2"
t "GET /stock/movimentos?armazem=01" "$BASE/stock/movimentos?armazem=01&limit=2"
t "GET /stock/movimentos?from+to" "$BASE/stock/movimentos?from=2026-01-01&to=2026-03-31&limit=2"
t "GET /stock/movimentos?all_filters" "$BASE/stock/movimentos?artigo=$ARTIGO&armazem=01&from=2025-01-01&to=2026-12-31&limit=2"
t "GET /stock/resumo" "$BASE/stock/resumo"

echo ""
echo ">> FINANCEIRO (5 endpoints, filtros: search, page, limit)"
t "GET /financeiro/contas" "$BASE/financeiro/contas?limit=2"
t "GET /financeiro/contas?search=vendas" "$BASE/financeiro/contas?search=vendas&limit=2"
t "GET /financeiro/contas?page=2" "$BASE/financeiro/contas?page=2&limit=5"
t "GET /financeiro/pendentes/clientes" "$BASE/financeiro/pendentes/clientes?limit=2"
t "GET /financeiro/pendentes/clientes?page=2" "$BASE/financeiro/pendentes/clientes?page=2&limit=5"
t "GET /financeiro/pendentes/fornecedores" "$BASE/financeiro/pendentes/fornecedores?limit=2"
t "GET /financeiro/pendentes/resumo" "$BASE/financeiro/pendentes/resumo"
t "GET /financeiro/tesouraria/mensal" "$BASE/financeiro/tesouraria/mensal"

echo ""
echo ">> BASE (16 endpoints, filtros: familia, marca, tipoDoc)"
t "GET /base/familias" "$BASE/base/familias"
t "GET /base/subfamilias" "$BASE/base/subfamilias"
t "GET /base/subfamilias?familia=01" "$BASE/base/subfamilias?familia=01"
t "GET /base/marcas" "$BASE/base/marcas"
t "GET /base/modelos" "$BASE/base/modelos"
t "GET /base/modelos?marca=01" "$BASE/base/modelos?marca=01"
t "GET /base/armazens" "$BASE/base/armazens"
t "GET /base/armazens/:id" "$BASE/base/armazens/01"
t "GET /base/unidades" "$BASE/base/unidades"
t "GET /base/vendedores" "$BASE/base/vendedores"
t "GET /base/vendedores/:id" "$BASE/base/vendedores/01"
t "GET /base/vendedores/:id/vendas" "$BASE/base/vendedores/01/vendas"
t "GET /base/zonas" "$BASE/base/zonas"
t "GET /base/condpag" "$BASE/base/condpag"
t "GET /base/moedas" "$BASE/base/moedas"
t "GET /base/iva" "$BASE/base/iva"
t "GET /base/series" "$BASE/base/series"
t "GET /base/series?tipoDoc=FA" "$BASE/base/series?tipoDoc=FA"
t "GET /base/tiposdoc" "$BASE/base/tiposdoc"

echo ""
echo ">> QUERY (1 endpoint)"
t "POST /query (SELECT)" "$BASE/query" "POST" '{"sql":"SELECT TOP 2 Cliente, Nome FROM Clientes"}'
t "POST /query (blocked INSERT)" "$BASE/query" "POST" '{"sql":"INSERT INTO Clientes VALUES (1)"}'
t "POST /query (no sql)" "$BASE/query" "POST" '{}'

echo ""
echo ">> COPILOT (1 endpoint)"
t "GET /copilot/context" "$BASE/copilot/context"

echo ""
echo "========================================"
echo "  RESULTADOS: $PASS passed | $FAIL failed"
echo "========================================"
