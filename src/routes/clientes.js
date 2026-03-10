const router = require('express').Router();
const { query, sql } = require('../db');
const { asyncHandler } = require('../middleware/errorHandler');
const { parsePagination, parseDateRange, parseDateFilter } = require('../middleware/pagination');

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const BILLING_DOC_TYPES = [
  'DV','DVI','FR','FR1','FRI','FS','FS1','EFAA','VD','VDI',
  'NC','NCE','NCI','NCT','ND','FA','FA2','FAA','FAC','FE2',
  'FI','FI2','FIT','FM','FMI','FNT','ADD','ADE','ADI','ADT',
  'ALC','ALE','ALI','CIE'
];

const CREDIT_NOTE_TYPES = ['NC','NCE','NCI','NCT','ALC','ALE','ALI'];

// Build SQL IN-list literal from array (safe - hardcoded values only)
const inList = (arr) => arr.map(t => `'${t}'`).join(',');

const BILLING_IN = inList(BILLING_DOC_TYPES);
const CREDIT_IN = inList(CREDIT_NOTE_TYPES);

// Reusable SQL fragment: net billing total (credit notes negative)
const NET_TOTAL_EXPR = `
  SUM(CASE WHEN cd.TipoDoc IN (${CREDIT_IN})
    THEN -cd.TotalDocumento ELSE cd.TotalDocumento END)`;

// Reusable SQL fragment: net margin weighted
const NET_MARGIN_EXPR = `
  AVG(CASE WHEN cd.TipoDoc IN (${CREDIT_IN})
    THEN -cd.MargemDoc ELSE cd.MargemDoc END)`;

// Reusable SQL fragment: billing base WHERE
const BILLING_BASE_WHERE = `
      cd.TipoEntidade = 'C'
  AND cd.TipoDoc IN (${BILLING_IN})
  AND ISNULL(cds.Anulado, 0) = 0`;

// ---------------------------------------------------------------------------
// GET /clientes - Listar clientes (paginado, com pesquisa)
// ---------------------------------------------------------------------------
router.get('/', asyncHandler(async (req, res) => {
  const { limit, offset, page } = parsePagination(req);
  let where = '1=1';
  const params = {};

  if (req.query.search) {
    where += ` AND (c.Cliente LIKE @search OR c.Nome LIKE @search
      OR c.NumContrib LIKE @search OR c.Email LIKE @search
      OR c.Fac_Tel LIKE @search)`;
    params.search = `%${req.query.search}%`;
  }

  if (req.query.zona) {
    where += ' AND c.Zona = @zona';
    params.zona = req.query.zona;
  }

  if (req.query.vendedor) {
    where += ' AND c.Vendedor = @vendedor';
    params.vendedor = req.query.vendedor;
  }

  const countResult = await query(
    `SELECT COUNT(*) as total FROM Clientes c WHERE ${where}`, params
  );

  const result = await query(`
    SELECT
      c.Cliente, c.Nome, c.NumContrib,
      c.Fac_Mor   AS Morada,
      c.Fac_Local AS Localidade,
      c.Fac_Cp    AS CodPostal,
      c.Fac_Tel   AS Telefone,
      c.Email, c.Pais, c.Zona,
      ISNULL(z.Descricao, '') AS ZonaDescricao,
      c.Vendedor, c.CondPag, c.ModoPag, c.Moeda,
      c.Desconto, c.TipoPrec, c.TipoCli,
      c.LimiteCred, c.TotalDeb,
      c.ClienteAnulado, c.DataCriacao, c.Distrito
    FROM Clientes c
    LEFT JOIN Zonas z ON c.Zona = z.Zona
    WHERE ${where}
    ORDER BY c.Nome
    OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY
  `, { ...params, offset, limit });

  res.json({
    page,
    limit,
    total: countResult.recordset[0].total,
    data: result.recordset
  });
}));

