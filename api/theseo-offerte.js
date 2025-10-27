// api/theseo-offerte.js
// Serverless PDF generator for Vercel (Node.js runtime, NOT Edge)
// Requires package.json deps EXACTLY:
//   "@sparticuz/chromium": "126.0.0"
//   "puppeteer-core": "22.6.5"

import chromium from '@sparticuz/chromium';
import puppeteer from 'puppeteer-core';

export const config = { runtime: 'nodejs' };

/* ----------------------------- HTTP HANDLER ----------------------------- */

function setCors(res){
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition');
}

async function readJsonBody(req){
  // Works for both Vercel serverless and plain Node streams
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

    const { payload } = await readJsonBody(req);
    if (!payload){ setCors(res); return res.status(400).send('Bad Request: missing payload'); }

    const html = buildHTML(payload);
    const pdfBuffer = await renderPDF(html);

    const today = new Date().toLocaleDateString('nl-NL').replace(/\//g,'-');
    setCors(res);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=theseo-offerte-${today}.pdf`);
    res.setHeader('Cache-Control', 'no-store');

    return res.status(200).send(pdfBuffer);
  }catch(e){
    console.error('PDF error', e);
    setCors(res);
    return res.status(500).send(String(e?.stack || e?.message || e));
  }
}

/* ------------------------------ PDF RENDER ------------------------------ */

async function renderPDF(html){
  // Ensure Sparticuz runs correctly on Vercel
  chromium.setHeadlessMode = true;
  chromium.setGraphicsMode = false;

  const executablePath = await chromium.executablePath(); // MUST be called as a function

  const browser = await puppeteer.launch({
    executablePath,
    headless: chromium.headless,
    defaultViewport: chromium.defaultViewport || { width: 1123, height: 794, deviceScaleFactor: 2 },
    args: [
      ...chromium.args,
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--single-process'
    ]
  });

  try{
    const page = await browser.newPage();
    await page.emulateMediaType('screen');
    await page.setContent(html, { waitUntil: ['domcontentloaded','networkidle0'] });
    return await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: 0, right: 0, bottom: 0, left: 0 },
      preferCSSPageSize: true
    });
  } finally {
    await browser.close();
  }
}

/* ------------------------------- TEMPLATE ------------------------------- */

function buildHTML(data){
  const { contact = {}, totals = {}, lines = [] } = data;

  const rows = (lines.length ? lines : [['(geen regels geselecteerd)','']])
    .map(([l,r])=>`
      <tr>
        <td class="col-l">${escapeHtml(l||'')}</td>
        <td class="col-r">${escapeHtml(r||'')}</td>
      </tr>`).join('');

  const logo = "https://ek68sppdjsi.exactdn.com/wp-content/uploads/2025/06/THESEAO_LOGO_FIXED-1024x552.png?strip=all&lossy=1&sharp=1&ssl=1";
  const today= new Date().toLocaleDateString('nl-NL');

  return `<!DOCTYPE html>
<html lang="nl">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Offerte – TheSEO</title>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;800&display=swap" rel="stylesheet">
<style>
  :root{
    --bg:#0A0F17;
    --panel:#121A26;
    --panel2:#0F1622;
    --text:#FFFFFF;
    --muted:#AFC3DE;
    --grid:#2D3750;
    --brand:#1652F0;
    --accent:#7EF529;
    --radius:16px;
  }
  *{box-sizing:border-box}
  html,body{margin:0;padding:0;background:var(--bg);color:var(--text);font-family:Inter,system-ui,Segoe UI,Roboto,Helvetica,Arial,sans-serif}
  .page{width:794px;min-height:1123px;padding:36px 42px;position:relative;}

  /* header */
  header{display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;}
  .logo img{height:38px;width:auto;display:block;image-rendering:-webkit-optimize-contrast;}
  .pill{border:1px solid rgba(255,255,255,.9);border-radius:999px;padding:8px 16px;font-weight:800;letter-spacing:.6px}
  .date{margin-top:6px;font-size:12px;color:#EAF0FF}

  /* contact card */
  .card{border-radius:var(--radius);background:linear-gradient(180deg,var(--panel),var(--panel2));border:1px solid rgba(255,255,255,0.2);padding:16px 18px;box-shadow:inset 0 1px 0 rgba(255,255,255,0.06)}
  .card .title{font-weight:800;letter-spacing:.3px;margin-bottom:8px}
  .contact{margin-top:6px;display:grid;grid-template-columns:1fr 1fr;gap:12px;font-size:13px}
  .contact small{display:block;color:var(--muted);text-transform:uppercase;font-weight:800;letter-spacing:.4px;margin-bottom:4px;font-size:11px}
  .contact strong{color:#fff}

  /* table */
  table.spec{width:100%;border-collapse:separate;border-spacing:0;margin-top:16px;font-size:13px;overflow:hidden;border-radius:var(--radius);border:1px solid var(--grid)}
  .spec thead th{background:var(--brand);color:#fff;text-align:left;padding:12px 14px;font-weight:800;letter-spacing:.2px}
  .spec td{padding:12px 14px;border-top:1px solid var(--grid)}
  .spec td.col-l{width:auto}
  .spec td.col-r{width:180px;text-align:right}
  .spec tr:nth-child(odd) td{background:rgba(255,255,255,0.03)}
  .spec tr td + td{border-left:1px solid var(--grid)}

  /* totals */
  .totals{margin-top:18px;display:grid;grid-template-columns:repeat(3,1fr);gap:12px}
  .chip{border-radius:var(--radius);background:linear-gradient(180deg,var(--panel),var(--panel2));border:1px solid rgba(255,255,255,0.2);padding:14px 16px}
  .chip small{display:block;color:var(--muted);text-transform:uppercase;letter-spacing:.4px;font-weight:800;margin-bottom:6px;font-size:11px}
  .chip strong{font-size:16px;color:#fff}

  /* footer */
  .footer{margin-top:22px}
  .brand-note{border-radius:var(--radius);background:linear-gradient(180deg,var(--panel),var(--panel2));border:1px solid rgba(255,255,255,0.2);padding:14px 16px;display:flex;justify-content:space-between;align-items:center}
  .fine{margin-top:10px;font-size:11px;color:var(--muted)}

  @page{size:A4;margin:0}
  @media print {.page{width:auto;min-height:auto;padding:28px 32px}}
</style>
</head>
<body>
  <div class="page">
    <header>
      <div class="logo"><img src="${logo}" alt="theseo"></div>
      <div class="pill">OFFERTE</div>
    </header>
    <div class="date">datum ${today}</div>

    <section class="card" style="margin-top:12px;">
      <div class="title">theseo</div>
      <div class="contact">
        <div><small>voornaam</small><strong>${escapeHtml(contact.firstName||'-')}</strong></div>
        <div><small>achternaam</small><strong>${escapeHtml(contact.lastName||'-')}</strong></div>
        <div><small>bedrijfsnaam</small><strong>${escapeHtml(contact.company||'-')}</strong></div>
        <div><small>email</small><strong>${escapeHtml(contact.email||'-')}</strong></div>
      </div>
    </section>

    <section style="margin-top:14px;">
      <table class="spec">
        <thead><tr><th>omschrijving</th><th style="text-align:right">bedrag</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </section>

    <section class="totals">
      <div class="chip"><small>maandelijks</small><strong>${escapeHtml(totals.monthly||'€0')}</strong></div>
      <div class="chip"><small>eenmalig</small><strong>${escapeHtml(totals.onetime||'€0')}</strong></div>
      <div class="chip"><small>totaal eerste maand</small><strong>${escapeHtml(totals.grand||'€0')}</strong></div>
    </section>

    <section class="footer">
      <div class="brand-note">
        <div style="font-weight:800">Vragen? Neem contact op.</div>
        <div style="font-size:12px;color:#EAF0FF">E-mail: sales@theseo.nl · Web: theseo.nl</div>
      </div>
      <div class="fine">alle bedragen exclusief btw. indicatie op basis van de geselecteerde opties</div>
    </section>
  </div>
</body>
</html>`;
}

function escapeHtml(s){
  return String(s).replace(/[&<>"']/g, m=>({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[m]));
}
