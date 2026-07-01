import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type } from '@google/genai';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

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
