const router = require('express').Router();
const { query, sql } = require('../db');
const { asyncHandler } = require('../middleware/errorHandler');
const { parsePagination } = require('../middleware/pagination');

// ---------------------------------------------------------------------------
// Constants: Document types for billing/sales
// ---------------------------------------------------------------------------
const DOC_TYPES_FATURACAO = [
  'DV','DVI','FR','FR1','FRI','FS','FS1','EFAA','VD','VDI',
  'NC','NCE','NCI','NCT','ND','FA','FA2','FAA','FAC','FE2',
  'FI','FI2','FIT','FM','FMI','FNT','ADD','ADE','ADI','ADT',
  'ALC','ALE','ALI','CIE'
];

const DOC_TYPES_CREDITO = ['NC','NCE','NCI','NCT','ALC','ALE','ALI'];

// SQL IN-clause fragment for all billing doc types
const IN_FATURACAO = DOC_TYPES_FATURACAO.map(d => `'${d}'`).join(',');

// CASE expression: positive for normal docs, negative for credit notes
const CASE_VALOR = `
  CASE
    WHEN cd.TipoDoc IN (${DOC_TYPES_CREDITO.map(d => `'${d}'`).join(',')})
      THEN -cd.TotalDocumento
    ELSE cd.TotalDocumento
  END`;

const CASE_MARGEM = `
  CASE
    WHEN cd.TipoDoc IN (${DOC_TYPES_CREDITO.map(d => `'${d}'`).join(',')})
      THEN -cd.MargemDoc
    ELSE cd.MargemDoc
  END`;

// Base WHERE for non-annulled billing docs
const BASE_WHERE = `
  cd.TipoDoc IN (${IN_FATURACAO})
  AND ISNULL(cds.Anulado, 0) = 0`;

const BASE_JOIN = `
  FROM CabecDoc cd
  LEFT JOIN CabecDocStatus cds ON cd.Id = cds.IdCabecDoc`;

