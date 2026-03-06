const { Router } = require('express');
const { query } = require('../db');
const { asyncHandler } = require('../middleware/errorHandler');
const { parsePagination, parseDateRange } = require('../middleware/pagination');

const router = Router();

const TIPOS_FACTURA = "('FA','FR','FS')";
const TIPOS_NC = "('NC')";

// GET /vendas/documentos - Listar documentos de venda
router.get('/documentos', asyncHandler(async (req, res) => {
  const { limit, offset, page } = parsePagination(req);
  const { dataInicio, dataFim } = parseDateRange(req);
  const tipoDoc = req.query.tipoDoc || '';
  const cliente = req.query.cliente || '';

  let where = '1=1';
  const params = {};

  if (tipoDoc) { where += ' AND TipoDoc = @tipoDoc'; params.tipoDoc = tipoDoc; }
  if (cliente) { where += ' AND Entidade = @cliente'; params.cliente = cliente; }
  if (dataInicio) { where += ' AND Data >= @dataInicio'; params.dataInicio = dataInicio; }
  if (dataFim) { where += ' AND Data <= @dataFim'; params.dataFim = dataFim; }

  const countResult = await query(`SELECT COUNT(*) as total FROM CabecDoc WHERE ${where}`, params);
  const result = await query(`
    SELECT Id, TipoDoc, Serie, NumDoc, Entidade, Nome, Data, DataVencimento,
           Moeda, TotalMerc, TotalDesc, TotalIva, TotalDocumento, Zona
    FROM CabecDoc
    WHERE ${where}
    ORDER BY Data DESC
    OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY
  `, { ...params, offset, limit });

  res.json({ page, limit, total: countResult.recordset[0].total, data: result.recordset });
}));

// GET /vendas/documentos/:id - Detalhes de um documento com linhas
router.get('/documentos/:id', asyncHandler(async (req, res) => {
  const cabec = await query('SELECT * FROM CabecDoc WHERE Id = @id', { id: parseInt(req.params.id) });
  if (!cabec.recordset.length) return res.status(404).json({ error: 'Documento nao encontrado' });

  const linhas = await query(`
    SELECT Id, NumLinha, Artigo, Descricao, Quantidade, Unidade, PrecUnit,
           Desconto1, Desconto2, Desconto3, PrecoLiquido, TotalIliquido,
           CodIva, TaxaIva, TotalIva, Armazem, Lote, Vendedor
    FROM LinhasDoc
    WHERE IdCabecDoc = @id
    ORDER BY NumLinha
  `, { id: parseInt(req.params.id) });

  res.json({ cabecalho: cabec.recordset[0], linhas: linhas.recordset });
}));

// GET /vendas/analytics/mensal - Volume de vendas por mes
router.get('/analytics/mensal', asyncHandler(async (req, res) => {
  const { dataInicio, dataFim } = parseDateRange(req);
  let where = `TipoDoc IN ${TIPOS_FACTURA}`;
  const params = {};
  if (dataInicio) { where += ' AND Data >= @dataInicio'; params.dataInicio = dataInicio; }
  if (dataFim) { where += ' AND Data <= @dataFim'; params.dataFim = dataFim; }

  const result = await query(`
    SELECT FORMAT(Data, 'yyyy-MM') as mes,
           SUM(TotalDocumento) as totalVendas,
           COUNT(*) as numDocumentos,
           COUNT(DISTINCT Entidade) as numClientes
    FROM CabecDoc
    WHERE ${where}
    GROUP BY FORMAT(Data, 'yyyy-MM')
    ORDER BY mes
  `, params);
  res.json({ data: result.recordset });
}));

