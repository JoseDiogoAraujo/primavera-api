const { Router } = require('express');
const { query } = require('../db');
const { asyncHandler } = require('../middleware/errorHandler');
const { parsePagination, parseDateRange } = require('../middleware/pagination');

const router = Router();

// GET /stock/actual - Stock actual por artigo
router.get('/actual', asyncHandler(async (req, res) => {
  const { limit, offset, page } = parsePagination(req);
  let where = "MovStock = 'S' AND STKActual > 0";
  const params = {};

  if (req.query.search) { where += ' AND (Artigo LIKE @search OR Descricao LIKE @search)'; params.search = `%${req.query.search}%`; }
  if (req.query.armazem) { where += ' AND ArmazemSugestao = @armazem'; params.armazem = req.query.armazem; }

  const countResult = await query(`SELECT COUNT(*) as total FROM Artigo WHERE ${where}`, params);
  const result = await query(`
    SELECT Artigo, Descricao, Familia, ArmazemSugestao as Armazem, STKActual, STKMinimo, STKMaximo,
           PCMedio, PCUltimo, (STKActual * PCMedio) as valorStock, UnidadeBase
    FROM Artigo
    WHERE ${where}
    ORDER BY valorStock DESC
    OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY
  `, { ...params, offset, limit });
  res.json({ page, limit, total: countResult.recordset[0].total, data: result.recordset });
}));

// GET /stock/alertas - Artigos com stock critico
router.get('/alertas', asyncHandler(async (req, res) => {
  const result = await query(`
    SELECT Artigo, Descricao, STKActual, STKMinimo, STKMaximo, ArmazemSugestao as Armazem,
           CASE
             WHEN STKActual <= 0 THEN 'sem_stock'
             WHEN STKActual < STKMinimo THEN 'abaixo_minimo'
             WHEN STKActual > STKMaximo AND STKMaximo > 0 THEN 'acima_maximo'
           END as alerta,
           (STKMinimo - STKActual) as deficit
    FROM Artigo
    WHERE MovStock = 'S' AND (
      STKActual <= 0
      OR (STKActual < STKMinimo AND STKMinimo > 0)
      OR (STKActual > STKMaximo AND STKMaximo > 0)
    )
    ORDER BY
      CASE WHEN STKActual <= 0 THEN 0 WHEN STKActual < STKMinimo THEN 1 ELSE 2 END,
      deficit DESC
  `);
  res.json({ total: result.recordset.length, data: result.recordset });
}));

// GET /stock/movimentos - Movimentos de stock
router.get('/movimentos', asyncHandler(async (req, res) => {
  const { limit, offset, page } = parsePagination(req);
  const { dataInicio, dataFim } = parseDateRange(req);
  let where = '1=1';
  const params = {};

  if (req.query.artigo) { where += ' AND m.Artigo = @artigo'; params.artigo = req.query.artigo; }
  if (req.query.armazem) { where += ' AND m.Armazem = @armazem'; params.armazem = req.query.armazem; }
  if (dataInicio) { where += ' AND m.Data >= @dataInicio'; params.dataInicio = dataInicio; }
  if (dataFim) { where += ' AND m.Data <= @dataFim'; params.dataFim = dataFim; }

  const countResult = await query(`SELECT COUNT(*) as total FROM INV_Movimentos m WHERE ${where}`, params);
  const result = await query(`
    SELECT m.Data, m.TipoMovimento, m.Artigo, m.Armazem, m.Quantidade,
           m.Stock_Anterior, m.Stock_Actual, m.NumRegisto
    FROM INV_Movimentos m
    WHERE ${where}
    ORDER BY m.Data DESC, m.NumRegisto DESC
    OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY
  `, { ...params, offset, limit });
  res.json({ page, limit, total: countResult.recordset[0].total, data: result.recordset });
}));

// GET /stock/resumo - Totais de inventario
router.get('/resumo', asyncHandler(async (req, res) => {
  const result = await query(`
    SELECT
      COUNT(*) as totalArtigosComStock,
      SUM(STKActual) as totalUnidades,
      SUM(STKActual * PCMedio) as valorTotalPCMedio,
      SUM(STKActual * PCUltimo) as valorTotalPCUltimo,
      COUNT(CASE WHEN STKActual < STKMinimo AND STKMinimo > 0 THEN 1 END) as artigosAbaixoMinimo,
      COUNT(CASE WHEN STKActual <= 0 THEN 1 END) as artigosSemStock
    FROM Artigo
    WHERE MovStock = 'S'
  `);
  res.json(result.recordset[0]);
}));

module.exports = router;