// ---------------------------------------------------------------------------
// 1. GET /resumo
//    "Qual e o meu total de vendas e margem (Mes/Ano)?"
// ---------------------------------------------------------------------------
router.get('/resumo', asyncHandler(async (req, res) => {
  const vendedor = req.query.vendedor || null;

  // Build optional vendedor filter (via LinhasDoc)
  let vendedorJoin = '';
  let vendedorWhere = '';
  if (vendedor) {
    vendedorJoin = ' INNER JOIN LinhasDoc ld ON ld.IdCabecDoc = cd.Id';
    vendedorWhere = ' AND ld.Vendedor = @vendedor';
  }

  const sqlText = `
    -- Current month
    SELECT
      FORMAT(GETDATE(), 'yyyy-MM') AS periodo,
      SUM(${CASE_VALOR}) AS totalVendas,
      SUM(${CASE_MARGEM}) AS margemTotal,
      COUNT(DISTINCT cd.Id) AS numDocumentos
    ${BASE_JOIN}
    ${vendedorJoin}
    WHERE ${BASE_WHERE}
      AND YEAR(cd.Data) = YEAR(GETDATE())
      AND MONTH(cd.Data) = MONTH(GETDATE())
      ${vendedorWhere};

    -- Current year
    SELECT
      CAST(YEAR(GETDATE()) AS NVARCHAR) AS periodo,
      SUM(${CASE_VALOR}) AS totalVendas,
      SUM(${CASE_MARGEM}) AS margemTotal,
      COUNT(DISTINCT cd.Id) AS numDocumentos
    ${BASE_JOIN}
    ${vendedorJoin}
    WHERE ${BASE_WHERE}
      AND YEAR(cd.Data) = YEAR(GETDATE())
      ${vendedorWhere};

    -- Previous month
    SELECT
      SUM(${CASE_VALOR}) AS totalVendas
    ${BASE_JOIN}
    ${vendedorJoin}
    WHERE ${BASE_WHERE}
      AND YEAR(cd.Data) = YEAR(DATEADD(MONTH, -1, GETDATE()))
      AND MONTH(cd.Data) = MONTH(DATEADD(MONTH, -1, GETDATE()))
      ${vendedorWhere};

    -- Previous year (same period YTD)
    SELECT
      SUM(${CASE_VALOR}) AS totalVendas
    ${BASE_JOIN}
    ${vendedorJoin}
    WHERE ${BASE_WHERE}
      AND YEAR(cd.Data) = YEAR(GETDATE()) - 1
      AND MONTH(cd.Data) <= MONTH(GETDATE())
      AND (MONTH(cd.Data) < MONTH(GETDATE()) OR DAY(cd.Data) <= DAY(GETDATE()))
      ${vendedorWhere};
  `;

  const params = {};
  if (vendedor) params.vendedor = vendedor;

  const result = await query(sqlText, params);

  const mesData = result.recordsets[0][0] || {};
  const anoData = result.recordsets[1][0] || {};
  const mesAnteriorData = result.recordsets[2][0] || {};
  const anoAnteriorData = result.recordsets[3][0] || {};

  const mesTotalVendas = mesData.totalVendas || 0;
  const mesMargemTotal = mesData.margemTotal || 0;
  const mesNumDocs = mesData.numDocumentos || 0;

  const anoTotalVendas = anoData.totalVendas || 0;
  const anoMargemTotal = anoData.margemTotal || 0;
  const anoNumDocs = anoData.numDocumentos || 0;

  const mesAnteriorVendas = mesAnteriorData.totalVendas || 0;
  const anoAnteriorVendas = anoAnteriorData.totalVendas || 0;

  res.json({
    mes: {
      periodo: mesData.periodo || '',
      totalVendas: mesTotalVendas,
      margemTotal: mesMargemTotal,
      margemPercent: mesTotalVendas ? parseFloat(((mesMargemTotal / mesTotalVendas) * 100).toFixed(2)) : 0,
      numDocumentos: mesNumDocs,
      ticketMedio: mesNumDocs ? parseFloat((mesTotalVendas / mesNumDocs).toFixed(2)) : 0,
    },
    ano: {
      periodo: anoData.periodo || '',
      totalVendas: anoTotalVendas,
      margemTotal: anoMargemTotal,
      margemPercent: anoTotalVendas ? parseFloat(((anoMargemTotal / anoTotalVendas) * 100).toFixed(2)) : 0,
      numDocumentos: anoNumDocs,
      ticketMedio: anoNumDocs ? parseFloat((anoTotalVendas / anoNumDocs).toFixed(2)) : 0,
    },
    comparacao: {
      mesAnterior: {
        totalVendas: mesAnteriorVendas,
        variacao: mesAnteriorVendas ? parseFloat((((mesTotalVendas - mesAnteriorVendas) / mesAnteriorVendas) * 100).toFixed(1)) : 0,
      },
      anoAnterior: {
        totalVendas: anoAnteriorVendas,
        variacao: anoAnteriorVendas ? parseFloat((((anoTotalVendas - anoAnteriorVendas) / anoAnteriorVendas) * 100).toFixed(1)) : 0,
      },
    },
  });
}));

