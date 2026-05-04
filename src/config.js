const path = require('node:path');
const { loadEnvFile } = require('./env');

const ROOT_DIR = path.resolve(__dirname, '..');

loadEnvFile(path.join(ROOT_DIR, '.env.local'));
loadEnvFile(path.join(ROOT_DIR, '.env'));

const config = {
  rootDir: ROOT_DIR,
  publicDir: path.join(ROOT_DIR, 'public'),
  port: Number(process.env.PORT || 3000),
  model: process.env.DEEPSEEK_MODEL || 'deepseek-v4-pro',
  apiKey: process.env.DEEPSEEK_API_KEY || ''
};

module.exports = config;
