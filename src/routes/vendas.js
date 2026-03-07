const { Router } = require('express');
const { query } = require('../db');
const { asyncHandler } = require('../middleware/errorHandler');
const { parsePagination, parseDateRange } = require('../middleware/pagination');
const geocode = require('../geocode');

const router = Router();

const TIPOS_FACTURA = "('FA','FAC','FR','GT')";
const TIPOS_ABATER = "('ALC','ALI','FAA','NC')";
const TIPOS_TODOS = "('FA','FAC','FR','GT','ALC','ALI','FAA','NC')";

// GET /vendas/documentos - Listar documentos de venda
router.get('/documentos', asyncHandler(async (req, res) => {
  const { limit, offset, page } = parsePagination(req);
  const { dataInicio, dataFim } = parseDateRange(req);
  const tipoDoc = req.query.tipoDoc || '';
  const cliente = req.query.cliente || '';

  let where = '1=1';
  const params = {};

  if (tipoDoc) { where += ' AND TipoDoc = @tipoDoc'; params.tipoDoc = tipoDoc; }
  if (cliente) { where += ' AND Entidade = @cliente'; params.cliente = cliente; }
  if (dataInicio) { where += ' AND Data >= @dataInicio'; params.dataInicio = dataInicio; }
  if (dataFim) { where += ' AND Data <= @dataFim'; params.dataFim = dataFim; }

  const countResult = await query(`SELECT COUNT(*) as total FROM CabecDoc WHERE ${where}`, params);
  const result = await query(`
    SELECT Id, TipoDoc, Serie, NumDoc, Entidade, Nome, Data, DataVencimento,
           Moeda, TotalMerc, TotalDesc, TotalIva, TotalDocumento, Zona
    FROM CabecDoc
    WHERE ${where}
    ORDER BY Data DESC
    OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY
  `, { ...params, offset, limit });

  res.json({ page, limit, total: countResult.recordset[0].total, data: result.recordset });
}));

// GET /vendas/documentos/:id - Detalhes de um documento com linhas
router.get('/documentos/:id', asyncHandler(async (req, res) => {
  const cabec = await query('SELECT * FROM CabecDoc WHERE Id = @id', { id: parseInt(req.params.id) });
  if (!cabec.recordset.length) return res.status(404).json({ error: 'Documento nao encontrado' });

  const linhas = await query(`
    SELECT Id, NumLinha, Artigo, Descricao, Quantidade, Unidade, PrecUnit,
           Desconto1, Desconto2, Desconto3, PrecoLiquido, TotalIliquido,
           CodIva, TaxaIva, TotalIva, Armazem, Lote, Vendedor
    FROM LinhasDoc
    WHERE IdCabecDoc = @id
    ORDER BY NumLinha
  `, { id: parseInt(req.params.id) });

  res.json({ cabecalho: cabec.recordset[0], linhas: linhas.recordset });
}));

// GET /vendas/analytics/mensal - Volume de vendas por mes
router.get('/analytics/mensal', asyncHandler(async (req, res) => {
  const { dataInicio, dataFim } = parseDateRange(req);
  let where = `TipoDoc IN ${TIPOS_FACTURA}`;
  const params = {};
  if (dataInicio) { where += ' AND Data >= @dataInicio'; params.dataInicio = dataInicio; }
  if (dataFim) { where += ' AND Data <= @dataFim'; params.dataFim = dataFim; }

  const result = await query(`
    SELECT FORMAT(Data, 'yyyy-MM') as mes,
           SUM(TotalDocumento) as totalVendas,
           COUNT(*) as numDocumentos,
           COUNT(DISTINCT Entidade) as numClientes
    FROM CabecDoc
    WHERE ${where}
    GROUP BY FORMAT(Data, 'yyyy-MM')
    ORDER BY mes
  `, params);
  res.json({ data: result.recordset });
}));

// GET /vendas/analytics/diario - Vendas por dia
router.get('/analytics/diario', asyncHandler(async (req, res) => {
  const { dataInicio, dataFim } = parseDateRange(req);
  let where = `TipoDoc IN ${TIPOS_FACTURA}`;
  const params = {};
  if (dataInicio) { where += ' AND Data >= @dataInicio'; params.dataInicio = dataInicio; }
  if (dataFim) { where += ' AND Data <= @dataFim'; params.dataFim = dataFim; }

  const result = await query(`
    SELECT CAST(Data as DATE) as dia,
           SUM(TotalDocumento) as totalVendas,
           COUNT(*) as numDocumentos
    FROM CabecDoc
    WHERE ${where}
    GROUP BY CAST(Data as DATE)
    ORDER BY dia
  `, params);
  res.json({ data: result.recordset });
}));

