const { Router } = require('express');
const { query } = require('../db');
const { asyncHandler } = require('../middleware/errorHandler');
const { parsePagination } = require('../middleware/pagination');

const router = Router();

// GET /financeiro/contas - Plano de contas
router.get('/contas', asyncHandler(async (req, res) => {
  const { limit, offset, page } = parsePagination(req);
  let where = '1=1';
  const params = {};
  if (req.query.search) {
    where += ' AND (Conta LIKE @search OR Descricao LIKE @search)';
    params.search = `%${req.query.search}%`;
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

// GET /financeiro/pendentes/resumo - A receber vs a pagar
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

// GET /financeiro/tesouraria/mensal - Recebimentos vs pagamentos mensal
router.get('/tesouraria/mensal', asyncHandler(async (req, res) => {
  const result = await query(`
    SELECT FORMAT(c.Data, 'yyyy-MM') as mes,
      SUM(CASE WHEN c.TipoEntidade = 'C' THEN c.TotalDocumento ELSE 0 END) as recebimentos,
      SUM(CASE WHEN c.TipoEntidade = 'F' THEN c.TotalDocumento ELSE 0 END) as pagamentos
    FROM CabecMovCCT c
    GROUP BY FORMAT(c.Data, 'yyyy-MM')
    ORDER BY mes
  `);
  res.json({ data: result.recordset });
}));

module.exports = router;
