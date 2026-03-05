const { Router } = require('express');
const { query } = require('../db');
const { asyncHandler } = require('../middleware/errorHandler');
const { parsePagination } = require('../middleware/pagination');

const router = Router();

// GET /artigos - Listar artigos
router.get('/', asyncHandler(async (req, res) => {
  const { limit, offset, page } = parsePagination(req);
  const search = req.query.search || '';
  const familia = req.query.familia || '';
  const comStock = req.query.comStock;

  let where = '1=1';
  const params = {};

  if (search) {
    where += ' AND (Artigo LIKE @search OR Descricao LIKE @search OR CodBarras LIKE @search)';
    params.search = `%${search}%`;
  }
  if (familia) { where += ' AND Familia = @familia'; params.familia = familia; }
  if (comStock === 'true') where += ' AND STKActual > 0';

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

// GET /artigos/analytics/stock-baixo - Artigos abaixo do stock minimo
router.get('/analytics/stock-baixo', asyncHandler(async (req, res) => {
  const result = await query(`
    SELECT Artigo, Descricao, STKActual, STKMinimo, (STKMinimo - STKActual) as Deficit, ArmazemSugestao as Armazem
    FROM Artigo
    WHERE STKActual < STKMinimo AND STKMinimo > 0 AND MovStock = 'S'
    ORDER BY Deficit DESC
  `);
  res.json({ total: result.recordset.length, data: result.recordset });
}));

// GET /artigos/analytics/valor-stock - Valor total de inventario
router.get('/analytics/valor-stock', asyncHandler(async (req, res) => {
  const result = await query(`
    SELECT
      COUNT(*) as totalArtigos,
      SUM(STKActual) as totalUnidades,
      SUM(STKActual * PCMedio) as valorTotalPCMedio,
      SUM(STKActual * PCUltimo) as valorTotalPCUltimo
    FROM Artigo
    WHERE STKActual > 0 AND MovStock = 'S'
  `);
  res.json(result.recordset[0]);
}));

// GET /artigos/:id
router.get('/:id', asyncHandler(async (req, res) => {
  const result = await query('SELECT * FROM Artigo WHERE Artigo = @id', { id: req.params.id });
  if (!result.recordset.length) return res.status(404).json({ error: 'Artigo nao encontrado' });
  res.json(result.recordset[0]);
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