// ---------------------------------------------------------------------------
// 2. GET /por-localidade
//    "Performance por localidade (Onde vendemos mais/menos)?"
// ---------------------------------------------------------------------------
router.get('/por-localidade', asyncHandler(async (req, res) => {
  const periodo = req.query.periodo || 'ano';
  const limitVal = Math.min(500, Math.max(1, parseInt(req.query.limit) || 50));

  let periodoWhere = '';
  if (periodo === 'mes') {
    periodoWhere = 'AND YEAR(cd.Data) = YEAR(GETDATE()) AND MONTH(cd.Data) = MONTH(GETDATE())';
  } else if (periodo === 'trimestre') {
    periodoWhere = 'AND YEAR(cd.Data) = YEAR(GETDATE()) AND DATEPART(QUARTER, cd.Data) = DATEPART(QUARTER, GETDATE())';
  } else {
    // ano (default)
    periodoWhere = 'AND YEAR(cd.Data) = YEAR(GETDATE())';
  }

  const sqlText = `
    SELECT
      COALESCE(NULLIF(LTRIM(RTRIM(cd.Localidade)), ''), cd.Zona, 'Sem localidade') AS localidade,
      cd.Zona AS zona,
      z.Descricao AS zonaDesc,
      SUM(${CASE_VALOR}) AS totalVendas,
      SUM(${CASE_MARGEM}) AS margem,
      COUNT(DISTINCT cd.Entidade) AS numClientes,
      COUNT(DISTINCT cd.Id) AS numDocumentos
    ${BASE_JOIN}
    LEFT JOIN Zonas z ON cd.Zona = z.Zona
    WHERE ${BASE_WHERE}
      ${periodoWhere}
    GROUP BY
      COALESCE(NULLIF(LTRIM(RTRIM(cd.Localidade)), ''), cd.Zona, 'Sem localidade'),
      cd.Zona,
      z.Descricao
    ORDER BY totalVendas DESC
    OFFSET 0 ROWS FETCH NEXT @limitVal ROWS ONLY;

    -- Totais
    SELECT
      SUM(${CASE_VALOR}) AS totalVendas,
      COUNT(DISTINCT COALESCE(NULLIF(LTRIM(RTRIM(cd.Localidade)), ''), cd.Zona, 'Sem localidade')) AS numLocalidades
    ${BASE_JOIN}
    WHERE ${BASE_WHERE}
      ${periodoWhere};
  `;

  const result = await query(sqlText, { limitVal });

  const localidades = (result.recordsets[0] || []).map(r => ({
    localidade: r.localidade,
    zona: r.zona,
    zonaDesc: r.zonaDesc || '',
    totalVendas: r.totalVendas || 0,
    margem: r.margem || 0,
    margemPercent: r.totalVendas ? parseFloat(((r.margem / r.totalVendas) * 100).toFixed(2)) : 0,
    numClientes: r.numClientes,
    numDocumentos: r.numDocumentos,
  }));

  const totais = result.recordsets[1][0] || {};

  res.json({
    periodo,
    localidades,
    totais: {
      totalVendas: totais.totalVendas || 0,
      numLocalidades: totais.numLocalidades || 0,
    },
  });
}));

