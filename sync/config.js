const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

function loadConfig() {
  const envPath = path.join(process.cwd(), '.env');
  if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath });
  } else {
    dotenv.config();
  }

  const baseUrl = process.env.TB_BASE_URL || process.env.BASE_URL || '';
  const username = process.env.TB_USERNAME || process.env.USERNAME || '';
  const password = process.env.TB_PASSWORD || process.env.PASSWORD || '';

  const missing = [];
  if (!baseUrl) missing.push('TB_BASE_URL');
  if (!username) missing.push('TB_USERNAME');
  if (!password) missing.push('TB_PASSWORD');

  if (missing.length) {
    throw new Error(
      `Missing credentials in .env: ${missing.join(', ')}`
    );
  }

  return { baseUrl, username, password };
}

module.exports = { loadConfig };
