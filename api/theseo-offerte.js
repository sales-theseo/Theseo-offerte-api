// api/theseo-offerte.js
import chromium from '@sparticuz/chromium';
import puppeteer from 'puppeteer-core';

export const config = { runtime: 'nodejs' };

function setCors(res){
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition');
}

async function readJsonBody(req){
  if (req.body && typeof req.body === 'object' && Object.keys(req.body).length) return req.body;
  return new Promise((resolve) => {
    let data = '';
    req.on('data', c => { data += c; });
    req.on('end', () => { try { resolve(JSON.parse(data||'{}')); } catch { resolve({}); } });
    req.on('error', () => resolve({}));
  });
}

export default async function handler(req, res){
  try{
    if (req.method === 'OPTIONS'){ setCors(res); return res.status(204).end(); }
    if (req.method !== 'POST'){ setCors(res); return res.status(405).send('Method Not Allowed'); }

    const body = await readJsonBody(req);
    const { payload } = body || {};
    if (!payload){ setCors(res); return res.status(400).send('Bad Request: missing payload'); }

    const html = buildHTML(payload);

    // ===== DEBUG INFO in headers =====
    res.setHeader('X-Chromium-Version', chromium?.chromiumVersion || 'unknown');
    res.setHeader('X-Chromium-Revision', chromium?.revision || 'unknown');

    let pdf;
    try {
      pdf = await renderPDF(html);
    } catch (e) {
      console.error('[theseo-offerte] renderPDF failed:', e?.stack || e);
      setCors(res);
      // >>> Stuur de volledige fout terug om te kunnen debuggen (tijdelijk)
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      return res.status(500).send('PDF error: ' + (e?.stack || e));
    }

    const today = new Date().toLocaleDateString('nl-NL').replace(/\//g,'-');
    const buf = Buffer.isBuffer(pdf) ? pdf : Buffer.from(pdf);

    setCors(res);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=theseo-offerte-${today}.pdf`);
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Content-Length', Buffer.byteLength(buf));
    return res.status(200).end(buf);
  }catch(e){
    console.error('[theseo-offerte] top-level error:', e?.stack || e);
    setCors(res);
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    return res.status(500).send('PDF error: ' + (e?.stack || e));
  }
}

function buildHTML(data){
  const { contact = {}, totals = {}, lines = [] } = data;
  const rows = (lines.length ? lines : [['(geen regels geselecteerd)','']])
    .map(([l,r])=>`<tr><td class="l">${escapeHtml(l||'')}</td><td class="r">${escapeHtml(r||'')}</td></tr>`).join('');
  const today= new Date().toLocaleDateString('nl-NL');

  return `<!doctype html><html lang="nl"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Offerte – TheSEO</title>
<style>
  :root{--bg:#0B0F16;--brand:#1652F0;--grid:#2D3750;--text:#fff;}
  *{box-sizing:border-box} html,body{margin:0;background:var(--bg);color:var(--text);font:14px/1.45 -apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Helvetica,Arial;}
  .page{width:794px;min-height:1123px;padding:36px 42px}
  h1{margin:0 0 6px;font-size:18px;letter-spacing:.3px}
  .date{opacity:.9;font-size:12px;margin:8px 0 16px}
  .card{border:1px solid rgba(255,255,255,.25);border-radius:16px;background:rgba(255,255,255,.06);padding:16px 18px;margin-bottom:14px}
  .grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}
  .label{font-weight:700;opacity:.8;text-transform:uppercase;font-size:11px;margin-bottom:3px}
  table{width:100%;border-collapse:separate;border-spacing:0;border:1px solid var(--grid);border-radius:16px;overflow:hidden}
  thead th{background:var(--brand);color:#fff;text-align:left;padding:10px 12px;font-weight:800}
  td{padding:10px 12px;border-top:1px solid var(--grid)}
  td.r{text-align:right;width:160px;border-left:1px solid var(--grid)}
  tbody tr:nth-child(odd) td{background:rgba(255,255,255,.03)}
  .totals{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-top:14px}
  .chip{border:1px solid rgba(255,255,255,.25);border-radius:16px;background:rgba(255,255,255,.06);padding:12px 14px}
  .chip .label{margin:0 0 6px}
  .fine{font-size:11px;opacity:.8;margin-top:18px}
</style></head>
<body><div class="page">
  <h1>theseo — offerte</h1>
  <div class="date">datum ${today}</div>
  <div class="card"><div class="grid">
    <div><div class="label">voornaam</div>${escapeHtml(contact.firstName||'-')}</div>
    <div><div class="label">achternaam</div>${escapeHtml(contact.lastName||'-')}</div>
    <div><div class="label">bedrijfsnaam</div>${escapeHtml(contact.company||'-')}</div>
    <div><div class="label">email</div>${escapeHtml(contact.email||'-')}</div>
  </div></div>
  <table><thead><tr><th>omschrijving</th><th class="r">bedrag</th></tr></thead><tbody>${rows}</tbody></table>
  <div class="totals">
    <div class="chip"><div class="label">maandelijks</div><div>${escapeHtml(totals.monthly||'€0')}</div></div>
    <div class="chip"><div class="label">eenmalig</div><div>${escapeHtml(totals.onetime||'€0')}</div></div>
    <div class="chip"><div class="label">totaal eerste maand</div><div>${escapeHtml(totals.grand||'€0')}</div></div>
  </div>
  <div class="fine">alle bedragen exclusief btw. indicatie op basis van de geselecteerde opties</div>
</div></body></html>`;
}

function escapeHtml(s){
  return String(s).replace(/[&<>"']/g, m=>({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[m]));
}

async function renderPDF(html){
  chromium.setHeadlessMode = true;
  chromium.setGraphicsMode = false;

  const execPath = typeof chromium.executablePath === 'function'
    ? await chromium.executablePath()
    : await chromium.executablePath;

  console.log('[theseo-offerte] execPath:', execPath);

  const browser = await puppeteer.launch({
    args: [
      ...chromium.args,
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--single-process',
      '--font-render-hinting=medium'
    ],
    defaultViewport: chromium.defaultViewport || { width: 1123, height: 794, deviceScaleFactor: 2 },
    executablePath: execPath,
    headless: chromium.headless
  });

  try{
    const page = await browser.newPage();
    await page.emulateMediaType('screen');
    await page.goto('data:text/html;charset=utf-8,' + encodeURIComponent(html), { waitUntil: ['load','networkidle0'] });
    return await page.pdf({ format:'A4', printBackground:true, margin:{top:0,right:0,bottom:0,left:0}, preferCSSPageSize:true });
  } finally {
    await browser.close();
  }
}
