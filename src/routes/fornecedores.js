const { Router } = require('express');
const { query } = require('../db');
const { asyncHandler } = require('../middleware/errorHandler');
const { parsePagination, parseDateRange } = require('../middleware/pagination');

const router = Router();

router.get('/', asyncHandler(async (req, res) => {
  const { limit, offset, page } = parsePagination(req);
  const search = req.query.search || '';
  let where = '1=1';
  const params = {};
  if (search) {
    where += ' AND (Fornecedor LIKE @search OR Nome LIKE @search OR NumContrib LIKE @search OR Email LIKE @search)';
    params.search = `%${search}%`;
  }
  if (req.query.nome) { where += ' AND Nome LIKE @nome'; params.nome = `%${req.query.nome}%`; }
  if (req.query.contribuinte) { where += ' AND NumContrib LIKE @contribuinte'; params.contribuinte = `%${req.query.contribuinte}%`; }
  if (req.query.localidade) { where += ' AND Local LIKE @localidade'; params.localidade = `%${req.query.localidade}%`; }
  if (req.query.pais) { where += ' AND Pais = @pais'; params.pais = req.query.pais; }

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

// GET /fornecedores/analytics/resumo - Resumo de fornecedores
router.get('/analytics/resumo', asyncHandler(async (req, res) => {
  const result = await query(`
    SELECT COUNT(*) as total,
      SUM(CASE WHEN SituacaoActual = 'Activo' OR SituacaoActual IS NULL THEN 1 ELSE 0 END) as activos,
      SUM(Debito) as totalDebito,
      SUM(Credito) as totalCredito
    FROM Fornecedores
  `);
  res.json(result.recordset[0]);
}));

router.get('/:id', asyncHandler(async (req, res) => {
  const result = await query('SELECT * FROM Fornecedores WHERE Fornecedor = @id', { id: req.params.id });
  if (!result.recordset.length) return res.status(404).json({ error: 'Fornecedor nao encontrado' });
  res.json(result.recordset[0]);
}));

router.get('/:id/documentos', asyncHandler(async (req, res) => {
  const { limit, offset, page } = parsePagination(req);
  const { dataInicio, dataFim } = parseDateRange(req);
  let where = 'Entidade = @id';
  const params = { id: req.params.id };
  if (req.query.tipoDoc) { where += ' AND TipoDoc = @tipoDoc'; params.tipoDoc = req.query.tipoDoc; }
  if (req.query.serie) { where += ' AND Serie = @serie'; params.serie = req.query.serie; }
  if (req.query.totalMin) { where += ' AND TotalDocumento >= @totalMin'; params.totalMin = parseFloat(req.query.totalMin); }
  if (req.query.totalMax) { where += ' AND TotalDocumento <= @totalMax'; params.totalMax = parseFloat(req.query.totalMax); }
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

// GET /fornecedores/:id/artigos - Artigos fornecidos por este fornecedor
router.get('/:id/artigos', asyncHandler(async (req, res) => {
  const result = await query(`
    SELECT af.Artigo, a.Descricao, af.RefFornecedor, af.UnidadeCompra,
      af.PrecoCompra, af.Desconto1, af.PrazoEntrega, af.FornecedorPrincipal
    FROM ArtigoFornecedor af
    JOIN Artigo a ON a.Artigo = af.Artigo
    WHERE af.Fornecedor = @id
    ORDER BY af.FornecedorPrincipal DESC, a.Descricao
  `, { id: req.params.id });
  res.json({ data: result.recordset });
}));

module.exports = router;
