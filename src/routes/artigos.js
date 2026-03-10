const router = require('express').Router();
const { query, sql } = require('../db');
const { asyncHandler } = require('../middleware/errorHandler');
const { parsePagination, parseDateFilter } = require('../middleware/pagination');

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

// Build a safe IN clause from a known constant array (no user input)
const BILLING_IN = BILLING_DOC_TYPES.map(t => `'${t}'`).join(',');
const CREDIT_IN = CREDIT_NOTE_TYPES.map(t => `'${t}'`).join(',');

// Reusable CASE expressions for credit-note-aware sums
const QTY_CASE = `SUM(CASE WHEN cd.TipoDoc IN (${CREDIT_IN}) THEN -ld.Quantidade ELSE ld.Quantidade END)`;
const VAL_CASE = `SUM(CASE WHEN cd.TipoDoc IN (${CREDIT_IN}) THEN -ld.TotalIliquido ELSE ld.TotalIliquido END)`;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Return a WHERE clause fragment that filters by period.
 * Supported values: 'mes', 'trimestre', 'semestre', 'ano' (default).
 * The date column must be passed in (e.g. 'cd.Data').
 */
function periodFilter(periodo, dateCol) {
  switch ((periodo || 'ano').toLowerCase()) {
    case 'mes':
      return `MONTH(${dateCol}) = MONTH(GETDATE()) AND YEAR(${dateCol}) = YEAR(GETDATE())`;
    case 'trimestre':
      return `DATEPART(QUARTER, ${dateCol}) = DATEPART(QUARTER, GETDATE()) AND YEAR(${dateCol}) = YEAR(GETDATE())`;
    case 'semestre':
      return `CASE WHEN MONTH(GETDATE()) <= 6 THEN 1 ELSE 2 END = CASE WHEN MONTH(${dateCol}) <= 6 THEN 1 ELSE 2 END AND YEAR(${dateCol}) = YEAR(GETDATE())`;
    case 'ano':
    default:
      return `YEAR(${dateCol}) = YEAR(GETDATE())`;
  }
}

/** Human-readable label for the requested period. */
function periodLabel(periodo) {
  switch ((periodo || 'ano').toLowerCase()) {
    case 'mes': return 'mes';
    case 'trimestre': return 'trimestre';
    case 'semestre': return 'semestre';
    default: return 'ano';
  }
}

/** Start-of-period date expression for SQL Server. */
function periodStartExpr(periodo) {
  switch ((periodo || 'ano').toLowerCase()) {
    case 'mes':
      return `DATEFROMPARTS(YEAR(GETDATE()), MONTH(GETDATE()), 1)`;
    case 'trimestre':
      return `DATEFROMPARTS(YEAR(GETDATE()), (DATEPART(QUARTER, GETDATE()) - 1) * 3 + 1, 1)`;
    case 'semestre':
      return `DATEFROMPARTS(YEAR(GETDATE()), CASE WHEN MONTH(GETDATE()) <= 6 THEN 1 ELSE 7 END, 1)`;
    case 'ano':
    default:
      return `DATEFROMPARTS(YEAR(GETDATE()), 1, 1)`;
  }
}

// ---------------------------------------------------------------------------
// 1. GET / – List articles (paginated, searchable)
// ---------------------------------------------------------------------------