// ---------------------------------------------------------------------------
// GET /clientes/segmentacao - Segmentacao de clientes
// ---------------------------------------------------------------------------
router.get('/segmentacao', asyncHandler(async (req, res) => {
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
  const mesParam = req.query.mes;
  const anoParam = req.query.ano;
  const periodo = req.query.periodo || 'ano';

  // Build date boundaries: mes > ano > periodo
  let dateExpr, prevDateExpr;
  let label;

  if (mesParam && /^\d{4}-\d{2}$/.test(mesParam)) {
    const [y, m] = mesParam.split('-').map(Number);
    dateExpr = `DATEFROMPARTS(${y}, ${m}, 1)`;
    prevDateExpr = `DATEADD(MONTH, -1, ${dateExpr})`;
    label = mesParam;
  } else if (anoParam) {
    const y = parseInt(anoParam);
    dateExpr = `DATEFROMPARTS(${y}, 1, 1)`;
    prevDateExpr = `DATEFROMPARTS(${y - 1}, 1, 1)`;
    label = String(y);
  } else {
    switch (periodo) {
      case 'mes':
        dateExpr = `DATEADD(MONTH, DATEDIFF(MONTH, 0, GETDATE()), 0)`;
        prevDateExpr = `DATEADD(MONTH, -1, ${dateExpr})`;
        label = 'mes-atual';
        break;
      case 'trimestre':
        dateExpr = `DATEADD(QUARTER, DATEDIFF(QUARTER, 0, GETDATE()), 0)`;
        prevDateExpr = `DATEADD(QUARTER, -1, ${dateExpr})`;
        label = 'trimestre-atual';
        break;
      default:
        dateExpr = `DATEFROMPARTS(YEAR(GETDATE()), 1, 1)`;
        prevDateExpr = `DATEADD(YEAR, -1, ${dateExpr})`;
        label = 'ano-atual';
    }
  }

  // End date: for ano/mes specific, cap the range; for relative, use now
  const endDateExpr = (mesParam && /^\d{4}-\d{2}$/.test(mesParam))
    ? `DATEADD(MONTH, 1, ${dateExpr})`
    : anoParam
      ? `DATEFROMPARTS(${parseInt(anoParam) + 1}, 1, 1)`
      : 'GETDATE()';

  let filterWhere = '';
  const params = { limit };

  if (req.query.zona) {
    filterWhere += ' AND cl.Zona = @zona';
    params.zona = req.query.zona;
  }
  if (req.query.localidade) {
    filterWhere += ' AND cl.Fac_Local LIKE @localidade';
    params.localidade = `%${req.query.localidade}%`;
  }

  // 1. Top clientes no periodo
  const topResult = await query(`
    SELECT TOP (@limit)
      cd.Entidade AS cliente,
      cl.Nome     AS nome,
      cl.Zona     AS zona,
      ISNULL(z.Descricao, '') AS zonaDescricao,
      cl.TipoCli,
      ${NET_TOTAL_EXPR} AS total
    FROM CabecDoc cd
    INNER JOIN CabecDocStatus cds ON cd.Id = cds.IdCabecDoc
    INNER JOIN Clientes cl ON cd.Entidade = cl.Cliente
    LEFT  JOIN Zonas z ON cl.Zona = z.Zona
    WHERE ${BILLING_BASE_WHERE}
      AND cd.Entidade = cl.Cliente
      AND cd.Data >= ${dateExpr}
      AND cd.Data < ${endDateExpr}
      ${filterWhere}
    GROUP BY cd.Entidade, cl.Nome, cl.Zona, z.Descricao, cl.TipoCli
    ORDER BY total DESC
  `, params);

  // 2. Crescimento / declinio: periodo atual vs anterior
  const growthResult = await query(`
    ;WITH atual AS (
      SELECT cd.Entidade,
        ${NET_TOTAL_EXPR} AS totalAtual
      FROM CabecDoc cd
      INNER JOIN CabecDocStatus cds ON cd.Id = cds.IdCabecDoc
      INNER JOIN Clientes cl ON cd.Entidade = cl.Cliente
      WHERE ${BILLING_BASE_WHERE}
        AND cd.Data >= ${dateExpr}
        AND cd.Data < ${endDateExpr}
        ${filterWhere}
      GROUP BY cd.Entidade
    ),
    anterior AS (
      SELECT cd.Entidade,
        ${NET_TOTAL_EXPR} AS totalAnterior
      FROM CabecDoc cd
      INNER JOIN CabecDocStatus cds ON cd.Id = cds.IdCabecDoc
      INNER JOIN Clientes cl ON cd.Entidade = cl.Cliente
      WHERE ${BILLING_BASE_WHERE}
        AND cd.Data >= ${prevDateExpr}
        AND cd.Data <  ${dateExpr}
        ${filterWhere}
      GROUP BY cd.Entidade
    )
    SELECT TOP (@limit)
      ISNULL(a.Entidade, b.Entidade) AS cliente,
      cl.Nome AS nome,
      ISNULL(a.totalAtual, 0)        AS periodoAtual,
      ISNULL(b.totalAnterior, 0)     AS periodoAnterior,
      CASE
        WHEN ISNULL(b.totalAnterior, 0) = 0 THEN 100
        ELSE ROUND(((ISNULL(a.totalAtual,0) - ISNULL(b.totalAnterior,0))
              / NULLIF(b.totalAnterior, 0)) * 100, 2)
      END AS variacao
    FROM atual a
    FULL OUTER JOIN anterior b ON a.Entidade = b.Entidade
    INNER JOIN Clientes cl ON ISNULL(a.Entidade, b.Entidade) = cl.Cliente
    WHERE (ISNULL(a.totalAtual, 0) > 0 OR ISNULL(b.totalAnterior, 0) > 0)
    ORDER BY variacao DESC
  `, params);

  const crescimento = [];
  const declinio = [];
  for (const row of growthResult.recordset) {
    if (row.variacao >= 0) {
      crescimento.push(row);
    } else {
      declinio.push(row);
    }
  }
  declinio.sort((a, b) => a.variacao - b.variacao);

  // 3. Clientes inativos (sem compra ha mais de 6 meses)
  const inativosResult = await query(`
    SELECT TOP (@limit)
      cl.Cliente   AS cliente,
      cl.Nome      AS nome,
      cl.TipoCli,
      t.ultimaCompra,
      DATEDIFF(DAY, t.ultimaCompra, GETDATE()) AS diasSemCompra,
      t.totalHistorico
    FROM Clientes cl
    INNER JOIN (
      SELECT cd.Entidade,
        MAX(cd.Data) AS ultimaCompra,
        ${NET_TOTAL_EXPR} AS totalHistorico
      FROM CabecDoc cd
      INNER JOIN CabecDocStatus cds ON cd.Id = cds.IdCabecDoc
      WHERE ${BILLING_BASE_WHERE}
      GROUP BY cd.Entidade
      HAVING MAX(cd.Data) < DATEADD(MONTH, -6, GETDATE())
    ) t ON cl.Cliente = t.Entidade
    WHERE ISNULL(cl.ClienteAnulado, 0) = 0
      ${filterWhere}
    ORDER BY t.totalHistorico DESC
  `, params);

  res.json({
    periodo: label,
    topClientes: topResult.recordset,
    crescimento,
    declinio,
    inativos: inativosResult.recordset
  });
}));

