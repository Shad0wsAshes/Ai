import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { OPENAI_API_KEY } from '../config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

const PROMPTS_FILE = path.join(__dirname, '../data/prompts.json');
const CONTEXT_FILE = path.join(__dirname, '../data/context.json');
const GHOSTWRITER_FILE = path.join(__dirname, '../data/ghostwriter.json');
const MENTOR_FILE = path.join(__dirname, '../data/mentor.json');

function readJSON(filePath) {
  try {
    const data = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    return {};
  }
}

function writeJSON(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

async function callOpenAI(messages, temperature = 0.7) {
  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages,
        temperature
      })
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.statusText}`);
    }

    const data = await response.json();
    return data.choices[0].message.content;
  } catch (error) {
    throw new Error(`Failed to call OpenAI: ${error.message}`);
  }
}

router.post('/generateNiches', async (req, res) => {
  try {
    const prompts = readJSON(PROMPTS_FILE);
    const systemPrompt = prompts.niches || "You are an expert in identifying profitable digital product niches.";

    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: 'Generate 10 trending, profitable niches for digital products (eBooks, courses, guides). Format as a JSON array with objects containing "title" and "description" fields.' }
    ];

    const response = await callOpenAI(messages);

    let niches;
    try {
      niches = JSON.parse(response);
    } catch {
      niches = response.split('\n').filter(line => line.trim()).slice(0, 10).map((line, i) => ({
        title: line.replace(/^\d+\.\s*/, '').trim(),
        description: `Profitable niche opportunity ${i + 1}`
      }));
    }

    res.json({ niches });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/generateTOC', async (req, res) => {
  try {
    const { niche, token } = req.body;

    const prompts = readJSON(PROMPTS_FILE);
    const systemPrompt = prompts.toc || "You are an expert content strategist creating comprehensive digital products.";

    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: `Create a detailed table of contents for a 45-page digital product about "${niche}". Include 12-15 chapters with engaging titles. Format as JSON array with "chapter" and "title" fields.` }
    ];

    const response = await callOpenAI(messages);

    let tableOfContents;
    try {
      tableOfContents = JSON.parse(response);
    } catch {
      tableOfContents = response.split('\n').filter(line => line.trim()).slice(0, 15).map((line, i) => ({
        chapter: i + 1,
        title: line.replace(/^\d+\.\s*/, '').trim()
      }));
    }

    const context = readJSON(CONTEXT_FILE);
    if (!Array.isArray(context[token])) {
      context[token] = [];
    }

    const productData = {
      productTitle: `${niche} Guide`,
      niche,
      tableOfContents,
      chapters: {},
      createdAt: new Date().toISOString()
    };

    context[token].push(productData);
    writeJSON(CONTEXT_FILE, context);

    res.json({ tableOfContents, productTitle: productData.productTitle });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/generateChapter', async (req, res) => {
  try {
    const { niche, chapterTitle, chapterNumber, token } = req.body;

    const prompts = readJSON(PROMPTS_FILE);
    const systemPrompt = prompts.chapters || "You are an expert writer creating engaging, valuable content.";

    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: `Write Chapter ${chapterNumber}: "${chapterTitle}" for a digital product about "${niche}". Make it comprehensive, actionable, and valuable (approximately 3-4 pages worth of content). Include practical examples and tips.` }
    ];

    const response = await callOpenAI(messages, 0.8);

    const context = readJSON(CONTEXT_FILE);
    if (context[token] && context[token].length > 0) {
      const latestProduct = context[token][context[token].length - 1];
      latestProduct.chapters[chapterNumber] = {
        title: chapterTitle,
        content: response
      };
      writeJSON(CONTEXT_FILE, context);
    }

    res.json({ content: response });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/generateGhostwriter', async (req, res) => {
  try {
    const { token, assetType } = req.body;

    const context = readJSON(CONTEXT_FILE);
    const userProducts = context[token];

    if (!userProducts || userProducts.length === 0) {
      return res.status(404).json({ error: 'No product found. Please create a product in Synthesise Mode first.' });
    }

    const product = userProducts[userProducts.length - 1];

    const prompts = readJSON(PROMPTS_FILE);
    const systemPrompt = prompts.ghostwriter || "You are an expert copywriter and marketing strategist.";

    let userPrompt = '';

    switch (assetType) {
      case 'salesPage':
        userPrompt = `Create a compelling long-form sales page (12 sections) for the digital product "${product.productTitle}" about ${product.niche}. Include: headline, problem, solution, features, benefits, testimonials, guarantee, pricing, FAQ, urgency, CTA, and PS.`;
        break;
      case 'emailSequence':
        userPrompt = `Create a 7-email launch sequence for "${product.productTitle}" about ${product.niche}. Format as JSON array with "day", "subject", and "body" fields.`;
        break;
      case 'videoScripts':
        userPrompt = `Create 3 short video scripts (30-60 seconds each) promoting "${product.productTitle}" about ${product.niche}. Format as JSON array with "title" and "script" fields.`;
        break;
      case 'socialContent':
        userPrompt = `Create 3 social media captions and 1 Twitter thread (10 tweets) for "${product.productTitle}" about ${product.niche}. Format as JSON with "captions" array and "thread" array.`;
        break;
      default:
        return res.status(400).json({ error: 'Invalid asset type' });
    }

    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ];

    const response = await callOpenAI(messages, 0.7);

    const ghostwriterData = readJSON(GHOSTWRITER_FILE);
    if (!ghostwriterData[token]) {
      ghostwriterData[token] = {};
    }
    ghostwriterData[token][assetType] = response;
    ghostwriterData[token].productTitle = product.productTitle;
    ghostwriterData[token].lastUpdated = new Date().toISOString();
    writeJSON(GHOSTWRITER_FILE, ghostwriterData);

    res.json({ content: response });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/generateMentorResponse', async (req, res) => {
  try {
    const { token, message } = req.body;

    const context = readJSON(CONTEXT_FILE);
    const userProducts = context[token] || [];

    const prompts = readJSON(PROMPTS_FILE);
    const systemPrompt = prompts.mentor || "You are an experienced digital business mentor and coach who helps entrepreneurs succeed.";

    let contextInfo = '';
    if (userProducts.length > 0) {
      const latestProduct = userProducts[userProducts.length - 1];
      contextInfo = `\n\nContext: The user has created a digital product titled "${latestProduct.productTitle}" in the ${latestProduct.niche} niche.`;
    }

    const messages = [
      { role: 'system', content: systemPrompt + contextInfo },
      { role: 'user', content: message }
    ];

    const response = await callOpenAI(messages, 0.7);

    const mentorData = readJSON(MENTOR_FILE);
    if (!mentorData[token]) {
      mentorData[token] = { conversations: [] };
    }
    mentorData[token].conversations.push({
      timestamp: new Date().toISOString(),
      userMessage: message,
      mentorResponse: response
    });
    writeJSON(MENTOR_FILE, mentorData);

    res.json({ response });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/generateMentorPlan', async (req, res) => {
  try {
    const { token } = req.body;

    const context = readJSON(CONTEXT_FILE);
    const userProducts = context[token];

    if (!userProducts || userProducts.length === 0) {
      return res.status(404).json({ error: 'No product found. Please create a product in Synthesise Mode first.' });
    }

    const product = userProducts[userProducts.length - 1];

    const prompts = readJSON(PROMPTS_FILE);
    const systemPrompt = prompts.mentor || "You are an experienced digital business mentor and coach.";

    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: `Create a detailed 90-day business plan for launching and growing "${product.productTitle}" in the ${product.niche} niche. Break it down into weekly goals and actions. Format as JSON with "weeks" array, each containing "week", "focus", and "actions" array.` }
    ];

    const response = await callOpenAI(messages, 0.6);

    const mentorData = readJSON(MENTOR_FILE);
    if (!mentorData[token]) {
      mentorData[token] = { conversations: [] };
    }
    mentorData[token].plan90Days = response;
    mentorData[token].planCreatedAt = new Date().toISOString();
    writeJSON(MENTOR_FILE, mentorData);

    res.json({ plan: response });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
