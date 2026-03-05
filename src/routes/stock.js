const { Router } = require('express');
const { query } = require('../db');
const { asyncHandler } = require('../middleware/errorHandler');
const { parsePagination, parseDateRange } = require('../middleware/pagination');

const router = Router();

// GET /stock/actual - Stock actual por artigo
router.get('/actual', asyncHandler(async (req, res) => {
  const { limit, offset, page } = parsePagination(req);
  const armazem = req.query.armazem || '';
  const familia = req.query.familia || '';

  let where = 'MovStock = 1 AND StkActual > 0';
  const params = {};
  if (armazem) { where += ' AND Armazem = @armazem'; params.armazem = armazem; }
  if (familia) { where += ' AND Familia = @familia'; params.familia = familia; }

  const result = await query(`
    SELECT Artigo, Descricao, Familia, Armazem, StkActual, StkMinimo, StkMaximo,
           PCMedio, PCUltimo, (StkActual * PCMedio) as valorStock, UnidadeBase
    FROM Artigos
    WHERE ${where}
    ORDER BY valorStock DESC
    OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY
  `, { ...params, offset, limit });
  res.json({ page, limit, data: result.recordset });
}));

// GET /stock/por-armazem - Stock agrupado por armazem
router.get('/por-armazem', asyncHandler(async (req, res) => {
  const result = await query(`
    SELECT a.Armazem, arm.Descricao,
           COUNT(*) as numArtigos,
           SUM(a.StkActual) as totalUnidades,
           SUM(a.StkActual * a.PCMedio) as valorTotal
    FROM Artigos a
    LEFT JOIN Armazens arm ON a.Armazem = arm.Armazem
    WHERE a.MovStock = 1 AND a.StkActual > 0
    GROUP BY a.Armazem, arm.Descricao
    ORDER BY valorTotal DESC
  `);
  res.json({ data: result.recordset });
}));

// GET /stock/por-familia - Stock agrupado por familia
router.get('/por-familia', asyncHandler(async (req, res) => {
  const result = await query(`
    SELECT a.Familia, f.Descricao,
           COUNT(*) as numArtigos,
           SUM(a.StkActual) as totalUnidades,
           SUM(a.StkActual * a.PCMedio) as valorTotal
    FROM Artigos a
    LEFT JOIN Familias f ON a.Familia = f.Familia
    WHERE a.MovStock = 1 AND a.StkActual > 0
    GROUP BY a.Familia, f.Descricao
    ORDER BY valorTotal DESC
  `);
  res.json({ data: result.recordset });
}));

// GET /stock/alertas - Artigos com stock critico
router.get('/alertas', asyncHandler(async (req, res) => {
  const result = await query(`
    SELECT Artigo, Descricao, StkActual, StkMinimo, StkMaximo, Armazem,
           CASE
             WHEN StkActual <= 0 THEN 'sem_stock'
             WHEN StkActual < StkMinimo THEN 'abaixo_minimo'
             WHEN StkActual > StkMaximo AND StkMaximo > 0 THEN 'acima_maximo'
           END as alerta,
           (StkMinimo - StkActual) as deficit
    FROM Artigos
    WHERE MovStock = 1 AND (
      StkActual <= 0
      OR (StkActual < StkMinimo AND StkMinimo > 0)
      OR (StkActual > StkMaximo AND StkMaximo > 0)
    )
    ORDER BY
      CASE WHEN StkActual <= 0 THEN 0 WHEN StkActual < StkMinimo THEN 1 ELSE 2 END,
      deficit DESC
  `);
  res.json({ total: result.recordset.length, data: result.recordset });
}));

// GET /stock/movimentos - Movimentos de stock recentes
router.get('/movimentos', asyncHandler(async (req, res) => {
  const { limit, offset, page } = parsePagination(req);
  const { dataInicio, dataFim } = parseDateRange(req);
  const tipo = req.query.tipo || ''; // E ou S

  let where = '1=1';
  const params = {};
  if (dataInicio) { where += ' AND m.Data >= @dataInicio'; params.dataInicio = dataInicio; }
  if (dataFim) { where += ' AND m.Data <= @dataFim'; params.dataFim = dataFim; }
  if (tipo) { where += ' AND m.TipoMovimento = @tipo'; params.tipo = tipo; }

  const result = await query(`
    SELECT m.Data, m.TipoMovimento, m.Stock_Anterior, m.Stock_Actual,
           (m.Stock_Actual - m.Stock_Anterior) as variacao,
           m.DataIntegracao, m.NumRegisto
    FROM INV_Movimentos m
    WHERE ${where}
    ORDER BY m.Data DESC, m.NumRegisto DESC
    OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY
  `, { ...params, offset, limit });
  res.json({ page, limit, data: result.recordset });
}));

// GET /stock/rotacao - Analise de rotacao de stock
router.get('/rotacao', asyncHandler(async (req, res) => {
  const dias = parseInt(req.query.dias) || 90;
  const result = await query(`
    SELECT a.Artigo, a.Descricao, a.StkActual, a.PCMedio,
           (a.StkActual * a.PCMedio) as valorStock,
           ISNULL(v.qtdVendida, 0) as qtdVendida,
           CASE WHEN ISNULL(v.qtdVendida, 0) > 0
             THEN a.StkActual / (v.qtdVendida / @dias)
             ELSE 9999 END as diasCobertura
    FROM Artigos a
    LEFT JOIN (
      SELECT ld.Artigo, SUM(ld.Quantidade) as qtdVendida
      FROM LinhasDoc ld
      INNER JOIN CabecDoc cd ON ld.IdCabecDoc = cd.Id
      WHERE cd.TipoDoc IN ('FA','FR','FS') AND cd.Anulado = 0
        AND cd.Data >= DATEADD(DAY, -@dias, GETDATE())
      GROUP BY ld.Artigo
    ) v ON a.Artigo = v.Artigo
    WHERE a.MovStock = 1 AND a.StkActual > 0
    ORDER BY diasCobertura DESC
  `, { dias });
  res.json({ dias, data: result.recordset });
}));

// GET /stock/resumo
router.get('/resumo', asyncHandler(async (req, res) => {
  const result = await query(`
    SELECT
      COUNT(*) as totalArtigosComStock,
      SUM(StkActual) as totalUnidades,
      SUM(StkActual * PCMedio) as valorTotalPCMedio,
      SUM(StkActual * PCUltimo) as valorTotalPCUltimo,
      COUNT(CASE WHEN StkActual < StkMinimo AND StkMinimo > 0 THEN 1 END) as artigosAbaixoMinimo,
      COUNT(CASE WHEN StkActual <= 0 AND MovStock = 1 THEN 1 END) as artigosSemStock
    FROM Artigos
    WHERE MovStock = 1 AND StkActual > 0
  `);
  res.json(result.recordset[0]);
}));

module.exports = router;
