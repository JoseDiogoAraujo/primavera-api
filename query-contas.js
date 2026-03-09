const { query, close } = require('./src/db');
(async () => {
  try {
    const r = await query(`
      SELECT m.Conta, m.Documento AS TipoDoc,
        COUNT(DISTINCT CONCAT(m.Serie, '-', CAST(m.NumDoc AS VARCHAR))) AS NumDocumentos,
        ROUND(SUM(CASE WHEN m.Natureza = 'C' THEN m.Valor ELSE -m.Valor END), 2) AS Total
      FROM Movimentos m
      WHERE m.Ano = 2025
        AND m.Conta LIKE '7%'
        AND LEFT(m.Conta, 2) IN ('71','72')
      GROUP BY m.Conta, m.Documento
      ORDER BY m.Conta, Total DESC
    `);
    console.log('Conta|TipoDoc|NumDocs|Total');
    console.log('---|---|---|---');
    for (const row of r.recordset) {
      console.log(row.Conta + '|' + row.TipoDoc + '|' + row.NumDocumentos + '|' + row.Total);
    }
  } catch(e) { console.error(e.message); }
  finally { await close(); process.exit(0); }
})();
