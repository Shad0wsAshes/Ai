import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { ADMIN_PASSWORD } from '../config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

const TOKENS_FILE = path.join(__dirname, '../data/tokens.json');
const PROMPTS_FILE = path.join(__dirname, '../data/prompts.json');
const CONTEXT_FILE = path.join(__dirname, '../data/context.json');

function readJSON(filePath) {
  try {
    const data = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    return filePath.includes('tokens.json') ? [] : {};
  }
}

function writeJSON(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

router.post('/verifyPassword', (req, res) => {
  const { password } = req.body;

  if (password === ADMIN_PASSWORD) {
    res.json({ valid: true });
  } else {
    res.status(401).json({ valid: false, message: 'Invalid password' });
  }
});

router.get('/tokens', (req, res) => {
  const tokens = readJSON(TOKENS_FILE);
  res.json(tokens);
});

router.post('/tokens', (req, res) => {
  const { token } = req.body;

  if (!token) {
    return res.status(400).json({ message: 'Token is required' });
  }

  const tokens = readJSON(TOKENS_FILE);

  if (tokens.find(t => t.token === token)) {
    return res.status(400).json({ message: 'Token already exists' });
  }

  tokens.push({
    token,
    active: true,
    usedByDevice: '',
    lastUsed: ''
  });

  writeJSON(TOKENS_FILE, tokens);
  res.json({ message: 'Token added successfully', tokens });
});

router.put('/tokens/:token', (req, res) => {
  const { token } = req.params;
  const { active } = req.body;

  const tokens = readJSON(TOKENS_FILE);
  const tokenData = tokens.find(t => t.token === token);

  if (!tokenData) {
    return res.status(404).json({ message: 'Token not found' });
  }

  tokenData.active = active;
  writeJSON(TOKENS_FILE, tokens);
  res.json({ message: 'Token updated successfully', tokens });
});

router.delete('/tokens/:token', (req, res) => {
  const { token } = req.params;

  let tokens = readJSON(TOKENS_FILE);
  tokens = tokens.filter(t => t.token !== token);

  writeJSON(TOKENS_FILE, tokens);
  res.json({ message: 'Token deleted successfully', tokens });
});

router.get('/prompts', (req, res) => {
  const prompts = readJSON(PROMPTS_FILE);
  res.json(prompts);
});

router.put('/prompts', (req, res) => {
  const prompts = req.body;
  writeJSON(PROMPTS_FILE, prompts);
  res.json({ message: 'Prompts updated successfully' });
});

router.get('/products', (req, res) => {
  const context = readJSON(CONTEXT_FILE);
  res.json(context);
});

export default router;