// ---------------------------------------------------------------------------
// GET /clientes/top - Ranking rapido de clientes
// ---------------------------------------------------------------------------
router.get('/top', asyncHandler(async (req, res) => {
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
  const df = parseDateFilter(req, 'cd.Data');

  let filterWhere = '';
  const params = { limit };

  if (req.query.zona) {
    filterWhere += ' AND cl.Zona = @zona';
    params.zona = req.query.zona;
  }
  if (req.query.localidade) {
    filterWhere += ' AND cl.Fac_Local LIKE @localidade';
    params.localidade = `%${req.query.localidade}%`;
  }

  const result = await query(`
    SELECT TOP (@limit)
      cd.Entidade AS cliente,
      cl.Nome     AS nome,
      cl.Zona     AS zona,
      ISNULL(z.Descricao, '') AS zonaDescricao,
      cl.Fac_Local AS localidade,
      cl.TipoCli,
      ${NET_TOTAL_EXPR} AS totalFaturado,
      ${NET_MARGIN_EXPR} AS margemMedia,
      COUNT(DISTINCT cd.Id)  AS numDocumentos,
      MAX(cd.Data)           AS ultimaCompra
    FROM CabecDoc cd
    INNER JOIN CabecDocStatus cds ON cd.Id = cds.IdCabecDoc
    INNER JOIN Clientes cl ON cd.Entidade = cl.Cliente
    LEFT  JOIN Zonas z ON cl.Zona = z.Zona
    WHERE ${BILLING_BASE_WHERE}
      AND ${df.whereClause}
      ${filterWhere}
    GROUP BY cd.Entidade, cl.Nome, cl.Zona, z.Descricao, cl.Fac_Local, cl.TipoCli
    ORDER BY totalFaturado DESC
  `, params);

  res.json({
    periodo: df.label,
    total: result.recordset.length,
    data: result.recordset
  });
}));

