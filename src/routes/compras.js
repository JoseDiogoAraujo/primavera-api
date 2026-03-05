const { Router } = require('express');
const { query } = require('../db');
const { asyncHandler } = require('../middleware/errorHandler');
const { parsePagination, parseDateRange } = require('../middleware/pagination');

const router = Router();

// GET /compras/documentos
router.get('/documentos', asyncHandler(async (req, res) => {
  const { limit, offset, page } = parsePagination(req);
  const { dataInicio, dataFim } = parseDateRange(req);
  const tipoDoc = req.query.tipoDoc || '';
  const fornecedor = req.query.fornecedor || '';

  let where = 'Anulado = 0';
  const params = {};
  if (tipoDoc) { where += ' AND TipoDoc = @tipoDoc'; params.tipoDoc = tipoDoc; }
  if (fornecedor) { where += ' AND Entidade = @fornecedor'; params.fornecedor = fornecedor; }
  if (dataInicio) { where += ' AND DataDoc >= @dataInicio'; params.dataInicio = dataInicio; }
  if (dataFim) { where += ' AND DataDoc <= @dataFim'; params.dataFim = dataFim; }

  const countResult = await query(`SELECT COUNT(*) as total FROM CabecCompras WHERE ${where}`, params);
  const result = await query(`
    SELECT Id, TipoDoc, Serie, NumDoc, Entidade, Nome, DataDoc, NumDocExterno,
           Moeda, TotalMerc, TotalDesc, TotalIva, TotalDocumento, Estado
    FROM CabecCompras
    WHERE ${where}
    ORDER BY DataDoc DESC
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
           Desconto1, Desconto2, PrecoLiquido, TotalILiquido, CodIva, TaxaIva, TotalIva, Armazem
    FROM LinhasCompras
    WHERE IdCabecCompras = @id
    ORDER BY NumLinha
  `, { id: parseInt(req.params.id) });

  res.json({ cabecalho: cabec.recordset[0], linhas: linhas.recordset });
}));

// GET /compras/analytics/mensal
router.get('/analytics/mensal', asyncHandler(async (req, res) => {
  const { dataInicio, dataFim } = parseDateRange(req);
  let where = 'Anulado = 0';
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
  let where = 'cc.Anulado = 0';
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
  let where = 'cc.Anulado = 0';
  const params = {};
  if (dataInicio) { where += ' AND cc.DataDoc >= @dataInicio'; params.dataInicio = dataInicio; }
  if (dataFim) { where += ' AND cc.DataDoc <= @dataFim'; params.dataFim = dataFim; }

  const result = await query(`
    SELECT TOP (@topN) lc.Artigo, a.Descricao,
           SUM(lc.Quantidade) as totalQtd,
           SUM(lc.TotalILiquido) as totalValor,
           AVG(lc.PrecUnit) as precoMedio,
           COUNT(DISTINCT cc.Entidade) as numFornecedores
    FROM LinhasCompras lc
    INNER JOIN CabecCompras cc ON lc.IdCabecCompras = cc.Id
    LEFT JOIN Artigos a ON lc.Artigo = a.Artigo
    WHERE ${where}
    GROUP BY lc.Artigo, a.Descricao
    ORDER BY totalValor DESC
  `, { ...params, topN });
  res.json({ data: result.recordset });
}));

// GET /compras/analytics/resumo
router.get('/analytics/resumo', asyncHandler(async (req, res) => {
  const { dataInicio, dataFim } = parseDateRange(req);
  let where = 'Anulado = 0';
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

module.exports = router;
