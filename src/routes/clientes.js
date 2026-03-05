const { Router } = require('express');
const { query } = require('../db');
const { asyncHandler } = require('../middleware/errorHandler');
const { parsePagination } = require('../middleware/pagination');

const router = Router();

// GET /clientes - Listar clientes
router.get('/', asyncHandler(async (req, res) => {
  const { limit, offset, page } = parsePagination(req);
  const search = req.query.search || '';
  const zona = req.query.zona || '';
  const vendedor = req.query.vendedor || '';

  let where = '1=1';
  const params = {};

  if (search) {
    where += ' AND (Cliente LIKE @search OR Nome LIKE @search OR NumContrib LIKE @search)';
    params.search = `%${search}%`;
  }
  if (zona) { where += ' AND Zona = @zona'; params.zona = zona; }
  if (vendedor) { where += ' AND Vendedor = @vendedor'; params.vendedor = vendedor; }

  const countResult = await query(`SELECT COUNT(*) as total FROM Clientes WHERE ${where}`, params);
  const result = await query(`
    SELECT Cliente, Nome, NumContrib, Fac_Mor as Morada, Fac_Local as Localidade, Fac_Cp as CodPostal,
           Fac_Tel as Telefone, Email, Pais, CondPag, Moeda, Vendedor, Zona, Desconto,
           TotalDeb, LimiteCred, Situacao, DataCriacao
    FROM Clientes
    WHERE ${where}
    ORDER BY Nome
    OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY
  `, { ...params, offset, limit });

  res.json({
    page, limit,
    total: countResult.recordset[0].total,
    data: result.recordset,
  });
}));

// GET /clientes/analytics/resumo
router.get('/analytics/resumo', asyncHandler(async (req, res) => {
  const result = await query(`
    SELECT
      COUNT(*) as totalClientes,
      COUNT(CASE WHEN Situacao = 'Activo' OR Situacao IS NULL THEN 1 END) as activos,
      SUM(TotalDeb) as totalDebito,
      AVG(TotalDeb) as mediaDebito
    FROM Clientes
  `);
  res.json(result.recordset[0]);
}));

// GET /clientes/:id
router.get('/:id', asyncHandler(async (req, res) => {
  const result = await query('SELECT * FROM Clientes WHERE Cliente = @id', { id: req.params.id });
  if (!result.recordset.length) return res.status(404).json({ error: 'Cliente nao encontrado' });
  res.json(result.recordset[0]);
}));

// GET /clientes/:id/documentos - Documentos de venda do cliente
router.get('/:id/documentos', asyncHandler(async (req, res) => {
  const { limit, offset, page } = parsePagination(req);
  const tipoDoc = req.query.tipoDoc || '';
  let where = 'Entidade = @id';
  const params = { id: req.params.id };
  if (tipoDoc) { where += ' AND TipoDoc = @tipoDoc'; params.tipoDoc = tipoDoc; }

  const result = await query(`
    SELECT Id, TipoDoc, Serie, NumDoc, Data, Nome, TotalMerc, TotalDesc, TotalIva,
           TotalDocumento, Moeda
    FROM CabecDoc
    WHERE ${where}
    ORDER BY Data DESC
    OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY
  `, { ...params, offset, limit });
  res.json({ page, limit, data: result.recordset });
}));

// GET /clientes/:id/saldo - Saldo conta corrente
router.get('/:id/saldo', asyncHandler(async (req, res) => {
  const result = await query(`
    SELECT
      SUM(CASE WHEN ValorPendente > 0 THEN ValorPendente ELSE 0 END) as totalPendente,
      COUNT(*) as numDocumentos,
      MIN(DataVenc) as vencimentoMaisAntigo,
      SUM(CASE WHEN DataVenc < GETDATE() THEN ValorPendente ELSE 0 END) as totalVencido
    FROM Pendentes
    WHERE TipoEntidade = 'C' AND Entidade = @id
  `, { id: req.params.id });
  res.json(result.recordset[0] || {});
}));

module.exports = router;