// ---------------------------------------------------------------------------
// GET /clientes/:id - Detalhes basicos do cliente
// ---------------------------------------------------------------------------
router.get('/:id', asyncHandler(async (req, res) => {
  const result = await query(`
    SELECT
      c.Cliente, c.Nome, c.NumContrib,
      c.Fac_Mor   AS Morada,
      c.Fac_Local AS Localidade,
      c.Fac_Cp    AS CodPostal,
      c.Fac_Tel   AS Telefone,
      c.Email, c.Pais, c.Zona,
      ISNULL(z.Descricao, '') AS ZonaDescricao,
      c.Vendedor, c.CondPag,
      ISNULL(cp.Descricao, '') AS CondPagDescricao,
      c.ModoPag, c.Moeda,
      c.Desconto, c.TipoPrec, c.TipoCli, c.TipoCred,
      c.LimiteCred, c.TotalDeb,
      ISNULL(c.LimiteCred, 0) - ISNULL(c.TotalDeb, 0) AS CreditoDisponivel,
      c.ClienteAnulado, c.DataCriacao, c.Distrito
    FROM Clientes c
    LEFT JOIN Zonas z ON c.Zona = z.Zona
    LEFT JOIN CondPag cp ON c.CondPag = cp.CondPag
    WHERE c.Cliente = @id
  `, { id: req.params.id });

  if (!result.recordset.length) {
    return res.status(404).json({ error: 'Cliente nao encontrado' });
  }

  res.json(result.recordset[0]);
}));

// ---------------------------------------------------------------------------
// GET /clientes/:id/perfil-financeiro
// ---------------------------------------------------------------------------
router.get('/:id/perfil-financeiro', asyncHandler(async (req, res) => {
  const clienteId = req.params.id;

  // 1. Client master data + payment conditions
  const clienteResult = await query(`
    SELECT
      c.Cliente, c.Nome,
      ISNULL(c.LimiteCred, 0)      AS LimiteCred,
      ISNULL(c.TotalDeb, 0)        AS TotalDeb,
      ISNULL(c.ClienteAnulado, 0)  AS ClienteAnulado,
      c.CondPag,
      ISNULL(cp.Descricao, '')     AS CondPagDescricao,
      ISNULL(cp.Dias, 0)           AS CondPagDias,
      ISNULL(cp.NumPrestacoes, 1)  AS CondPagPrestacoes
    FROM Clientes c
    LEFT JOIN CondPag cp ON c.CondPag = cp.CondPag
    WHERE c.Cliente = @clienteId
  `, { clienteId });

  if (!clienteResult.recordset.length) {
    return res.status(404).json({ error: 'Cliente nao encontrado' });
  }

  const cli = clienteResult.recordset[0];

  // 2. Total pending amounts
  const pendentesResult = await query(`
    SELECT
      ISNULL(SUM(p.ValorPendente), 0) AS totalDivida,
      ISNULL(SUM(CASE WHEN p.ValorPendente > 0 THEN p.ValorPendente ELSE 0 END), 0) AS saldoPendente,
      COUNT(*)                         AS numDocumentos
    FROM Pendentes p
    WHERE p.TipoEntidade = 'C'
      AND p.Entidade = @clienteId
  `, { clienteId });

  const pend = pendentesResult.recordset[0];

  // 3. Overdue invoices detail
  const vencidasResult = await query(`
    SELECT
      p.TipoDoc,
      p.NumDoc,
      p.Serie,
      p.ValorPendente AS valor,
      p.DataVenc      AS dataVenc,
      DATEDIFF(DAY, p.DataVenc, GETDATE()) AS diasAtraso
    FROM Pendentes p
    WHERE p.TipoEntidade = 'C'
      AND p.Entidade = @clienteId
      AND p.ValorPendente > 0
      AND p.DataVenc < GETDATE()
    ORDER BY p.DataVenc ASC
  `, { clienteId });

  const vencidas = vencidasResult.recordset;
  const vencidasQtd = vencidas.length;
  const vencidasTotal = vencidas.reduce((s, r) => s + (r.valor || 0), 0);
  const diasAtrasoArr = vencidas.map(r => r.diasAtraso || 0);
  const diasAtrasoMedio = vencidasQtd > 0
    ? Math.round(diasAtrasoArr.reduce((s, d) => s + d, 0) / vencidasQtd)
    : 0;
  const maiorAtraso = vencidasQtd > 0 ? Math.max(...diasAtrasoArr) : 0;

  // 4. Average payment days (from documents that were paid - ValorPendente = 0)
  const prazoResult = await query(`
    SELECT
      AVG(DATEDIFF(DAY, p.DataDoc, p.DataVenc)) AS prazoMedioPagamento
    FROM Pendentes p
    WHERE p.TipoEntidade = 'C'
      AND p.Entidade = @clienteId
      AND p.ValorPendente <= 0.01
      AND p.DataDoc IS NOT NULL
      AND p.DataVenc IS NOT NULL
  `, { clienteId });

  const prazoMedio = prazoResult.recordset[0]?.prazoMedioPagamento || 0;

  res.json({
    cliente: cli.Cliente,
    nome: cli.Nome,
    limiteCreditoTotal: cli.LimiteCred,
    creditoUtilizado: cli.TotalDeb,
    creditoDisponivel: Math.max(0, cli.LimiteCred - cli.TotalDeb),
    bloqueado: cli.ClienteAnulado === 1,
    totalDivida: pend.totalDivida,
    saldoPendente: pend.saldoPendente,
    condicaoPagamento: {
      codigo: cli.CondPag,
      descricao: cli.CondPagDescricao,
      dias: cli.CondPagDias,
      prestacoes: cli.CondPagPrestacoes
    },
    prazoMedioPagamento: Math.round(prazoMedio),
    faturasVencidas: {
      quantidade: vencidasQtd,
      valorTotal: Math.round(vencidasTotal * 100) / 100,
      diasAtrasoMedio,
      maiorAtraso,
      detalhe: vencidas.map(v => ({
        tipoDoc: v.TipoDoc,
        numDoc: v.NumDoc,
        serie: v.Serie,
        valor: v.valor,
        dataVenc: v.dataVenc,
        diasAtraso: v.diasAtraso
      }))
    }
  });
}));

