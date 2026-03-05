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
    where += ' AND (Funcionario LIKE @search OR Nome LIKE @search OR NumContribuinte LIKE @search)';
    params.search = `%${search}%`;
  }
  if (departamento) { where += ' AND Departamento = @departamento'; params.departamento = departamento; }
  if (situacao) { where += ' AND Situacao = @situacao'; params.situacao = situacao; }

  // Tentar tabela Funcionarios (pode nao existir em todas as instalacoes)
  try {
    const countResult = await query(`SELECT COUNT(*) as total FROM Funcionarios WHERE ${where}`, params);
    const result = await query(`
      SELECT Funcionario, Nome, NumContribuinte, Departamento, Funcao, Categoria,
             DataAdmissao, DataNascimento, Situacao, VencimentoBase, Email, Telefone
      FROM Funcionarios
      WHERE ${where}
      ORDER BY Nome
      OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY
    `, { ...params, offset, limit });
    res.json({ page, limit, total: countResult.recordset[0].total, data: result.recordset });
  } catch (e) {
    // Tabela pode ter nome diferente dependendo da versao/modulo RH instalado
    res.status(404).json({
      error: 'Modulo RH nao disponivel ou tabela nao encontrada',
      message: e.message,
      hint: 'Verificar se o modulo de RH esta instalado. Tabelas possiveis: Funcionarios, RHU_Funcionarios, Empregados',
    });
  }
}));

// GET /rh/departamentos
router.get('/departamentos', asyncHandler(async (req, res) => {
  try {
    const result = await query(`
      SELECT Departamento, Descricao, COUNT(f.Funcionario) as numFuncionarios
      FROM Departamentos d
      LEFT JOIN Funcionarios f ON d.Departamento = f.Departamento
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
  try {
    const result = await query(`
      SELECT
        COUNT(*) as totalFuncionarios,
        COUNT(CASE WHEN Situacao = 'Activo' OR Situacao IS NULL THEN 1 END) as activos,
        COUNT(CASE WHEN Situacao = 'Inactivo' OR Situacao = 'Saida' THEN 1 END) as inactivos,
        AVG(VencimentoBase) as vencimentoMedio,
        SUM(VencimentoBase) as massaSalarial,
        COUNT(DISTINCT Departamento) as numDepartamentos,
        MIN(DataAdmissao) as admissaoMaisAntiga,
        MAX(DataAdmissao) as admissaoMaisRecente
      FROM Funcionarios
    `);
    res.json(result.recordset[0]);
  } catch (e) {
    res.status(404).json({ error: 'Modulo RH nao disponivel', message: e.message });
  }
}));

// GET /rh/analytics/por-departamento
router.get('/analytics/por-departamento', asyncHandler(async (req, res) => {
  try {
    const result = await query(`
      SELECT f.Departamento, d.Descricao,
             COUNT(*) as numFuncionarios,
             AVG(f.VencimentoBase) as vencimentoMedio,
             SUM(f.VencimentoBase) as massaSalarial,
             MIN(f.DataAdmissao) as admissaoMaisAntiga
      FROM Funcionarios f
      LEFT JOIN Departamentos d ON f.Departamento = d.Departamento
      GROUP BY f.Departamento, d.Descricao
      ORDER BY numFuncionarios DESC
    `);
    res.json({ data: result.recordset });
  } catch (e) {
    res.status(404).json({ error: 'Modulo RH nao disponivel', message: e.message });
  }
}));

// GET /rh/analytics/antiguidade
router.get('/analytics/antiguidade', asyncHandler(async (req, res) => {
  try {
    const result = await query(`
      SELECT
        COUNT(CASE WHEN DATEDIFF(YEAR, DataAdmissao, GETDATE()) < 1 THEN 1 END) as menosDeUmAno,
        COUNT(CASE WHEN DATEDIFF(YEAR, DataAdmissao, GETDATE()) BETWEEN 1 AND 3 THEN 1 END) as de1a3anos,
        COUNT(CASE WHEN DATEDIFF(YEAR, DataAdmissao, GETDATE()) BETWEEN 4 AND 5 THEN 1 END) as de4a5anos,
        COUNT(CASE WHEN DATEDIFF(YEAR, DataAdmissao, GETDATE()) BETWEEN 6 AND 10 THEN 1 END) as de6a10anos,
        COUNT(CASE WHEN DATEDIFF(YEAR, DataAdmissao, GETDATE()) > 10 THEN 1 END) as maisde10anos,
        AVG(DATEDIFF(YEAR, DataAdmissao, GETDATE())) as antiguidadeMedia
      FROM Funcionarios
      WHERE Situacao = 'Activo' OR Situacao IS NULL
    `);
    res.json(result.recordset[0]);
  } catch (e) {
    res.status(404).json({ error: 'Modulo RH nao disponivel', message: e.message });
  }
}));

module.exports = router;
