const fs = require('fs');
const dashFile = require('./grafana-dash.json');
const dashboard = dashFile.dashboard;

const TIPOS_POS = "('FA','FAC','FR','GT')";
const TIPOS_NEG = "('ALC','ALI','FAA','NC')";
const TIPOS_ALL = "('FA','FAC','FR','GT','ALC','ALI','FAA','NC')";
const ANULADO_JOIN = "INNER JOIN CabecDocStatus cds ON cd.Id = cds.IdCabecDoc AND cds.Anulado = 0";

// Net value (sem IVA)
const VAL = `(cd.TotalDocumento - cd.TotalIva)`;
const VAL_NA = `(TotalDocumento - TotalIva)`; // no alias

for (const panel of dashboard.panels) {
  if (!panel.targets) continue;

  for (const target of panel.targets) {
    if (!target.rawSql) continue;

    switch (panel.id) {
      case 1: // Total Facturado - net value, exclude anulados
        target.rawSql = `SELECT
  SUM(CASE WHEN cd.TipoDoc IN ${TIPOS_POS} THEN ${VAL} WHEN cd.TipoDoc IN ${TIPOS_NEG} THEN -${VAL} ELSE 0 END) as total
FROM CabecDoc cd
${ANULADO_JOIN}
WHERE cd.TipoDoc IN ${TIPOS_ALL}
  AND $__timeFilter(cd.Data)`;
        break;

      case 2: // N. Documentos - exclude anulados
        target.rawSql = `SELECT COUNT(*) as total
FROM CabecDoc cd
${ANULADO_JOIN}
WHERE cd.TipoDoc IN ${TIPOS_ALL}
  AND $__timeFilter(cd.Data)`;
        break;

      case 3: // N. Localidades - exclude anulados
        target.rawSql = `SELECT COUNT(DISTINCT LTRIM(RTRIM(cd.LocalDescarga))) as total
FROM CabecDoc cd
${ANULADO_JOIN}
WHERE cd.TipoDoc IN ${TIPOS_ALL}
  AND $__timeFilter(cd.Data)
  AND LTRIM(RTRIM(ISNULL(cd.LocalDescarga,''))) NOT IN ('','.','..','Morada do Cliente')`;
        break;

      case 4: // N. Clientes - exclude anulados
        target.rawSql = `SELECT COUNT(DISTINCT cd.Entidade) as total
FROM CabecDoc cd
${ANULADO_JOIN}
WHERE cd.TipoDoc IN ${TIPOS_ALL}
  AND $__timeFilter(cd.Data)`;
        break;

      case 7: // Evolucao Mensal - net value, exclude anulados
        target.rawSql = `SELECT
  DATEADD(MONTH, DATEDIFF(MONTH, 0, cd.Data), 0) as time,
  SUM(CASE WHEN cd.TipoDoc IN ${TIPOS_POS} THEN ${VAL} WHEN cd.TipoDoc IN ${TIPOS_NEG} THEN -${VAL} ELSE 0 END) as 'Total Vendas'
FROM CabecDoc cd
${ANULADO_JOIN}
WHERE cd.TipoDoc IN ${TIPOS_ALL}
  AND $__timeFilter(cd.Data)
GROUP BY DATEADD(MONTH, DATEDIFF(MONTH, 0, cd.Data), 0)
ORDER BY time`;
        panel.title = 'Evolucao Mensal de Vendas';
        break;

      case 9: // Ultimos 20 Documentos - exclude anulados
        target.rawSql = `SELECT TOP 20
  cd.TipoDoc as tipoDoc,
  cd.Serie as serie,
  cd.NumDoc as numDoc,
  CONVERT(VARCHAR(10), cd.Data, 120) as data,
  cd.Entidade as cliente,
  cd.Nome as nome,
  cd.LocalDescarga as localDescarga,
  ROUND(cd.TotalMerc, 2) as totalMerc,
  ROUND(cd.TotalIva, 2) as totalIva,
  ROUND(cd.TotalDocumento, 2) as totalDoc,
  cd.Zona as zona
FROM CabecDoc cd
${ANULADO_JOIN}
WHERE cd.TipoDoc IN ${TIPOS_ALL}
  AND $__timeFilter(cd.Data)
ORDER BY cd.Data DESC, cd.NumDoc DESC`;
        break;

      case 10: // Mapa SQL
      case 11: // Table SQL
        target.rawSql = `SELECT
  CASE
    WHEN LTRIM(RTRIM(ISNULL(cd.LocalDescarga,''))) NOT IN ('','.','..','Morada do Cliente','Morada da Obra')
      THEN LTRIM(RTRIM(cd.LocalDescarga))
    WHEN LTRIM(RTRIM(ISNULL(c.Fac_Cploc,''))) NOT IN ('','.','..')
      THEN LTRIM(RTRIM(c.Fac_Cploc))
    ELSE 'Sem Localidade'
  END as localidade,
  COUNT(*) as numDocumentos,
  ROUND(SUM(CASE WHEN cd.TipoDoc IN ${TIPOS_POS} THEN ${VAL} WHEN cd.TipoDoc IN ${TIPOS_NEG} THEN -${VAL} ELSE 0 END), 2) as totalVendas,
  ROUND(AVG(${VAL}), 2) as mediaDocumento,
  COUNT(DISTINCT cd.Entidade) as numClientes
FROM CabecDoc cd
${ANULADO_JOIN}
LEFT JOIN Clientes c ON cd.Entidade = c.Cliente
WHERE cd.TipoDoc IN ${TIPOS_ALL}
  AND $__timeFilter(cd.Data)
GROUP BY CASE
    WHEN LTRIM(RTRIM(ISNULL(cd.LocalDescarga,''))) NOT IN ('','.','..','Morada do Cliente','Morada da Obra')
      THEN LTRIM(RTRIM(cd.LocalDescarga))
    WHEN LTRIM(RTRIM(ISNULL(c.Fac_Cploc,''))) NOT IN ('','.','..')
      THEN LTRIM(RTRIM(c.Fac_Cploc))
    ELSE 'Sem Localidade'
  END
ORDER BY totalVendas DESC`;
        break;
    }
  }
}

const payload = {
  dashboard: dashboard,
  folderId: dashFile.meta.folderId,
  overwrite: true,
  message: 'fix: exclude anulados + use net values (sem IVA) to match accounting 16.26M'
};

delete payload.dashboard.id;

fs.writeFileSync('./grafana-update.json', JSON.stringify(payload, null, 2));
console.log('Dashboard update payload saved');
