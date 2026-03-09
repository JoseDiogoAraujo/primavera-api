import json

with open('C:/Users/josearaujo/primavera-api/openapi-powerautomate.json', 'r', encoding='utf-8') as f:
    d = json.load(f)

descs = {
    "GetHealth": "Verifica se a API esta operacional e retorna informacao da base de dados (nome, hora do servidor). Usar para diagnostico de conectividade.",
    "GetTables": "Lista todas as tabelas da base de dados Primavera V10 com o numero de registos em cada uma. Util para explorar a estrutura de dados disponivel.",
    "GetTableColumns": "Lista as colunas de uma tabela especifica com tipo de dados, tamanho e se aceita nulos. Util para construir queries SQL no endpoint /query.",
    "GetFamilias": "Lista todas as familias de artigos (categorias principais de produtos). Cada familia tem um codigo e descricao. Usar para filtrar artigos por familia.",
    "GetSubFamilias": "Lista subfamilias de artigos (subcategorias). Pode filtrar por familia para ver apenas as subfamilias de uma familia especifica.",
    "GetMarcas": "Lista todas as marcas de artigos registadas no sistema. Cada marca tem um codigo e descricao.",
    "GetModelos": "Lista modelos de artigos. Pode filtrar por marca para ver apenas os modelos de uma marca especifica.",
    "GetArmazens": "Lista todos os armazens da empresa com morada e localidade. Os codigos de armazem sao usados como filtro nos endpoints de stock.",
    "GetArmazemById": "Retorna todos os detalhes de um armazem especifico pelo seu codigo.",
    "GetUnidades": "Lista todas as unidades de medida registadas (UN, KG, M, M2, M3, LT, etc.). As unidades sao usadas nos artigos e linhas de documentos.",
    "GetVendedores": "Lista todos os vendedores da empresa com nome, comissao e email. Os codigos de vendedor sao usados como filtro nas vendas.",
    "GetVendedorById": "Retorna todos os detalhes de um vendedor especifico pelo seu codigo, incluindo morada, telefone e comissao.",
    "GetVendedorVendas": "Retorna o resumo de vendas de um vendedor: total de documentos e valor total de vendas. Calcula a partir das linhas de documentos de venda.",
    "GetZonas": "Lista todas as zonas geograficas configuradas. As zonas sao usadas na classificacao de clientes e documentos de venda.",
    "GetCondPag": "Lista todas as condicoes de pagamento: dias, desconto e tipo de condicao (pronto pagamento, 30 dias, etc.).",
    "GetMoedas": "Lista todas as moedas configuradas com taxa de cambio, codigo ISO e simbolo. A moeda principal e EUR.",
    "GetIva": "Lista todas as taxas de IVA configuradas no sistema com codigo, descricao, taxa percentual e tipo de taxa.",
    "GetSeries": "Lista as series de documentos de venda (numeracao). Pode filtrar por tipo de documento (FA, NC, EC, etc.). Mostra numerador actual, datas de validade e se esta activa.",
    "GetTiposDoc": "Lista todos os tipos de documentos de venda configurados (FA-Factura, NC-Nota Credito, EC-Encomenda, etc.) com indicacao se movimentam stock, conta corrente e contabilidade.",
    "GetClientes": "Lista todos os clientes com paginacao. Pesquisa generica por codigo de cliente, nome, NIF (NumContrib), email ou telefone. Retorna dados principais: nome, morada, contactos, condicoes comerciais, vendedor e zona.",
    "GetClienteById": "Retorna todos os campos de um cliente especifico pelo seu codigo. Inclui toda a informacao comercial, fiscal, morada e contactos.",
    "GetClienteDocumentos": "Lista documentos de venda emitidos a um cliente especifico. Filtrar por tipo de documento (FA, NC, EC, GR) e intervalo de datas. Retorna cabecalho com totais.",
    "GetClienteSaldo": "Retorna o saldo de conta corrente de um cliente: total pendente, total vencido, numero de documentos pendentes e data do vencimento mais antigo.",
    "GetClientePendentes": "Lista detalhada de todos os documentos pendentes (por pagar) de um cliente, com tipo de documento, valor pendente, data de vencimento e dias de atraso.",
    "GetFornecedores": "Lista todos os fornecedores com paginacao. Pesquisa generica por codigo, nome, NIF ou email. Retorna dados principais: nome, morada, contactos e condicoes comerciais.",
    "GetFornecedorById": "Retorna todos os campos de um fornecedor especifico pelo seu codigo. Inclui toda a informacao comercial, fiscal, morada e contactos.",
    "GetFornecedorDocumentos": "Lista documentos de compra de um fornecedor especifico. Filtrar por tipo de documento (VFA, ECF, VNC) e intervalo de datas. Retorna cabecalho com totais.",
    "GetFornecedorSaldo": "Retorna o saldo de conta corrente de um fornecedor: total pendente (que devemos), total vencido, numero de documentos pendentes e data do vencimento mais antigo.",
    "GetFornecedorArtigos": "Lista todos os artigos que um fornecedor fornece, com referencia do fornecedor, preco de custo ultimo, desconto comercial, prazo de entrega e unidade de compra.",
    "GetArtigos": "Lista artigos/produtos com paginacao. Pesquisa por codigo, descricao ou codigo de barras. Filtrar por familia de artigo ou apenas artigos com stock positivo. Retorna precos de custo, stock e armazem.",
    "GetArtigoById": "Retorna todos os campos de um artigo especifico pelo seu codigo. Inclui toda a informacao tecnica, comercial, precos e stock.",
    "GetArtigoPrecos": "Retorna os precos de custo de um artigo: PCMedio (preco custo medio), PCUltimo (preco custo ultimo) e PCPadrao (preco custo padrao).",
    "GetArtigoFornecedores": "Lista todos os fornecedores que vendem este artigo, com preco de custo, desconto, prazo de entrega e referencia do fornecedor. Ordenado por preco.",
    "GetArtigoMovimentos": "Historico de movimentos de stock de um artigo: entradas, saidas e transferencias com quantidades, stock anterior e actual. Ordenado do mais recente.",
    "GetVendasDocumentos": "Lista documentos de venda com filtros genericos: tipo documento (FA, FR, NC, EC, GR, GT), cliente, artigo, vendedor, zona, serie e intervalo de datas. Filtros por artigo e vendedor usam as linhas do documento.",
    "GetVendaDocumentoById": "Retorna o cabecalho completo e todas as linhas de um documento de venda especifico. Cada linha tem artigo, quantidade, preco, descontos, IVA, armazem e vendedor.",
    "GetVendasResumo": "Resumo de facturacao: total facturado, total de notas de credito (abatimentos), numero de facturas e abatimentos, numero de clientes e ticket medio. Exclui documentos anulados. Filtrar por periodo.",
    "GetVendasTop": "Rankings de vendas por volume. Agrupar por cliente (total documento), artigo (total iliquido + quantidade) ou vendedor (total iliquido + num clientes). Filtrar por periodo e numero de resultados (max 100).",
    "GetComprasDocumentos": "Lista documentos de compra com filtros genericos: tipo documento (VFA, ECF, VNC), fornecedor, artigo, serie e intervalo de datas. Filtro por artigo usa as linhas do documento.",
    "GetCompraDocumentoById": "Retorna o cabecalho completo e todas as linhas de um documento de compra especifico. Cada linha tem artigo, quantidade, preco, descontos, IVA e armazem.",
    "GetComprasResumo": "Resumo de compras: total de compras, numero de documentos, numero de fornecedores e valor medio por documento. Filtrar por periodo.",
    "GetComprasTop": "Rankings de compras por volume. Agrupar por fornecedor (total documento) ou artigo (total iliquido + quantidade). Filtrar por periodo e numero de resultados (max 100).",
    "GetStockActual": "Lista artigos com stock actual positivo (MovStock=S). Mostra quantidades (actual, minimo, maximo), precos de custo e valor de stock calculado (STKActual * PCMedio). Filtrar por pesquisa e armazem.",
    "GetStockAlertas": "Lista artigos com alertas de stock: sem stock (STKActual <= 0), abaixo do minimo ou acima do maximo. Ordenado por severidade: sem_stock > abaixo_minimo > acima_maximo. Inclui deficit calculado.",
    "GetStockMovimentos": "Historico de movimentos de stock: entradas, saidas e transferencias. Filtrar por artigo, armazem e intervalo de datas. Mostra quantidade, stock anterior e actual.",
    "GetStockResumo": "Resumo geral de inventario: total de artigos com stock, total de unidades, valor total a PCMedio e PCUltimo, artigos abaixo do minimo e artigos sem stock.",
    "GetFinanceiroContas": "Lista contas do plano contabilistico (SNC). Pesquisar por numero de conta ou descricao. Cada conta tem codigo, descricao e tipo de conta.",
    "GetPendentesClientes": "Lista clientes com dividas pendentes, agrupados por cliente. Mostra total pendente, total vencido, numero de documentos, data do vencimento mais antigo, dias de atraso maximo, telefone e email. Ordenado por total pendente.",
    "GetPendentesFornecedores": "Lista fornecedores com valores por pagar, agrupados por fornecedor. Mostra total pendente, total vencido, numero de documentos e data do vencimento mais antigo. Ordenado por total pendente.",
    "GetPendentesResumo": "Resumo financeiro: total a receber (clientes) vs total a pagar (fornecedores), totais vencidos, numero de entidades devedoras/credoras e saldo liquido (receber - pagar).",
    "GetTesourariaMensal": "Evolucao mensal de tesouraria: recebimentos de clientes e pagamentos a fornecedores por mes (formato YYYY-MM). Util para analise de cash-flow.",
    "ExecuteQuery": "Executa queries SQL read-only directamente na base de dados Primavera. Apenas SELECT e WITH (CTE) sao permitidos. INSERT, UPDATE, DELETE, DROP e outras operacoes de escrita sao bloqueadas por seguranca.",
    "GetCopilotContext": "Retorna metadados completos da API para integracao com LLM/Copilot: lista de endpoints disponiveis, filtros suportados, tipos de documento, formato de paginacao e dicas de utilizacao.",
}

for path, methods in d['paths'].items():
    for method, op in methods.items():
        oid = op.get('operationId', '')
        if oid in descs:
            op['description'] = descs[oid]

with open('C:/Users/josearaujo/primavera-api/openapi-powerautomate.json', 'w', encoding='utf-8') as f:
    json.dump(d, f, indent=2, ensure_ascii=False)

# Verify
missing = 0
for path, methods in d['paths'].items():
    for method, op in methods.items():
        if not op.get('description'):
            print(f"STILL MISSING: {op.get('operationId')}")
            missing += 1

print(f"\nDone! {len(descs)} descriptions applied. {missing} still missing.")
