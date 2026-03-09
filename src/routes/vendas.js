const { Router } = require('express');
const { query } = require('../db');
const { asyncHandler } = require('../middleware/errorHandler');
const { parsePagination, parseDateRange } = require('../middleware/pagination');

const router = Router();

// GET /vendas/documentos - Listar documentos de venda (filtros genericos)
router.get('/documentos', asyncHandler(async (req, res) => {
  const { limit, offset, page } = parsePagination(req);
  const { dataInicio, dataFim } = parseDateRange(req);

  let where = '1=1';
  const params = {};

  if (req.query.search) { where += ' AND (cd.Nome LIKE @search OR cd.Entidade LIKE @search OR CAST(cd.NumDoc AS NVARCHAR) LIKE @search)'; params.search = `%${req.query.search}%`; }
  if (req.query.tipoDoc) { where += ' AND cd.TipoDoc = @tipoDoc'; params.tipoDoc = req.query.tipoDoc; }
  if (req.query.cliente) { where += ' AND cd.Entidade = @cliente'; params.cliente = req.query.cliente; }
  if (req.query.zona) { where += ' AND cd.Zona = @zona'; params.zona = req.query.zona; }
  if (req.query.serie) { where += ' AND cd.Serie = @serie'; params.serie = req.query.serie; }
  if (dataInicio) { where += ' AND cd.Data >= @dataInicio'; params.dataInicio = dataInicio; }
  if (dataFim) { where += ' AND cd.Data <= @dataFim'; params.dataFim = dataFim; }

  // Filtros por artigo/vendedor (via linhas)
  let joinLinhas = '';
  if (req.query.artigo || req.query.vendedor) {
    joinLinhas = ' INNER JOIN LinhasDoc ld ON ld.IdCabecDoc = cd.Id';
    if (req.query.artigo) { where += ' AND ld.Artigo = @artigo'; params.artigo = req.query.artigo; }
    if (req.query.vendedor) { where += ' AND ld.Vendedor = @vendedor'; params.vendedor = req.query.vendedor; }
  }

  const countResult = await query(`SELECT COUNT(DISTINCT cd.Id) as total FROM CabecDoc cd${joinLinhas} WHERE ${where}`, params);
  const result = await query(`
    SELECT DISTINCT cd.Id, cd.TipoDoc, cd.Serie, cd.NumDoc, cd.Entidade, cd.Nome, cd.Data, cd.DataVencimento,
           cd.Moeda, cd.TotalMerc, cd.TotalDesc, cd.TotalIva, cd.TotalDocumento, cd.Zona, cd.CondPag
    FROM CabecDoc cd${joinLinhas}
    WHERE ${where}
    ORDER BY cd.Data DESC
    OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY
  `, { ...params, offset, limit });

  res.json({ page, limit, total: countResult.recordset[0].total, data: result.recordset });
}));

// GET /vendas/documentos/:id - Detalhes de um documento com linhas
router.get('/documentos/:id', asyncHandler(async (req, res) => {
  const cabec = await query('SELECT * FROM CabecDoc WHERE Id = @id', { id: req.params.id });
  if (!cabec.recordset.length) return res.status(404).json({ error: 'Documento nao encontrado' });

  const linhas = await query(`
    SELECT Id, NumLinha, Artigo, Descricao, Quantidade, Unidade, PrecUnit,
           Desconto1, Desconto2, Desconto3, PrecoLiquido, TotalIliquido,
           CodIva, TaxaIva, TotalIva, Armazem, Lote, Vendedor
    FROM LinhasDoc
    WHERE IdCabecDoc = @id
    ORDER BY NumLinha
  `, { id: req.params.id });

  res.json({ cabecalho: cabec.recordset[0], linhas: linhas.recordset });
}));

// GET /vendas/resumo - Totais de vendas
router.get('/resumo', asyncHandler(async (req, res) => {
  const { dataInicio, dataFim } = parseDateRange(req);
  let where = '1=1';
  const params = {};
  if (dataInicio) { where += ' AND cd.Data >= @dataInicio'; params.dataInicio = dataInicio; }
  if (dataFim) { where += ' AND cd.Data <= @dataFim'; params.dataFim = dataFim; }

  const result = await query(`
    SELECT
      SUM(CASE WHEN cd.TipoDoc IN ('FA','FAC','FE2','FI2','FNT','FR') THEN cd.TotalDocumento ELSE 0 END) as totalFacturado,
      SUM(CASE WHEN cd.TipoDoc IN ('ALC','DV','NC','NCT') THEN cd.TotalDocumento ELSE 0 END) as totalAbatimentos,
      COUNT(CASE WHEN cd.TipoDoc IN ('FA','FAC','FE2','FI2','FNT','FR') THEN 1 END) as numFacturas,
      COUNT(CASE WHEN cd.TipoDoc IN ('ALC','DV','NC','NCT') THEN 1 END) as numAbatimentos,
      COUNT(DISTINCT cd.Entidade) as numClientes,
      AVG(CASE WHEN cd.TipoDoc IN ('FA','FAC','FE2','FI2','FNT','FR') THEN cd.TotalDocumento END) as ticketMedio
    FROM CabecDoc cd
    LEFT JOIN CabecDocStatus cds ON cd.Id = cds.IdCabecDoc
    WHERE (cds.Anulado IS NULL OR cds.Anulado = 0) AND ${where}
  `, params);
  res.json(result.recordset[0]);
}));

