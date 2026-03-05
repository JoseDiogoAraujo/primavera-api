const sql = require('mssql');

const config = {
  server: process.env.DB_HOST || '172.21.126.3',
  database: process.env.DB_NAME || 'PRIACL',
  user: process.env.DB_USER || 'reader',
  password: process.env.DB_PASS || '',
  port: parseInt(process.env.DB_PORT || '1433'),
  options: {
    encrypt: false,
    trustServerCertificate: true,
    requestTimeout: 30000,
    connectionTimeout: 15000,
  },
  pool: {
    max: 10,
    min: 2,
    idleTimeoutMillis: 30000,
  },
};

let pool = null;

async function getPool() {
  if (!pool) {
    pool = await sql.connect(config);
    console.log(`Connected to SQL Server: ${config.server}/${config.database}`);
  }
  return pool;
}

async function query(sqlText, params = {}) {
  const p = await getPool();
  const req = p.request();
  for (const [key, value] of Object.entries(params)) {
    req.input(key, value);
  }
  return req.query(sqlText);
}

async function close() {
  if (pool) {
    await pool.close();
    pool = null;
  }
}

module.exports = { getPool, query, close, sql };
