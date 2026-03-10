function parsePagination(req) {
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.min(500, Math.max(1, parseInt(req.query.limit) || 50));
  const offset = (page - 1) * limit;
  return { page, limit, offset };
}

function parseDateRange(req) {
  const dataInicio = req.query.dataInicio || req.query.from || null;
  const dataFim = req.query.dataFim || req.query.to || null;
  return { dataInicio, dataFim };
}

/**
 * Universal date filter for LLM-friendly querying.
 * Accepts: ?ano=2025  or  ?mes=2025-03  or  ?periodo=mes|trimestre|semestre|ano
 * Returns { whereClause, label } for a given date column.
 *
 * Priority: mes > ano > periodo
 */
function parseDateFilter(req, dateCol) {
  const mesParam = req.query.mes;    // e.g. "2025-03"
  const anoParam = req.query.ano;    // e.g. "2025"
  const periodo = req.query.periodo || 'ano';

  if (mesParam && /^\d{4}-\d{2}$/.test(mesParam)) {
    const [y, m] = mesParam.split('-').map(Number);
    return {
      whereClause: `${dateCol} >= DATEFROMPARTS(${y}, ${m}, 1) AND ${dateCol} < DATEADD(MONTH, 1, DATEFROMPARTS(${y}, ${m}, 1))`,
      label: mesParam,
    };
  }

  if (anoParam) {
    const y = parseInt(anoParam);
    if (y >= 2000 && y <= 2100) {
      return {
        whereClause: `${dateCol} >= DATEFROMPARTS(${y}, 1, 1) AND ${dateCol} < DATEFROMPARTS(${y + 1}, 1, 1)`,
        label: String(y),
      };
    }
  }

  // Fallback: periodo relativo ao ano/mes/trimestre corrente
  switch (periodo) {
    case 'mes':
      return {
        whereClause: `YEAR(${dateCol}) = YEAR(GETDATE()) AND MONTH(${dateCol}) = MONTH(GETDATE())`,
        label: 'mes-atual',
      };
    case 'trimestre':
      return {
        whereClause: `YEAR(${dateCol}) = YEAR(GETDATE()) AND DATEPART(QUARTER, ${dateCol}) = DATEPART(QUARTER, GETDATE())`,
        label: 'trimestre-atual',
      };
    case 'semestre':
      return {
        whereClause: `YEAR(${dateCol}) = YEAR(GETDATE()) AND CASE WHEN MONTH(GETDATE()) <= 6 THEN 1 ELSE 2 END = CASE WHEN MONTH(${dateCol}) <= 6 THEN 1 ELSE 2 END`,
        label: 'semestre-atual',
      };
    case 'ano':
    default:
      return {
        whereClause: `YEAR(${dateCol}) = YEAR(GETDATE())`,
        label: 'ano-atual',
      };
  }
}

module.exports = { parsePagination, parseDateRange, parseDateFilter };
