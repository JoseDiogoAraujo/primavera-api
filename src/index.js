const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const swaggerUi = require('swagger-ui-express');
const swaggerDoc = require('./swagger');
const { errorHandler } = require('./middleware/errorHandler');
const { getPool } = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors());
app.use(compression());
app.use(express.json());

// Swagger UI
app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerDoc, {
  customCss: '.swagger-ui .topbar { display: none }',
  customSiteTitle: 'Primavera V10 API',
}));

// Routes
app.use('/api/health', require('./routes/health'));
app.use('/api/clientes', require('./routes/clientes'));
app.use('/api/artigos', require('./routes/artigos'));
app.use('/api/vendas', require('./routes/vendas'));
app.use('/api/compras', require('./routes/compras'));
app.use('/api/fornecedores', require('./routes/fornecedores'));
app.use('/api/stock', require('./routes/stock'));
app.use('/api/financeiro', require('./routes/financeiro'));
app.use('/api/rh', require('./routes/rh'));
app.use('/api/query', require('./routes/query'));

// Root redirect to docs
app.get('/', (req, res) => res.redirect('/docs'));

// Error handler
app.use(errorHandler);

// Start
async function start() {
  try {
    await getPool();
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`Primavera V10 API running on port ${PORT}`);
      console.log(`Swagger docs: http://0.0.0.0:${PORT}/docs`);
    });
  } catch (err) {
    console.error('Failed to start:', err.message);
    process.exit(1);
  }
}

start();
