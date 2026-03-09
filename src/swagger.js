const swaggerDoc = {
  openapi: '3.0.0',
  info: {
    title: 'Primavera V10 API',
    version: '3.0.0',
    description: 'REST API para dados do ERP Primavera V10 Executive. Read-only. Endpoints genericos para Copilot/LLM.',
  },
  servers: [{ url: '/api' }],
  components: {
    securitySchemes: {
      basicAuth: { type: 'http', scheme: 'basic', description: 'Basic Auth (user:password)' },
      apiKey: { type: 'apiKey', in: 'header', name: 'x-api-key', description: 'API Key no header x-api-key' },
    },
  },
  security: [{ basicAuth: [] }, { apiKey: [] }],
  paths: {
    // ===== SISTEMA =====
    '/health': { get: { tags: ['Sistema'], summary: 'Health check + info BD', responses: { 200: { description: 'OK' } } } },
    '/health/tables': { get: { tags: ['Sistema'], summary: 'Listar tabelas da BD', responses: { 200: { description: 'OK' } } } },
    '/health/tables/{nome}/columns': { get: { tags: ['Sistema'], summary: 'Colunas de uma tabela', parameters: [{ name: 'nome', in: 'path', required: true, schema: { type: 'string' } }], responses: { 200: { description: 'OK' } } } },

    // ===== BASE =====
    '/base/familias': { get: { tags: ['Base'], summary: 'Familias de artigos', responses: { 200: { description: 'OK' } } } },
    '/base/subfamilias': { get: { tags: ['Base'], summary: 'Subfamilias', parameters: [{ name: 'familia', in: 'query', schema: { type: 'string' } }], responses: { 200: { description: 'OK' } } } },
    '/base/marcas': { get: { tags: ['Base'], summary: 'Marcas', responses: { 200: { description: 'OK' } } } },
    '/base/modelos': { get: { tags: ['Base'], summary: 'Modelos', parameters: [{ name: 'marca', in: 'query', schema: { type: 'string' } }], responses: { 200: { description: 'OK' } } } },
    '/base/armazens': { get: { tags: ['Base'], summary: 'Armazens', responses: { 200: { description: 'OK' } } } },
    '/base/armazens/{id}': { get: { tags: ['Base'], summary: 'Detalhe armazem', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { 200: { description: 'OK' } } } },
    '/base/unidades': { get: { tags: ['Base'], summary: 'Unidades de medida', responses: { 200: { description: 'OK' } } } },
    '/base/vendedores': { get: { tags: ['Base'], summary: 'Vendedores', responses: { 200: { description: 'OK' } } } },
    '/base/vendedores/{id}': { get: { tags: ['Base'], summary: 'Detalhe vendedor', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { 200: { description: 'OK' } } } },
    '/base/zonas': { get: { tags: ['Base'], summary: 'Zonas geograficas', responses: { 200: { description: 'OK' } } } },
    '/base/condpag': { get: { tags: ['Base'], summary: 'Condicoes pagamento', responses: { 200: { description: 'OK' } } } },
    '/base/moedas': { get: { tags: ['Base'], summary: 'Moedas', responses: { 200: { description: 'OK' } } } },
    '/base/iva': { get: { tags: ['Base'], summary: 'Tabela IVA', responses: { 200: { description: 'OK' } } } },
    '/base/series': { get: { tags: ['Base'], summary: 'Series de documentos', parameters: [{ name: 'tipoDoc', in: 'query', schema: { type: 'string' } }], responses: { 200: { description: 'OK' } } } },
    '/base/tiposdoc': { get: { tags: ['Base'], summary: 'Tipos de documento', responses: { 200: { description: 'OK' } } } },

    // ===== CLIENTES =====
    '/clientes': { get: { tags: ['Clientes'], summary: 'Listar clientes', parameters: [
      { name: 'search', in: 'query', schema: { type: 'string' }, description: 'Pesquisa (codigo, nome, NIF, email, telefone)' },
      { name: 'page', in: 'query', schema: { type: 'integer' } },
      { name: 'limit', in: 'query', schema: { type: 'integer' } },
    ], responses: { 200: { description: 'OK' } } } },
    '/clientes/{id}': { get: { tags: ['Clientes'], summary: 'Detalhes do cliente', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { 200: { description: 'OK' } } } },
    '/clientes/{id}/documentos': { get: { tags: ['Clientes'], summary: 'Documentos do cliente', parameters: [
      { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
      { name: 'tipoDoc', in: 'query', schema: { type: 'string' } },
      { name: 'from', in: 'query', schema: { type: 'string', format: 'date' } },
      { name: 'to', in: 'query', schema: { type: 'string', format: 'date' } },
    ], responses: { 200: { description: 'OK' } } } },
    '/clientes/{id}/saldo': { get: { tags: ['Clientes'], summary: 'Saldo conta corrente', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { 200: { description: 'OK' } } } },
    '/clientes/{id}/pendentes': { get: { tags: ['Clientes'], summary: 'Documentos pendentes', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { 200: { description: 'OK' } } } },

    // ===== FORNECEDORES =====
    '/fornecedores': { get: { tags: ['Fornecedores'], summary: 'Listar fornecedores', parameters: [
      { name: 'search', in: 'query', schema: { type: 'string' }, description: 'Pesquisa (codigo, nome, NIF, email)' },
      { name: 'page', in: 'query', schema: { type: 'integer' } },
      { name: 'limit', in: 'query', schema: { type: 'integer' } },
    ], responses: { 200: { description: 'OK' } } } },
    '/fornecedores/{id}': { get: { tags: ['Fornecedores'], summary: 'Detalhes fornecedor', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { 200: { description: 'OK' } } } },
    '/fornecedores/{id}/documentos': { get: { tags: ['Fornecedores'], summary: 'Documentos do fornecedor', parameters: [
      { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
      { name: 'tipoDoc', in: 'query', schema: { type: 'string' } },
      { name: 'from', in: 'query', schema: { type: 'string', format: 'date' } },
      { name: 'to', in: 'query', schema: { type: 'string', format: 'date' } },
    ], responses: { 200: { description: 'OK' } } } },
    '/fornecedores/{id}/saldo': { get: { tags: ['Fornecedores'], summary: 'Saldo conta corrente', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { 200: { description: 'OK' } } } },
    '/fornecedores/{id}/artigos': { get: { tags: ['Fornecedores'], summary: 'Artigos fornecidos', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { 200: { description: 'OK' } } } },

    // ===== ARTIGOS =====
    '/artigos': { get: { tags: ['Artigos'], summary: 'Listar artigos', parameters: [
      { name: 'search', in: 'query', schema: { type: 'string' }, description: 'Pesquisa (codigo, descricao, cod barras)' },
      { name: 'familia', in: 'query', schema: { type: 'string' } },
      { name: 'comStock', in: 'query', schema: { type: 'string' }, description: 'true = so com stock' },
      { name: 'page', in: 'query', schema: { type: 'integer' } },
      { name: 'limit', in: 'query', schema: { type: 'integer' } },
    ], responses: { 200: { description: 'OK' } } } },
    '/artigos/{id}': { get: { tags: ['Artigos'], summary: 'Detalhes do artigo', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { 200: { description: 'OK' } } } },
    '/artigos/{id}/precos': { get: { tags: ['Artigos'], summary: 'Precos (PVP1-6, PCMedio, PCUltimo)', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { 200: { description: 'OK' } } } },
    '/artigos/{id}/fornecedores': { get: { tags: ['Artigos'], summary: 'Fornecedores do artigo', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { 200: { description: 'OK' } } } },
    '/artigos/{id}/movimentos': { get: { tags: ['Artigos'], summary: 'Movimentos de stock', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { 200: { description: 'OK' } } } },

    // ===== VENDAS =====
    '/vendas/documentos': { get: { tags: ['Vendas'], summary: 'Listar documentos de venda', parameters: [
      { name: 'search', in: 'query', schema: { type: 'string' }, description: 'Pesquisa (nome cliente, codigo, num doc)' },
      { name: 'tipoDoc', in: 'query', schema: { type: 'string' }, description: 'FA, NC, EC, GR...' },
      { name: 'cliente', in: 'query', schema: { type: 'string' }, description: 'Codigo cliente' },
      { name: 'artigo', in: 'query', schema: { type: 'string' }, description: 'Filtrar por artigo (via linhas)' },
      { name: 'vendedor', in: 'query', schema: { type: 'string' }, description: 'Filtrar por vendedor (via linhas)' },
      { name: 'zona', in: 'query', schema: { type: 'string' } },
      { name: 'serie', in: 'query', schema: { type: 'string' } },
      { name: 'from', in: 'query', schema: { type: 'string', format: 'date' } },
      { name: 'to', in: 'query', schema: { type: 'string', format: 'date' } },
      { name: 'page', in: 'query', schema: { type: 'integer' } },
      { name: 'limit', in: 'query', schema: { type: 'integer' } },
    ], responses: { 200: { description: 'OK' } } } },
    '/vendas/documentos/{id}': { get: { tags: ['Vendas'], summary: 'Documento com linhas', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { 200: { description: 'OK' } } } },
    '/vendas/resumo': { get: { tags: ['Vendas'], summary: 'Totais de vendas', parameters: [
      { name: 'from', in: 'query', schema: { type: 'string', format: 'date' } },
      { name: 'to', in: 'query', schema: { type: 'string', format: 'date' } },
    ], responses: { 200: { description: 'OK' } } } },
    '/vendas/top': { get: { tags: ['Vendas'], summary: 'Rankings (top clientes, artigos, vendedores)', parameters: [
      { name: 'por', in: 'query', schema: { type: 'string', enum: ['cliente', 'artigo', 'vendedor'] }, description: 'Agrupar por' },
      { name: 'top', in: 'query', schema: { type: 'integer' }, description: 'Numero de resultados (default 10)' },
      { name: 'from', in: 'query', schema: { type: 'string', format: 'date' } },
      { name: 'to', in: 'query', schema: { type: 'string', format: 'date' } },
    ], responses: { 200: { description: 'OK' } } } },

    // ===== COMPRAS =====
    '/compras/documentos': { get: { tags: ['Compras'], summary: 'Listar documentos de compra', parameters: [
      { name: 'search', in: 'query', schema: { type: 'string' }, description: 'Pesquisa (nome fornecedor, codigo, num doc)' },
      { name: 'tipoDoc', in: 'query', schema: { type: 'string' } },
      { name: 'fornecedor', in: 'query', schema: { type: 'string' }, description: 'Codigo fornecedor' },
      { name: 'artigo', in: 'query', schema: { type: 'string' }, description: 'Filtrar por artigo (via linhas)' },
      { name: 'serie', in: 'query', schema: { type: 'string' } },
      { name: 'from', in: 'query', schema: { type: 'string', format: 'date' } },
      { name: 'to', in: 'query', schema: { type: 'string', format: 'date' } },
      { name: 'page', in: 'query', schema: { type: 'integer' } },
      { name: 'limit', in: 'query', schema: { type: 'integer' } },
    ], responses: { 200: { description: 'OK' } } } },
    '/compras/documentos/{id}': { get: { tags: ['Compras'], summary: 'Documento com linhas', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { 200: { description: 'OK' } } } },
    '/compras/resumo': { get: { tags: ['Compras'], summary: 'Totais de compras', parameters: [
      { name: 'from', in: 'query', schema: { type: 'string', format: 'date' } },
      { name: 'to', in: 'query', schema: { type: 'string', format: 'date' } },
    ], responses: { 200: { description: 'OK' } } } },
    '/compras/top': { get: { tags: ['Compras'], summary: 'Rankings (top fornecedores, artigos)', parameters: [
      { name: 'por', in: 'query', schema: { type: 'string', enum: ['fornecedor', 'artigo'] }, description: 'Agrupar por' },
      { name: 'top', in: 'query', schema: { type: 'integer' }, description: 'Numero de resultados (default 10)' },
      { name: 'from', in: 'query', schema: { type: 'string', format: 'date' } },
      { name: 'to', in: 'query', schema: { type: 'string', format: 'date' } },
    ], responses: { 200: { description: 'OK' } } } },

    // ===== STOCK =====
    '/stock/actual': { get: { tags: ['Stock'], summary: 'Stock actual por artigo', parameters: [
      { name: 'search', in: 'query', schema: { type: 'string' } },
      { name: 'armazem', in: 'query', schema: { type: 'string' } },
      { name: 'page', in: 'query', schema: { type: 'integer' } },
      { name: 'limit', in: 'query', schema: { type: 'integer' } },
    ], responses: { 200: { description: 'OK' } } } },
    '/stock/alertas': { get: { tags: ['Stock'], summary: 'Alertas de stock (sem stock, abaixo minimo)', responses: { 200: { description: 'OK' } } } },
    '/stock/movimentos': { get: { tags: ['Stock'], summary: 'Movimentos de stock', parameters: [
      { name: 'artigo', in: 'query', schema: { type: 'string' } },
      { name: 'armazem', in: 'query', schema: { type: 'string' } },
      { name: 'from', in: 'query', schema: { type: 'string', format: 'date' } },
      { name: 'to', in: 'query', schema: { type: 'string', format: 'date' } },
    ], responses: { 200: { description: 'OK' } } } },
    '/stock/resumo': { get: { tags: ['Stock'], summary: 'Totais de inventario', responses: { 200: { description: 'OK' } } } },

    // ===== FINANCEIRO =====
    '/financeiro/contas': { get: { tags: ['Financeiro'], summary: 'Plano de contas', parameters: [{ name: 'search', in: 'query', schema: { type: 'string' } }], responses: { 200: { description: 'OK' } } } },
    '/financeiro/pendentes/clientes': { get: { tags: ['Financeiro'], summary: 'Dividas de clientes', responses: { 200: { description: 'OK' } } } },
    '/financeiro/pendentes/fornecedores': { get: { tags: ['Financeiro'], summary: 'Dividas a fornecedores', responses: { 200: { description: 'OK' } } } },
    '/financeiro/pendentes/resumo': { get: { tags: ['Financeiro'], summary: 'Resumo a receber vs a pagar', responses: { 200: { description: 'OK' } } } },
    '/financeiro/tesouraria/mensal': { get: { tags: ['Financeiro'], summary: 'Recebimentos vs pagamentos mensal', responses: { 200: { description: 'OK' } } } },

    // ===== QUERY LIVRE =====
    '/query': { post: { tags: ['Query'], summary: 'Executar SQL read-only', requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', properties: { sql: { type: 'string', example: "SELECT TOP 10 * FROM Clientes" } }, required: ['sql'] } } } }, responses: { 200: { description: 'OK' } } } },

    // ===== COPILOT =====
    '/copilot/context': { get: { tags: ['Copilot'], summary: 'Contexto da API para LLM', responses: { 200: { description: 'OK' } } } },
  },
};

module.exports = swaggerDoc;
