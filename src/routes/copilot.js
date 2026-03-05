const { Router } = require('express');
const { query } = require('../db');
const { asyncHandler } = require('../middleware/errorHandler');

const router = Router();

// GET /copilot/context - Contexto completo para o LLM entender a API
router.get('/context', asyncHandler(async (req, res) => {
  res.json({
    descricao: 'API REST para consulta de dados do ERP Primavera V10 (Cegid) da empresa Cimenteira do Louro. Apenas leitura (read-only). Todos os valores monetarios estao em EUR.',
    baseUrl: '/api',
    modulosDisponiveis: {
      clientes: {
        descricao: 'Gestao de clientes (compradores)',
        endpoints: [
          { metodo: 'GET', path: '/api/clientes', descricao: 'Listar clientes com paginacao', parametros: 'search, zona, vendedor, page, limit' },
          { metodo: 'GET', path: '/api/clientes/:id', descricao: 'Detalhes de um cliente pelo codigo' },
          { metodo: 'GET', path: '/api/clientes/:id/documentos', descricao: 'Documentos de venda do cliente', parametros: 'tipoDoc, page, limit' },
          { metodo: 'GET', path: '/api/clientes/:id/saldo', descricao: 'Saldo em conta corrente (dividas pendentes)' },
          { metodo: 'GET', path: '/api/clientes/analytics/resumo', descricao: 'Resumo: total de clientes, activos, debito total e medio' },
        ],
        camposChave: {
          Cliente: 'Codigo unico do cliente (ex: "C0001")',
          Nome: 'Nome completo ou razao social',
          NumContrib: 'Numero de contribuinte (NIF)',
          Zona: 'Codigo da zona geografica',
          Vendedor: 'Codigo do vendedor associado',
          CondPag: 'Condicao de pagamento (ex: "F4" = 30 dias)',
          TotalDeb: 'Total em divida (EUR)',
          LimiteCred: 'Limite de credito (EUR)',
          Situacao: 'Estado do cliente (Activo, Inactivo, etc.)',
        },
      },
      artigos: {
        descricao: 'Catalogo de artigos/produtos',
        endpoints: [
          { metodo: 'GET', path: '/api/artigos', descricao: 'Listar artigos com paginacao', parametros: 'search, familia, comStock (true/false), page, limit' },
          { metodo: 'GET', path: '/api/artigos/:id', descricao: 'Detalhes de um artigo pelo codigo' },
          { metodo: 'GET', path: '/api/artigos/:id/movimentos', descricao: 'Movimentos de stock do artigo', parametros: 'page, limit' },
          { metodo: 'GET', path: '/api/artigos/analytics/stock-baixo', descricao: 'Artigos com stock abaixo do minimo definido' },
          { metodo: 'GET', path: '/api/artigos/analytics/valor-stock', descricao: 'Valor total do inventario' },
        ],
        camposChave: {
          Artigo: 'Codigo unico do artigo (ex: "A001")',
          Descricao: 'Nome/descricao do artigo',
          Familia: 'Codigo da familia de artigos',
          STKActual: 'Stock actual em unidades',
          STKMinimo: 'Stock minimo definido',
          PCMedio: 'Preco de custo medio (EUR)',
          PCUltimo: 'Preco da ultima compra (EUR)',
          MovStock: '"S" = artigo com gestao de stock, "N" = sem gestao de stock',
          ArtigoAnulado: 'Se o artigo esta descontinuado',
        },
      },
      vendas: {
        descricao: 'Documentos de venda (facturas, notas de credito, etc.)',
        endpoints: [
          { metodo: 'GET', path: '/api/vendas/documentos', descricao: 'Listar documentos de venda', parametros: 'tipoDoc, cliente, dataInicio (YYYY-MM-DD), dataFim (YYYY-MM-DD), page, limit' },
          { metodo: 'GET', path: '/api/vendas/documentos/:id', descricao: 'Detalhes de um documento com linhas (produtos vendidos)' },
          { metodo: 'GET', path: '/api/vendas/analytics/resumo', descricao: 'Resumo geral: total facturacao, notas credito, ticket medio', parametros: 'dataInicio, dataFim' },
          { metodo: 'GET', path: '/api/vendas/analytics/mensal', descricao: 'Volume de vendas agrupado por mes', parametros: 'dataInicio, dataFim' },
          { metodo: 'GET', path: '/api/vendas/analytics/diario', descricao: 'Vendas por dia', parametros: 'dataInicio, dataFim' },
          { metodo: 'GET', path: '/api/vendas/analytics/top-clientes', descricao: 'Ranking dos melhores clientes por facturacao', parametros: 'top (num), dataInicio, dataFim' },
          { metodo: 'GET', path: '/api/vendas/analytics/top-artigos', descricao: 'Artigos mais vendidos', parametros: 'top, por (valor|quantidade), dataInicio, dataFim' },
          { metodo: 'GET', path: '/api/vendas/analytics/por-vendedor', descricao: 'Vendas agrupadas por vendedor', parametros: 'dataInicio, dataFim' },
          { metodo: 'GET', path: '/api/vendas/analytics/por-familia', descricao: 'Vendas agrupadas por familia de artigos', parametros: 'dataInicio, dataFim' },
          { metodo: 'GET', path: '/api/vendas/analytics/por-zona', descricao: 'Vendas agrupadas por zona geografica', parametros: 'dataInicio, dataFim' },
          { metodo: 'GET', path: '/api/vendas/analytics/yoy', descricao: 'Comparacao ano a ano (Year over Year)' },
        ],
        tiposDocumento: {
          FA: 'Factura',
          FR: 'Factura-Recibo',
          FS: 'Factura Simplificada',
          NC: 'Nota de Credito',
          GT: 'Guia de Transporte',
          GR: 'Guia de Remessa',
          OR: 'Orcamento',
          EC: 'Encomenda de Cliente',
        },
      },
      compras: {
        descricao: 'Documentos de compra a fornecedores',
        endpoints: [
          { metodo: 'GET', path: '/api/compras/documentos', descricao: 'Listar documentos de compra', parametros: 'tipoDoc, fornecedor, dataInicio, dataFim, page, limit' },
          { metodo: 'GET', path: '/api/compras/documentos/:id', descricao: 'Detalhes de um documento de compra com linhas' },
          { metodo: 'GET', path: '/api/compras/analytics/resumo', descricao: 'Resumo geral de compras', parametros: 'dataInicio, dataFim' },
          { metodo: 'GET', path: '/api/compras/analytics/mensal', descricao: 'Compras agrupadas por mes', parametros: 'dataInicio, dataFim' },
          { metodo: 'GET', path: '/api/compras/analytics/top-fornecedores', descricao: 'Ranking dos maiores fornecedores', parametros: 'top, dataInicio, dataFim' },
          { metodo: 'GET', path: '/api/compras/analytics/top-artigos', descricao: 'Artigos mais comprados', parametros: 'top, dataInicio, dataFim' },
        ],
      },
      fornecedores: {
        descricao: 'Gestao de fornecedores',
        endpoints: [
          { metodo: 'GET', path: '/api/fornecedores', descricao: 'Listar fornecedores', parametros: 'search, page, limit' },
          { metodo: 'GET', path: '/api/fornecedores/:id', descricao: 'Detalhes de um fornecedor' },
          { metodo: 'GET', path: '/api/fornecedores/:id/documentos', descricao: 'Documentos de compra do fornecedor', parametros: 'page, limit' },
          { metodo: 'GET', path: '/api/fornecedores/:id/saldo', descricao: 'Saldo pendente ao fornecedor' },
        ],
      },
      stock: {
        descricao: 'Gestao de inventario e stock',
        endpoints: [
          { metodo: 'GET', path: '/api/stock/actual', descricao: 'Stock actual por artigo', parametros: 'armazem, familia, page, limit' },
          { metodo: 'GET', path: '/api/stock/por-armazem', descricao: 'Stock agrupado por armazem' },
          { metodo: 'GET', path: '/api/stock/por-familia', descricao: 'Stock agrupado por familia' },
          { metodo: 'GET', path: '/api/stock/alertas', descricao: 'Artigos com stock critico (sem stock, abaixo minimo, acima maximo)' },
          { metodo: 'GET', path: '/api/stock/movimentos', descricao: 'Movimentos de stock recentes', parametros: 'tipo, dataInicio, dataFim, page, limit' },
          { metodo: 'GET', path: '/api/stock/rotacao', descricao: 'Analise de rotacao de stock (dias de cobertura)', parametros: 'dias (default 90)' },
          { metodo: 'GET', path: '/api/stock/resumo', descricao: 'Resumo geral do inventario' },
        ],
      },
      financeiro: {
        descricao: 'Modulo financeiro - contas correntes e pendentes',
        endpoints: [
          { metodo: 'GET', path: '/api/financeiro/contas', descricao: 'Plano de contas', parametros: 'search, page, limit' },
          { metodo: 'GET', path: '/api/financeiro/pendentes/clientes', descricao: 'Dividas de clientes (contas a receber)', parametros: 'page, limit' },
          { metodo: 'GET', path: '/api/financeiro/pendentes/fornecedores', descricao: 'Dividas a fornecedores (contas a pagar)', parametros: 'page, limit' },
          { metodo: 'GET', path: '/api/financeiro/pendentes/aging', descricao: 'Analise de antiguidade de divida por escaloes', parametros: 'tipo (C=clientes, F=fornecedores)' },
          { metodo: 'GET', path: '/api/financeiro/pendentes/resumo', descricao: 'Resumo: total a receber, total a pagar, saldo liquido' },
        ],
      },
      rh: {
        descricao: 'Recursos Humanos - funcionarios e departamentos',
        endpoints: [
          { metodo: 'GET', path: '/api/rh/funcionarios', descricao: 'Listar funcionarios', parametros: 'search, departamento, situacao, page, limit' },
          { metodo: 'GET', path: '/api/rh/departamentos', descricao: 'Lista de departamentos com contagem de funcionarios' },
          { metodo: 'GET', path: '/api/rh/analytics/resumo', descricao: 'Resumo RH: total funcionarios, activos, vencimento medio, massa salarial' },
          { metodo: 'GET', path: '/api/rh/analytics/por-departamento', descricao: 'Funcionarios e custos por departamento' },
          { metodo: 'GET', path: '/api/rh/analytics/antiguidade', descricao: 'Distribuicao de funcionarios por tempo na empresa' },
        ],
        camposChave: {
          Situacao: '"A" = Activo, "I" = Inactivo, "D" = Despedido',
          Vencimento: 'Salario base mensal (EUR)',
          CodDepartamento: 'Codigo do departamento',
        },
      },
      query: {
        descricao: 'Endpoint para executar queries SQL read-only directamente na base de dados Primavera. USAR APENAS quando os endpoints estruturados nao respondem a pergunta.',
        endpoints: [
          { metodo: 'POST', path: '/api/query', descricao: 'Executar query SELECT. Body: { "sql": "SELECT ..." }. Apenas SELECT e WITH (CTE) permitidos.' },
        ],
        tabelasPrincipais: [
          { tabela: 'Clientes', descricao: 'Ficha de clientes' },
          { tabela: 'Fornecedores', descricao: 'Ficha de fornecedores' },
          { tabela: 'Artigo', descricao: 'Ficha de artigos/produtos' },
          { tabela: 'CabecDoc', descricao: 'Cabecalhos de documentos de venda' },
          { tabela: 'LinhasDoc', descricao: 'Linhas de documentos de venda (ligacao: LinhasDoc.IdCabecDoc = CabecDoc.Id)' },
          { tabela: 'CabecCompras', descricao: 'Cabecalhos de documentos de compra' },
          { tabela: 'LinhasCompras', descricao: 'Linhas de documentos de compra (ligacao: LinhasCompras.IdCabecCompras = CabecCompras.Id)' },
          { tabela: 'Pendentes', descricao: 'Documentos pendentes de pagamento. TipoEntidade: C=Cliente, F=Fornecedor' },
          { tabela: 'Funcionarios', descricao: 'Ficha de funcionarios' },
          { tabela: 'Departamentos', descricao: 'Departamentos da empresa' },
          { tabela: 'Familias', descricao: 'Familias de artigos' },
          { tabela: 'Vendedores', descricao: 'Vendedores' },
          { tabela: 'Zonas', descricao: 'Zonas geograficas' },
          { tabela: 'Armazens', descricao: 'Armazens' },
          { tabela: 'PlanoContas', descricao: 'Plano de contas contabilistico' },
          { tabela: 'INV_Movimentos', descricao: 'Movimentos de stock/inventario' },
        ],
        avisos: [
          'Usar sempre os endpoints estruturados primeiro (/api/vendas, /api/clientes, etc.)',
          'O endpoint /query e para casos excepcionais que os endpoints normais nao cobrem',
          'Apenas SELECT permitido - INSERT, UPDATE, DELETE sao bloqueados',
          'A tabela de artigos chama-se "Artigo" (singular), nao "Artigos"',
          'MovStock e nvarchar: "S" (sim) ou "N" (nao), nao inteiro',
          'Datas em formato YYYY-MM-DD nos parametros de filtro',
        ],
      },
      sistema: {
        descricao: 'Endpoints de sistema e diagnostico',
        endpoints: [
          { metodo: 'GET', path: '/api/health', descricao: 'Estado da API e conectividade da base de dados' },
          { metodo: 'GET', path: '/api/health/tables', descricao: 'Lista todas as tabelas da base de dados' },
          { metodo: 'GET', path: '/api/health/tables/:nome/columns', descricao: 'Colunas de uma tabela especifica' },
        ],
      },
    },
    paginacao: {
      descricao: 'Endpoints com listas suportam paginacao',
      parametros: {
        page: 'Numero da pagina (default: 1)',
        limit: 'Registos por pagina (default: 50, max: 200)',
      },
      exemploResposta: '{ page: 1, limit: 50, total: 150, data: [...] }',
    },
    filtrosDatas: {
      descricao: 'Endpoints de analytics aceitam filtros de data',
      parametros: {
        dataInicio: 'Data inicio no formato YYYY-MM-DD',
        dataFim: 'Data fim no formato YYYY-MM-DD',
      },
    },
    dicasParaLLM: [
      'Comecar sempre pelo endpoint de contexto (/api/copilot/context) para entender a API',
      'Para perguntas genericas, usar os endpoints /analytics/resumo de cada modulo',
      'Para perguntas sobre "quanto vendemos", usar /api/vendas/analytics/resumo com filtros de data',
      'Para perguntas sobre dividas, usar /api/financeiro/pendentes/resumo',
      'Para perguntas sobre stock, usar /api/stock/resumo e /api/stock/alertas',
      'Para perguntas sobre funcionarios, usar /api/rh/analytics/resumo',
      'Usar /api/query apenas como ultimo recurso quando nenhum endpoint estruturado responde',
      'Valores monetarios estao em EUR (euros)',
      'A empresa e a Cimenteira do Louro (industria cimenteira)',
    ],
  });
}));

module.exports = router;
