import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

const TOKENS_FILE = path.join(__dirname, '../data/tokens.json');

function readTokens() {
  try {
    const data = fs.readFileSync(TOKENS_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    return [];
  }
}

function writeTokens(tokens) {
  fs.writeFileSync(TOKENS_FILE, JSON.stringify(tokens, null, 2));
}

router.post('/verifyToken', (req, res) => {
  const { token, deviceId } = req.body;

  if (!token) {
    return res.status(400).json({ valid: false, message: 'Token is required' });
  }

  const tokens = readTokens();
  const tokenData = tokens.find(t => t.token === token);

  if (!tokenData) {
    return res.status(404).json({ valid: false, message: 'Invalid token' });
  }

  if (!tokenData.active) {
    return res.status(403).json({ valid: false, message: 'Token is inactive' });
  }

  if (tokenData.usedByDevice && tokenData.usedByDevice !== deviceId) {
    return res.status(403).json({ valid: false, message: 'Token already in use on another device' });
  }

  tokenData.usedByDevice = deviceId;
  tokenData.lastUsed = new Date().toISOString();
  writeTokens(tokens);

  const isMaster = token.startsWith('MASTER-');

  res.json({
    valid: true,
    isMaster,
    message: 'Token verified successfully'
  });
});

export default router;
