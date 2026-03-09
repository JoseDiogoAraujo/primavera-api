const path = require('path');
const fs = require('fs');

const swaggerDoc = JSON.parse(
  fs.readFileSync(path.join(__dirname, '..', 'openapi.json'), 'utf8')
);

module.exports = swaggerDoc;