// ---------------------------------------------------------------------------
// GET /clientes/:id/historico
// ---------------------------------------------------------------------------
router.get('/:id/historico', asyncHandler(async (req, res) => {
  const clienteId = req.params.id;

  // Verify client exists
  const clienteCheck = await query(
    `SELECT Cliente, Nome FROM Clientes WHERE Cliente = @clienteId`,
    { clienteId }
  );
  if (!clienteCheck.recordset.length) {
    return res.status(404).json({ error: 'Cliente nao encontrado' });
  }

  // 1. YTD billing current year
  const ytdResult = await query(`
    SELECT
      ${NET_TOTAL_EXPR} AS faturacaoAnoAtual
    FROM CabecDoc cd
    INNER JOIN CabecDocStatus cds ON cd.Id = cds.IdCabecDoc
    WHERE ${BILLING_BASE_WHERE}
      AND cd.Entidade = @clienteId
      AND cd.Data >= DATEFROMPARTS(YEAR(GETDATE()), 1, 1)
      AND cd.Data <= GETDATE()
  `, { clienteId });

  // 2. Same period last year (up to same day-of-year)
  const ytdPrevResult = await query(`
    SELECT
      ${NET_TOTAL_EXPR} AS faturacaoMesmoPeriodoAnoPassado
    FROM CabecDoc cd
    INNER JOIN CabecDocStatus cds ON cd.Id = cds.IdCabecDoc
    WHERE ${BILLING_BASE_WHERE}
      AND cd.Entidade = @clienteId
      AND cd.Data >= DATEFROMPARTS(YEAR(GETDATE()) - 1, 1, 1)
      AND cd.Data <= DATEADD(YEAR, -1, GETDATE())
  `, { clienteId });

  // 3. Last 12 months total
  const last12Result = await query(`
    SELECT
      ${NET_TOTAL_EXPR} AS totalUltimos12Meses
    FROM CabecDoc cd
    INNER JOIN CabecDocStatus cds ON cd.Id = cds.IdCabecDoc
    WHERE ${BILLING_BASE_WHERE}
      AND cd.Entidade = @clienteId
      AND cd.Data >= DATEADD(MONTH, -12, GETDATE())
  `, { clienteId });

  // 4. Average margin
  const margemResult = await query(`
    SELECT
      ${NET_MARGIN_EXPR} AS margemMedia
    FROM CabecDoc cd
    INNER JOIN CabecDocStatus cds ON cd.Id = cds.IdCabecDoc
    WHERE ${BILLING_BASE_WHERE}
      AND cd.Entidade = @clienteId
      AND cd.Data >= DATEADD(MONTH, -12, GETDATE())
  `, { clienteId });

  // 5. Largest sale (billing docs)
  const maiorVendaResult = await query(`
    SELECT TOP 1
      cd.TipoDoc, cd.NumDoc, cd.Serie, cd.Data, cd.TotalDocumento AS total
    FROM CabecDoc cd
    INNER JOIN CabecDocStatus cds ON cd.Id = cds.IdCabecDoc
    WHERE ${BILLING_BASE_WHERE}
      AND cd.Entidade = @clienteId
      AND cd.TipoDoc NOT IN (${CREDIT_IN})
    ORDER BY cd.TotalDocumento DESC
  `, { clienteId });

  // 6. Last purchase (most recent billing doc) + its line items
  const ultimaCompraResult = await query(`
    SELECT TOP 1
      cd.Id, cd.TipoDoc, cd.NumDoc, cd.Serie, cd.Data, cd.TotalDocumento AS total
    FROM CabecDoc cd
    INNER JOIN CabecDocStatus cds ON cd.Id = cds.IdCabecDoc
    WHERE ${BILLING_BASE_WHERE}
      AND cd.Entidade = @clienteId
      AND cd.TipoDoc NOT IN (${CREDIT_IN})
    ORDER BY cd.Data DESC
  `, { clienteId });

  let ultimaCompraArtigos = [];
  if (ultimaCompraResult.recordset.length) {
    const docId = ultimaCompraResult.recordset[0].Id;
    const linhasResult = await query(`
      SELECT
        ld.Artigo AS artigo,
        a.Descricao AS descricao,
        ld.Quantidade AS quantidade,
        ld.Unidade AS unidade,
        ld.PrecUnit AS precoUnitario,
        ld.TotalIliquido AS totalLinha
      FROM LinhasDoc ld
      LEFT JOIN Artigo a ON a.Artigo = ld.Artigo
      WHERE ld.IdCabecDoc = @docId
      ORDER BY ld.NumLinha
    `, { docId });
    ultimaCompraArtigos = linhasResult.recordset;
  }

  // 7. Last budget/quote (POR)
  const ultimoOrcResult = await query(`
    SELECT TOP 1
      cd.TipoDoc, cd.NumDoc, cd.Serie, cd.Data, cd.TotalDocumento AS total
    FROM CabecDoc cd
    INNER JOIN CabecDocStatus cds ON cd.Id = cds.IdCabecDoc
    WHERE cd.TipoEntidade = 'C'
      AND cd.Entidade = @clienteId
      AND cd.TipoDoc = 'POR'
      AND ISNULL(cds.Anulado, 0) = 0
    ORDER BY cd.Data DESC
  `, { clienteId });

  // 8. Monthly billing breakdown (last 24 months for trend)
  const mensalResult = await query(`
    SELECT
      MONTH(cd.Data) AS mes,
      YEAR(cd.Data)  AS ano,
      ${NET_TOTAL_EXPR} AS total,
      ${NET_MARGIN_EXPR} AS margem
    FROM CabecDoc cd
    INNER JOIN CabecDocStatus cds ON cd.Id = cds.IdCabecDoc
    WHERE ${BILLING_BASE_WHERE}
      AND cd.Entidade = @clienteId
      AND cd.Data >= DATEADD(MONTH, -24, GETDATE())
    GROUP BY YEAR(cd.Data), MONTH(cd.Data)
    ORDER BY ano, mes
  `, { clienteId });

  // Assemble response
  const fatAtual = ytdResult.recordset[0]?.faturacaoAnoAtual || 0;
  const fatAnterior = ytdPrevResult.recordset[0]?.faturacaoMesmoPeriodoAnoPassado || 0;
  const variacao = fatAnterior !== 0
    ? Math.round(((fatAtual - fatAnterior) / Math.abs(fatAnterior)) * 10000) / 100
    : (fatAtual > 0 ? 100 : 0);

  const maiorVenda = maiorVendaResult.recordset[0] || null;
  const ultimaCompra = ultimaCompraResult.recordset[0] || null;
  const ultimoOrc = ultimoOrcResult.recordset[0] || null;

  res.json({
    cliente: clienteId,
    faturacaoAnoAtual: fatAtual || 0,
    faturacaoMesmoPeriodoAnoPassado: fatAnterior || 0,
    variacaoPercent: variacao,
    totalUltimos12Meses: last12Result.recordset[0]?.totalUltimos12Meses || 0,
    margemMedia: Math.round((margemResult.recordset[0]?.margemMedia || 0) * 100) / 100,
    maiorVenda: maiorVenda
      ? { tipoDoc: maiorVenda.TipoDoc, numDoc: maiorVenda.NumDoc, serie: maiorVenda.Serie, data: maiorVenda.Data, total: maiorVenda.total }
      : null,
    ultimaCompra: ultimaCompra
      ? { tipoDoc: ultimaCompra.TipoDoc, numDoc: ultimaCompra.NumDoc, serie: ultimaCompra.Serie, data: ultimaCompra.Data, total: ultimaCompra.total, artigos: ultimaCompraArtigos }
      : null,
    ultimoOrcamento: ultimoOrc
      ? { tipoDoc: ultimoOrc.TipoDoc, numDoc: ultimoOrc.NumDoc, serie: ultimoOrc.Serie, data: ultimoOrc.Data, total: ultimoOrc.total }
      : null,
    faturacaoMensal: mensalResult.recordset.map(r => ({
      mes: r.mes,
      ano: r.ano,
      total: r.total || 0,
      margem: Math.round((r.margem || 0) * 100) / 100
    }))
  });
}));

