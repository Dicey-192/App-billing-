import express from 'express';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type } from '@google/genai';
import dotenv from 'dotenv';
import JSZip from 'jszip';

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '50mb' }));

// Receipt PNG Cache Store Setup
const RECEIPT_CACHE_DIR = path.join(process.cwd(), '.receipts_cache');
if (!fs.existsSync(RECEIPT_CACHE_DIR)) {
  fs.mkdirSync(RECEIPT_CACHE_DIR, { recursive: true });
}

function getReceiptCacheKey(tenantId: string, month?: string): string {
  const cleanMonth = (month || 'CURRENT_CYCLE').replace(/[^a-zA-Z0-9_-]/g, '_');
  const cleanId = (tenantId || 'default').replace(/[^a-zA-Z0-9_-]/g, '_');
  return `${cleanId}_${cleanMonth}.png`;
}

// 1. Cache Receipt PNG Endpoint
app.post('/api/receipts/cache', async (req, res) => {
  try {
    const { tenantId, month, base64Image } = req.body;
    if (!tenantId || !base64Image) {
      return res.status(400).json({ error: 'Missing tenantId or base64Image' });
    }
    const filename = getReceiptCacheKey(tenantId, month);
    const filePath = path.join(RECEIPT_CACHE_DIR, filename);

    // Remove base64 data header if present
    const base64Data = base64Image.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');

    await fs.promises.writeFile(filePath, buffer);
    return res.json({ success: true, key: filename });
  } catch (err: any) {
    console.error('[Receipt Cache] Error caching image:', err);
    return res.status(500).json({ error: 'Failed to cache receipt', message: err.message });
  }
});

// 2. Check Cache Status Endpoint
app.post('/api/receipts/check-cache', (req, res) => {
  try {
    const { tenantIds, month } = req.body;
    if (!Array.isArray(tenantIds)) {
      return res.status(400).json({ error: 'tenantIds must be an array' });
    }
    const cachedTenantIds: string[] = [];
    const missingTenantIds: string[] = [];

    for (const tid of tenantIds) {
      const filename = getReceiptCacheKey(tid, month);
      const filePath = path.join(RECEIPT_CACHE_DIR, filename);
      if (fs.existsSync(filePath) && fs.statSync(filePath).size > 0) {
        cachedTenantIds.push(tid);
      } else {
        missingTenantIds.push(tid);
      }
    }

    return res.json({ cachedTenantIds, missingTenantIds });
  } catch (err: any) {
    console.error('[Receipt Cache] Check cache error:', err);
    return res.status(500).json({ error: 'Failed to check cache' });
  }
});

// 3. Download / Serve Cached PNG
app.get('/api/receipts/:tenantId/download', (req, res) => {
  try {
    const { tenantId } = req.params;
    const { month, filename } = req.query;
    const cacheKey = getReceiptCacheKey(tenantId, month as string);
    const filePath = path.join(RECEIPT_CACHE_DIR, cacheKey);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'Receipt not cached yet' });
    }

    const downloadName = (filename as string) || `receipt_${tenantId}.png`;

    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(downloadName)}"`);
    res.setHeader('Cache-Control', 'public, max-age=86400');
    
    return res.sendFile(filePath);
  } catch (err: any) {
    console.error('[Receipt Cache] Serve error:', err);
    return res.status(500).json({ error: 'Failed to serve cached receipt' });
  }
});

