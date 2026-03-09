const { Router } = require('express');
const { asyncHandler } = require('../middleware/errorHandler');

const router = Router();

router.get('/context', asyncHandler(async (req, res) => {
  res.json({
    descricao: 'API REST read-only para dados do ERP Primavera V10 (Cegid) da Cimenteira do Louro. Valores em EUR.',
    baseUrl: '/api',
    autenticacao: 'Basic Auth (user:password) ou header x-api-key',
    endpoints: {
      clientes: {
        descricao: 'Gestao de clientes',
        lista: { path: '/api/clientes', parametros: 'search, page, limit' },
        detalhe: { path: '/api/clientes/:id' },
        documentos: { path: '/api/clientes/:id/documentos', parametros: 'tipoDoc, from, to, page, limit' },
        saldo: { path: '/api/clientes/:id/saldo' },
        pendentes: { path: '/api/clientes/:id/pendentes' },
      },
      fornecedores: {
        descricao: 'Gestao de fornecedores',
        lista: { path: '/api/fornecedores', parametros: 'search, page, limit' },
        detalhe: { path: '/api/fornecedores/:id' },
        documentos: { path: '/api/fornecedores/:id/documentos', parametros: 'tipoDoc, from, to, page, limit' },
        saldo: { path: '/api/fornecedores/:id/saldo' },
        artigos: { path: '/api/fornecedores/:id/artigos' },
      },
      artigos: {
        descricao: 'Catalogo de artigos/produtos',
        lista: { path: '/api/artigos', parametros: 'search, familia, comStock (true/false), page, limit' },
        detalhe: { path: '/api/artigos/:id' },
        precos: { path: '/api/artigos/:id/precos' },
        fornecedores: { path: '/api/artigos/:id/fornecedores' },
        movimentos: { path: '/api/artigos/:id/movimentos', parametros: 'page, limit' },
      },
      vendas: {
        descricao: 'Documentos de venda',
        documentos: { path: '/api/vendas/documentos', parametros: 'search, tipoDoc, cliente, artigo, vendedor, zona, serie, from, to, page, limit' },
        detalhe: { path: '/api/vendas/documentos/:id', descricao: 'Cabecalho + linhas do documento' },
        resumo: { path: '/api/vendas/resumo', parametros: 'from, to', descricao: 'Totais facturacao' },
        top: { path: '/api/vendas/top', parametros: 'por (cliente|artigo|vendedor), top (default 10), from, to', descricao: 'Rankings' },
        recentes: { path: '/api/vendas/recentes/:cliente', descricao: 'Faturas (FA) do ano passado com artigos, quantidades e precos por documento' },
      },
      compras: {
        descricao: 'Documentos de compra',
        documentos: { path: '/api/compras/documentos', parametros: 'search, tipoDoc, fornecedor, artigo, serie, from, to, page, limit' },
        detalhe: { path: '/api/compras/documentos/:id', descricao: 'Cabecalho + linhas do documento' },
        resumo: { path: '/api/compras/resumo', parametros: 'from, to', descricao: 'Totais compras' },
        top: { path: '/api/compras/top', parametros: 'por (fornecedor|artigo), top (default 10), from, to', descricao: 'Rankings' },
      },
      stock: {
        descricao: 'Inventario e stock',
        actual: { path: '/api/stock/actual', parametros: 'search, armazem, page, limit' },
        alertas: { path: '/api/stock/alertas', descricao: 'Sem stock ou abaixo minimo' },
        movimentos: { path: '/api/stock/movimentos', parametros: 'artigo, armazem, from, to, page, limit' },
        resumo: { path: '/api/stock/resumo' },
      },
      financeiro: {
        descricao: 'Financeiro e pendentes',
        contas: { path: '/api/financeiro/contas', parametros: 'search, page, limit' },
        pendentesClientes: { path: '/api/financeiro/pendentes/clientes', descricao: 'Dividas de clientes' },
        pendentesFornecedores: { path: '/api/financeiro/pendentes/fornecedores', descricao: 'Dividas a fornecedores' },
        pendentesResumo: { path: '/api/financeiro/pendentes/resumo', descricao: 'Total a receber vs a pagar' },
        tesourariaMensal: { path: '/api/financeiro/tesouraria/mensal' },
      },
      base: {
        descricao: 'Tabelas mestras',
        endpoints: 'familias, subfamilias, marcas, modelos, armazens, unidades, vendedores, zonas, condpag, moedas, iva, series, tiposdoc',
        exemplo: '/api/base/familias, /api/base/vendedores',
      },
    },
    tiposDocVenda: { FA: 'Factura', FR: 'Factura-Recibo', NC: 'Nota Credito', EC: 'Encomenda', GR: 'Guia Remessa', GT: 'Guia Transporte' },
    tiposDocCompra: { VFA: 'Factura Fornecedor', ECF: 'Encomenda Fornecedor', VNC: 'Nota Credito Fornecedor' },
    paginacao: { parametros: 'page (default 1), limit (default 50, max 200)', resposta: '{ page, limit, total, data: [...] }' },
    datas: { formato: 'YYYY-MM-DD', parametros: 'from (data inicio), to (data fim)' },
    dicas: [
      'Usar ?search= para pesquisa generica em clientes, fornecedores, artigos',
      'Usar /vendas/top?por=cliente&top=10 para rankings',
      'Usar /vendas/resumo?from=2024-01-01&to=2024-12-31 para totais de periodo',
      'Documentos de venda: filtrar por artigo com ?artigo=CODIGO',
      'Valores monetarios em EUR',
    ],
  });
}));

module.exports = router;