router.get('/', asyncHandler(async (req, res) => {
  const { limit, offset, page } = parsePagination(req);
  let where = 'a.ArtigoAnulado = 0';
  const params = {};

  if (req.query.search) {
    where += ` AND (a.Artigo LIKE @search OR a.Descricao LIKE @search OR a.CodBarras LIKE @search)`;
    params.search = `%${req.query.search}%`;
  }
  if (req.query.familia) {
    where += ' AND a.Familia = @familia';
    params.familia = req.query.familia;
  }
  if (req.query.subfamilia) {
    where += ' AND a.SubFamilia = @subfamilia';
    params.subfamilia = req.query.subfamilia;
  }

  const countResult = await query(
    `SELECT COUNT(*) AS total FROM Artigo a WHERE ${where}`,
    params
  );

  const result = await query(`
    SELECT
      a.Artigo,
      a.Descricao,
      a.CodBarras,
      a.Familia,
      f.Descricao                AS FamiliaDescricao,
      a.SubFamilia,
      a.Marca,
      a.TipoArtigo,
      a.UnidadeVenda,
      a.UnidadeBase,
      a.Iva,
      a.STKActual,
      a.PCMedio,
      a.PCUltimo,
      a.PCPadrao,
      a.ArmazemSugestao
    FROM Artigo a
    LEFT JOIN Familias f ON f.Familia = a.Familia
    WHERE ${where}
    ORDER BY a.Descricao
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
// 5. GET /top – Top selling articles
//    (defined before /:id to avoid route conflicts)
// ---------------------------------------------------------------------------

router.get('/top', asyncHandler(async (req, res) => {
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
  const df = parseDateFilter(req, 'cd.Data');
  const params = {};
  let familiaFilter = '';

  if (req.query.familia) {
    familiaFilter = 'AND a.Familia = @familia';
    params.familia = req.query.familia;
  }

  const result = await query(`
    SELECT TOP (@topN)
      ld.Artigo,
      MAX(a.Descricao)            AS descricao,
      MAX(a.Familia)              AS familia,
      MAX(f.Descricao)            AS familiaDesc,
      ${QTY_CASE}                 AS quantidadeVendida,
      ${VAL_CASE}                 AS valorTotal,
      SUM(CASE
        WHEN cd.TipoDoc IN (${CREDIT_IN})
          THEN -ld.TotalIliquido * (ld.PercentagemMargem / 100.0)
        ELSE ld.TotalIliquido * (ld.PercentagemMargem / 100.0)
      END) /
      NULLIF(${VAL_CASE}, 0) * 100  AS margemMedia,
      COUNT(DISTINCT cd.Id)       AS numDocumentos
    FROM LinhasDoc ld
    INNER JOIN CabecDoc cd        ON cd.Id = ld.IdCabecDoc
    LEFT  JOIN CabecDocStatus cds ON cds.IdCabecDoc = cd.Id
    INNER JOIN Artigo a           ON a.Artigo = ld.Artigo
    LEFT  JOIN Familias f         ON f.Familia = a.Familia
    WHERE cd.TipoDoc IN (${BILLING_IN})
      AND ISNULL(cds.Anulado, 0) = 0
      AND ${df.whereClause}
      ${familiaFilter}
    GROUP BY ld.Artigo
    HAVING ${VAL_CASE} > 0
    ORDER BY valorTotal DESC
  `, { ...params, topN: limit });

  res.json({
    periodo: df.label,
    top: result.recordset
  });
}));

// ---------------------------------------------------------------------------
// 2. GET /:id – Article detail
// ---------------------------------------------------------------------------

router.get('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;

  // Main article + family/subfamily descriptions
  const artResult = await query(`
    SELECT
      a.*,
      f.Descricao   AS FamiliaDescricao,
      sf.Descricao  AS SubFamiliaDescricao
    FROM Artigo a
    LEFT JOIN Familias    f  ON f.Familia    = a.Familia
    LEFT JOIN SubFamilias sf ON sf.Familia   = a.Familia AND sf.SubFamilia = a.SubFamilia
    WHERE a.Artigo = @id
  `, { id });

  if (!artResult.recordset.length) {
    return res.status(404).json({ error: 'Artigo nao encontrado' });
  }

  // Prices from ArtigoMoeda
  const pricesResult = await query(`
    SELECT Moeda, Unidade,
           PVP1, PVP2, PVP3, PVP4, PVP5, PVP6,
           PVP1IvaIncluido, PVP2IvaIncluido, PVP3IvaIncluido,
           PVP4IvaIncluido, PVP5IvaIncluido, PVP6IvaIncluido
    FROM ArtigoMoeda
    WHERE Artigo = @id
  `, { id });

  // Current stock by warehouse
  const stockResult = await query(`
    SELECT Armazem, EstadoStock, SUM(Stock) AS quantidade
    FROM INV_ValoresActuaisStock
    WHERE Artigo = @id
    GROUP BY Armazem, EstadoStock
  `, { id });

  const artigo = artResult.recordset[0];

  res.json({
    ...artigo,
    precos: pricesResult.recordset,
    stock: stockResult.recordset
  });
}));

// ---------------------------------------------------------------------------
// 3. GET /:id/stock – Stock breakdown
// ---------------------------------------------------------------------------

router.get('/:id/stock', asyncHandler(async (req, res) => {
  const { id } = req.params;

  // Article base info
  const artResult = await query(`
    SELECT Artigo, Descricao, STKActual, STKMinimo, STKMaximo
    FROM Artigo
    WHERE Artigo = @id
  `, { id });

  if (!artResult.recordset.length) {
    return res.status(404).json({ error: 'Artigo nao encontrado' });
  }

  const artigo = artResult.recordset[0];

  // Stock by warehouse and state
  const detailResult = await query(`
    SELECT
      Armazem,
      EstadoStock,
      SUM(Stock) AS quantidade,
      SUM(CASE WHEN Bloqueado = 1 THEN Stock ELSE 0 END) AS bloqueado
    FROM INV_ValoresActuaisStock
    WHERE Artigo = @id
    GROUP BY Armazem, EstadoStock
  `, { id });

  const rows = detailResult.recordset;

  // Build per-warehouse summary
  const warehouseMap = {};
  for (const r of rows) {
    if (!warehouseMap[r.Armazem]) {
      warehouseMap[r.Armazem] = { armazem: r.Armazem, disponivel: 0, reservado: 0, bloqueado: 0, total: 0 };
    }
    const w = warehouseMap[r.Armazem];
    const qty = parseFloat(r.quantidade) || 0;
    const blk = parseFloat(r.bloqueado) || 0;

    const estado = (r.EstadoStock || '').toUpperCase().trim();
    if (estado === 'DISP' || estado === '') {
      w.disponivel += qty;
    } else if (estado === 'RES') {
      w.reservado += qty;
    }
    w.bloqueado += blk;
    w.total += qty;
  }

  // Build per-state summary
  const stateMap = {};
  for (const r of rows) {
    const estado = (r.EstadoStock || 'DISP').toUpperCase().trim();
    const qty = parseFloat(r.quantidade) || 0;
    stateMap[estado] = (stateMap[estado] || 0) + qty;
  }

  res.json({
    artigo: artigo.Artigo,
    descricao: artigo.Descricao,
    stockGlobal: artigo.STKActual,
    stockMinimo: artigo.STKMinimo,
    stockMaximo: artigo.STKMaximo,
    porArmazem: Object.values(warehouseMap),
    porEstado: Object.entries(stateMap).map(([estado, quantidade]) => ({ estado, quantidade }))
  });
}));

// ---------------------------------------------------------------------------
// 4. GET /:id/cliente/:clienteId – Article pricing for a specific client
// ---------------------------------------------------------------------------

router.get('/:id/cliente/:clienteId', asyncHandler(async (req, res) => {
  const { id, clienteId } = req.params;

  // Article base info
  const artResult = await query(`
    SELECT Artigo, Descricao, Peso, Volume, UnidadeVenda
    FROM Artigo
    WHERE Artigo = @id
  `, { id });

  if (!artResult.recordset.length) {
    return res.status(404).json({ error: 'Artigo nao encontrado' });
  }

  const artigo = artResult.recordset[0];

  // Client info
  const cliResult = await query(`
    SELECT Cliente, Nome, Moeda, Desconto, TipoPrec
    FROM Clientes
    WHERE Cliente = @clienteId
  `, { clienteId });

  if (!cliResult.recordset.length) {
    return res.status(404).json({ error: 'Cliente nao encontrado' });
  }

  const cliente = cliResult.recordset[0];

  // Prices from ArtigoMoeda (client's currency)
  const priceResult = await query(`
    SELECT PVP1, PVP2, PVP3, PVP4, PVP5, PVP6
    FROM ArtigoMoeda
    WHERE Artigo = @id AND Moeda = @moeda
  `, { id, moeda: cliente.Moeda || 'EUR' });

  const precos = priceResult.recordset.length ? priceResult.recordset[0] : {};

  // Determine the applicable PVP based on client's TipoPrec
  const tipoPreco = parseInt(cliente.TipoPrec) || 1;
  const pvpKey = `PVP${tipoPreco}`;
  const precoBase = parseFloat(precos[pvpKey] || precos.PVP1 || 0);
  const desconto = parseFloat(cliente.Desconto) || 0;
  const precoFinal = precoBase * (1 - desconto / 100);

  // Last purchase by this client for this article
  const ultimaCompra = await query(`
    SELECT TOP 1
      cd.Data         AS data,
      ld.Quantidade   AS quantidade,
      ld.PrecUnit     AS precoUnit
    FROM LinhasDoc ld
    INNER JOIN CabecDoc cd        ON cd.Id = ld.IdCabecDoc
    LEFT  JOIN CabecDocStatus cds ON cds.IdCabecDoc = cd.Id
    WHERE ld.Artigo = @id
      AND cd.Entidade = @clienteId
      AND cd.TipoDoc IN (${BILLING_IN})
      AND ISNULL(cds.Anulado, 0) = 0
    ORDER BY cd.Data DESC
  `, { id, clienteId });

  // Quantities bought last 12 months and this year
  const histResult = await query(`
    SELECT
      SUM(CASE
        WHEN cd.Data >= DATEADD(MONTH, -12, GETDATE())
        THEN CASE WHEN cd.TipoDoc IN (${CREDIT_IN}) THEN -ld.Quantidade ELSE ld.Quantidade END
        ELSE 0
      END) AS ultimos12Meses,
      SUM(CASE
        WHEN YEAR(cd.Data) = YEAR(GETDATE())
        THEN CASE WHEN cd.TipoDoc IN (${CREDIT_IN}) THEN -ld.Quantidade ELSE ld.Quantidade END
        ELSE 0
      END) AS esteAno
    FROM LinhasDoc ld
    INNER JOIN CabecDoc cd        ON cd.Id = ld.IdCabecDoc
    LEFT  JOIN CabecDocStatus cds ON cds.IdCabecDoc = cd.Id
    WHERE ld.Artigo = @id
      AND cd.Entidade = @clienteId
      AND cd.TipoDoc IN (${BILLING_IN})
      AND ISNULL(cds.Anulado, 0) = 0
  `, { id, clienteId });

  const hist = histResult.recordset[0] || {};
  const uc = ultimaCompra.recordset[0] || null;

  res.json({
    artigo: artigo.Artigo,
    descricao: artigo.Descricao,
    peso: artigo.Peso,
    volume: artigo.Volume,
    unidadeVenda: artigo.UnidadeVenda,
    precos: {
      pvp1: precos.PVP1 || null,
      pvp2: precos.PVP2 || null,
      pvp3: precos.PVP3 || null,
      pvp4: precos.PVP4 || null,
      pvp5: precos.PVP5 || null,
      pvp6: precos.PVP6 || null
    },
    cliente: {
      id: cliente.Cliente,
      nome: cliente.Nome,
      tipoPreco: String(tipoPreco),
      descontoCliente: desconto,
      precoFinal: Math.round(precoFinal * 100) / 100
    },
    ultimaCompraCliente: uc
      ? { data: uc.data, quantidade: uc.quantidade, precoUnit: uc.precoUnit }
      : null,
    historicoQuantidades: {
      ultimos12Meses: hist.ultimos12Meses || 0,
      esteAno: hist.esteAno || 0
    }
  });
}));

// ---------------------------------------------------------------------------
// 6. GET /:id/top-clientes – Top clients for a given article
// ---------------------------------------------------------------------------

router.get('/:id/top-clientes', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const df = parseDateFilter(req, 'cd.Data');
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 10));

  const artResult = await query(`
    SELECT Artigo, Descricao FROM Artigo WHERE Artigo = @id
  `, { id });

  if (!artResult.recordset.length) {
    return res.status(404).json({ error: 'Artigo nao encontrado' });
  }

  const artigo = artResult.recordset[0];

  const result = await query(`
    SELECT TOP (@topN)
      cd.Entidade                  AS cliente,
      MAX(cd.Nome)                 AS nome,
      MAX(cd.Zona)                 AS zona,
      ${QTY_CASE}                  AS quantidadeTotal,
      ${VAL_CASE}                  AS valorTotal,
      COUNT(DISTINCT cd.Id)        AS numCompras,
      MAX(cd.Data)                 AS ultimaCompra
    FROM LinhasDoc ld
    INNER JOIN CabecDoc cd        ON cd.Id = ld.IdCabecDoc
    LEFT  JOIN CabecDocStatus cds ON cds.IdCabecDoc = cd.Id
    WHERE ld.Artigo = @id
      AND cd.TipoDoc IN (${BILLING_IN})
      AND ISNULL(cds.Anulado, 0) = 0
      AND ${df.whereClause}
    GROUP BY cd.Entidade
    HAVING ${VAL_CASE} > 0
    ORDER BY valorTotal DESC
  `, { id, topN: limit });

  res.json({
    artigo: artigo.Artigo,
    descricao: artigo.Descricao,
    periodo: df.label,
    topClientes: result.recordset
  });
}));

module.exports = router;