// 4. Stream ZIP of Receipts
app.post('/api/receipts/zip', (req, res) => {
  try {
    const { month, targets } = req.body;
    if (!Array.isArray(targets) || targets.length === 0) {
      return res.status(400).json({ error: 'targets must be a non-empty array' });
    }

    const zip = new JSZip();
    const folder = zip.folder("receipts");
    const dateStr = new Date().toISOString().split('T')[0];

    let count = 0;
    for (const t of targets) {
      const cacheKey = getReceiptCacheKey(t.id, month);
      const filePath = path.join(RECEIPT_CACHE_DIR, cacheKey);

      if (fs.existsSync(filePath)) {
        const fileBuffer = fs.readFileSync(filePath);
        const cleanName = (t.name || 'Tenant').replace(/\s+/g, '_');
        const invNum = t.invoiceNum || t.id.slice(-5);
        const fileNameInZip = `${cleanName}-${dateStr}-${invNum}.png`;
        folder?.file(fileNameInZip, fileBuffer);
        count++;
      }
    }

    if (count === 0) {
      return res.status(404).json({ error: 'No cached receipts found for ZIP' });
    }

    const zipName = `Rentflo_Receipts_${dateStr}.zip`;
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${zipName}"`);

    const nodeStream = zip.generateNodeStream({ type: 'nodebuffer', streamFiles: true });
    nodeStream.pipe(res);
  } catch (err: any) {
    console.error('[Receipt Cache] ZIP stream error:', err);
    return res.status(500).json({ error: 'Failed to stream ZIP' });
  }
});

// Initialize Gemini
const apiKey = process.env.GEMINI_API_KEY;
let ai: GoogleGenAI | null = null;

if (apiKey) {
  try {
    ai = new GoogleGenAI({
      apiKey: apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
    console.log('[Rentflo AI] Gemini AI client initialized successfully.');
  } catch (err) {
    console.error('[Rentflo AI] Failed to initialize Gemini client:', err);
  }
} else {
  console.warn('[Rentflo AI] GEMINI_API_KEY environment variable is not defined.');
}

// Chat API endpoint
app.post('/api/chat', async (req, res) => {
  const { message, tenants, properties, history } = req.body;

  if (!message) {
    return res.status(400).json({ error: 'Message is required' });
  }

  if (!ai) {
    return res.json({
      error: 'AI_KEY_MISSING',
      text: "I am currently running in offline administrative mode because the Gemini API Key is not configured. I can still assist you with local rule-based lookups!"
    });
  }

  try {
    const systemInstruction = `You are Aurelia, the elite artificial intelligence concierge of Rentflo (formerly Artha), an elite billing and property management system.
You are given the live data of properties, tenants, and bill/payment history:
- Properties: ${JSON.stringify(properties || [])}
- Tenants: ${JSON.stringify(tenants || [])}
- Billing & Payment History: ${JSON.stringify(history || [])}

The user is an admin or manager inquiring about current balances, payments, meter readings, analytics, or tenant accounts.
Analyze the provided live data to answer their query with extreme precision, professional poise, and elegant concierge-style language.
Provide actual calculations. For example, if they ask about total revenue, sum up the rent/fees and utilities. If they ask about outstanding balances, sum them up.

If the user asks to see, view, print, or show a receipt/statement for a specific tenant or room, locate that tenant's ID in the data and populate the "receiptTenantId" field in your JSON response. Otherwise, keep "receiptTenantId" as null.

You MUST respond strictly in JSON format matching this schema:
{
  "text": "Your complete, elegantly formulated textual answer...",
  "receiptTenantId": "the tenant's string ID if showing/viewing a receipt was requested, otherwise null"
}`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.5-flash',
      contents: message,
      config: {
        systemInstruction,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            text: { type: Type.STRING, description: "The main text response" },
            receiptTenantId: { type: Type.STRING, description: "Target tenant ID if showing a receipt is requested, or null" }
          },
          required: ["text", "receiptTenantId"]
        }
      }
    });

    const responseText = response.text;
    if (responseText) {
      try {
        const parsed = JSON.parse(responseText.trim());
        return res.json(parsed);
      } catch (parseErr) {
        return res.json({
          text: responseText,
          receiptTenantId: null
        });
      }
    } else {
      throw new Error('Empty response from Gemini');
    }
  } catch (err: any) {
    console.error('[Rentflo AI] Chat API error:', err);
    res.status(500).json({ error: 'Internal AI error', message: err.message });
  }
});

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Rentflo Full-Stack Server running on http://localhost:${PORT}`);
  });
}

startServer();
