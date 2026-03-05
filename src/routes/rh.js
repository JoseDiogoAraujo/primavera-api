const { Router } = require('express');
const { query } = require('../db');
const { asyncHandler } = require('../middleware/errorHandler');
const { parsePagination } = require('../middleware/pagination');

const router = Router();

// GET /rh/funcionarios - Listar funcionarios
router.get('/funcionarios', asyncHandler(async (req, res) => {
  const { limit, offset, page } = parsePagination(req);
  const search = req.query.search || '';
  const departamento = req.query.departamento || '';
  const situacao = req.query.situacao || '';

  let where = '1=1';
  const params = {};
  if (search) {
    where += ' AND (Codigo LIKE @search OR Nome LIKE @search OR NumContr LIKE @search)';
    params.search = `%${search}%`;
  }
  if (departamento) { where += ' AND CodDepartamento = @departamento'; params.departamento = departamento; }
  if (situacao) { where += ' AND Situacao = @situacao'; params.situacao = situacao; }

  const countResult = await query(`SELECT COUNT(*) as total FROM Funcionarios WHERE ${where}`, params);
  const result = await query(`
    SELECT Codigo, Nome, NumContr, CodDepartamento as Departamento, Profissao, Categoria,
           DataAdmissao, DataNascimento, Situacao, Vencimento, Email, Telefone, Sexo
    FROM Funcionarios
    WHERE ${where}
    ORDER BY Nome
    OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY
  `, { ...params, offset, limit });
  res.json({ page, limit, total: countResult.recordset[0].total, data: result.recordset });
}));

// GET /rh/departamentos
router.get('/departamentos', asyncHandler(async (req, res) => {
  try {
    const result = await query(`
      SELECT d.Departamento, d.Descricao, COUNT(f.Codigo) as numFuncionarios
      FROM Departamentos d
      LEFT JOIN Funcionarios f ON d.Departamento = f.CodDepartamento
      GROUP BY d.Departamento, d.Descricao
      ORDER BY numFuncionarios DESC
    `);
    res.json({ data: result.recordset });
  } catch (e) {
    res.status(404).json({ error: 'Tabela Departamentos nao encontrada', message: e.message });
  }
}));

// GET /rh/analytics/resumo
router.get('/analytics/resumo', asyncHandler(async (req, res) => {
  const result = await query(`
    SELECT
      COUNT(*) as totalFuncionarios,
      COUNT(CASE WHEN Situacao = 'A' OR Situacao IS NULL THEN 1 END) as activos,
      COUNT(CASE WHEN Situacao = 'I' OR Situacao = 'D' THEN 1 END) as inactivos,
      AVG(Vencimento) as vencimentoMedio,
      SUM(Vencimento) as massaSalarial,
      COUNT(DISTINCT CodDepartamento) as numDepartamentos,
      MIN(DataAdmissao) as admissaoMaisAntiga,
      MAX(DataAdmissao) as admissaoMaisRecente
    FROM Funcionarios
  `);
  res.json(result.recordset[0]);
}));

// GET /rh/analytics/por-departamento
router.get('/analytics/por-departamento', asyncHandler(async (req, res) => {
  try {
    const result = await query(`
      SELECT f.CodDepartamento as Departamento, d.Descricao,
             COUNT(*) as numFuncionarios,
             AVG(f.Vencimento) as vencimentoMedio,
             SUM(f.Vencimento) as massaSalarial,
             MIN(f.DataAdmissao) as admissaoMaisAntiga
      FROM Funcionarios f
      LEFT JOIN Departamentos d ON f.CodDepartamento = d.Departamento
      GROUP BY f.CodDepartamento, d.Descricao
      ORDER BY numFuncionarios DESC
    `);
    res.json({ data: result.recordset });
  } catch (e) {
    res.status(404).json({ error: 'Modulo RH nao disponivel', message: e.message });
  }
}));

// GET /rh/analytics/antiguidade
router.get('/analytics/antiguidade', asyncHandler(async (req, res) => {
  const result = await query(`
    SELECT
      COUNT(CASE WHEN DATEDIFF(YEAR, DataAdmissao, GETDATE()) < 1 THEN 1 END) as menosDeUmAno,
      COUNT(CASE WHEN DATEDIFF(YEAR, DataAdmissao, GETDATE()) BETWEEN 1 AND 3 THEN 1 END) as de1a3anos,
      COUNT(CASE WHEN DATEDIFF(YEAR, DataAdmissao, GETDATE()) BETWEEN 4 AND 5 THEN 1 END) as de4a5anos,
      COUNT(CASE WHEN DATEDIFF(YEAR, DataAdmissao, GETDATE()) BETWEEN 6 AND 10 THEN 1 END) as de6a10anos,
      COUNT(CASE WHEN DATEDIFF(YEAR, DataAdmissao, GETDATE()) > 10 THEN 1 END) as maisde10anos,
      AVG(DATEDIFF(YEAR, DataAdmissao, GETDATE())) as antiguidadeMedia
    FROM Funcionarios
  `);
  res.json(result.recordset[0]);
}));

module.exports = router;