// ---------------------------------------------------------------------------
// GET /clientes/:id/orcamentos - Orcamentos de um cliente
// ---------------------------------------------------------------------------
router.get('/:id/orcamentos', asyncHandler(async (req, res) => {
  const clienteId = req.params.id;
  const df = parseDateFilter(req, 'cd.Data');
  const limit = Math.min(500, Math.max(1, parseInt(req.query.limit) || 50));

  const result = await query(`
    SELECT
      cd.TipoDoc,
      cd.NumDoc,
      cd.Serie,
      cd.Data,
      cd.TotalDocumento AS total,
      cd.Observacoes AS observacoes,
      ISNULL(cds.Fechado, 0) AS fechado
    FROM CabecDoc cd
    INNER JOIN CabecDocStatus cds ON cd.Id = cds.IdCabecDoc
    WHERE cd.TipoEntidade = 'C'
      AND cd.Entidade = @clienteId
      AND cd.TipoDoc = 'POR'
      AND ISNULL(cds.Anulado, 0) = 0
      AND ${df.whereClause}
    ORDER BY cd.Data DESC
    OFFSET 0 ROWS FETCH NEXT @limit ROWS ONLY
  `, { clienteId, limit });

  res.json({
    cliente: clienteId,
    periodo: df.label,
    total: result.recordset.length,
    data: result.recordset
  });
}));

