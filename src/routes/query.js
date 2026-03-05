const { Router } = require('express');
const { query } = require('../db');
const { asyncHandler } = require('../middleware/errorHandler');

const router = Router();

// POST /query - Endpoint para LLM executar queries read-only
router.post('/', asyncHandler(async (req, res) => {
  const { sql: sqlText } = req.body;

  if (!sqlText) {
    return res.status(400).json({ error: 'Campo "sql" obrigatorio no body' });
  }

  // Bloquear operacoes de escrita
  const upper = sqlText.toUpperCase().trim();
  const blocked = ['INSERT ', 'UPDATE ', 'DELETE ', 'DROP ', 'ALTER ', 'CREATE ', 'TRUNCATE ',
                    'EXEC ', 'EXECUTE ', 'GRANT ', 'REVOKE ', 'DENY ', 'BACKUP ', 'RESTORE ',
                    'SHUTDOWN', 'DBCC ', 'BULK ', 'MERGE '];
  for (const keyword of blocked) {
    if (upper.includes(keyword)) {
      return res.status(403).json({ error: `Operacao bloqueada: ${keyword.trim()}. Apenas SELECT permitido.` });
    }
  }

  if (!upper.startsWith('SELECT') && !upper.startsWith('WITH')) {
    return res.status(403).json({ error: 'Apenas queries SELECT ou WITH (CTE) sao permitidas.' });
  }

  const result = await query(sqlText);
  res.json({
    rows: result.recordset.length,
    data: result.recordset,
  });
}));

module.exports = router;
