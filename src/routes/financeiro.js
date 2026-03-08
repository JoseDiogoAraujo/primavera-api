const { Router } = require('express');
const { query } = require('../db');
const { asyncHandler } = require('../middleware/errorHandler');
const { parsePagination, parseDateRange } = require('../middleware/pagination');

const router = Router();

// GET /financeiro/contas - Plano de contas
router.get('/contas', asyncHandler(async (req, res) => {
  const { limit, offset, page } = parsePagination(req);
  const search = req.query.search || '';
  let where = '1=1';
  const params = {};
  if (search) {
    where += ' AND (Conta LIKE @search OR Descricao LIKE @search)';
    params.search = `%${search}%`;
  }

  const countResult = await query(`SELECT COUNT(*) as total FROM PlanoContas WHERE ${where}`, params);
  const result = await query(`
    SELECT Conta, Descricao, TipoConta
    FROM PlanoContas
    WHERE ${where}
    ORDER BY Conta
    OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY
  `, { ...params, offset, limit });
  res.json({ page, limit, total: countResult.recordset[0].total, data: result.recordset });
}));

// GET /financeiro/movimentos - Movimentos contabilisticos
router.get('/movimentos', asyncHandler(async (req, res) => {
  const { limit, offset, page } = parsePagination(req);
  const { dataInicio, dataFim } = parseDateRange(req);

  let where = '1=1';
  const params = {};
  if (dataInicio) { where += ' AND m.Data >= @dataInicio'; params.dataInicio = dataInicio; }
  if (dataFim) { where += ' AND m.Data <= @dataFim'; params.dataFim = dataFim; }

  const countResult = await query(`SELECT COUNT(*) as total FROM MovCBL m WHERE ${where}`, params);
  const result = await query(`
    SELECT m.Id, m.Exercicio, m.Diario, m.NumDiario, m.Data, m.Descricao, m.TipoDocumento, m.Modulo
    FROM MovCBL m
    WHERE ${where}
    ORDER BY m.Data DESC, m.Id DESC
    OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY
  `, { ...params, offset, limit });
  res.json({ page, limit, total: countResult.recordset[0].total, data: result.recordset });
}));

// GET /financeiro/movimentos/:id - Detalhe de movimento contabilistico com linhas
router.get('/movimentos/:id', asyncHandler(async (req, res) => {
  const header = await query('SELECT * FROM MovCBL WHERE Id = @id', { id: req.params.id });
  if (!header.recordset.length) return res.status(404).json({ error: 'Movimento nao encontrado' });

  const lines = await query(`
    SELECT l.*, p.Descricao as ContaDescricao
    FROM LinMovCBL l
    LEFT JOIN PlanoContas p ON p.Conta = l.Conta
    WHERE l.IdMovCBL = @id
    ORDER BY l.Id
  `, { id: req.params.id });

  res.json({ ...header.recordset[0], linhas: lines.recordset });
}));

// GET /financeiro/centros-custo - Centros de custo
router.get('/centros-custo', asyncHandler(async (req, res) => {
  const result = await query('SELECT CCusto, Descricao FROM CentrosCusto ORDER BY CCusto');
  res.json({ data: result.recordset });
}));

// GET /financeiro/diarios - Diarios contabilisticos
router.get('/diarios', asyncHandler(async (req, res) => {
  const result = await query('SELECT Diario, Descricao FROM Diarios ORDER BY Diario');
  res.json({ data: result.recordset });
}));

// GET /financeiro/pendentes/clientes - Dividas de clientes
router.get('/pendentes/clientes', asyncHandler(async (req, res) => {
  const { limit, offset, page } = parsePagination(req);
  const result = await query(`
    SELECT p.Entidade, c.Nome, c.Fac_Tel as Telefone, c.Email,
           SUM(p.ValorPendente) as totalPendente,
           COUNT(*) as numDocumentos,
           MIN(p.DataVenc) as vencimentoMaisAntigo,
           SUM(CASE WHEN p.DataVenc < GETDATE() THEN p.ValorPendente ELSE 0 END) as totalVencido,
           MAX(DATEDIFF(DAY, p.DataVenc, GETDATE())) as maxDiasAtraso
    FROM Pendentes p
    LEFT JOIN Clientes c ON p.Entidade = c.Cliente
    WHERE p.TipoEntidade = 'C' AND p.ValorPendente > 0
    GROUP BY p.Entidade, c.Nome, c.Fac_Tel, c.Email
    ORDER BY totalPendente DESC
    OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY
  `, { offset, limit });
  res.json({ page, limit, data: result.recordset });
}));