// ---------------------------------------------------------------------------
// 3. GET /clientes-risco
//    "Que clientes deixaram de comprar ou estao em risco?"
// ---------------------------------------------------------------------------
router.get('/clientes-risco', asyncHandler(async (req, res) => {
  const diasInativo = parseInt(req.query.diasInativo) || 180;
  const quedaMinima = parseInt(req.query.quedaMinima) || 30;
  const limitVal = Math.min(500, Math.max(1, parseInt(req.query.limit) || 50));

  // 3a. Inactive clients (no purchase in N+ days)
  const inativosSql = `
    WITH UltimaCompra AS (
      SELECT
        cd.Entidade AS cliente,
        c.Nome,
        c.Zona,
        MAX(cd.Data) AS ultimaCompra,
        DATEDIFF(DAY, MAX(cd.Data), GETDATE()) AS diasSemCompra,
        SUM(${CASE_VALOR}) / NULLIF(DATEDIFF(MONTH, MIN(cd.Data), MAX(cd.Data)), 0) * 12 AS mediaAnual
      ${BASE_JOIN}
      LEFT JOIN Clientes c ON cd.Entidade = c.Cliente
      WHERE ${BASE_WHERE}
        AND cd.TipoEntidade = 'C'
        AND ISNULL(c.ClienteAnulado, 0) = 0
      GROUP BY cd.Entidade, c.Nome, c.Zona
      HAVING DATEDIFF(DAY, MAX(cd.Data), GETDATE()) >= @diasWarning
    )
    SELECT
      cliente, Nome AS nome, Zona AS zona,
      ultimaCompra, diasSemCompra,
      ISNULL(mediaAnual, 0) AS mediaAnual,
      CASE
        WHEN diasSemCompra >= @diasInativo THEN 'critico'
        ELSE 'aviso'
      END AS risco
    FROM UltimaCompra
    ORDER BY diasSemCompra DESC
    OFFSET 0 ROWS FETCH NEXT @limitVal ROWS ONLY;
  `;

  // 3b. Clients with spending drop >N% vs same period last year
  const quedaSql = `
    WITH VendasAtual AS (
      SELECT
        cd.Entidade AS cliente,
        SUM(${CASE_VALOR}) AS periodoAtual
      ${BASE_JOIN}
      WHERE ${BASE_WHERE}
        AND cd.TipoEntidade = 'C'
        AND cd.Data >= DATEADD(MONTH, -6, GETDATE())
      GROUP BY cd.Entidade
    ),
    VendasAnterior AS (
      SELECT
        cd.Entidade AS cliente,
        SUM(${CASE_VALOR}) AS periodoAnterior
      ${BASE_JOIN}
      WHERE ${BASE_WHERE}
        AND cd.TipoEntidade = 'C'
        AND cd.Data >= DATEADD(MONTH, -18, GETDATE())
        AND cd.Data < DATEADD(MONTH, -12, GETDATE())
      GROUP BY cd.Entidade
    )
    SELECT
      va.cliente,
      c.Nome AS nome,
      va.periodoAtual,
      vp.periodoAnterior,
      CAST(((va.periodoAtual - vp.periodoAnterior) / NULLIF(vp.periodoAnterior, 0)) * 100 AS DECIMAL(10,1)) AS queda
    FROM VendasAtual va
    INNER JOIN VendasAnterior vp ON va.cliente = vp.cliente
    LEFT JOIN Clientes c ON va.cliente = c.Cliente
    WHERE vp.periodoAnterior > 0
      AND ((va.periodoAtual - vp.periodoAnterior) / vp.periodoAnterior) * 100 <= -@quedaMinima
      AND ISNULL(c.ClienteAnulado, 0) = 0
    ORDER BY queda ASC
    OFFSET 0 ROWS FETCH NEXT @limitVal ROWS ONLY;
  `;

  // 3c. Clients with overdue debt
  const dividaSql = `
    SELECT
      p.Entidade AS cliente,
      c.Nome AS nome,
      SUM(p.ValorPendente) AS valorVencido,
      MAX(DATEDIFF(DAY, p.DataVenc, GETDATE())) AS diasAtrasoMax,
      COUNT(*) AS numFaturasVencidas
    FROM Pendentes p
    LEFT JOIN Clientes c ON p.Entidade = c.Cliente
    WHERE p.TipoEntidade = 'C'
      AND p.DataVenc < GETDATE()
      AND p.ValorPendente > 0
      AND ISNULL(c.ClienteAnulado, 0) = 0
    GROUP BY p.Entidade, c.Nome
    ORDER BY valorVencido DESC
    OFFSET 0 ROWS FETCH NEXT @limitVal ROWS ONLY;
  `;

  // 90 days = warning threshold
  const diasWarning = Math.min(diasInativo, 90);

  const [inativosRes, quedaRes, dividaRes] = await Promise.all([
    query(inativosSql, { diasInativo, diasWarning, limitVal }),
    query(quedaSql, { quedaMinima, limitVal }),
    query(dividaSql, { limitVal }),
  ]);

  res.json({
    inativos: (inativosRes.recordset || []).map(r => ({
      cliente: r.cliente,
      nome: r.nome,
      zona: r.zona,
      ultimaCompra: r.ultimaCompra,
      diasSemCompra: r.diasSemCompra,
      mediaAnual: parseFloat((r.mediaAnual || 0).toFixed(2)),
      risco: r.risco,
    })),
    emQueda: (quedaRes.recordset || []).map(r => ({
      cliente: r.cliente,
      nome: r.nome,
      periodoAtual: r.periodoAtual || 0,
      periodoAnterior: r.periodoAnterior || 0,
      queda: parseFloat(r.queda || 0),
    })),
    comDividaVencida: (dividaRes.recordset || []).map(r => ({
      cliente: r.cliente,
      nome: r.nome,
      valorVencido: r.valorVencido || 0,
      diasAtrasoMax: r.diasAtrasoMax || 0,
      numFaturasVencidas: r.numFaturasVencidas || 0,
    })),
  });
}));

