const { Router } = require('express');
const { query } = require('../db');
const { asyncHandler } = require('../middleware/errorHandler');
const { parsePagination, parseDateRange } = require('../middleware/pagination');

const router = Router();

const TIPOS_FACTURA = "('FA','FR','FS')";
const TIPOS_NC = "('NC')";

// GET /vendas/documentos - Listar documentos de venda
router.get('/documentos', asyncHandler(async (req, res) => {
  const { limit, offset, page } = parsePagination(req);
  const { dataInicio, dataFim } = parseDateRange(req);
  const tipoDoc = req.query.tipoDoc || '';
  const cliente = req.query.cliente || '';

  let where = 'Anulado = 0';
  const params = {};

  if (tipoDoc) { where += ' AND TipoDoc = @tipoDoc'; params.tipoDoc = tipoDoc; }
  if (cliente) { where += ' AND Entidade = @cliente'; params.cliente = cliente; }
  if (dataInicio) { where += ' AND Data >= @dataInicio'; params.dataInicio = dataInicio; }
  if (dataFim) { where += ' AND Data <= @dataFim'; params.dataFim = dataFim; }

  const countResult = await query(`SELECT COUNT(*) as total FROM CabecDoc WHERE ${where}`, params);
  const result = await query(`
    SELECT Id, TipoDoc, Serie, NumDoc, Entidade, Nome, Data, DataVencimento,
           Moeda, TotalMerc, TotalDesc, TotalIva, TotalDocumento, Vendedor, Estado
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
           Desconto1, Desconto2, Desconto3, PrecoLiquido, TotalILiquido,
           CodIva, TaxaIva, TotalIva, Armazem, Lote
    FROM LinhasDoc
    WHERE IdCabecDoc = @id
    ORDER BY NumLinha
  `, { id: parseInt(req.params.id) });

  res.json({ cabecalho: cabec.recordset[0], linhas: linhas.recordset });
}));

// GET /vendas/analytics/mensal - Volume de vendas por mes
router.get('/analytics/mensal', asyncHandler(async (req, res) => {
  const { dataInicio, dataFim } = parseDateRange(req);
  let where = `TipoDoc IN ${TIPOS_FACTURA} AND Anulado = 0`;
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
  let where = `TipoDoc IN ${TIPOS_FACTURA} AND Anulado = 0`;
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
  let where = `cd.TipoDoc IN ${TIPOS_FACTURA} AND cd.Anulado = 0`;
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
  const por = req.query.por || 'valor'; // valor ou quantidade
  const { dataInicio, dataFim } = parseDateRange(req);
  let where = `cd.TipoDoc IN ${TIPOS_FACTURA} AND cd.Anulado = 0`;
  const params = {};
  if (dataInicio) { where += ' AND cd.Data >= @dataInicio'; params.dataInicio = dataInicio; }
  if (dataFim) { where += ' AND cd.Data <= @dataFim'; params.dataFim = dataFim; }

  const orderCol = por === 'quantidade' ? 'totalQtd' : 'totalValor';
  const result = await query(`
    SELECT TOP (@topN) ld.Artigo, a.Descricao, a.Familia,
           SUM(ld.Quantidade) as totalQtd,
           SUM(ld.TotalILiquido) as totalValor,
           COUNT(DISTINCT cd.Entidade) as numClientes
    FROM LinhasDoc ld
    INNER JOIN CabecDoc cd ON ld.IdCabecDoc = cd.Id
    LEFT JOIN Artigos a ON ld.Artigo = a.Artigo
    WHERE ${where}
    GROUP BY ld.Artigo, a.Descricao, a.Familia
    ORDER BY ${orderCol} DESC
  `, { ...params, topN });
  res.json({ data: result.recordset });
}));

// GET /vendas/analytics/por-vendedor
router.get('/analytics/por-vendedor', asyncHandler(async (req, res) => {
  const { dataInicio, dataFim } = parseDateRange(req);
  let where = `cd.TipoDoc IN ${TIPOS_FACTURA} AND cd.Anulado = 0`;
  const params = {};
  if (dataInicio) { where += ' AND cd.Data >= @dataInicio'; params.dataInicio = dataInicio; }
  if (dataFim) { where += ' AND cd.Data <= @dataFim'; params.dataFim = dataFim; }

  const result = await query(`
    SELECT cd.Vendedor, v.Nome,
           SUM(cd.TotalDocumento) as totalVendas,
           COUNT(*) as numDocumentos,
           COUNT(DISTINCT cd.Entidade) as numClientes,
           AVG(cd.TotalDocumento) as ticketMedio
    FROM CabecDoc cd
    LEFT JOIN Vendedores v ON cd.Vendedor = v.Vendedor
    WHERE ${where}
    GROUP BY cd.Vendedor, v.Nome
    ORDER BY totalVendas DESC
  `, params);
  res.json({ data: result.recordset });
}));

