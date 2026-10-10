import express from 'express';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';
import dotenv from 'dotenv';
import JSZip from 'jszip';

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '50mb' }));

// Private Local Storage Folder Setup (Local-Only Architecture)
const LOCAL_APP_DIR = path.join(process.cwd(), '.rentflo_data');
const SUBDIRS = ['tenants', 'properties', 'readings', 'payments', 'receipts', 'backups'];

function initLocalPrivateFolder() {
  if (!fs.existsSync(LOCAL_APP_DIR)) {
    fs.mkdirSync(LOCAL_APP_DIR, { recursive: true });
  }
  for (const sub of SUBDIRS) {
    const subPath = path.join(LOCAL_APP_DIR, sub);
    if (!fs.existsSync(subPath)) {
      fs.mkdirSync(subPath, { recursive: true });
    }
  }
}
initLocalPrivateFolder();

// Receipts subfolder mapping
const RECEIPT_CACHE_DIR = path.join(LOCAL_APP_DIR, 'receipts');

function getReceiptCacheKey(tenantId: string, month?: string): string {
  const cleanMonth = (month || 'CURRENT_CYCLE').replace(/[^a-zA-Z0-9_-]/g, '_');
  const cleanId = (tenantId || 'default').replace(/[^a-zA-Z0-9_-]/g, '_');
  return `${cleanId}_${cleanMonth}.png`;
}

// Local Storage Status Endpoint
app.get('/api/local-storage/status', async (req, res) => {
  try {
    initLocalPrivateFolder();
    const stats: Record<string, number> = {};
    for (const sub of SUBDIRS) {
      const subPath = path.join(LOCAL_APP_DIR, sub);
      const files = fs.existsSync(subPath) ? fs.readdirSync(subPath) : [];
      stats[sub] = files.length;
    }
    const dbFile = path.join(LOCAL_APP_DIR, 'app_db.json');
    const hasDbFile = fs.existsSync(dbFile);
    const dbSize = hasDbFile ? fs.statSync(dbFile).size : 0;

    return res.json({
      success: true,
      localOnly: true,
      folderPath: '.rentflo_data/',
      stats,
      dbSize,
      lastUpdated: hasDbFile ? fs.statSync(dbFile).mtimeMs : Date.now()
    });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to read local storage status', message: err.message });
  }
});

// Save Data directly into Local Private App Folder with Overwrite Protection & Atomic Write
app.post('/api/local-storage/save', async (req, res) => {
  try {
    initLocalPrivateFolder();
    const { data, forceOverwriteEmpty } = req.body;
    if (!data) return res.status(400).json({ error: 'Missing data payload' });

    const now = Date.now();
    data._timestamp = data._timestamp || now;
    data._lastSavedAt = now;

    const dbFilePath = path.join(LOCAL_APP_DIR, 'app_db.json');
    const backupDbFilePath = path.join(LOCAL_APP_DIR, 'app_db_backup.json');
    const tmpFilePath = path.join(LOCAL_APP_DIR, `app_db_${Date.now()}_${Math.random().toString(36).substring(7)}.tmp`);

    const incomingProps = Array.isArray(data.properties) ? data.properties.length : 0;
    const incomingTenants = Array.isArray(data.tenants) ? data.tenants.length : 0;

    // Order 4: Overwrite Protection - Never replace real saved data with empty data
    if (fs.existsSync(dbFilePath)) {
      try {
        const existingRaw = await fs.promises.readFile(dbFilePath, 'utf-8');
        const existingData = JSON.parse(existingRaw);
        const existingProps = Array.isArray(existingData.properties) ? existingData.properties.length : 0;
        const existingTenants = Array.isArray(existingData.tenants) ? existingData.tenants.length : 0;

        if ((existingProps > 0 || existingTenants > 0) && (incomingProps === 0 && incomingTenants === 0) && !forceOverwriteEmpty) {
          console.warn('[Local Storage] OVERWRITE PROTECTED: Rejected empty payload from overwriting existing database with', existingProps, 'properties and', existingTenants, 'tenants.');
          return res.status(200).json({ 
            success: false, 
            preventedOverwrite: true, 
            message: 'Existing data preserved. Empty payload was rejected.' 
          });
        }

        // Keep rolling backup of the good existing file
        if (existingProps > 0 || existingTenants > 0) {
          await fs.promises.writeFile(backupDbFilePath, existingRaw);
        }
      } catch (checkErr) {
        console.warn('[Local Storage] Check existing file error:', checkErr);
      }
    }

    // Atomic write to prevent partial/truncated files
    await fs.promises.writeFile(tmpFilePath, JSON.stringify(data, null, 2));
    await fs.promises.rename(tmpFilePath, dbFilePath);

    // 2. Write itemized files into subfolders for fast indexing & memory-efficient reads
    if (Array.isArray(data.tenants)) {
      for (const t of data.tenants) {
        if (t.id) {
          await fs.promises.writeFile(
            path.join(LOCAL_APP_DIR, 'tenants', `${t.id}.json`),
            JSON.stringify(t, null, 2)
          );
        }
      }
    }

    if (Array.isArray(data.properties)) {
      for (const p of data.properties) {
        if (p.id) {
          await fs.promises.writeFile(
            path.join(LOCAL_APP_DIR, 'properties', `${p.id}.json`),
            JSON.stringify(p, null, 2)
          );
        }
      }
    }

    if (Array.isArray(data.history)) {
      for (const h of data.history) {
        if (h.id) {
          await fs.promises.writeFile(
            path.join(LOCAL_APP_DIR, 'payments', `${h.id}.json`),
            JSON.stringify(h, null, 2)
          );
        }
      }
    }

    return res.json({ success: true, savedAt: now, timestamp: data._timestamp });
  } catch (err: any) {
    console.error('[Local Storage] Save error:', err);
    return res.status(500).json({ error: 'Failed to save to local folder', message: err.message });
  }
});