// ---------------------------------------------------------------------------
// 4. GET /recomendacoes/:clienteId
//    "Que produtos vender baseando no historico e no que clientes
//     semelhantes compram?"
// ---------------------------------------------------------------------------
router.get('/recomendacoes/:clienteId', asyncHandler(async (req, res) => {
  const clienteId = req.params.clienteId;
  const limitVal = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));

  const sqlText = `
    -- CTE 1: This client's zone
    WITH ClienteInfo AS (
      SELECT Cliente, Nome, Zona
      FROM Clientes
      WHERE Cliente = @clienteId
    ),
    -- CTE 2: Articles this client bought in the last 12 months
    ArtigosCliente AS (
      SELECT DISTINCT ld.Artigo
      FROM LinhasDoc ld
      INNER JOIN CabecDoc cd ON ld.IdCabecDoc = cd.Id
      LEFT JOIN CabecDocStatus cds ON cd.Id = cds.IdCabecDoc
      WHERE cd.Entidade = @clienteId
        AND cd.TipoEntidade = 'C'
        AND cd.TipoDoc IN (${IN_FATURACAO})
        AND ISNULL(cds.Anulado, 0) = 0
        AND cd.Data >= DATEADD(MONTH, -12, GETDATE())
    ),
    -- CTE 3: Similar clients = same Zona + at least 2 common articles
    ClientesSemelhantes AS (
      SELECT cd.Entidade AS cliente
      FROM LinhasDoc ld
      INNER JOIN CabecDoc cd ON ld.IdCabecDoc = cd.Id
      LEFT JOIN CabecDocStatus cds ON cd.Id = cds.IdCabecDoc
      INNER JOIN ClienteInfo ci ON cd.Zona = ci.Zona
      INNER JOIN ArtigosCliente ac ON ld.Artigo = ac.Artigo
      WHERE cd.Entidade <> @clienteId
        AND cd.TipoEntidade = 'C'
        AND cd.TipoDoc IN (${IN_FATURACAO})
        AND ISNULL(cds.Anulado, 0) = 0
        AND cd.Data >= DATEADD(MONTH, -12, GETDATE())
      GROUP BY cd.Entidade
      HAVING COUNT(DISTINCT ld.Artigo) >= 2
    ),
    -- CTE 4: Total count of similar clients
    TotalSemelhantes AS (
      SELECT COUNT(*) AS total FROM ClientesSemelhantes
    ),
    -- CTE 5: Products bought by similar clients but NOT by this client
    Recomendacoes AS (
      SELECT
        ld.Artigo AS artigo,
        MAX(ld.Descricao) AS descricao,
        COUNT(DISTINCT cd.Entidade) AS clientesSemelhantesQueCompram,
        AVG(ld.PrecUnit) AS precoMedio,
        AVG(ld.Quantidade) AS quantidadeMediaComprada
      FROM LinhasDoc ld
      INNER JOIN CabecDoc cd ON ld.IdCabecDoc = cd.Id
      LEFT JOIN CabecDocStatus cds ON cd.Id = cds.IdCabecDoc
      INNER JOIN ClientesSemelhantes cs ON cd.Entidade = cs.cliente
      WHERE cd.TipoDoc IN (${IN_FATURACAO})
        AND ISNULL(cds.Anulado, 0) = 0
        AND cd.Data >= DATEADD(MONTH, -12, GETDATE())
        AND ld.Artigo NOT IN (SELECT Artigo FROM ArtigosCliente)
      GROUP BY ld.Artigo
    )
    -- Main query: top recommendations ranked by popularity
    SELECT
      r.artigo,
      r.descricao,
      r.clientesSemelhantesQueCompram,
      ts.total AS totalClientesSemelhantes,
      r.precoMedio,
      r.quantidadeMediaComprada,
      ci.Nome AS clienteNome,
      ci.Zona AS clienteZona,
      z.Descricao AS zonaDesc
    FROM Recomendacoes r
    CROSS JOIN TotalSemelhantes ts
    CROSS JOIN ClienteInfo ci
    LEFT JOIN Zonas z ON ci.Zona = z.Zona
    ORDER BY r.clientesSemelhantesQueCompram DESC
    OFFSET 0 ROWS FETCH NEXT @limitVal ROWS ONLY;

    -- Recent articles for this client
    SELECT DISTINCT TOP 30 ld.Artigo
    FROM LinhasDoc ld
    INNER JOIN CabecDoc cd ON ld.IdCabecDoc = cd.Id
    LEFT JOIN CabecDocStatus cds ON cd.Id = cds.IdCabecDoc
    WHERE cd.Entidade = @clienteId
      AND cd.TipoEntidade = 'C'
      AND cd.TipoDoc IN (${IN_FATURACAO})
      AND ISNULL(cds.Anulado, 0) = 0
      AND cd.Data >= DATEADD(MONTH, -12, GETDATE())
    ORDER BY ld.Artigo;
  `;

  const result = await query(sqlText, { clienteId, limitVal });

  const recs = result.recordsets[0] || [];
  const artigosRecentes = (result.recordsets[1] || []).map(r => r.Artigo);

  const firstRec = recs[0] || {};
  const zonaDesc = firstRec.zonaDesc || '';
  const totalSemelhantes = firstRec.totalClientesSemelhantes || 0;

  // If client not found, try to get info separately
  let clienteNome = firstRec.clienteNome || '';
  if (!clienteNome && recs.length === 0) {
    const infoRes = await query(
      'SELECT Nome FROM Clientes WHERE Cliente = @clienteId',
      { clienteId }
    );
    if (infoRes.recordset.length) {
      clienteNome = infoRes.recordset[0].Nome;
    }
  }

  res.json({
    cliente: clienteId,
    nome: clienteNome,
    recomendacoes: recs.map(r => ({
      artigo: r.artigo,
      descricao: r.descricao,
      razao: `Comprado por ${r.clientesSemelhantesQueCompram} de ${r.totalClientesSemelhantes} clientes semelhantes na zona ${zonaDesc || r.clienteZona || ''}`.trim(),
      clientesSemelhantesQueCompram: r.clientesSemelhantesQueCompram,
      totalClientesSemelhantes: r.totalClientesSemelhantes,
      precoMedio: parseFloat((r.precoMedio || 0).toFixed(2)),
      quantidadeMediaComprada: parseFloat((r.quantidadeMediaComprada || 0).toFixed(2)),
    })),
    artigosRecentes,
  });
}));

