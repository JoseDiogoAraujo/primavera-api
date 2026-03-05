const { Router } = require('express');
const { query } = require('../db');
const { asyncHandler } = require('../middleware/errorHandler');
const { parsePagination } = require('../middleware/pagination');

const router = Router();

// GET /financeiro/pendentes/clientes - Dividas de clientes
router.get('/pendentes/clientes', asyncHandler(async (req, res) => {
  const { limit, offset, page } = parsePagination(req);
  const result = await query(`
    SELECT p.Entidade, c.Nome, c.Telefone, c.Email,
           SUM(p.ValorPendente) as totalPendente,
           COUNT(*) as numDocumentos,
           MIN(p.DataVenc) as vencimentoMaisAntigo,
           SUM(CASE WHEN p.DataVenc < GETDATE() THEN p.ValorPendente ELSE 0 END) as totalVencido,
           MAX(DATEDIFF(DAY, p.DataVenc, GETDATE())) as maxDiasAtraso
    FROM Pendentes p
    LEFT JOIN Clientes c ON p.Entidade = c.Cliente
    WHERE p.TipoEntidade = 'C' AND p.ValorPendente > 0
    GROUP BY p.Entidade, c.Nome, c.Telefone, c.Email
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

// GET /financeiro/pendentes/aging - Analise de antiguidade de divida
router.get('/pendentes/aging', asyncHandler(async (req, res) => {
  const tipo = req.query.tipo || 'C'; // C ou F
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

// GET /financeiro/tesouraria/mensal - Fluxo de tesouraria mensal
router.get('/tesouraria/mensal', asyncHandler(async (req, res) => {
  const result = await query(`
    SELECT FORMAT(Data, 'yyyy-MM') as mes,
           SUM(CASE WHEN TipoEntidade = 'C' THEN TotalDocumento ELSE 0 END) as recebimentos,
           SUM(CASE WHEN TipoEntidade = 'F' THEN TotalDocumento ELSE 0 END) as pagamentos
    FROM CabecMovCCT
    GROUP BY FORMAT(Data, 'yyyy-MM')
    ORDER BY mes
  `);
  res.json({ data: result.recordset });
}));

module.exports = router;