// GET /vendas/analytics/diario - Vendas por dia
router.get('/analytics/diario', asyncHandler(async (req, res) => {
  const { dataInicio, dataFim } = parseDateRange(req);
  let where = `TipoDoc IN ${TIPOS_FACTURA}`;
  const params = {};
  if (dataInicio) { where += ' AND Data >= @dataInicio'; params.dataInicio = dataInicio; }
  if (dataFim) { where += ' AND Data <= @dataFim'; params.dataFim = dataFim; }

  const result = await query(`
    SELECT CAST(Data as DATE) as dia,
           SUM(TotalDocumento) as totalVendas,
           COUNT(*) as numDocumentos
    FROM CabecDoc
    WHERE ${where}
    GROUP BY CAST(Data as DATE)
    ORDER BY dia
  `, params);
  res.json({ data: result.recordset });
}));

// GET /vendas/analytics/top-clientes
router.get('/analytics/top-clientes', asyncHandler(async (req, res) => {
  const topN = Math.min(100, parseInt(req.query.top) || 10);
  const { dataInicio, dataFim } = parseDateRange(req);
  let where = `cd.TipoDoc IN ${TIPOS_FACTURA}`;
  const params = {};
  if (dataInicio) { where += ' AND cd.Data >= @dataInicio'; params.dataInicio = dataInicio; }
  if (dataFim) { where += ' AND cd.Data <= @dataFim'; params.dataFim = dataFim; }

  const result = await query(`
    SELECT TOP (@topN) cd.Entidade, c.Nome,
           SUM(cd.TotalDocumento) as totalFacturado,
           COUNT(*) as numDocumentos,
           AVG(cd.TotalDocumento) as ticketMedio
    FROM CabecDoc cd
    LEFT JOIN Clientes c ON cd.Entidade = c.Cliente
    WHERE ${where}
    GROUP BY cd.Entidade, c.Nome
    ORDER BY totalFacturado DESC
  `, { ...params, topN });
  res.json({ data: result.recordset });
}));

// GET /vendas/analytics/top-artigos
router.get('/analytics/top-artigos', asyncHandler(async (req, res) => {
  const topN = Math.min(100, parseInt(req.query.top) || 10);
  const por = req.query.por || 'valor';
  const { dataInicio, dataFim } = parseDateRange(req);
  let where = `cd.TipoDoc IN ${TIPOS_FACTURA}`;
  const params = {};
  if (dataInicio) { where += ' AND cd.Data >= @dataInicio'; params.dataInicio = dataInicio; }
  if (dataFim) { where += ' AND cd.Data <= @dataFim'; params.dataFim = dataFim; }

  const orderCol = por === 'quantidade' ? 'totalQtd' : 'totalValor';
  const result = await query(`
    SELECT TOP (@topN) ld.Artigo, a.Descricao, a.Familia,
           SUM(ld.Quantidade) as totalQtd,
           SUM(ld.TotalIliquido) as totalValor,
           COUNT(DISTINCT cd.Entidade) as numClientes
    FROM LinhasDoc ld
    INNER JOIN CabecDoc cd ON ld.IdCabecDoc = cd.Id
    LEFT JOIN Artigo a ON ld.Artigo = a.Artigo
    WHERE ${where}
    GROUP BY ld.Artigo, a.Descricao, a.Familia
    ORDER BY ${orderCol} DESC
  `, { ...params, topN });
  res.json({ data: result.recordset });
}));

// GET /vendas/analytics/por-vendedor
router.get('/analytics/por-vendedor', asyncHandler(async (req, res) => {
  const { dataInicio, dataFim } = parseDateRange(req);
  let where = `cd.TipoDoc IN ${TIPOS_FACTURA}`;
  const params = {};
  if (dataInicio) { where += ' AND cd.Data >= @dataInicio'; params.dataInicio = dataInicio; }
  if (dataFim) { where += ' AND cd.Data <= @dataFim'; params.dataFim = dataFim; }

  const result = await query(`
    SELECT ld.Vendedor, v.Nome,
           SUM(ld.TotalIliquido) as totalVendas,
           COUNT(DISTINCT cd.Id) as numDocumentos,
           COUNT(DISTINCT cd.Entidade) as numClientes
    FROM LinhasDoc ld
    INNER JOIN CabecDoc cd ON ld.IdCabecDoc = cd.Id
    LEFT JOIN Vendedores v ON ld.Vendedor = v.Vendedor
    WHERE ${where}
    GROUP BY ld.Vendedor, v.Nome
    ORDER BY totalVendas DESC
  `, params);
  res.json({ data: result.recordset });
}));