// ---------------------------------------------------------------------------
// 5. GET /vendedores
//    Performance by salesperson
// ---------------------------------------------------------------------------
router.get('/vendedores', asyncHandler(async (req, res) => {
  const periodo = req.query.periodo || 'ano';
  const limitVal = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));

  let periodoWhere = '';
  if (periodo === 'mes') {
    periodoWhere = 'AND YEAR(cd.Data) = YEAR(GETDATE()) AND MONTH(cd.Data) = MONTH(GETDATE())';
  } else {
    periodoWhere = 'AND YEAR(cd.Data) = YEAR(GETDATE())';
  }

  const sqlText = `
    SELECT
      ld.Vendedor AS vendedor,
      v.Nome AS nome,
      SUM(
        CASE
          WHEN cd.TipoDoc IN (${DOC_TYPES_CREDITO.map(d => `'${d}'`).join(',')})
            THEN -ld.TotalIliquido
          ELSE ld.TotalIliquido
        END
      ) AS totalVendas,
      SUM(
        CASE
          WHEN cd.TipoDoc IN (${DOC_TYPES_CREDITO.map(d => `'${d}'`).join(',')})
            THEN -ld.Margem
          ELSE ld.Margem
        END
      ) AS margem,
      COUNT(DISTINCT cd.Id) AS numDocumentos,
      COUNT(DISTINCT cd.Entidade) AS numClientes
    ${BASE_JOIN}
    INNER JOIN LinhasDoc ld ON ld.IdCabecDoc = cd.Id
    LEFT JOIN Vendedores v ON ld.Vendedor = v.Vendedor
    WHERE ${BASE_WHERE}
      AND ld.Vendedor IS NOT NULL
      AND ld.Vendedor <> ''
      ${periodoWhere}
    GROUP BY ld.Vendedor, v.Nome
    ORDER BY totalVendas DESC
    OFFSET 0 ROWS FETCH NEXT @limitVal ROWS ONLY;
  `;

  const result = await query(sqlText, { limitVal });

  const vendedores = (result.recordset || []).map(r => {
    const totalVendas = r.totalVendas || 0;
    const margem = r.margem || 0;
    const numDocs = r.numDocumentos || 0;
    return {
      vendedor: r.vendedor,
      nome: r.nome || '',
      totalVendas,
      margem,
      margemPercent: totalVendas ? parseFloat(((margem / totalVendas) * 100).toFixed(2)) : 0,
      numDocumentos: numDocs,
      numClientes: r.numClientes || 0,
      ticketMedio: numDocs ? parseFloat((totalVendas / numDocs).toFixed(2)) : 0,
    };
  });

  res.json({ periodo, vendedores });
}));

