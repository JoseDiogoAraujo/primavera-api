const { Router } = require('express');
const { asyncHandler } = require('../middleware/errorHandler');

const router = Router();

router.get('/context', asyncHandler(async (req, res) => {
  res.json({
    descricao: 'API LLM-Ready para dados do ERP Primavera V10 (Cegid) da Cimenteira do Louro. Valores em EUR. Todos os calculos de faturacao usam 34 tipos de documento com notas de credito como valores negativos.',
    versao: '4.0',
    baseUrl: '/api',
    autenticacao: 'Basic Auth (user:password) ou header x-api-key',
    logicaFaturacao: {
      descricao: 'Volume de negocios calculado com SUM(CASE WHEN creditNote THEN -total ELSE total END)',
      documentosFaturacao: ['DV','DVI','FR','FR1','FRI','FS','FS1','EFAA','VD','VDI','NC','NCE','NCI','NCT','ND','FA','FA2','FAA','FAC','FE2','FI','FI2','FIT','FM','FMI','FNT','ADD','ADE','ADI','ADT','ALC','ALE','ALI','CIE'],
      notasCredito: ['NC','NCE','NCI','NCT','ALC','ALE','ALI'],
      orcamentos: ['POR'],
      nota: 'Documentos anulados (CabecDocStatus.Anulado=1) sao sempre excluidos.',
    },
    endpoints: {
      clientes: {
        descricao: 'Perfil financeiro, historico e segmentacao de clientes',
        lista: { method: 'GET', path: '/api/clientes', params: 'search, zona, vendedor, page, limit' },
        detalhe: { method: 'GET', path: '/api/clientes/:id' },
        perfilFinanceiro: {
          method: 'GET',
          path: '/api/clientes/:id/perfil-financeiro',
          descricao: 'Limite de credito, bloqueio, divida, faturas vencidas, condicoes pagamento',
          responde: [
            'Tem limite de credito disponivel?',
            'Esta bloqueado para vendas?',
            'Qual o saldo em divida?',
            'Tem faturas vencidas e quantos dias de atraso?',
            'Quais as condicoes de pagamento?',
          ],
        },
        historico: {
          method: 'GET',
          path: '/api/clientes/:id/historico',
          descricao: 'Faturacao YTD vs ano passado, ultimos 12 meses, maior venda, ultimo orcamento, margem media, evolucao mensal',
          responde: [
            'Quanto comprou este ano?',
            'Esta a comprar mais ou menos que o ano passado?',
            'Qual foi a maior venda?',
            'Qual o ultimo orcamento (POR)?',
            'Qual a margem media?',
            'Total faturado nos ultimos 12 meses?',
          ],
        },
        segmentacao: {
          method: 'GET',
          path: '/api/clientes/segmentacao',
          params: 'zona, localidade, periodo (mes|trimestre|ano), limit',
          descricao: 'Top clientes, crescimento/declinio, inativos (sem compra ha 6+ meses)',
          responde: [
            'Quais os top clientes de Braga?',
            'Quem mais cresceu/diminuiu este trimestre?',
            'Que clientes nao compram ha mais de 6 meses?',
          ],
        },
        top: {
          method: 'GET',
          path: '/api/clientes/top',
          params: 'zona, localidade, periodo, limit',
          descricao: 'Ranking rapido de clientes por volume faturado',
        },
      },
      artigos: {
        descricao: 'Stock, precos, top vendidos, analise por cliente',
        lista: { method: 'GET', path: '/api/artigos', params: 'search, familia, subfamilia, page, limit' },
        detalhe: { method: 'GET', path: '/api/artigos/:id' },
        stock: {
          method: 'GET',
          path: '/api/artigos/:id/stock',
          descricao: 'Stock total vs reservado vs disponivel por armazem e estado',
          responde: ['Quanto stock disponivel existe?'],
        },
        infoCliente: {
          method: 'GET',
          path: '/api/artigos/:id/cliente/:clienteId',
          descricao: 'Peso, preco especifico para cliente (PVP por TipoPrec + desconto), ultima compra, historico quantidades',
          responde: [
            'Qual o preco para este cliente?',
            'Qual o peso e volume?',
            'Quanto comprou este cliente deste artigo?',
          ],
        },
        topVendidos: {
          method: 'GET',
          path: '/api/artigos/top',
          params: 'periodo (mes|trimestre|semestre|ano), familia, limit',
          descricao: 'Top artigos mais vendidos',
          responde: ['Top artigos mais vendidos este mes/ano/familia X?'],
        },
        topClientes: {
          method: 'GET',
          path: '/api/artigos/:id/top-clientes',
          params: 'periodo, limit',
          descricao: 'Que clientes mais compram este artigo',
          responde: ['Qual o cliente que mais compra o artigo X?'],
        },
        maiorMargem: {
          method: 'GET',
          path: '/api/artigos/maior-margem',
          params: 'periodo, familia, limit',
          descricao: 'Artigos com maior margem media ponderada',
          responde: ['Qual o artigo com maior margem?'],
        },
      },
      comercial: {
        descricao: 'Inteligencia comercial: resumos, localidades, risco, recomendacoes, vendedores',
        resumo: {
          method: 'GET',
          path: '/api/comercial/resumo',
          params: 'vendedor',
          descricao: 'Total vendas e margem mes/ano com comparacao periodo anterior',
          responde: [
            'Qual o meu total de vendas este mes/ano?',
            'Qual a margem?',
          ],
        },
        porLocalidade: {
          method: 'GET',
          path: '/api/comercial/por-localidade',
          params: 'periodo (mes|trimestre|ano), limit',
          descricao: 'Vendas agrupadas por localidade/zona',
          responde: ['Onde vendemos mais? Onde vendemos menos?'],
        },
        clientesRisco: {
          method: 'GET',
          path: '/api/comercial/clientes-risco',
          params: 'diasInativo (default 180), quedaMinima (default 30), limit',
          descricao: 'Clientes inativos, em queda, e com divida vencida',
          responde: [
            'Que clientes deixaram de comprar?',
            'Quais estao em risco?',
          ],
        },
        recomendacoes: {
          method: 'GET',
          path: '/api/comercial/recomendacoes/:clienteId',
          params: 'limit',
          descricao: 'Produtos que clientes semelhantes (mesma zona, artigos comuns) compram mas este cliente nao',
          responde: ['Que produtos recomendar a este cliente?'],
        },
        vendedores: {
          method: 'GET',
          path: '/api/comercial/vendedores',
          params: 'periodo (mes|ano), limit',
          descricao: 'Performance por vendedor: vendas, margem, clientes, ticket medio',
        },
        evolucaoMensal: {
          method: 'GET',
          path: '/api/comercial/evolucao-mensal',
          params: 'ano',
          descricao: 'Evolucao mensal com comparacao ano anterior',
        },
      },
      utilitarios: {
        query: {
          method: 'POST',
          path: '/api/query',
          descricao: 'Execucao de queries SQL read-only',
          body: '{ "sql": "SELECT ...", "params": {} }',
        },
        health: {
          method: 'GET',
          path: '/api/health',
          descricao: 'Estado da API e BD. Tambem /api/health/tables e /api/health/tables/:nome/columns para explorar schema.',
        },
      },
    },
    paginacao: { parametros: 'page (default 1), limit (default 50, max 500)', resposta: '{ page, limit, total, data: [...] }' },
    periodos: { valores: 'mes, trimestre, semestre, ano', nota: 'Sempre relativo a data atual' },
    dicas: [
      'Usar /clientes/:id/perfil-financeiro para verificar credito antes de encomenda',
      'Usar /clientes/:id/historico para comparar faturacao YTD vs ano passado',
      'Usar /comercial/clientes-risco para identificar clientes que deixaram de comprar',
      'Usar /comercial/recomendacoes/:id para sugestoes de cross-selling',
      'Usar /artigos/:id/cliente/:clienteId para preco especifico por cliente',
      'Notas de credito (NC, ALC, etc.) sao automaticamente subtraidas nos totais',
      'Todos os endpoints excluem documentos anulados automaticamente',
    ],
  });
}));

module.exports = router;