// ---------------------------------------------------------------------------
// GET /clientes/:id/atividade - Resumo anual de orcamentos vs compras
// ---------------------------------------------------------------------------
router.get('/:id/atividade', asyncHandler(async (req, res) => {
  const clienteId = req.params.id;

  // Orcamentos (POR) agrupados por ano
  const orcResult = await query(`
    SELECT
      YEAR(cd.Data) AS ano,
      COUNT(*) AS totalOrcamentos,
      SUM(cd.TotalDocumento) AS valorTotal,
      MAX(cd.Data) AS ultimoOrcamentoData,
      MAX(cd.NumDoc) AS ultimoOrcamentoNum
    FROM CabecDoc cd
    INNER JOIN CabecDocStatus cds ON cd.Id = cds.IdCabecDoc
    WHERE cd.TipoEntidade = 'C'
      AND cd.Entidade = @clienteId
      AND cd.TipoDoc = 'POR'
      AND ISNULL(cds.Anulado, 0) = 0
    GROUP BY YEAR(cd.Data)
    ORDER BY ano DESC
  `, { clienteId });

  // Compras (faturacao) agrupadas por ano
  const comprasResult = await query(`
    SELECT
      YEAR(cd.Data) AS ano,
      COUNT(DISTINCT cd.Id) AS totalCompras,
      ${NET_TOTAL_EXPR} AS valorTotal,
      MAX(cd.Data) AS ultimaCompraData
    FROM CabecDoc cd
    INNER JOIN CabecDocStatus cds ON cd.Id = cds.IdCabecDoc
    WHERE ${BILLING_BASE_WHERE}
      AND cd.Entidade = @clienteId
      AND cd.TipoDoc NOT IN (${CREDIT_IN})
    GROUP BY YEAR(cd.Data)
    ORDER BY ano DESC
  `, { clienteId });

  // Detalhes do ultimo orcamento por ano (serie, numDoc)
  const orcDetalhes = await query(`
    SELECT
      YEAR(cd.Data) AS ano,
      cd.TipoDoc, cd.NumDoc, cd.Serie, cd.Data, cd.TotalDocumento AS total
    FROM CabecDoc cd
    INNER JOIN CabecDocStatus cds ON cd.Id = cds.IdCabecDoc
    WHERE cd.TipoEntidade = 'C'
      AND cd.Entidade = @clienteId
      AND cd.TipoDoc = 'POR'
      AND ISNULL(cds.Anulado, 0) = 0
      AND cd.Data = (
        SELECT MAX(cd2.Data)
        FROM CabecDoc cd2
        INNER JOIN CabecDocStatus cds2 ON cd2.Id = cds2.IdCabecDoc
        WHERE cd2.TipoEntidade = 'C'
          AND cd2.Entidade = @clienteId
          AND cd2.TipoDoc = 'POR'
          AND ISNULL(cds2.Anulado, 0) = 0
          AND YEAR(cd2.Data) = YEAR(cd.Data)
      )
    ORDER BY cd.Data DESC
  `, { clienteId });

  // Detalhes da ultima compra por ano
  const compraDetalhes = await query(`
    SELECT
      YEAR(cd.Data) AS ano,
      cd.TipoDoc, cd.NumDoc, cd.Serie, cd.Data, cd.TotalDocumento AS total
    FROM CabecDoc cd
    INNER JOIN CabecDocStatus cds ON cd.Id = cds.IdCabecDoc
    WHERE ${BILLING_BASE_WHERE}
      AND cd.Entidade = @clienteId
      AND cd.TipoDoc NOT IN (${CREDIT_IN})
      AND cd.Data = (
        SELECT MAX(cd2.Data)
        FROM CabecDoc cd2
        INNER JOIN CabecDocStatus cds2 ON cd2.Id = cds2.IdCabecDoc
        WHERE cd2.TipoDoc IN (${BILLING_IN})
          AND ISNULL(cds2.Anulado, 0) = 0
          AND cd2.Entidade = @clienteId
          AND cd2.TipoDoc NOT IN (${CREDIT_IN})
          AND YEAR(cd2.Data) = YEAR(cd.Data)
      )
    ORDER BY cd.Data DESC
  `, { clienteId });

  // Indexar detalhes por ano
  const orcPorAno = {};
  for (const r of orcDetalhes.recordset) {
    orcPorAno[r.ano] = { tipoDoc: r.TipoDoc, numDoc: r.NumDoc, serie: r.Serie, data: r.Data, total: r.total };
  }
  const compraPorAno = {};
  for (const r of compraDetalhes.recordset) {
    compraPorAno[r.ano] = { tipoDoc: r.TipoDoc, numDoc: r.NumDoc, serie: r.Serie, data: r.Data, total: r.total };
  }

  // Juntar todos os anos
  const anos = new Set();
  for (const r of orcResult.recordset) anos.add(r.ano);
  for (const r of comprasResult.recordset) anos.add(r.ano);

  const orcMap = {};
  for (const r of orcResult.recordset) orcMap[r.ano] = r;
  const compMap = {};
  for (const r of comprasResult.recordset) compMap[r.ano] = r;

  const resumo = [...anos].sort((a, b) => b - a).map(ano => ({
    ano,
    orcamentos: {
      total: orcMap[ano]?.totalOrcamentos || 0,
      valorTotal: orcMap[ano]?.valorTotal || 0,
      ultimo: orcPorAno[ano] || null,
    },
    compras: {
      total: compMap[ano]?.totalCompras || 0,
      valorTotal: compMap[ano]?.valorTotal || 0,
      ultima: compraPorAno[ano] || null,
    },
  }));

  res.json({
    cliente: clienteId,
    resumoPorAno: resumo,
  });
}));

module.exports = router;