// GET /vendas/analytics/top-clientes
router.get('/analytics/top-clientes', asyncHandler(async (req, res) => {
  const topN = Math.min(100, parseInt(req.query.top) || 10);
  const { dataInicio, dataFim } = parseDateRange(req);
  let where = `cd.TipoDoc IN ${TIPOS_FACTURA}`;
  const params = {};
  if (dataInicio) { where += ' AND cd.Data >= @dataInicio'; params.dataInicio = dataInicio; }
  if (dataFim) { where += ' AND cd.Data <= @dataFim'; params.dataFim = dataFim; }

  const result = await query(`
    SELECT TOP (@topN) cd.Entidade, c.Nome,
           SUM(cd.TotalDocumento) as totalFacturado,
           COUNT(*) as numDocumentos,
           AVG(cd.TotalDocumento) as ticketMedio
    FROM CabecDoc cd
    LEFT JOIN Clientes c ON cd.Entidade = c.Cliente
    WHERE ${where}
    GROUP BY cd.Entidade, c.Nome
    ORDER BY totalFacturado DESC
  `, { ...params, topN });
  res.json({ data: result.recordset });
}));

// GET /vendas/analytics/top-artigos
router.get('/analytics/top-artigos', asyncHandler(async (req, res) => {
  const topN = Math.min(100, parseInt(req.query.top) || 10);
  const por = req.query.por || 'valor';
  const { dataInicio, dataFim } = parseDateRange(req);
  let where = `cd.TipoDoc IN ${TIPOS_FACTURA}`;
  const params = {};
  if (dataInicio) { where += ' AND cd.Data >= @dataInicio'; params.dataInicio = dataInicio; }
  if (dataFim) { where += ' AND cd.Data <= @dataFim'; params.dataFim = dataFim; }

  const orderCol = por === 'quantidade' ? 'totalQtd' : 'totalValor';
  const result = await query(`
    SELECT TOP (@topN) ld.Artigo, a.Descricao, a.Familia,
           SUM(ld.Quantidade) as totalQtd,
           SUM(ld.TotalIliquido) as totalValor,
           COUNT(DISTINCT cd.Entidade) as numClientes
    FROM LinhasDoc ld
    INNER JOIN CabecDoc cd ON ld.IdCabecDoc = cd.Id
    LEFT JOIN Artigo a ON ld.Artigo = a.Artigo
    WHERE ${where}
    GROUP BY ld.Artigo, a.Descricao, a.Familia
    ORDER BY ${orderCol} DESC
  `, { ...params, topN });
  res.json({ data: result.recordset });
}));

// GET /vendas/analytics/por-vendedor
router.get('/analytics/por-vendedor', asyncHandler(async (req, res) => {
  const { dataInicio, dataFim } = parseDateRange(req);
  let where = `cd.TipoDoc IN ${TIPOS_FACTURA}`;
  const params = {};
  if (dataInicio) { where += ' AND cd.Data >= @dataInicio'; params.dataInicio = dataInicio; }
  if (dataFim) { where += ' AND cd.Data <= @dataFim'; params.dataFim = dataFim; }

  const result = await query(`
    SELECT ld.Vendedor, v.Nome,
           SUM(ld.TotalIliquido) as totalVendas,
           COUNT(DISTINCT cd.Id) as numDocumentos,
           COUNT(DISTINCT cd.Entidade) as numClientes
    FROM LinhasDoc ld
    INNER JOIN CabecDoc cd ON ld.IdCabecDoc = cd.Id
    LEFT JOIN Vendedores v ON ld.Vendedor = v.Vendedor
    WHERE ${where}
    GROUP BY ld.Vendedor, v.Nome
    ORDER BY totalVendas DESC
  `, params);
  res.json({ data: result.recordset });
}));