// ---------------------------------------------------------------------------
// 6. GET /evolucao-mensal
//    Monthly evolution for the current year with YoY comparison
// ---------------------------------------------------------------------------
router.get('/evolucao-mensal', asyncHandler(async (req, res) => {
  const ano = parseInt(req.query.ano) || new Date().getFullYear();
  const anoAnterior = ano - 1;

  const sqlText = `
    SELECT
      MONTH(cd.Data) AS mes,
      YEAR(cd.Data) AS ano,
      SUM(${CASE_VALOR}) AS totalVendas,
      SUM(${CASE_MARGEM}) AS margemTotal,
      COUNT(DISTINCT cd.Id) AS numDocumentos,
      COUNT(DISTINCT cd.Entidade) AS numClientes
    ${BASE_JOIN}
    WHERE ${BASE_WHERE}
      AND YEAR(cd.Data) IN (@ano, @anoAnterior)
    GROUP BY YEAR(cd.Data), MONTH(cd.Data)
    ORDER BY YEAR(cd.Data), MONTH(cd.Data);
  `;

  const result = await query(sqlText, { ano, anoAnterior });

  // Build lookup maps
  const atualMap = {};
  const anteriorMap = {};

  for (const row of result.recordset || []) {
    const entry = {
      totalVendas: row.totalVendas || 0,
      margemTotal: row.margemTotal || 0,
      numDocumentos: row.numDocumentos || 0,
      numClientes: row.numClientes || 0,
    };
    if (row.ano === ano) {
      atualMap[row.mes] = entry;
    } else {
      anteriorMap[row.mes] = entry;
    }
  }

  // Build 12-month array
  const meses = [];
  for (let m = 1; m <= 12; m++) {
    const atual = atualMap[m] || { totalVendas: 0, margemTotal: 0, numDocumentos: 0, numClientes: 0 };
    const anterior = anteriorMap[m] || { totalVendas: 0, margemTotal: 0, numDocumentos: 0, numClientes: 0 };

    const variacaoVendas = anterior.totalVendas
      ? parseFloat((((atual.totalVendas - anterior.totalVendas) / anterior.totalVendas) * 100).toFixed(1))
      : 0;

    meses.push({
      mes: m,
      mesNome: ['', 'Janeiro', 'Fevereiro', 'Marco', 'Abril', 'Maio', 'Junho',
        'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'][m],
      atual: {
        totalVendas: atual.totalVendas,
        margemTotal: atual.margemTotal,
        margemPercent: atual.totalVendas ? parseFloat(((atual.margemTotal / atual.totalVendas) * 100).toFixed(2)) : 0,
        numDocumentos: atual.numDocumentos,
        numClientes: atual.numClientes,
      },
      anterior: {
        totalVendas: anterior.totalVendas,
        margemTotal: anterior.margemTotal,
        margemPercent: anterior.totalVendas ? parseFloat(((anterior.margemTotal / anterior.totalVendas) * 100).toFixed(2)) : 0,
        numDocumentos: anterior.numDocumentos,
        numClientes: anterior.numClientes,
      },
      variacao: variacaoVendas,
    });
  }

  res.json({
    ano,
    anoComparacao: anoAnterior,
    meses,
  });
}));

module.exports = router;
