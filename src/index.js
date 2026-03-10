const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const swaggerUi = require('swagger-ui-express');
const swaggerDoc = require('./swagger');
const path = require('path');
const { errorHandler } = require('./middleware/errorHandler');
const { getPool } = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors());
app.use(compression());
app.use(express.json());

// Authentication: Basic Auth ou API Key
const API_USER = process.env.API_USER || 'primavera';
const API_PASS = process.env.API_PASS;
const API_KEY = process.env.API_KEY;
app.use('/api', (req, res, next) => {
  if (!API_PASS && !API_KEY) return next(); // Se nao configurada, permite tudo

  // Verificar API Key (header x-api-key)
  const key = req.headers['x-api-key'] || req.query.apikey;
  if (API_KEY && key === API_KEY) return next();

  // Verificar Basic Auth
  const authHeader = req.headers.authorization;
  if (API_PASS && authHeader && authHeader.startsWith('Basic ')) {
    const decoded = Buffer.from(authHeader.slice(6), 'base64').toString();
    const [user, pass] = decoded.split(':');
    if (user === API_USER && pass === API_PASS) return next();
  }

  res.status(401).json({ error: 'Autenticacao em falta. Usar Basic Auth ou header x-api-key.' });
});

// Swagger UI
app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerDoc, {
  customCss: '.swagger-ui .topbar { display: none }',
  customSiteTitle: 'Primavera V10 API',
}));

// Routes – LLM-Ready API v4.0
app.use('/api/health', require('./routes/health'));
app.use('/api/clientes', require('./routes/clientes'));
app.use('/api/artigos', require('./routes/artigos'));
app.use('/api/comercial', require('./routes/comercial'));
app.use('/api/vendas', require('./routes/vendas'));
app.use('/api/query', require('./routes/query'));
app.use('/api/copilot', require('./routes/copilot'));

// Static pages (mapa, dashboards)
app.use('/static', express.static(path.join(__dirname, 'public')));

// Root redirect to docs
app.get('/', (req, res) => res.redirect('/docs'));
app.get('/mapa', (req, res) => res.sendFile(path.join(__dirname, 'public', 'mapa.html')));

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
