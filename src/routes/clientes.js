const { Router } = require('express');
const { query } = require('../db');
const { asyncHandler } = require('../middleware/errorHandler');
const { parsePagination, parseDateRange } = require('../middleware/pagination');

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
    where += ' AND (Cliente LIKE @search OR Nome LIKE @search OR NumContrib LIKE @search OR Email LIKE @search OR Fac_Tel LIKE @search)';
    params.search = `%${search}%`;
  }
  if (req.query.nome) { where += ' AND Nome LIKE @nome'; params.nome = `%${req.query.nome}%`; }
  if (req.query.contribuinte) { where += ' AND NumContrib LIKE @contribuinte'; params.contribuinte = `%${req.query.contribuinte}%`; }
  if (req.query.localidade) { where += ' AND Fac_Local LIKE @localidade'; params.localidade = `%${req.query.localidade}%`; }
  if (req.query.pais) { where += ' AND Pais = @pais'; params.pais = req.query.pais; }
  if (req.query.situacao) { where += ' AND Situacao = @situacao'; params.situacao = req.query.situacao; }
  if (req.query.condpag) { where += ' AND CondPag = @condpag'; params.condpag = req.query.condpag; }
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

// GET /clientes/analytics/top-devedores - Top clientes por divida pendente
router.get('/analytics/top-devedores', asyncHandler(async (req, res) => {
  const top = parseInt(req.query.top) || 10;
  const result = await query(`
    SELECT TOP(@top) p.Entidade as cliente, c.Nome,
      SUM(p.ValorPendente) as totalPendente,
      COUNT(*) as numDocumentos,
      MIN(p.DataVenc) as vencimentoMaisAntigo,
      SUM(CASE WHEN p.DataVenc < GETDATE() THEN p.ValorPendente ELSE 0 END) as totalVencido
    FROM Pendentes p
    JOIN Clientes c ON c.Cliente = p.Entidade
    WHERE p.TipoEntidade = 'C' AND p.ValorPendente > 0
    GROUP BY p.Entidade, c.Nome
    ORDER BY totalPendente DESC
  `, { top });
  res.json({ total: result.recordset.length, data: result.recordset });
}));

// GET /clientes/:id/pendentes - Documentos pendentes detalhados do cliente
router.get('/:id/pendentes', asyncHandler(async (req, res) => {
  const result = await query(`
    SELECT TipoDoc, Serie, NumDocInt, DataDoc, DataVenc, Moeda,
      ValorTotal, ValorPendente,
      DATEDIFF(DAY, DataVenc, GETDATE()) as diasAtraso
    FROM Pendentes
    WHERE TipoEntidade = 'C' AND Entidade = @id AND ValorPendente > 0
    ORDER BY DataVenc
  `, { id: req.params.id });
  res.json({ total: result.recordset.length, data: result.recordset });
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
  const { dataInicio, dataFim } = parseDateRange(req);
  let where = 'Entidade = @id';
  const params = { id: req.params.id };
  if (req.query.tipoDoc) { where += ' AND TipoDoc = @tipoDoc'; params.tipoDoc = req.query.tipoDoc; }
  if (req.query.serie) { where += ' AND Serie = @serie'; params.serie = req.query.serie; }
  if (req.query.totalMin) { where += ' AND TotalDocumento >= @totalMin'; params.totalMin = parseFloat(req.query.totalMin); }
  if (req.query.totalMax) { where += ' AND TotalDocumento <= @totalMax'; params.totalMax = parseFloat(req.query.totalMax); }
  if (dataInicio) { where += ' AND Data >= @dataInicio'; params.dataInicio = dataInicio; }
  if (dataFim) { where += ' AND Data <= @dataFim'; params.dataFim = dataFim; }

  const countResult = await query(`SELECT COUNT(*) as total FROM CabecDoc WHERE ${where}`, params);
  const result = await query(`
    SELECT Id, TipoDoc, Serie, NumDoc, Data, Nome, TotalMerc, TotalDesc, TotalIva,
           TotalDocumento, Moeda, Vendedor, Zona
    FROM CabecDoc
    WHERE ${where}
    ORDER BY Data DESC
    OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY
  `, { ...params, offset, limit });
  res.json({ page, limit, total: countResult.recordset[0].total, data: result.recordset });
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