// GET /vendas/analytics/por-familia
router.get('/analytics/por-familia', asyncHandler(async (req, res) => {
  const { dataInicio, dataFim } = parseDateRange(req);
  let where = `cd.TipoDoc IN ${TIPOS_FACTURA}`;
  const params = {};
  if (dataInicio) { where += ' AND cd.Data >= @dataInicio'; params.dataInicio = dataInicio; }
  if (dataFim) { where += ' AND cd.Data <= @dataFim'; params.dataFim = dataFim; }

  const result = await query(`
    SELECT a.Familia, f.Descricao as FamiliaDesc,
           SUM(ld.TotalIliquido) as totalVendas,
           SUM(ld.Quantidade) as totalQtd,
           COUNT(DISTINCT ld.Artigo) as numArtigos
    FROM LinhasDoc ld
    INNER JOIN CabecDoc cd ON ld.IdCabecDoc = cd.Id
    LEFT JOIN Artigo a ON ld.Artigo = a.Artigo
    LEFT JOIN Familias f ON a.Familia = f.Familia
    WHERE ${where}
    GROUP BY a.Familia, f.Descricao
    ORDER BY totalVendas DESC
  `, params);
  res.json({ data: result.recordset });
}));

// GET /vendas/analytics/por-zona
router.get('/analytics/por-zona', asyncHandler(async (req, res) => {
  const { dataInicio, dataFim } = parseDateRange(req);
  let where = `cd.TipoDoc IN ${TIPOS_FACTURA}`;
  const params = {};
  if (dataInicio) { where += ' AND cd.Data >= @dataInicio'; params.dataInicio = dataInicio; }
  if (dataFim) { where += ' AND cd.Data <= @dataFim'; params.dataFim = dataFim; }

  const result = await query(`
    SELECT cd.Zona, z.Descricao as ZonaDesc,
           SUM(cd.TotalDocumento) as totalVendas,
           COUNT(*) as numDocumentos,
           COUNT(DISTINCT cd.Entidade) as numClientes
    FROM CabecDoc cd
    LEFT JOIN Zonas z ON cd.Zona = z.Zona
    WHERE ${where}
    GROUP BY cd.Zona, z.Descricao
    ORDER BY totalVendas DESC
  `, params);
  res.json({ data: result.recordset });
}));

// GET /vendas/analytics/resumo - Resumo geral de vendas
router.get('/analytics/resumo', asyncHandler(async (req, res) => {
  const { dataInicio, dataFim } = parseDateRange(req);
  let where = '1=1';
  const params = {};
  if (dataInicio) { where += ' AND Data >= @dataInicio'; params.dataInicio = dataInicio; }
  if (dataFim) { where += ' AND Data <= @dataFim'; params.dataFim = dataFim; }

  const result = await query(`
    SELECT
      SUM(CASE WHEN TipoDoc IN ${TIPOS_FACTURA} THEN TotalDocumento ELSE 0 END) as totalFacturacao,
      SUM(CASE WHEN TipoDoc IN ${TIPOS_NC} THEN TotalDocumento ELSE 0 END) as totalNotasCredito,
      COUNT(CASE WHEN TipoDoc IN ${TIPOS_FACTURA} THEN 1 END) as numFacturas,
      COUNT(CASE WHEN TipoDoc IN ${TIPOS_NC} THEN 1 END) as numNotasCredito,
      COUNT(DISTINCT Entidade) as numClientes,
      AVG(CASE WHEN TipoDoc IN ${TIPOS_FACTURA} THEN TotalDocumento END) as ticketMedio,
      MIN(CASE WHEN TipoDoc IN ${TIPOS_FACTURA} THEN Data END) as primeiraFactura,
      MAX(CASE WHEN TipoDoc IN ${TIPOS_FACTURA} THEN Data END) as ultimaFactura
    FROM CabecDoc
    WHERE ${where}
  `, params);
  res.json(result.recordset[0]);
}));