// GET /vendas/top - Rankings genericos (?por=cliente|artigo|vendedor, ?top=10, ?from=, ?to=)
router.get('/top', asyncHandler(async (req, res) => {
  const por = req.query.por || 'cliente';
  const topN = Math.min(100, parseInt(req.query.top) || 10);
  const { dataInicio, dataFim } = parseDateRange(req);
  let where = "cd.TipoDoc IN ('FA','FAC','FI','FE2','FIT','FNT','FR','FR1','FRI','NC','NCE','NCI','NCT','ND','CIE') AND cds.Anulado = 0";
  const params = {};
  if (dataInicio) { where += ' AND cd.Data >= @dataInicio'; params.dataInicio = dataInicio; }
  if (dataFim) { where += ' AND cd.Data <= @dataFim'; params.dataFim = dataFim; }

  let sql;
  if (por === 'artigo') {
    sql = `
      SELECT TOP (@topN) ld.Artigo as codigo, a.Descricao as nome,
             SUM(ld.TotalIliquido) as total, SUM(ld.Quantidade) as quantidade, COUNT(DISTINCT cd.Entidade) as numClientes
      FROM LinhasDoc ld
      INNER JOIN CabecDoc cd ON ld.IdCabecDoc = cd.Id
      INNER JOIN CabecDocStatus cds ON cd.Id = cds.IdCabecDoc
      LEFT JOIN Artigo a ON ld.Artigo = a.Artigo
      WHERE ${where}
      GROUP BY ld.Artigo, a.Descricao
      ORDER BY total DESC`;
  } else if (por === 'vendedor') {
    sql = `
      SELECT TOP (@topN) ld.Vendedor as codigo, v.Nome as nome,
             SUM(ld.TotalIliquido) as total, COUNT(DISTINCT cd.Id) as numDocumentos, COUNT(DISTINCT cd.Entidade) as numClientes
      FROM LinhasDoc ld
      INNER JOIN CabecDoc cd ON ld.IdCabecDoc = cd.Id
      INNER JOIN CabecDocStatus cds ON cd.Id = cds.IdCabecDoc
      LEFT JOIN Vendedores v ON ld.Vendedor = v.Vendedor
      WHERE ${where}
      GROUP BY ld.Vendedor, v.Nome
      ORDER BY total DESC`;
  } else {
    sql = `
      SELECT TOP (@topN) cd.Entidade as codigo, c.Nome as nome,
             SUM(cd.TotalDocumento - cd.TotalIva) as total, COUNT(*) as numDocumentos
      FROM CabecDoc cd
      INNER JOIN CabecDocStatus cds ON cd.Id = cds.IdCabecDoc
      LEFT JOIN Clientes c ON cd.Entidade = c.Cliente
      WHERE ${where}
      GROUP BY cd.Entidade, c.Nome
      ORDER BY total DESC`;
  }

  const result = await query(sql, { ...params, topN });
  res.json({ por, top: topN, data: result.recordset });
}));

// GET /vendas/recentes/:cliente - Faturas (FA) do ano passado de um cliente
router.get('/recentes/:cliente', asyncHandler(async (req, res) => {
  const cliente = req.params.cliente;
  const anoPassado = new Date().getFullYear() - 1;
  const dataInicio = `${anoPassado}-01-01`;
  const dataFim = `${anoPassado}-12-31`;

  const result = await query(`
    SELECT cd.Id, cd.TipoDoc, cd.Serie, cd.NumDoc, cd.Entidade, cd.Nome, cd.Data,
           cd.TotalMerc, cd.TotalDesc, cd.TotalIva, cd.TotalDocumento, cd.Moeda, cd.CondPag,
           ld.Artigo, ld.Descricao as ArtigoDescricao, ld.Quantidade, ld.Unidade,
           ld.PrecUnit, ld.PrecoLiquido, ld.TotalIliquido as TotalLinha, ld.Armazem
    FROM CabecDoc cd
    INNER JOIN CabecDocStatus cds ON cd.Id = cds.IdCabecDoc
    INNER JOIN LinhasDoc ld ON ld.IdCabecDoc = cd.Id
    WHERE cd.TipoDoc = 'FA'
      AND cd.Entidade = @cliente
      AND cds.Anulado = 0
      AND cd.Data >= @dataInicio
      AND cd.Data <= @dataFim
    ORDER BY cd.Data DESC, ld.NumLinha
  `, { cliente, dataInicio, dataFim });

  // Agrupar linhas por documento
  const docs = {};
  for (const row of result.recordset) {
    if (!docs[row.Id]) {
      docs[row.Id] = {
        Id: row.Id, TipoDoc: row.TipoDoc, Serie: row.Serie, NumDoc: row.NumDoc,
        Entidade: row.Entidade, Nome: row.Nome, Data: row.Data,
        TotalMerc: row.TotalMerc, TotalDesc: row.TotalDesc, TotalIva: row.TotalIva,
        TotalDocumento: row.TotalDocumento, Moeda: row.Moeda, CondPag: row.CondPag,
        linhas: []
      };
    }
    docs[row.Id].linhas.push({
      Artigo: row.Artigo, Descricao: row.ArtigoDescricao, Quantidade: row.Quantidade,
      Unidade: row.Unidade, PrecUnit: row.PrecUnit, PrecoLiquido: row.PrecoLiquido,
      TotalLinha: row.TotalLinha, Armazem: row.Armazem
    });
  }

  const data = Object.values(docs);
  res.json({
    cliente,
    ano: anoPassado,
    totalDocumentos: data.length,
    data
  });
}));

module.exports = router;
