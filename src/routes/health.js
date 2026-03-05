const { Router } = require('express');
const { query } = require('../db');
const { asyncHandler } = require('../middleware/errorHandler');

const router = Router();

router.get('/', asyncHandler(async (req, res) => {
  const result = await query('SELECT 1 as ok, GETDATE() as serverTime, DB_NAME() as [database]');
  res.json({
    status: 'ok',
    api: 'Primavera V10 API',
    version: '1.0.0',
    database: result.recordset[0].database,
    serverTime: result.recordset[0].serverTime,
  });
}));

router.get('/tables', asyncHandler(async (req, res) => {
  const result = await query(`
    SELECT t.name AS tabela, p.rows AS registos
    FROM sys.tables t
    INNER JOIN sys.partitions p ON t.object_id = p.object_id AND p.index_id IN (0,1)
    ORDER BY t.name
  `);
  res.json({ total: result.recordset.length, tabelas: result.recordset });
}));

router.get('/tables/:nome/columns', asyncHandler(async (req, res) => {
  const result = await query(`
    SELECT COLUMN_NAME as coluna, DATA_TYPE as tipo,
           CHARACTER_MAXIMUM_LENGTH as tamanho, IS_NULLABLE as nulo
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_NAME = @nome
    ORDER BY ORDINAL_POSITION
  `, { nome: req.params.nome });
  res.json({ tabela: req.params.nome, colunas: result.recordset });
}));

module.exports = router;