// GET /vendas/analytics/yoy - Year over Year comparison
router.get('/analytics/yoy', asyncHandler(async (req, res) => {
  const result = await query(`
    SELECT YEAR(Data) as ano, MONTH(Data) as mes,
           SUM(TotalDocumento) as totalVendas,
           COUNT(*) as numDocumentos
    FROM CabecDoc
    WHERE TipoDoc IN ${TIPOS_FACTURA}
    GROUP BY YEAR(Data), MONTH(Data)
    ORDER BY ano, mes
  `);
  res.json({ data: result.recordset });
}));

// GET /vendas/analytics/por-localidade - Vendas por localidade de descarga (para mapa)
// Normaliza automaticamente variacoes de nomes e usa Fac_Cploc do cliente como fallback
const TIPOS_DESCARGA = "('FA','FAC','FNT','FR')";

// Normalizacao SQL inline: limpa e unifica nomes de localidades
const NORMALIZA_LOCALIDADE = `
  CASE
    -- Fallback: se localidade invalida (., Apartado, Lote, Rua, Av., etc), usar Fac_Cploc do cliente
    WHEN LTRIM(RTRIM(loc_raw)) IN ('.','..','') OR LTRIM(RTRIM(loc_raw)) IS NULL
      OR LTRIM(RTRIM(loc_raw)) LIKE 'Apartado%' OR LTRIM(RTRIM(loc_raw)) LIKE 'Lote%'
      OR LTRIM(RTRIM(loc_raw)) LIKE 'Rua %' OR LTRIM(RTRIM(loc_raw)) LIKE 'RUA %'
      OR LTRIM(RTRIM(loc_raw)) LIKE 'Av.%' OR LTRIM(RTRIM(loc_raw)) LIKE 'AV.%'
      OR LTRIM(RTRIM(loc_raw)) LIKE 'Edificio%' OR LTRIM(RTRIM(loc_raw)) LIKE 'EDIFICIO%'
      OR LTRIM(RTRIM(loc_raw)) LIKE 'Praça%' OR LTRIM(RTRIM(loc_raw)) LIKE 'Polo%'
      OR LTRIM(RTRIM(loc_raw)) LIKE 'Pólo%'
      OR LTRIM(RTRIM(loc_raw)) LIKE 'Aparatado%'
      OR LTRIM(RTRIM(loc_raw)) LIKE 'PAVILHAO%'
      OR LTRIM(RTRIM(loc_raw)) LIKE 'FRENTE %'
      OR LTRIM(RTRIM(loc_raw)) LIKE '%(JUNTO%'
      OR LTRIM(RTRIM(loc_raw)) LIKE 'NO %'
      OR LTRIM(RTRIM(loc_raw)) LIKE 'Alto dos%'
      THEN COALESCE(NULLIF(LTRIM(RTRIM(cli_cploc)),'.'), NULLIF(LTRIM(RTRIM(cli_local)),'.'))

    -- Vila Nova de Famalicao (todas as variacoes)
    WHEN UPPER(LTRIM(RTRIM(loc_raw))) LIKE '%V.N.%FAMALICA%'
      OR UPPER(LTRIM(RTRIM(loc_raw))) LIKE '%V. N.%FAMALICA%'
      OR UPPER(LTRIM(RTRIM(loc_raw))) LIKE 'VNFAMALICA%'
      OR UPPER(LTRIM(RTRIM(loc_raw))) LIKE 'FAMALICA%'
      OR (UPPER(LTRIM(RTRIM(loc_raw))) LIKE '%VILA NOVA%FAMALICA%' AND UPPER(LTRIM(RTRIM(loc_raw))) NOT LIKE '%TELHA%')
      OR UPPER(LTRIM(RTRIM(loc_raw))) LIKE '%(ESTRADA:%FAMALICA%'
      THEN 'Vila Nova de Famalicao'

    -- Vila Nova de Gaia
    WHEN UPPER(LTRIM(RTRIM(loc_raw))) LIKE 'V.N.GAIA%'
      OR UPPER(LTRIM(RTRIM(loc_raw))) = 'GAIA'
      OR UPPER(LTRIM(RTRIM(loc_raw))) LIKE '%VNG'
      OR (UPPER(LTRIM(RTRIM(loc_raw))) LIKE '%VILA NOVA%GAIA%' AND LEN(LTRIM(RTRIM(loc_raw))) < 25)
      THEN 'Vila Nova de Gaia'

    -- Santo Tirso
    WHEN UPPER(LTRIM(RTRIM(loc_raw))) IN ('SANTO TIRSO','STO TIRSO','ST.TIRSO','S. TIRSO','ST TIRSO')
      OR UPPER(LTRIM(RTRIM(loc_raw))) LIKE 'ST. TIRSO%'
      OR UPPER(LTRIM(RTRIM(loc_raw))) LIKE 'STO TIRSO%'
      THEN 'Santo Tirso'

    -- Povoa de Varzim
    WHEN UPPER(LTRIM(RTRIM(loc_raw))) LIKE '%POVOA%VARZIM%'
      OR UPPER(LTRIM(RTRIM(loc_raw))) LIKE '%PÓVOA%VARZIM%'
      THEN 'Povoa de Varzim'

    -- Viana do Castelo
    WHEN UPPER(LTRIM(RTRIM(loc_raw))) LIKE '%VIANA%CASTELO%'
      THEN 'Viana do Castelo'

    -- Azurem / Guimaraes
    WHEN UPPER(LTRIM(RTRIM(loc_raw))) IN ('AZUREM','AZURÉM')
      THEN 'Azurem'

    -- Guimaraes
    WHEN UPPER(LTRIM(RTRIM(loc_raw))) IN ('GUIMARAES','GUIMARÃES')
      THEN 'Guimaraes'

    -- Castelo da Maia
    WHEN UPPER(LTRIM(RTRIM(loc_raw))) LIKE 'CAST%LO%MAIA%'
      OR UPPER(LTRIM(RTRIM(loc_raw))) = 'CASTELO MAIA'
      THEN 'Castelo da Maia'

    -- Moure BCL -> Moure
    WHEN UPPER(LTRIM(RTRIM(loc_raw))) LIKE 'MOURE%BCL%'
      THEN 'Moure'

    -- Alcacer do Sal
    WHEN UPPER(LTRIM(RTRIM(loc_raw))) LIKE 'ALCAC%SAL%' OR UPPER(LTRIM(RTRIM(loc_raw))) LIKE 'ALCÁC%SAL%'
      THEN 'Alcacer do Sal'

    -- Sao Tome de Negrelos
    WHEN UPPER(LTRIM(RTRIM(loc_raw))) LIKE 'S%TOM%NEGRELO%'
      THEN 'S. Tome de Negrelos'

    -- Riba de Ave
    WHEN UPPER(LTRIM(RTRIM(loc_raw))) LIKE 'RIBA%AVE%' OR UPPER(LTRIM(RTRIM(loc_raw))) LIKE 'RIBA D%AVE%'
      THEN 'Riba de Ave'

    -- Oliveira S. Mateus / Santa Maria
    WHEN UPPER(LTRIM(RTRIM(loc_raw))) LIKE 'OLIVEIRA S%MATEUS%'
      OR UPPER(LTRIM(RTRIM(loc_raw))) LIKE 'OLIVEIRA SANTA MARIA%'
      THEN 'Oliveira S. Mateus'

    -- Rebordoes
    WHEN UPPER(LTRIM(RTRIM(loc_raw))) LIKE 'REBORD%ES%' OR UPPER(LTRIM(RTRIM(loc_raw))) LIKE 'REBORDÕ%'
      THEN 'Rebordoes'

    -- S. Mamede Coronado
    WHEN UPPER(LTRIM(RTRIM(loc_raw))) LIKE 'S%MAMEDE%CORONADO%'
      OR UPPER(LTRIM(RTRIM(loc_raw))) LIKE 'S.MAMEDE%CORONADO%'
      THEN 'S. Mamede Coronado'

    -- Sufixos de concelho (VFR, GMR, PNF, etc) - limpar
    WHEN UPPER(LTRIM(RTRIM(loc_raw))) LIKE '% VFR' THEN LEFT(LTRIM(RTRIM(loc_raw)), LEN(LTRIM(RTRIM(loc_raw)))-4)
    WHEN UPPER(LTRIM(RTRIM(loc_raw))) LIKE '% GMR' THEN LEFT(LTRIM(RTRIM(loc_raw)), LEN(LTRIM(RTRIM(loc_raw)))-4)
    WHEN UPPER(LTRIM(RTRIM(loc_raw))) LIKE '% PNF' THEN LEFT(LTRIM(RTRIM(loc_raw)), LEN(LTRIM(RTRIM(loc_raw)))-4)
    WHEN UPPER(LTRIM(RTRIM(loc_raw))) LIKE '% BCL' THEN LEFT(LTRIM(RTRIM(loc_raw)), LEN(LTRIM(RTRIM(loc_raw)))-4)
    WHEN UPPER(LTRIM(RTRIM(loc_raw))) LIKE '% MBR' THEN LEFT(LTRIM(RTRIM(loc_raw)), LEN(LTRIM(RTRIM(loc_raw)))-4)
    WHEN UPPER(LTRIM(RTRIM(loc_raw))) LIKE '% MTR' THEN LEFT(LTRIM(RTRIM(loc_raw)), LEN(LTRIM(RTRIM(loc_raw)))-4)
    WHEN UPPER(LTRIM(RTRIM(loc_raw))) LIKE '% VNG' THEN LEFT(LTRIM(RTRIM(loc_raw)), LEN(LTRIM(RTRIM(loc_raw)))-4)

    -- Default: trim e capitalize
    ELSE LTRIM(RTRIM(loc_raw))
  END
`;