// GET /financeiro/pendentes/fornecedores - Dividas a fornecedores
router.get('/pendentes/fornecedores', asyncHandler(async (req, res) => {
  const { limit, offset, page } = parsePagination(req);
  const result = await query(`
    SELECT p.Entidade, f.Nome,
           SUM(p.ValorPendente) as totalPendente,
           COUNT(*) as numDocumentos,
           MIN(p.DataVenc) as vencimentoMaisAntigo,
           SUM(CASE WHEN p.DataVenc < GETDATE() THEN p.ValorPendente ELSE 0 END) as totalVencido
    FROM Pendentes p
    LEFT JOIN Fornecedores f ON p.Entidade = f.Fornecedor
    WHERE p.TipoEntidade = 'F' AND p.ValorPendente > 0
    GROUP BY p.Entidade, f.Nome
    ORDER BY totalPendente DESC
    OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY
  `, { offset, limit });
  res.json({ page, limit, data: result.recordset });
}));

// GET /financeiro/pendentes/por-documento - Pendentes agrupados por tipo de documento
router.get('/pendentes/por-documento', asyncHandler(async (req, res) => {
  const result = await query(`
    SELECT TipoEntidade, TipoDoc, COUNT(*) as numDocumentos,
      SUM(ValorPendente) as totalPendente,
      SUM(CASE WHEN DataVenc < GETDATE() THEN ValorPendente ELSE 0 END) as totalVencido,
      MIN(DataVenc) as vencimentoMaisAntigo
    FROM Pendentes
    WHERE ValorPendente > 0
    GROUP BY TipoEntidade, TipoDoc
    ORDER BY TipoEntidade, totalPendente DESC
  `);
  res.json({ data: result.recordset });
}));

// GET /financeiro/pendentes/aging - Analise de antiguidade de divida
router.get('/pendentes/aging', asyncHandler(async (req, res) => {
  const tipo = req.query.tipo || 'C';
  const result = await query(`
    SELECT
      SUM(CASE WHEN DataVenc >= GETDATE() THEN ValorPendente ELSE 0 END) as naoVencido,
      SUM(CASE WHEN DATEDIFF(DAY, DataVenc, GETDATE()) BETWEEN 1 AND 30 THEN ValorPendente ELSE 0 END) as ate30dias,
      SUM(CASE WHEN DATEDIFF(DAY, DataVenc, GETDATE()) BETWEEN 31 AND 60 THEN ValorPendente ELSE 0 END) as de31a60dias,
      SUM(CASE WHEN DATEDIFF(DAY, DataVenc, GETDATE()) BETWEEN 61 AND 90 THEN ValorPendente ELSE 0 END) as de61a90dias,
      SUM(CASE WHEN DATEDIFF(DAY, DataVenc, GETDATE()) BETWEEN 91 AND 180 THEN ValorPendente ELSE 0 END) as de91a180dias,
      SUM(CASE WHEN DATEDIFF(DAY, DataVenc, GETDATE()) > 180 THEN ValorPendente ELSE 0 END) as mais180dias,
      SUM(ValorPendente) as totalPendente,
      COUNT(DISTINCT Entidade) as numEntidades
    FROM Pendentes
    WHERE TipoEntidade = @tipo AND ValorPendente > 0
  `, { tipo });
  res.json({ tipo: tipo === 'C' ? 'Clientes' : 'Fornecedores', ...result.recordset[0] });
}));

// GET /financeiro/pendentes/resumo
router.get('/pendentes/resumo', asyncHandler(async (req, res) => {
  const result = await query(`
    SELECT
      SUM(CASE WHEN TipoEntidade = 'C' THEN ValorPendente ELSE 0 END) as totalReceber,
      SUM(CASE WHEN TipoEntidade = 'F' THEN ValorPendente ELSE 0 END) as totalPagar,
      SUM(CASE WHEN TipoEntidade = 'C' AND DataVenc < GETDATE() THEN ValorPendente ELSE 0 END) as totalReceberVencido,
      SUM(CASE WHEN TipoEntidade = 'F' AND DataVenc < GETDATE() THEN ValorPendente ELSE 0 END) as totalPagarVencido,
      COUNT(DISTINCT CASE WHEN TipoEntidade = 'C' THEN Entidade END) as numClientesDevedores,
      COUNT(DISTINCT CASE WHEN TipoEntidade = 'F' THEN Entidade END) as numFornecedoresCredores
    FROM Pendentes
    WHERE ValorPendente > 0
  `);
  const r = result.recordset[0];
  r.saldoLiquido = (r.totalReceber || 0) - (r.totalPagar || 0);
  res.json(r);
}));

// GET /financeiro/tesouraria/movimentos - Movimentos de tesouraria
router.get('/tesouraria/movimentos', asyncHandler(async (req, res) => {
  const { dataInicio, dataFim } = parseDateRange(req);

  let where = '1=1';
  const params = {};
  if (dataInicio) { where += ' AND c.Data >= @dataInicio'; params.dataInicio = dataInicio; }
  if (dataFim) { where += ' AND c.Data <= @dataFim'; params.dataFim = dataFim; }

  const result = await query(`
    SELECT c.Id, c.TipoDoc, c.Serie, c.NumDoc, c.Entidade, c.TipoEntidade, c.Data, c.Moeda, c.TotalDocumento
    FROM CabecMovCCT c
    WHERE ${where}
    ORDER BY c.Data DESC
  `, params);
  res.json({ data: result.recordset });
}));

module.exports = router;
