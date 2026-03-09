const { Router } = require('express');
const { query } = require('../db');
const { asyncHandler } = require('../middleware/errorHandler');
const { parsePagination, parseDateRange } = require('../middleware/pagination');

const router = Router();

// GET /fornecedores - Listar fornecedores
router.get('/', asyncHandler(async (req, res) => {
  const { limit, offset, page } = parsePagination(req);
  let where = '1=1';
  const params = {};

  if (req.query.search) {
    where += ' AND (Fornecedor LIKE @search OR Nome LIKE @search OR NumContrib LIKE @search OR Email LIKE @search)';
    params.search = `%${req.query.search}%`;
  }

  const countResult = await query(`SELECT COUNT(*) as total FROM Fornecedores WHERE ${where}`, params);
  const result = await query(`
    SELECT Fornecedor, Nome, NumContrib, Morada, Local as Localidade, Cp as CodPostal,
           Tel as Telefone, Email, Pais, CondPag, Moeda, TotalDeb, LimiteCred
    FROM Fornecedores
    WHERE ${where}
    ORDER BY Nome
    OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY
  `, { ...params, offset, limit });

  res.json({ page, limit, total: countResult.recordset[0].total, data: result.recordset });
}));

// GET /fornecedores/:id
router.get('/:id', asyncHandler(async (req, res) => {
  const result = await query('SELECT * FROM Fornecedores WHERE Fornecedor = @id', { id: req.params.id });
  if (!result.recordset.length) return res.status(404).json({ error: 'Fornecedor nao encontrado' });
  res.json(result.recordset[0]);
}));

// GET /fornecedores/:id/documentos - Documentos de compra do fornecedor
router.get('/:id/documentos', asyncHandler(async (req, res) => {
  const { limit, offset, page } = parsePagination(req);
  const { dataInicio, dataFim } = parseDateRange(req);
  let where = 'Entidade = @id';
  const params = { id: req.params.id };
  if (req.query.tipoDoc) { where += ' AND TipoDoc = @tipoDoc'; params.tipoDoc = req.query.tipoDoc; }
  if (dataInicio) { where += ' AND DataDoc >= @dataInicio'; params.dataInicio = dataInicio; }
  if (dataFim) { where += ' AND DataDoc <= @dataFim'; params.dataFim = dataFim; }

  const countResult = await query(`SELECT COUNT(*) as total FROM CabecCompras WHERE ${where}`, params);
  const result = await query(`
    SELECT Id, TipoDoc, Serie, NumDoc, DataDoc, NumDocExterno, TotalDocumento, Moeda
    FROM CabecCompras
    WHERE ${where}
    ORDER BY DataDoc DESC
    OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY
  `, { ...params, offset, limit });
  res.json({ page, limit, total: countResult.recordset[0].total, data: result.recordset });
}));

// GET /fornecedores/:id/saldo - Saldo conta corrente
router.get('/:id/saldo', asyncHandler(async (req, res) => {
  const result = await query(`
    SELECT
      SUM(CASE WHEN ValorPendente > 0 THEN ValorPendente ELSE 0 END) as totalPendente,
      COUNT(*) as numDocumentos,
      MIN(DataVenc) as vencimentoMaisAntigo,
      SUM(CASE WHEN DataVenc < GETDATE() THEN ValorPendente ELSE 0 END) as totalVencido
    FROM Pendentes
    WHERE TipoEntidade = 'F' AND Entidade = @id
  `, { id: req.params.id });
  res.json(result.recordset[0] || {});
}));

// GET /fornecedores/:id/artigos - Artigos fornecidos
router.get('/:id/artigos', asyncHandler(async (req, res) => {
  const result = await query(`
    SELECT af.Artigo, a.Descricao, af.ReferenciaFor as RefFornecedor, af.UnidadeCompra,
      af.PrCustoUltimo, af.UltDescontoComercialCompra as Desconto, af.PrazoEntrega, af.Moeda
    FROM ArtigoFornecedor af
    JOIN Artigo a ON a.Artigo = af.Artigo
    WHERE af.Fornecedor = @id
    ORDER BY a.Descricao
  `, { id: req.params.id });
  res.json({ data: result.recordset });
}));

module.exports = router;