// GET /vendas/analytics/por-familia
router.get('/analytics/por-familia', asyncHandler(async (req, res) => {
  const { dataInicio, dataFim } = parseDateRange(req);
  let where = `cd.TipoDoc IN ${TIPOS_FACTURA} AND cd.Anulado = 0`;
  const params = {};
  if (dataInicio) { where += ' AND cd.Data >= @dataInicio'; params.dataInicio = dataInicio; }
  if (dataFim) { where += ' AND cd.Data <= @dataFim'; params.dataFim = dataFim; }

  const result = await query(`
    SELECT a.Familia, f.Descricao as FamiliaDesc,
           SUM(ld.TotalILiquido) as totalVendas,
           SUM(ld.Quantidade) as totalQtd,
           COUNT(DISTINCT ld.Artigo) as numArtigos
    FROM LinhasDoc ld
    INNER JOIN CabecDoc cd ON ld.IdCabecDoc = cd.Id
    LEFT JOIN Artigos a ON ld.Artigo = a.Artigo
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
  let where = `cd.TipoDoc IN ${TIPOS_FACTURA} AND cd.Anulado = 0`;
  const params = {};
  if (dataInicio) { where += ' AND cd.Data >= @dataInicio'; params.dataInicio = dataInicio; }
  if (dataFim) { where += ' AND cd.Data <= @dataFim'; params.dataFim = dataFim; }

  const result = await query(`
    SELECT c.Zona, z.Descricao as ZonaDesc,
           SUM(cd.TotalDocumento) as totalVendas,
           COUNT(*) as numDocumentos,
           COUNT(DISTINCT cd.Entidade) as numClientes
    FROM CabecDoc cd
    LEFT JOIN Clientes c ON cd.Entidade = c.Cliente
    LEFT JOIN Zonas z ON c.Zona = z.Zona
    WHERE ${where}
    GROUP BY c.Zona, z.Descricao
    ORDER BY totalVendas DESC
  `, params);
  res.json({ data: result.recordset });
}));

// GET /vendas/analytics/margens - Margem por artigo
router.get('/analytics/margens', asyncHandler(async (req, res) => {
  const topN = Math.min(100, parseInt(req.query.top) || 20);
  const { dataInicio, dataFim } = parseDateRange(req);
  let where = `cd.TipoDoc IN ${TIPOS_FACTURA} AND cd.Anulado = 0`;
  const params = {};
  if (dataInicio) { where += ' AND cd.Data >= @dataInicio'; params.dataInicio = dataInicio; }
  if (dataFim) { where += ' AND cd.Data <= @dataFim'; params.dataFim = dataFim; }

  const result = await query(`
    SELECT TOP (@topN) ld.Artigo, a.Descricao,
           SUM(ld.Quantidade) as qtdVendida,
           SUM(ld.TotalILiquido) as receita,
           SUM(ld.Quantidade * ISNULL(ld.PCMedio, 0)) as custo,
           SUM(ld.TotalILiquido) - SUM(ld.Quantidade * ISNULL(ld.PCMedio, 0)) as margem,
           CASE WHEN SUM(ld.TotalILiquido) > 0
             THEN (SUM(ld.TotalILiquido) - SUM(ld.Quantidade * ISNULL(ld.PCMedio, 0))) / SUM(ld.TotalILiquido) * 100
             ELSE 0 END as margemPct
    FROM LinhasDoc ld
    INNER JOIN CabecDoc cd ON ld.IdCabecDoc = cd.Id
    LEFT JOIN Artigos a ON ld.Artigo = a.Artigo
    WHERE ${where}
    GROUP BY ld.Artigo, a.Descricao
    HAVING SUM(ld.TotalILiquido) > 0
    ORDER BY margem DESC
  `, { ...params, topN });
  res.json({ data: result.recordset });
}));

// GET /vendas/analytics/resumo - Resumo geral de vendas
router.get('/analytics/resumo', asyncHandler(async (req, res) => {
  const { dataInicio, dataFim } = parseDateRange(req);
  let where = 'Anulado = 0';
  const params = {};
  if (dataInicio) { where += ' AND Data >= @dataInicio'; params.dataInicio = dataInicio; }
  if (dataFim) { where += ' AND Data <= @dataFim'; params.dataFim = dataFim; }

  const result = await query(`
    SELECT
      SUM(CASE WHEN TipoDoc IN ${TIPOS_FACTURA} THEN TotalDocumento ELSE 0 END) as totalFacturacao,
      SUM(CASE WHEN TipoDoc IN ${TIPOS_NC} THEN TotalDocumento ELSE 0 END) as totalNotasCredito,
      COUNT(CASE WHEN TipoDoc IN ${TIPOS_FACTURA} THEN 1 END) as numFacturas,
      COUNT(CASE WHEN TipoDoc IN ${TIPOS_NC} THEN 1 END) as numNotasCredito,
      COUNT(DISTINCT Entidade) as numClientes,
      AVG(CASE WHEN TipoDoc IN ${TIPOS_FACTURA} THEN TotalDocumento END) as ticketMedio,
      MIN(CASE WHEN TipoDoc IN ${TIPOS_FACTURA} THEN Data END) as primeiraFactura,
      MAX(CASE WHEN TipoDoc IN ${TIPOS_FACTURA} THEN Data END) as ultimaFactura
    FROM CabecDoc
    WHERE ${where}
  `, params);
  res.json(result.recordset[0]);
}));

// GET /vendas/analytics/yoy - Year over Year comparison
router.get('/analytics/yoy', asyncHandler(async (req, res) => {
  const result = await query(`
    SELECT YEAR(Data) as ano, MONTH(Data) as mes,
           SUM(TotalDocumento) as totalVendas,
           COUNT(*) as numDocumentos
    FROM CabecDoc
    WHERE TipoDoc IN ${TIPOS_FACTURA} AND Anulado = 0
    GROUP BY YEAR(Data), MONTH(Data)
    ORDER BY ano, mes
  `);
  res.json({ data: result.recordset });
}));

module.exports = router;
