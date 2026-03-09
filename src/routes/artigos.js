const { Router } = require('express');
const { query } = require('../db');
const { asyncHandler } = require('../middleware/errorHandler');
const { parsePagination } = require('../middleware/pagination');

const router = Router();

// GET /artigos - Listar artigos
router.get('/', asyncHandler(async (req, res) => {
  const { limit, offset, page } = parsePagination(req);
  let where = '1=1';
  const params = {};

  if (req.query.search) {
    where += ' AND (Artigo LIKE @search OR Descricao LIKE @search OR CodBarras LIKE @search)';
    params.search = `%${req.query.search}%`;
  }
  if (req.query.familia) { where += ' AND Familia = @familia'; params.familia = req.query.familia; }
  if (req.query.comStock === 'true') where += ' AND STKActual > 0';

  const countResult = await query(`SELECT COUNT(*) as total FROM Artigo WHERE ${where}`, params);
  const result = await query(`
    SELECT Artigo, Descricao, Familia, SubFamilia, Marca, Modelo, UnidadeBase,
           PCMedio, PCUltimo, PCPadrao,
           STKActual, STKMinimo, STKMaximo, ArmazemSugestao as Armazem, MovStock, ArtigoAnulado
    FROM Artigo
    WHERE ${where}
    ORDER BY Descricao
    OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY
  `, { ...params, offset, limit });

  res.json({ page, limit, total: countResult.recordset[0].total, data: result.recordset });
}));

// GET /artigos/:id
router.get('/:id', asyncHandler(async (req, res) => {
  const result = await query('SELECT * FROM Artigo WHERE Artigo = @id', { id: req.params.id });
  if (!result.recordset.length) return res.status(404).json({ error: 'Artigo nao encontrado' });
  res.json(result.recordset[0]);
}));

// GET /artigos/:id/precos - Precos do artigo
router.get('/:id/precos', asyncHandler(async (req, res) => {
  const result = await query(`
    SELECT Artigo, Descricao, PCMedio, PCUltimo, PCPadrao
    FROM Artigo WHERE Artigo = @id
  `, { id: req.params.id });
  if (!result.recordset.length) return res.status(404).json({ error: 'Artigo nao encontrado' });
  res.json(result.recordset[0]);
}));

// GET /artigos/:id/fornecedores - Fornecedores do artigo
router.get('/:id/fornecedores', asyncHandler(async (req, res) => {
  const result = await query(`
    SELECT af.Fornecedor, f.Nome, af.ReferenciaFor as RefFornecedor, af.UnidadeCompra,
      af.PrCustoUltimo, af.UltDescontoComercialCompra as Desconto, af.PrazoEntrega, af.Moeda
    FROM ArtigoFornecedor af
    JOIN Fornecedores f ON f.Fornecedor = af.Fornecedor
    WHERE af.Artigo = @id
    ORDER BY af.PrCustoUltimo
  `, { id: req.params.id });
  res.json({ data: result.recordset });
}));

// GET /artigos/:id/movimentos - Movimentos de stock do artigo
router.get('/:id/movimentos', asyncHandler(async (req, res) => {
  const { limit, offset, page } = parsePagination(req);
  const result = await query(`
    SELECT m.Data, m.TipoMovimento, m.Quantidade, m.Stock_Anterior, m.Stock_Actual,
           m.Armazem, m.NumRegisto
    FROM INV_Movimentos m
    WHERE m.Artigo = @id
    ORDER BY m.Data DESC, m.NumRegisto DESC
    OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY
  `, { id: req.params.id, offset, limit });
  res.json({ page, limit, data: result.recordset });
}));

module.exports = router;
