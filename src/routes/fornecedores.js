const { Router } = require('express');
const { query } = require('../db');
const { asyncHandler } = require('../middleware/errorHandler');
const { parsePagination } = require('../middleware/pagination');

const router = Router();

router.get('/', asyncHandler(async (req, res) => {
  const { limit, offset, page } = parsePagination(req);
  const search = req.query.search || '';
  let where = '1=1';
  const params = {};
  if (search) {
    where += ' AND (Fornecedor LIKE @search OR Nome LIKE @search OR NumContrib LIKE @search)';
    params.search = `%${search}%`;
  }

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

router.get('/:id', asyncHandler(async (req, res) => {
  const result = await query('SELECT * FROM Fornecedores WHERE Fornecedor = @id', { id: req.params.id });
  if (!result.recordset.length) return res.status(404).json({ error: 'Fornecedor nao encontrado' });
  res.json(result.recordset[0]);
}));

router.get('/:id/documentos', asyncHandler(async (req, res) => {
  const { limit, offset, page } = parsePagination(req);
  const result = await query(`
    SELECT Id, TipoDoc, Serie, NumDoc, DataDoc, NumDocExterno, TotalDocumento
    FROM CabecCompras
    WHERE Entidade = @id
    ORDER BY DataDoc DESC
    OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY
  `, { id: req.params.id, offset, limit });
  res.json({ page, limit, data: result.recordset });
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

module.exports = router;
