const { Router } = require('express');
const { query } = require('../db');
const { asyncHandler } = require('../middleware/errorHandler');
const { parsePagination, parseDateRange } = require('../middleware/pagination');

const router = Router();

// GET /compras/documentos - Listar documentos de compra (filtros avancados)
router.get('/documentos', asyncHandler(async (req, res) => {
  const { limit, offset, page } = parsePagination(req);
  const { dataInicio, dataFim } = parseDateRange(req);

  let where = '1=1';
  const params = {};

  if (req.query.tipoDoc) { where += ' AND cc.TipoDoc = @tipoDoc'; params.tipoDoc = req.query.tipoDoc; }
  if (req.query.fornecedor) { where += ' AND cc.Entidade = @fornecedor'; params.fornecedor = req.query.fornecedor; }
  if (req.query.nome) { where += ' AND cc.Nome LIKE @nome'; params.nome = `%${req.query.nome}%`; }
  if (req.query.serie) { where += ' AND cc.Serie = @serie'; params.serie = req.query.serie; }
  if (req.query.moeda) { where += ' AND cc.Moeda = @moeda'; params.moeda = req.query.moeda; }
  if (req.query.numDoc) { where += ' AND cc.NumDoc = @numDoc'; params.numDoc = parseInt(req.query.numDoc); }
  if (req.query.numDocExterno) { where += ' AND cc.NumDocExterno LIKE @numDocExterno'; params.numDocExterno = `%${req.query.numDocExterno}%`; }
  if (req.query.totalMin) { where += ' AND cc.TotalDocumento >= @totalMin'; params.totalMin = parseFloat(req.query.totalMin); }
  if (req.query.totalMax) { where += ' AND cc.TotalDocumento <= @totalMax'; params.totalMax = parseFloat(req.query.totalMax); }
  if (req.query.condPag) { where += ' AND cc.CondPag = @condPag'; params.condPag = req.query.condPag; }
  if (dataInicio) { where += ' AND cc.DataDoc >= @dataInicio'; params.dataInicio = dataInicio; }
  if (dataFim) { where += ' AND cc.DataDoc <= @dataFim'; params.dataFim = dataFim; }

  // Filtros por artigo/familia (via linhas)
  let joinLinhas = '';
  if (req.query.artigo) {
    joinLinhas = ' INNER JOIN LinhasCompras lc ON lc.IdCabecCompras = cc.Id';
    where += ' AND lc.Artigo = @artigo';
    params.artigo = req.query.artigo;
  }
  if (req.query.familia) {
    if (!joinLinhas) joinLinhas = ' INNER JOIN LinhasCompras lc ON lc.IdCabecCompras = cc.Id';
    joinLinhas += ' LEFT JOIN Artigo a ON lc.Artigo = a.Artigo';
    where += ' AND a.Familia = @familia';
    params.familia = req.query.familia;
  }

  const countResult = await query(`SELECT COUNT(DISTINCT cc.Id) as total FROM CabecCompras cc${joinLinhas} WHERE ${where}`, params);
  const result = await query(`
    SELECT DISTINCT cc.Id, cc.TipoDoc, cc.Serie, cc.NumDoc, cc.Entidade, cc.Nome, cc.DataDoc, cc.NumDocExterno,
           cc.Moeda, cc.TotalMerc, cc.TotalDesc, cc.TotalIva, cc.TotalDocumento, cc.CondPag
    FROM CabecCompras cc${joinLinhas}
    WHERE ${where}
    ORDER BY cc.DataDoc DESC
    OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY
  `, { ...params, offset, limit });

  res.json({ page, limit, total: countResult.recordset[0].total, data: result.recordset });
}));

// GET /compras/documentos/:id
router.get('/documentos/:id', asyncHandler(async (req, res) => {
  const cabec = await query('SELECT * FROM CabecCompras WHERE Id = @id', { id: parseInt(req.params.id) });
  if (!cabec.recordset.length) return res.status(404).json({ error: 'Documento nao encontrado' });

  const linhas = await query(`
    SELECT Id, NumLinha, Artigo, Descricao, Quantidade, Unidade, PrecUnit,
           Desconto1, Desconto2, PrecoLiquido, TotalIliquido, CodIva, TaxaIva, TotalIva, Armazem
    FROM LinhasCompras
    WHERE IdCabecCompras = @id
    ORDER BY NumLinha
  `, { id: parseInt(req.params.id) });

  res.json({ cabecalho: cabec.recordset[0], linhas: linhas.recordset });
}));

// GET /compras/analytics/mensal
router.get('/analytics/mensal', asyncHandler(async (req, res) => {
  const { dataInicio, dataFim } = parseDateRange(req);
  let where = '1=1';
  const params = {};
  if (dataInicio) { where += ' AND DataDoc >= @dataInicio'; params.dataInicio = dataInicio; }
  if (dataFim) { where += ' AND DataDoc <= @dataFim'; params.dataFim = dataFim; }

  const result = await query(`
    SELECT FORMAT(DataDoc, 'yyyy-MM') as mes,
           SUM(TotalDocumento) as totalCompras,
           COUNT(*) as numDocumentos,
           COUNT(DISTINCT Entidade) as numFornecedores
    FROM CabecCompras
    WHERE ${where}
    GROUP BY FORMAT(DataDoc, 'yyyy-MM')
    ORDER BY mes
  `, params);
  res.json({ data: result.recordset });
}));

