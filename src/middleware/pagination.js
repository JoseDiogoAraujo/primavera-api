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

module.exports = { parsePagination, parseDateRange };