// GET /vendas/analytics/por-familia
router.get('/analytics/por-familia', asyncHandler(async (req, res) => {
  const { dataInicio, dataFim } = parseDateRange(req);
  let where = `cd.TipoDoc IN ${TIPOS_FACTURA}`;
  const params = {};
  if (dataInicio) { where += ' AND cd.Data >= @dataInicio'; params.dataInicio = dataInicio; }
  if (dataFim) { where += ' AND cd.Data <= @dataFim'; params.dataFim = dataFim; }

  const result = await query(`
    SELECT a.Familia, f.Descricao as FamiliaDesc,
           SUM(ld.TotalIliquido) as totalVendas,
           SUM(ld.Quantidade) as totalQtd,
           COUNT(DISTINCT ld.Artigo) as numArtigos
    FROM LinhasDoc ld
    INNER JOIN CabecDoc cd ON ld.IdCabecDoc = cd.Id
    LEFT JOIN Artigo a ON ld.Artigo = a.Artigo
    LEFT JOIN Familias f ON a.Familia = f.Familia
    WHERE ${where}
    GROUP BY a.Familia, f.Descricao
    ORDER BY totalVendas DESC
  `, params);
  res.json({ data: result.recordset });
}));

// GET /vendas/analytics/por-zona
router.get('/analytics/por-zona', asyncHandler(async (req, res) => {
  const { dataInicio, dataFim } = parseDateRange(req);
  let where = `cd.TipoDoc IN ${TIPOS_FACTURA}`;
  const params = {};
  if (dataInicio) { where += ' AND cd.Data >= @dataInicio'; params.dataInicio = dataInicio; }
  if (dataFim) { where += ' AND cd.Data <= @dataFim'; params.dataFim = dataFim; }

  const result = await query(`
    SELECT cd.Zona, z.Descricao as ZonaDesc,
           SUM(cd.TotalDocumento) as totalVendas,
           COUNT(*) as numDocumentos,
           COUNT(DISTINCT cd.Entidade) as numClientes
    FROM CabecDoc cd
    LEFT JOIN Zonas z ON cd.Zona = z.Zona
    WHERE ${where}
    GROUP BY cd.Zona, z.Descricao
    ORDER BY totalVendas DESC
  `, params);
  res.json({ data: result.recordset });
}));

// GET /vendas/analytics/resumo - Resumo geral de vendas
router.get('/analytics/resumo', asyncHandler(async (req, res) => {
  const { dataInicio, dataFim } = parseDateRange(req);
  let where = '1=1';
  const params = {};
  if (dataInicio) { where += ' AND Data >= @dataInicio'; params.dataInicio = dataInicio; }
  if (dataFim) { where += ' AND Data <= @dataFim'; params.dataFim = dataFim; }

  const result = await query(`
    SELECT
      SUM(CASE WHEN TipoDoc IN ${TIPOS_FACTURA} THEN TotalDocumento ELSE 0 END)
      - SUM(CASE WHEN TipoDoc IN ${TIPOS_ABATER} THEN TotalDocumento ELSE 0 END) as totalFacturacao,
      SUM(CASE WHEN TipoDoc IN ${TIPOS_FACTURA} THEN TotalDocumento ELSE 0 END) as totalBruto,
      SUM(CASE WHEN TipoDoc IN ${TIPOS_ABATER} THEN TotalDocumento ELSE 0 END) as totalAbatimentos,
      COUNT(CASE WHEN TipoDoc IN ${TIPOS_FACTURA} THEN 1 END) as numFacturas,
      COUNT(CASE WHEN TipoDoc IN ${TIPOS_ABATER} THEN 1 END) as numAbatimentos,
      COUNT(DISTINCT CASE WHEN TipoDoc IN ${TIPOS_TODOS} THEN Entidade END) as numClientes,
      AVG(CASE WHEN TipoDoc IN ${TIPOS_FACTURA} THEN TotalDocumento END) as ticketMedio,
      MIN(CASE WHEN TipoDoc IN ${TIPOS_TODOS} THEN Data END) as primeiraFactura,
      MAX(CASE WHEN TipoDoc IN ${TIPOS_TODOS} THEN Data END) as ultimaFactura
    FROM CabecDoc
    WHERE ${where}
  `, params);
  res.json(result.recordset[0]);
}));

// GET /vendas/analytics/yoy - Year over Year comparison
router.get('/analytics/yoy', asyncHandler(async (req, res) => {
  const result = await query(`
    SELECT YEAR(Data) as ano, MONTH(Data) as mes,
           SUM(CASE WHEN TipoDoc IN ${TIPOS_FACTURA} THEN TotalDocumento
                    WHEN TipoDoc IN ${TIPOS_ABATER} THEN -TotalDocumento
                    ELSE 0 END) as totalVendas,
           COUNT(*) as numDocumentos
    FROM CabecDoc
    WHERE TipoDoc IN ${TIPOS_TODOS}
    GROUP BY YEAR(Data), MONTH(Data)
    ORDER BY ano, mes
  `);
  res.json({ data: result.recordset });
}));