// GET /compras/analytics/top-fornecedores
router.get('/analytics/top-fornecedores', asyncHandler(async (req, res) => {
  const topN = Math.min(100, parseInt(req.query.top) || 10);
  const { dataInicio, dataFim } = parseDateRange(req);
  let where = '1=1';
  const params = {};
  if (dataInicio) { where += ' AND cc.DataDoc >= @dataInicio'; params.dataInicio = dataInicio; }
  if (dataFim) { where += ' AND cc.DataDoc <= @dataFim'; params.dataFim = dataFim; }

  const result = await query(`
    SELECT TOP (@topN) cc.Entidade, f.Nome,
           SUM(cc.TotalDocumento) as totalCompras,
           COUNT(*) as numDocumentos,
           AVG(cc.TotalDocumento) as valorMedio
    FROM CabecCompras cc
    LEFT JOIN Fornecedores f ON cc.Entidade = f.Fornecedor
    WHERE ${where}
    GROUP BY cc.Entidade, f.Nome
    ORDER BY totalCompras DESC
  `, { ...params, topN });
  res.json({ data: result.recordset });
}));

// GET /compras/analytics/top-artigos
router.get('/analytics/top-artigos', asyncHandler(async (req, res) => {
  const topN = Math.min(100, parseInt(req.query.top) || 10);
  const { dataInicio, dataFim } = parseDateRange(req);
  let where = '1=1';
  const params = {};
  if (dataInicio) { where += ' AND cc.DataDoc >= @dataInicio'; params.dataInicio = dataInicio; }
  if (dataFim) { where += ' AND cc.DataDoc <= @dataFim'; params.dataFim = dataFim; }

  const result = await query(`
    SELECT TOP (@topN) lc.Artigo, a.Descricao,
           SUM(lc.Quantidade) as totalQtd,
           SUM(lc.TotalIliquido) as totalValor,
           AVG(lc.PrecUnit) as precoMedio,
           COUNT(DISTINCT cc.Entidade) as numFornecedores
    FROM LinhasCompras lc
    INNER JOIN CabecCompras cc ON lc.IdCabecCompras = cc.Id
    LEFT JOIN Artigo a ON lc.Artigo = a.Artigo
    WHERE ${where}
    GROUP BY lc.Artigo, a.Descricao
    ORDER BY totalValor DESC
  `, { ...params, topN });
  res.json({ data: result.recordset });
}));

// GET /compras/analytics/resumo
router.get('/analytics/resumo', asyncHandler(async (req, res) => {
  const { dataInicio, dataFim } = parseDateRange(req);
  let where = '1=1';
  const params = {};
  if (dataInicio) { where += ' AND DataDoc >= @dataInicio'; params.dataInicio = dataInicio; }
  if (dataFim) { where += ' AND DataDoc <= @dataFim'; params.dataFim = dataFim; }

  const result = await query(`
    SELECT
      SUM(TotalDocumento) as totalCompras,
      COUNT(*) as numDocumentos,
      COUNT(DISTINCT Entidade) as numFornecedores,
      AVG(TotalDocumento) as valorMedio,
      MIN(DataDoc) as primeiraCompra,
      MAX(DataDoc) as ultimaCompra
    FROM CabecCompras
    WHERE ${where}
  `, params);
  res.json(result.recordset[0]);
}));

// GET /compras/analytics/por-tipodoc - Compras por tipo de documento
router.get('/analytics/por-tipodoc', asyncHandler(async (req, res) => {
  const { dataInicio, dataFim } = parseDateRange(req);
  let where = '(s.Anulado IS NULL OR s.Anulado = 0)';
  const params = {};
  if (dataInicio) { where += ' AND cc.DataDoc >= @dataInicio'; params.dataInicio = dataInicio; }
  if (dataFim) { where += ' AND cc.DataDoc <= @dataFim'; params.dataFim = dataFim; }

  const result = await query(`
    SELECT cc.TipoDoc, COUNT(*) as totalDocs,
           SUM(cc.TotalDocumento) as totalValor,
           COUNT(DISTINCT cc.Entidade) as totalFornecedores
    FROM CabecCompras cc
    LEFT JOIN CabecComprasStatus s ON s.IdCabecCompras = cc.Id
    WHERE ${where}
    GROUP BY cc.TipoDoc
    ORDER BY totalValor DESC
  `, params);
  res.json({ data: result.recordset });
}));

// GET /compras/analytics/yoy - Year over Year comparison
router.get('/analytics/yoy', asyncHandler(async (req, res) => {
  const result = await query(`
    SELECT YEAR(cc.DataDoc) as ano, MONTH(cc.DataDoc) as mes,
           SUM(cc.TotalDocumento) as total,
           COUNT(*) as numDocumentos,
           COUNT(DISTINCT cc.Entidade) as numFornecedores
    FROM CabecCompras cc
    LEFT JOIN CabecComprasStatus s ON s.IdCabecCompras = cc.Id
    WHERE (s.Anulado IS NULL OR s.Anulado = 0)
    GROUP BY YEAR(cc.DataDoc), MONTH(cc.DataDoc)
    ORDER BY ano, mes
  `);
  res.json({ data: result.recordset });
}));

// GET /compras/encomendas - Encomendas de compra pendentes (tipo ECF)
router.get('/encomendas', asyncHandler(async (req, res) => {
  const result = await query(`
    SELECT cc.Id, cc.Serie, cc.NumDoc, cc.Entidade, f.Nome, cc.DataDoc, cc.TotalDocumento,
           cc.Estado, cc.NumDocExterno, cc.Observacoes
    FROM CabecCompras cc
    LEFT JOIN CabecComprasStatus s ON s.IdCabecCompras = cc.Id
    LEFT JOIN Fornecedores f ON f.Fornecedor = cc.Entidade
    WHERE cc.TipoDoc = 'ECF' AND (s.Anulado IS NULL OR s.Anulado = 0) AND (s.Fechado IS NULL OR s.Fechado = 0)
    ORDER BY cc.DataDoc DESC
  `);
  res.json({ data: result.recordset });
}));

module.exports = router;
