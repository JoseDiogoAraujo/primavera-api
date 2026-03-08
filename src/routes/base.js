const { Router } = require('express');
const { query } = require('../db');
const { asyncHandler } = require('../middleware/errorHandler');

const router = Router();

// GET /familias - Listar familias
router.get('/familias', asyncHandler(async (req, res) => {
  const result = await query('SELECT Familia, Descricao FROM Familias ORDER BY Familia');
  res.json(result.recordset);
}));

// GET /subfamilias - Listar subfamilias (filtro opcional ?familia=)
router.get('/subfamilias', asyncHandler(async (req, res) => {
  const params = {};
  let where = '';
  if (req.query.familia) {
    where = ' WHERE Familia = @familia';
    params.familia = req.query.familia;
  }
  const result = await query(
    `SELECT SubFamilia, Familia, Descricao FROM SubFamilias${where} ORDER BY Familia, SubFamilia`,
    params
  );
  res.json(result.recordset);
}));

// GET /marcas - Listar marcas
router.get('/marcas', asyncHandler(async (req, res) => {
  const result = await query('SELECT Marca, Descricao FROM Marcas ORDER BY Marca');
  res.json(result.recordset);
}));

// GET /modelos - Listar modelos (filtro opcional ?marca=)
router.get('/modelos', asyncHandler(async (req, res) => {
  const params = {};
  let where = '';
  if (req.query.marca) {
    where = ' WHERE Marca = @marca';
    params.marca = req.query.marca;
  }
  const result = await query(
    `SELECT Modelo, Marca, Descricao FROM Modelos${where} ORDER BY Marca, Modelo`,
    params
  );
  res.json(result.recordset);
}));

// GET /armazens - Listar armazens
router.get('/armazens', asyncHandler(async (req, res) => {
  const result = await query(
    'SELECT Armazem, Descricao, Morada, Localidade, CodPostal FROM Armazens ORDER BY Armazem'
  );
  res.json(result.recordset);
}));

// GET /armazens/:id - Detalhe de armazem
router.get('/armazens/:id', asyncHandler(async (req, res) => {
  const result = await query(
    'SELECT * FROM Armazens WHERE Armazem = @id',
    { id: req.params.id }
  );
  if (!result.recordset.length) return res.status(404).json({ error: 'Armazem nao encontrado' });
  res.json(result.recordset[0]);
}));

// GET /unidades - Listar unidades
router.get('/unidades', asyncHandler(async (req, res) => {
  const result = await query('SELECT Unidade, Descricao FROM Unidades ORDER BY Unidade');
  res.json(result.recordset);
}));

// GET /vendedores - Listar vendedores
router.get('/vendedores', asyncHandler(async (req, res) => {
  const result = await query(
    'SELECT Vendedor, Nome, Comissao, Email FROM Vendedores ORDER BY Vendedor'
  );
  res.json(result.recordset);
}));

// GET /vendedores/:id - Detalhe de vendedor
router.get('/vendedores/:id', asyncHandler(async (req, res) => {
  const result = await query(
    'SELECT * FROM Vendedores WHERE Vendedor = @id',
    { id: req.params.id }
  );
  if (!result.recordset.length) return res.status(404).json({ error: 'Vendedor nao encontrado' });
  res.json(result.recordset[0]);
}));

// GET /vendedores/:id/vendas - Resumo de vendas de um vendedor
router.get('/vendedores/:id/vendas', asyncHandler(async (req, res) => {
  const result = await query(`
    SELECT v.Vendedor, v.Nome, COUNT(*) as totalDocs, SUM(cd.TotalDocumento) as totalVendas
    FROM Vendedores v
    JOIN CabecDoc cd ON cd.Vendedor = v.Vendedor
    JOIN CabecDocStatus s ON s.IdCabecDoc = cd.Id
    WHERE s.Anulado = 0 AND v.Vendedor = @id
    GROUP BY v.Vendedor, v.Nome
  `, { id: req.params.id });
  if (!result.recordset.length) return res.status(404).json({ error: 'Vendedor nao encontrado ou sem vendas' });
  res.json(result.recordset[0]);
}));

// GET /zonas - Listar zonas
router.get('/zonas', asyncHandler(async (req, res) => {
  const result = await query('SELECT Zona, Descricao FROM Zonas ORDER BY Zona');
  res.json(result.recordset);
}));

// GET /condpag - Condicoes de pagamento
router.get('/condpag', asyncHandler(async (req, res) => {
  const result = await query(
    'SELECT CondPag, Descricao, NumDias, TipoDesconto FROM CondPag ORDER BY CondPag'
  );
  res.json(result.recordset);
}));

// GET /moedas - Listar moedas
router.get('/moedas', asyncHandler(async (req, res) => {
  const result = await query(
    'SELECT Moeda, Descricao, Abreviatura, Cambio FROM Moedas ORDER BY Moeda'
  );
  res.json(result.recordset);
}));

// GET /iva - Tabela de IVA
router.get('/iva', asyncHandler(async (req, res) => {
  const result = await query(
    'SELECT Iva, Descricao, Taxa, TipoTaxa FROM Iva ORDER BY Iva'
  );
  res.json(result.recordset);
}));

// GET /series - Series de documentos (filtro opcional ?tipoDoc=)
router.get('/series', asyncHandler(async (req, res) => {
  const params = {};
  let where = '';
  if (req.query.tipoDoc) {
    where = ' WHERE TipoDoc = @tipoDoc';
    params.tipoDoc = req.query.tipoDoc;
  }
  const result = await query(
    `SELECT TipoDoc, Serie, Descricao, Numerador, DataInicial, DataFinal, SerieInactiva, SeriePorDefeito FROM Series${where} ORDER BY TipoDoc, Serie`,
    params
  );
  res.json(result.recordset);
}));

// GET /tiposdoc - Tipos de documento
router.get('/tiposdoc', asyncHandler(async (req, res) => {
  const result = await query(
    'SELECT Documento, Descricao, MovStock, MovConta, MovContab, Anulacao FROM TiposDoc ORDER BY Documento'
  );
  res.json(result.recordset);
}));

module.exports = router;