router.get('/analytics/por-localidade', asyncHandler(async (req, res) => {
  const { dataInicio, dataFim } = parseDateRange(req);
  const topN = Math.min(500, parseInt(req.query.top) || 100);
  let where = `cd.TipoDoc IN ${TIPOS_DESCARGA}`;
  const params = {};
  if (dataInicio) { where += ' AND cd.Data >= @dataInicio'; params.dataInicio = dataInicio; }
  if (dataFim) { where += ' AND cd.Data <= @dataFim'; params.dataFim = dataFim; }

  const result = await query(`
    WITH DocNorm AS (
      SELECT
        cd.TotalDocumento,
        cd.Entidade,
        cd.Data,
        cd.LocalDescarga,
        ${NORMALIZA_LOCALIDADE.replace(/loc_raw/g, 'cd.LocalidadeEntrega').replace(/cli_cploc/g, 'c.Fac_Cploc').replace(/cli_local/g, 'c.Fac_Local')} as localidade_norm
      FROM CabecDoc cd
      LEFT JOIN Clientes c ON cd.Entidade = c.Cliente
      WHERE ${where}
    )
    SELECT TOP (@topN)
           localidade_norm as localidade,
           COUNT(*) as numDocumentos,
           SUM(TotalDocumento) as totalVendas,
           AVG(TotalDocumento) as mediaDocumento,
           COUNT(DISTINCT Entidade) as numClientes,
           MIN(Data) as primeiraVenda,
           MAX(Data) as ultimaVenda
    FROM DocNorm
    WHERE localidade_norm IS NOT NULL AND localidade_norm != '' AND localidade_norm != '.'
    GROUP BY localidade_norm
    ORDER BY totalVendas DESC
  `, { ...params, topN });
  res.json({ data: result.recordset });
}));

module.exports = router;