// Load Data directly from Local Private App Folder with Automatic Recovery
app.get('/api/local-storage/load', async (req, res) => {
  try {
    initLocalPrivateFolder();
    const dbFilePath = path.join(LOCAL_APP_DIR, 'app_db.json');
    const backupDbFilePath = path.join(LOCAL_APP_DIR, 'app_db_backup.json');

    let parsed: any = null;
    let statMtime = Date.now();

    if (fs.existsSync(dbFilePath)) {
      const content = await fs.promises.readFile(dbFilePath, 'utf-8');
      try {
        parsed = JSON.parse(content);
        const stat = fs.statSync(dbFilePath);
        statMtime = stat.mtimeMs;
      } catch (e) {
        console.warn('[Local Storage] Corrupt app_db.json encountered during load:', e);
      }
    }

    const hasData = parsed && ((parsed.properties?.length || 0) > 0 || (parsed.tenants?.length || 0) > 0);

    // If master db file is empty or missing, recover from backup file or itemized records
    if (!hasData) {
      if (fs.existsSync(backupDbFilePath)) {
        try {
          const bContent = await fs.promises.readFile(backupDbFilePath, 'utf-8');
          const bParsed = JSON.parse(bContent);
          if ((bParsed.properties?.length || 0) > 0 || (bParsed.tenants?.length || 0) > 0) {
            console.log('[Local Storage] Recovered data from app_db_backup.json');
            parsed = bParsed;
            await fs.promises.writeFile(dbFilePath, JSON.stringify(parsed, null, 2));
          }
        } catch {}
      }

      // Check itemized tenant and property folders
      if (!parsed || ((parsed.properties?.length || 0) === 0 && (parsed.tenants?.length || 0) === 0)) {
        try {
          const propDir = path.join(LOCAL_APP_DIR, 'properties');
          const tenantDir = path.join(LOCAL_APP_DIR, 'tenants');
          const paymentsDir = path.join(LOCAL_APP_DIR, 'payments');

          const propFiles = fs.existsSync(propDir) ? fs.readdirSync(propDir).filter(f => f.endsWith('.json')) : [];
          const tenantFiles = fs.existsSync(tenantDir) ? fs.readdirSync(tenantDir).filter(f => f.endsWith('.json')) : [];
          const paymentFiles = fs.existsSync(paymentsDir) ? fs.readdirSync(paymentsDir).filter(f => f.endsWith('.json')) : [];

          if (propFiles.length > 0 || tenantFiles.length > 0) {
            const recoveredProps = propFiles.map(f => JSON.parse(fs.readFileSync(path.join(propDir, f), 'utf-8')));
            const recoveredTenants = tenantFiles.map(f => JSON.parse(fs.readFileSync(path.join(tenantDir, f), 'utf-8')));
            const recoveredPayments = paymentFiles.map(f => JSON.parse(fs.readFileSync(path.join(paymentsDir, f), 'utf-8')));

            parsed = {
              properties: recoveredProps,
              tenants: recoveredTenants,
              history: recoveredPayments,
              activeMonth: parsed?.activeMonth || '',
              calendarSystem: parsed?.calendarSystem || 'AD',
              _timestamp: Date.now(),
              _lastSavedAt: Date.now()
            };

            await fs.promises.writeFile(dbFilePath, JSON.stringify(parsed, null, 2));
            console.log(`[Local Storage] Assembled and recovered ${recoveredTenants.length} tenants and ${recoveredProps.length} properties from disk subfolders.`);
          }
        } catch (itemizedErr) {
          console.warn('[Local Storage] Subfolder recovery error:', itemizedErr);
        }
      }
    }

    if (parsed) {
      if (!parsed._timestamp && !parsed._lastSavedAt) {
        parsed._timestamp = statMtime;
        parsed._lastSavedAt = statMtime;
      }
      return res.json({ success: true, data: parsed, lastUpdated: statMtime });
    }

    return res.json({ success: true, data: null });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to load local folder data', message: err.message });
  }
});

// Export entire private local folder as a ZIP archive
app.get('/api/local-storage/export-folder', async (req, res) => {
  try {
    initLocalPrivateFolder();
    const zip = new JSZip();

    async function addFolderToZip(dirPath: string, zipFolder: JSZip) {
      const files = fs.readdirSync(dirPath);
      for (const file of files) {
        const fullPath = path.join(dirPath, file);
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) {
          const subZip = zipFolder.folder(file);
          if (subZip) await addFolderToZip(fullPath, subZip);
        } else {
          const content = fs.readFileSync(fullPath);
          zipFolder.file(file, content);
        }
      }
    }

    await addFolderToZip(LOCAL_APP_DIR, zip);

    const dateStr = new Date().toISOString().split('T')[0];
    const zipName = `Rentflo_Local_Folder_Backup_${dateStr}.zip`;

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${zipName}"`);

    const nodeStream = zip.generateNodeStream({ type: 'nodebuffer', streamFiles: true });
    nodeStream.pipe(res);
  } catch (err: any) {
    console.error('[Local Storage] Folder export failed:', err);
    return res.status(500).json({ error: 'Failed to export local folder', message: err.message });
  }
});

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