// GET /vendas/analytics/por-localidade - Vendas por localidade de descarga (para mapa)
// Usa Google Geocoding API para normalizar automaticamente nomes de localidades
// Cache persistente em locality-cache.json - geocodifica cada valor distinto uma unica vez
const TIPOS_VENDA = "('FA','FAC','FR','GT','ALC','ALI','FAA','NC')";

router.get('/analytics/por-localidade', asyncHandler(async (req, res) => {
  const { dataInicio, dataFim } = parseDateRange(req);
  const topNParam = parseInt(req.query.top);
  const topN = topNParam === 0 ? Infinity : Math.min(500, topNParam || 100);
  let where = `cd.TipoDoc IN ${TIPOS_VENDA}`;
  const params = {};
  if (dataInicio) { where += ' AND cd.Data >= @dataInicio'; params.dataInicio = dataInicio; }
  if (dataFim) { where += ' AND cd.Data <= @dataFim'; params.dataFim = dataFim; }
  // Default: current year if no date filters provided
  if (!dataInicio && !dataFim) { where += ' AND YEAR(cd.Data) = YEAR(GETDATE())'; }

  // Get raw data: LocalDescarga as primary, Fac_Cploc as fallback for "Morada do Cliente"/empty
  const result = await query(`
    SELECT
      cd.TipoDoc,
      cd.TotalDocumento,
      cd.Entidade,
      cd.Data,
      LTRIM(RTRIM(cd.LocalDescarga)) as localDescarga,
      LTRIM(RTRIM(c.Fac_Cploc)) as facCploc
    FROM CabecDoc cd
    LEFT JOIN Clientes c ON cd.Entidade = c.Cliente
    WHERE ${where}
  `, params);

  // Queue any uncached values for background geocoding
  const allRaw = result.recordset.map(r => {
    const ld = r.localDescarga;
    return (!ld || ld === '' || ld === '.' || ld === '..' || ld === 'Morada do Cliente') ? r.facCploc : ld;
  }).filter(Boolean);
  geocode.bulkNormalizeSync([...new Set(allRaw)]);

  // Normalize and aggregate (synchronous from cache)
  // IMPORTANT: Never skip documents - all must be counted for sum to match total
  const aggMap = {};
  for (const r of result.recordset) {
    let raw = r.localDescarga;
    if (!raw || raw === '' || raw === '.' || raw === '..' || raw === 'Morada do Cliente') {
      raw = r.facCploc || null;
    }

    let normalized;
    if (!raw) {
      normalized = 'Sem Localidade';
    } else {
      normalized = geocode.normalize(raw) || 'Sem Localidade';
    }

    if (!aggMap[normalized]) {
      aggMap[normalized] = { localidade: normalized, numDocumentos: 0, totalVendas: 0, clientes: new Set(), minData: null, maxData: null };
    }
    const agg = aggMap[normalized];
    const abater = ['ALC','ALI','FAA','NC'].includes(r.TipoDoc);
    agg.numDocumentos++;
    agg.totalVendas += abater ? -(r.TotalDocumento || 0) : (r.TotalDocumento || 0);
    agg.clientes.add(r.Entidade);
    if (!agg.minData || r.Data < agg.minData) agg.minData = r.Data;
    if (!agg.maxData || r.Data > agg.maxData) agg.maxData = r.Data;
  }

  const data = Object.values(aggMap)
    .map(a => {
      const coords = geocode.getCoords(a.localidade);
      return {
        localidade: a.localidade,
        latitude: coords ? coords.lat : null,
        longitude: coords ? coords.lng : null,
        numDocumentos: a.numDocumentos,
        totalVendas: a.totalVendas,
        mediaDocumento: a.numDocumentos > 0 ? a.totalVendas / a.numDocumentos : 0,
        numClientes: a.clientes.size,
        primeiraVenda: a.minData,
        ultimaVenda: a.maxData
      };
    })
    .sort((a, b) => b.totalVendas - a.totalVendas)
    .slice(0, topN);

  res.json({ data });
}));

// GET /vendas/analytics/geocode-cache - Ver/gerir o cache de geocoding
router.get('/analytics/geocode-cache', asyncHandler(async (req, res) => {
  const cache = geocode.getCache();
  const entries = Object.entries(cache);
  const resolved = entries.filter(([, v]) => v !== null);
  const failed = entries.filter(([, v]) => v === null);
  res.json({
    total: entries.length,
    resolved: resolved.length,
    failed: failed.length,
    cache: req.query.full === '1' ? cache : undefined,
    failedEntries: failed.map(([k]) => k)
  });
}));

module.exports = router;
