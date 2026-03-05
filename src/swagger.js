const swaggerDoc = {
  openapi: '3.0.0',
  info: {
    title: 'Primavera V10 API',
    version: '1.0.0',
    description: 'REST API para dados do ERP Primavera V10 Executive - Analytics, Vendas, Compras, Stock, RH, Financeiro. Read-only.',
  },
  servers: [{ url: '/api' }],
  paths: {
    '/health': { get: { tags: ['Sistema'], summary: 'Health check + info BD', responses: { 200: { description: 'OK' } } } },
    '/health/tables': { get: { tags: ['Sistema'], summary: 'Listar todas as tabelas da BD', responses: { 200: { description: 'OK' } } } },
    '/health/tables/{nome}/columns': { get: { tags: ['Sistema'], summary: 'Colunas de uma tabela', parameters: [{ name: 'nome', in: 'path', required: true, schema: { type: 'string' } }], responses: { 200: { description: 'OK' } } } },

    '/clientes': { get: { tags: ['Clientes'], summary: 'Listar clientes', parameters: [
      { name: 'search', in: 'query', schema: { type: 'string' } },
      { name: 'zona', in: 'query', schema: { type: 'string' } },
      { name: 'vendedor', in: 'query', schema: { type: 'string' } },
      { name: 'page', in: 'query', schema: { type: 'integer' } },
      { name: 'limit', in: 'query', schema: { type: 'integer' } },
    ], responses: { 200: { description: 'OK' } } } },
    '/clientes/{id}': { get: { tags: ['Clientes'], summary: 'Detalhes do cliente', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { 200: { description: 'OK' } } } },
    '/clientes/{id}/documentos': { get: { tags: ['Clientes'], summary: 'Documentos do cliente', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { 200: { description: 'OK' } } } },
    '/clientes/{id}/saldo': { get: { tags: ['Clientes'], summary: 'Saldo conta corrente', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { 200: { description: 'OK' } } } },
    '/clientes/analytics/resumo': { get: { tags: ['Clientes'], summary: 'Resumo geral clientes', responses: { 200: { description: 'OK' } } } },

    '/artigos': { get: { tags: ['Artigos'], summary: 'Listar artigos', parameters: [
      { name: 'search', in: 'query', schema: { type: 'string' } },
      { name: 'familia', in: 'query', schema: { type: 'string' } },
      { name: 'comStock', in: 'query', schema: { type: 'string' } },
    ], responses: { 200: { description: 'OK' } } } },
    '/artigos/{id}': { get: { tags: ['Artigos'], summary: 'Detalhes do artigo', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { 200: { description: 'OK' } } } },
    '/artigos/analytics/stock-baixo': { get: { tags: ['Artigos'], summary: 'Artigos abaixo stock minimo', responses: { 200: { description: 'OK' } } } },
    '/artigos/analytics/valor-stock': { get: { tags: ['Artigos'], summary: 'Valor total de inventario', responses: { 200: { description: 'OK' } } } },

    '/vendas/documentos': { get: { tags: ['Vendas'], summary: 'Listar documentos de venda', parameters: [
      { name: 'tipoDoc', in: 'query', schema: { type: 'string' } },
      { name: 'cliente', in: 'query', schema: { type: 'string' } },
      { name: 'from', in: 'query', schema: { type: 'string', format: 'date' } },
      { name: 'to', in: 'query', schema: { type: 'string', format: 'date' } },
    ], responses: { 200: { description: 'OK' } } } },
    '/vendas/documentos/{id}': { get: { tags: ['Vendas'], summary: 'Documento com linhas', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }], responses: { 200: { description: 'OK' } } } },
    '/vendas/analytics/mensal': { get: { tags: ['Vendas Analytics'], summary: 'Vendas por mes', responses: { 200: { description: 'OK' } } } },
    '/vendas/analytics/diario': { get: { tags: ['Vendas Analytics'], summary: 'Vendas por dia', responses: { 200: { description: 'OK' } } } },
    '/vendas/analytics/top-clientes': { get: { tags: ['Vendas Analytics'], summary: 'Top N clientes por facturacao', parameters: [{ name: 'top', in: 'query', schema: { type: 'integer' } }], responses: { 200: { description: 'OK' } } } },
    '/vendas/analytics/top-artigos': { get: { tags: ['Vendas Analytics'], summary: 'Top N artigos vendidos', parameters: [{ name: 'top', in: 'query', schema: { type: 'integer' } }, { name: 'por', in: 'query', schema: { type: 'string', enum: ['valor', 'quantidade'] } }], responses: { 200: { description: 'OK' } } } },
    '/vendas/analytics/por-vendedor': { get: { tags: ['Vendas Analytics'], summary: 'Vendas por vendedor', responses: { 200: { description: 'OK' } } } },
    '/vendas/analytics/por-familia': { get: { tags: ['Vendas Analytics'], summary: 'Vendas por familia de artigos', responses: { 200: { description: 'OK' } } } },
    '/vendas/analytics/por-zona': { get: { tags: ['Vendas Analytics'], summary: 'Vendas por zona geografica', responses: { 200: { description: 'OK' } } } },
    '/vendas/analytics/margens': { get: { tags: ['Vendas Analytics'], summary: 'Analise de margens por artigo', responses: { 200: { description: 'OK' } } } },
    '/vendas/analytics/resumo': { get: { tags: ['Vendas Analytics'], summary: 'Resumo geral de vendas', responses: { 200: { description: 'OK' } } } },
    '/vendas/analytics/yoy': { get: { tags: ['Vendas Analytics'], summary: 'Comparacao Year over Year', responses: { 200: { description: 'OK' } } } },

    '/compras/documentos': { get: { tags: ['Compras'], summary: 'Listar documentos de compra', responses: { 200: { description: 'OK' } } } },
    '/compras/documentos/{id}': { get: { tags: ['Compras'], summary: 'Documento de compra com linhas', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }], responses: { 200: { description: 'OK' } } } },
    '/compras/analytics/mensal': { get: { tags: ['Compras Analytics'], summary: 'Compras por mes', responses: { 200: { description: 'OK' } } } },
    '/compras/analytics/top-fornecedores': { get: { tags: ['Compras Analytics'], summary: 'Top fornecedores', responses: { 200: { description: 'OK' } } } },
    '/compras/analytics/top-artigos': { get: { tags: ['Compras Analytics'], summary: 'Top artigos comprados', responses: { 200: { description: 'OK' } } } },
    '/compras/analytics/resumo': { get: { tags: ['Compras Analytics'], summary: 'Resumo geral compras', responses: { 200: { description: 'OK' } } } },

    '/fornecedores': { get: { tags: ['Fornecedores'], summary: 'Listar fornecedores', responses: { 200: { description: 'OK' } } } },
    '/fornecedores/{id}': { get: { tags: ['Fornecedores'], summary: 'Detalhes fornecedor', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { 200: { description: 'OK' } } } },
    '/fornecedores/{id}/saldo': { get: { tags: ['Fornecedores'], summary: 'Saldo conta corrente', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { 200: { description: 'OK' } } } },

    '/stock/actual': { get: { tags: ['Stock'], summary: 'Stock actual por artigo', responses: { 200: { description: 'OK' } } } },
    '/stock/por-armazem': { get: { tags: ['Stock'], summary: 'Stock agrupado por armazem', responses: { 200: { description: 'OK' } } } },
    '/stock/por-familia': { get: { tags: ['Stock'], summary: 'Stock por familia de artigos', responses: { 200: { description: 'OK' } } } },
    '/stock/alertas': { get: { tags: ['Stock'], summary: 'Alertas de stock (abaixo minimo, sem stock)', responses: { 200: { description: 'OK' } } } },
    '/stock/movimentos': { get: { tags: ['Stock'], summary: 'Movimentos de stock', responses: { 200: { description: 'OK' } } } },
    '/stock/rotacao': { get: { tags: ['Stock'], summary: 'Analise de rotacao de stock', parameters: [{ name: 'dias', in: 'query', schema: { type: 'integer' } }], responses: { 200: { description: 'OK' } } } },
    '/stock/resumo': { get: { tags: ['Stock'], summary: 'Resumo geral stock', responses: { 200: { description: 'OK' } } } },

    '/financeiro/pendentes/clientes': { get: { tags: ['Financeiro'], summary: 'Dividas de clientes', responses: { 200: { description: 'OK' } } } },
    '/financeiro/pendentes/fornecedores': { get: { tags: ['Financeiro'], summary: 'Dividas a fornecedores', responses: { 200: { description: 'OK' } } } },
    '/financeiro/pendentes/aging': { get: { tags: ['Financeiro'], summary: 'Aging report (antiguidade divida)', parameters: [{ name: 'tipo', in: 'query', schema: { type: 'string', enum: ['C', 'F'] } }], responses: { 200: { description: 'OK' } } } },
    '/financeiro/pendentes/resumo': { get: { tags: ['Financeiro'], summary: 'Resumo a receber vs a pagar', responses: { 200: { description: 'OK' } } } },
    '/financeiro/tesouraria/mensal': { get: { tags: ['Financeiro'], summary: 'Recebimentos vs pagamentos mensal', responses: { 200: { description: 'OK' } } } },

    '/rh/funcionarios': { get: { tags: ['RH'], summary: 'Listar funcionarios', responses: { 200: { description: 'OK' } } } },
    '/rh/departamentos': { get: { tags: ['RH'], summary: 'Departamentos com headcount', responses: { 200: { description: 'OK' } } } },
    '/rh/analytics/resumo': { get: { tags: ['RH'], summary: 'Resumo RH', responses: { 200: { description: 'OK' } } } },
    '/rh/analytics/por-departamento': { get: { tags: ['RH'], summary: 'Analise por departamento', responses: { 200: { description: 'OK' } } } },
    '/rh/analytics/antiguidade': { get: { tags: ['RH'], summary: 'Distribuicao por antiguidade', responses: { 200: { description: 'OK' } } } },

    '/query': { post: { tags: ['Query Livre'], summary: 'Executar query SQL read-only (para LLM)', requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', properties: { sql: { type: 'string', example: "SELECT TOP 10 * FROM Clientes" } }, required: ['sql'] } } } }, responses: { 200: { description: 'OK' }, 403: { description: 'Operacao bloqueada' } } } },
  },
};

module.exports = swaggerDoc;
