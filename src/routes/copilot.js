const { Router } = require('express');
const { asyncHandler } = require('../middleware/errorHandler');

const router = Router();

router.get('/context', asyncHandler(async (req, res) => {
  res.json({
    descricao: 'API LLM-Ready para dados do ERP Primavera V10 (Cegid) da Cimenteira do Louro. Valores em EUR, sempre sem IVA (TotalDocumento - TotalIva). Documentos anulados sao sempre excluidos.',
    versao: '5.0',
    baseUrl: '/api',
    autenticacao: 'Basic Auth (user:password) ou header x-api-key',
    logicaFaturacao: {
      descricao: 'Volume de faturacao nacional: SUM dos docs positivos menos docs negativos, sem IVA',
      documentosPositivos: ['FA','FR','FNT','FAC'],
      documentosNegativos: ['NC','NCT','NPC'],
      orcamentos: ['POR'],
      calculo: 'SUM(CASE WHEN TipoDoc IN (NC,NCT,NPC) THEN -(TotalDocumento-TotalIva) ELSE (TotalDocumento-TotalIva) END)',
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
          descricao: 'Faturacao YTD vs ano passado, ultimos 12 meses, maior venda, ultima compra (com artigos comprados), ultimo orcamento, margem media, evolucao mensal',
          responde: [
            'Quanto comprou este ano?',
            'Esta a comprar mais ou menos que o ano passado?',
            'Qual foi a maior venda?',
            'Qual foi a ultima compra e que artigos levou?',
            'Qual o ultimo orcamento (POR)?',
            'Qual a margem media?',
            'Total faturado nos ultimos 12 meses?',
          ],
        },
        segmentacao: {
          method: 'GET',
          path: '/api/clientes/segmentacao',
          params: 'ano, mes (YYYY-MM), zona, localidade, periodo (mes|trimestre|ano), limit',
          descricao: 'Top clientes, crescimento/declinio, inativos. Use ano=2025 ou mes=2025-03 para periodo especifico.',
          responde: [
            'Quais os top clientes de 2025?',
            'Quem mais cresceu/diminuiu em 2024?',
            'Que clientes nao compram ha mais de 6 meses?',
          ],
        },
        top: {
          method: 'GET',
          path: '/api/clientes/top',
          params: 'ano, mes (YYYY-MM), zona, localidade, periodo, limit',
          descricao: 'Ranking de clientes por faturacao. Use ano=2025 ou mes=2025-03.',
        },
        atividade: {
          method: 'GET',
          path: '/api/clientes/:id/atividade',
          descricao: 'Resumo anual de orcamentos vs compras. Mostra por ano: quantos orcamentos pediu, quantas compras fez, ultimo de cada.',
          responde: [
            'O cliente pediu orcamentos mas nao comprou?',
            'Quantos orcamentos e compras fez em 2025?',
            'Quando foi a ultima compra vs ultimo orcamento?',
          ],
        },
        comparacaoAnual: {
          method: 'GET',
          path: '/api/clientes/:id/comparacao-anual',
          params: 'ano (default: ano corrente)',
          descricao: 'Faturacao do ano vs ano anterior. Mostra se esta a comprar mais ou menos.',
          responde: [
            'O cliente esta a comprar mais ou menos que o ano passado?',
            'Comparar faturacao 2025 vs 2024 do cliente X?',
          ],
        },
        total12Meses: {
          method: 'GET',
          path: '/api/clientes/:id/total-12-meses',
          descricao: 'Total faturado nos ultimos 12 meses com evolucao mensal.',
          responde: [
            'Quanto faturou o cliente nos ultimos 12 meses?',
            'Qual a evolucao mensal do cliente?',
          ],
        },
        inativos: {
          method: 'GET',
          path: '/api/clientes/inativos',
          params: 'meses (default 6), minCompras (default 3), limit',
          descricao: 'Clientes que tinham compras regulares (minimo 3) mas pararam ha N meses. Mostra historico, faturacao anterior e dias sem compra.',
          responde: [
            'Que clientes deixaram de comprar?',
            'Clientes inativos ha mais de 6 meses que compravam regularmente?',
            'Quem parou de comprar no ultimo ano?',
          ],
        },
        maiorVenda: {
          method: 'GET',
          path: '/api/clientes/:id/maior-venda',
          params: 'ano, mes (YYYY-MM), periodo',
          descricao: 'Maior venda/compra do cliente com artigos. Use ano=2025 para filtrar.',
          responde: [
            'Qual foi a maior venda do cliente X?',
            'Maior compra do cliente em 2025?',
          ],
        },
        taxaConversao: {
          method: 'GET',
          path: '/api/clientes/:id/taxa-conversao',
          params: 'ano, mes (YYYY-MM), periodo',
          descricao: 'Orcamentos elaborados vs adjudicados (fechados). Taxa de conversao e valores.',
          responde: [
            'Quantos orcamentos foram adjudicados em 2025?',
            'Qual a taxa de conversao de orcamentos do cliente?',
            'Quanto valor em orcamentos esta pendente?',
          ],
        },
        orcamentos: {
          method: 'GET',
          path: '/api/clientes/:id/orcamentos',
          params: 'ano, mes (YYYY-MM), periodo, limit',
          descricao: 'Lista orcamentos (POR) de um cliente. Use ano=2024 ou mes=2024-01.',
          responde: [
            'Que orcamentos fez o cliente X em 2024?',
            'Orcamentos de janeiro de 2025 do cliente Y?',
          ],
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
          params: 'ano, mes (YYYY-MM), periodo, familia, limit',
          descricao: 'Top artigos mais vendidos. Use ano=2025 ou mes=2025-03.',
          responde: ['Top artigos mais vendidos em 2025?', 'Top artigos da familia X em marco 2025?'],
        },
        topClientes: {
          method: 'GET',
          path: '/api/artigos/:id/top-clientes',
          params: 'ano, mes (YYYY-MM), periodo, limit',
          descricao: 'Que clientes mais compram este artigo. Use ano=2025 ou mes=2025-03.',
          responde: ['Qual o cliente que mais comprou o artigo X em 2025?'],
        },
      },
      vendas: {
        descricao: 'Documentos de venda, resumos, rankings e analytics geografico',
        documentos: {
          method: 'GET',
          path: '/api/vendas/documentos',
          params: 'search, tipoDoc, cliente, zona, serie, artigo, vendedor, dataInicio (YYYY-MM-DD), dataFim (YYYY-MM-DD), page, limit',
          descricao: 'Lista documentos de venda com filtros genericos. Pesquisa por nome, entidade ou numero de documento.',
          responde: [
            'Que faturas tem o cliente X?',
            'Documentos de venda do mes passado?',
            'Faturas com o artigo Y?',
          ],
        },
        documentoDetalhe: {
          method: 'GET',
          path: '/api/vendas/documentos/:id',
          descricao: 'Detalhes de um documento com cabecalho e todas as linhas (artigos, quantidades, precos).',
          responde: [
            'Mostra os detalhes da fatura X?',
            'Que artigos tem este documento?',
          ],
        },
        resumo: {
          method: 'GET',
          path: '/api/vendas/resumo',
          params: 'dataInicio (YYYY-MM-DD), dataFim (YYYY-MM-DD)',
          descricao: 'Totais de vendas: total facturado, total abatimentos, numero de faturas, numero de clientes, ticket medio.',
          responde: [
            'Qual o total facturado este ano?',
            'Quantas faturas emitimos?',
            'Qual o ticket medio?',
          ],
        },
        top: {
          method: 'GET',
          path: '/api/vendas/top',
          params: 'por (cliente|artigo|vendedor, default: cliente), top (default 10, max 100), dataInicio, dataFim',
          descricao: 'Rankings genericos por cliente, artigo ou vendedor.',
          responde: [
            'Top 10 clientes por vendas?',
            'Top artigos mais vendidos?',
            'Que vendedor vendeu mais?',
          ],
        },
        recentes: {
          method: 'GET',
          path: '/api/vendas/recentes/:cliente',
          descricao: 'Faturas (FA) do ano passado de um cliente, agrupadas por documento com linhas de artigos.',
          responde: [
            'Que faturas teve o cliente no ano passado?',
            'Historico de compras recentes do cliente?',
          ],
        },
        porLocalidade: {
          method: 'GET',
          path: '/api/vendas/analytics/por-localidade',
          params: 'top (default 100, max 500), dataInicio (YYYY-MM-DD), dataFim (YYYY-MM-DD)',
          descricao: 'Vendas por localidade com coordenadas GPS. Usa apenas docs positivos (FA,FR,FNT,FAC) sem IVA. Localidades normalizadas para municipios portugueses. Usado pelo Grafana geomap.',
          responde: [
            'Onde vendemos mais?',
            'Vendas por localidade no mapa?',
            'Top localidades por faturacao?',
          ],
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
          params: 'ano, mes (YYYY-MM), periodo, limit',
          descricao: 'Vendas por localidade/zona. Use ano=2025 ou mes=2025-03.',
          responde: ['Onde vendemos mais em 2025?', 'Vendas por localidade em marco 2025?'],
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
          params: 'ano, mes (YYYY-MM), periodo, limit',
          descricao: 'Performance por vendedor. Use ano=2025 ou mes=2025-03.',
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
    periodos: {
      valores: 'mes, trimestre, semestre, ano (relativo a data atual)',
      filtrosAbsolutos: 'ano=2025 (ano especifico) ou mes=2025-03 (mes especifico)',
      prioridade: 'mes > ano > periodo',
      nota: 'Usar ano ou mes para consultar periodos passados. Sem eles, usa o periodo corrente.',
    },
    dicas: [
      'Usar /clientes/:id/perfil-financeiro para verificar credito antes de encomenda',
      'Usar /clientes/:id/historico para comparar faturacao YTD vs ano passado',
      'Usar /comercial/clientes-risco para identificar clientes que deixaram de comprar',
      'Usar /comercial/recomendacoes/:id para sugestoes de cross-selling',
      'Usar /artigos/:id/cliente/:clienteId para preco especifico por cliente',
      'Usar /vendas/documentos para pesquisar faturas por cliente, artigo ou vendedor',
      'Usar /vendas/analytics/por-localidade para ver vendas no mapa por localidade',
      'Docs positivos: FA, FR, FNT, FAC. Negativos (abatidos): NC, NCT, NPC',
      'Valores sempre sem IVA (TotalDocumento - TotalIva)',
      'Todos os endpoints excluem documentos anulados automaticamente',
    ],
  });
}));

module.exports = router;
