const { Router } = require('express');
const { query } = require('../db');
const { asyncHandler } = require('../middleware/errorHandler');
const { parsePagination, parseDateRange } = require('../middleware/pagination');

const router = Router();

// GET /compras/documentos - Listar documentos de compra (filtros genericos)
router.get('/documentos', asyncHandler(async (req, res) => {
  const { limit, offset, page } = parsePagination(req);
  const { dataInicio, dataFim } = parseDateRange(req);

  let where = '1=1';
  const params = {};

  if (req.query.search) { where += ' AND (cc.Nome LIKE @search OR cc.Entidade LIKE @search OR CAST(cc.NumDoc AS NVARCHAR) LIKE @search)'; params.search = `%${req.query.search}%`; }
  if (req.query.tipoDoc) { where += ' AND cc.TipoDoc = @tipoDoc'; params.tipoDoc = req.query.tipoDoc; }
  if (req.query.fornecedor) { where += ' AND cc.Entidade = @fornecedor'; params.fornecedor = req.query.fornecedor; }
  if (req.query.serie) { where += ' AND cc.Serie = @serie'; params.serie = req.query.serie; }
  if (dataInicio) { where += ' AND cc.DataDoc >= @dataInicio'; params.dataInicio = dataInicio; }
  if (dataFim) { where += ' AND cc.DataDoc <= @dataFim'; params.dataFim = dataFim; }

  // Filtro por artigo (via linhas)
  let joinLinhas = '';
  if (req.query.artigo) {
    joinLinhas = ' INNER JOIN LinhasCompras lc ON lc.IdCabecCompras = cc.Id';
    where += ' AND lc.Artigo = @artigo';
    params.artigo = req.query.artigo;
  }

  const countResult = await query(`SELECT COUNT(DISTINCT cc.Id) as total FROM CabecCompras cc${joinLinhas} WHERE ${where}`, params);
  const result = await query(`
    SELECT DISTINCT cc.Id, cc.TipoDoc, cc.Serie, cc.NumDoc, cc.Entidade, cc.Nome, cc.DataDoc,
           cc.NumDocExterno, cc.Moeda, cc.TotalMerc, cc.TotalDesc, cc.TotalIva, cc.TotalDocumento, cc.CondPag
    FROM CabecCompras cc${joinLinhas}
    WHERE ${where}
    ORDER BY cc.DataDoc DESC
    OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY
  `, { ...params, offset, limit });

  res.json({ page, limit, total: countResult.recordset[0].total, data: result.recordset });
}));

// GET /compras/documentos/:id - Detalhes de um documento com linhas
router.get('/documentos/:id', asyncHandler(async (req, res) => {
  const cabec = await query('SELECT * FROM CabecCompras WHERE Id = @id', { id: req.params.id });
  if (!cabec.recordset.length) return res.status(404).json({ error: 'Documento nao encontrado' });

  const linhas = await query(`
    SELECT Id, NumLinha, Artigo, Descricao, Quantidade, Unidade, PrecUnit,
           Desconto1, Desconto2, PrecoLiquido, TotalIliquido, CodIva, TaxaIva, TotalIva, Armazem
    FROM LinhasCompras
    WHERE IdCabecCompras = @id
    ORDER BY NumLinha
  `, { id: req.params.id });

  res.json({ cabecalho: cabec.recordset[0], linhas: linhas.recordset });
}));

// GET /compras/resumo - Totais de compras
router.get('/resumo', asyncHandler(async (req, res) => {
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
      AVG(TotalDocumento) as valorMedio
    FROM CabecCompras
    WHERE ${where}
  `, params);
  res.json(result.recordset[0]);
}));

// GET /compras/top - Rankings genericos (?por=fornecedor|artigo, ?top=10, ?from=, ?to=)
router.get('/top', asyncHandler(async (req, res) => {
  const por = req.query.por || 'fornecedor';
  const topN = Math.min(100, parseInt(req.query.top) || 10);
  const { dataInicio, dataFim } = parseDateRange(req);
  let where = '1=1';
  const params = {};
  if (dataInicio) { where += ' AND cc.DataDoc >= @dataInicio'; params.dataInicio = dataInicio; }
  if (dataFim) { where += ' AND cc.DataDoc <= @dataFim'; params.dataFim = dataFim; }

  let sql;
  if (por === 'artigo') {
    sql = `
      SELECT TOP (@topN) lc.Artigo as codigo, a.Descricao as nome,
             SUM(lc.TotalIliquido) as total, SUM(lc.Quantidade) as quantidade, COUNT(DISTINCT cc.Entidade) as numFornecedores
      FROM LinhasCompras lc
      INNER JOIN CabecCompras cc ON lc.IdCabecCompras = cc.Id
      LEFT JOIN Artigo a ON lc.Artigo = a.Artigo
      WHERE ${where}
      GROUP BY lc.Artigo, a.Descricao
      ORDER BY total DESC`;
  } else {
    sql = `
      SELECT TOP (@topN) cc.Entidade as codigo, f.Nome as nome,
             SUM(cc.TotalDocumento) as total, COUNT(*) as numDocumentos
      FROM CabecCompras cc
      LEFT JOIN Fornecedores f ON cc.Entidade = f.Fornecedor
      WHERE ${where}
      GROUP BY cc.Entidade, f.Nome
      ORDER BY total DESC`;
  }

  const result = await query(sql, { ...params, topN });
  res.json({ por, top: topN, data: result.recordset });
}));

module.exports = router;
