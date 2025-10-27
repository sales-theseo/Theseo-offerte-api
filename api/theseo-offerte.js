// api/theseo-offerte.js
import chromium from '@sparticuz/chromium';
import puppeteer from 'puppeteer-core';

function setCors(res){
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition');
}

async function readJson(req){
  if (req.body && typeof req.body === 'object') return req.body;
  return new Promise((resolve) => {
    let data=''; req.on('data', c=>data+=c);
    req.on('end', ()=>{ try{ resolve(JSON.parse(data||'{}')); } catch{ resolve({}); } });
    req.on('error', ()=>resolve({}));
  });
}

export default async function handler(req, res){
  try{
    if (req.method === 'OPTIONS'){ setCors(res); return res.status(204).end(); }
    if (req.method !== 'POST'){ setCors(res); return res.status(405).send('Method Not Allowed'); }

    const { payload } = await readJson(req);
    if (!payload){ setCors(res); return res.status(400).send('Bad Request: missing payload'); }

    const html = buildHTML(payload);
    const pdf = await renderPDF(html);

    const today = new Date().toLocaleDateString('nl-NL').replace(/\//g,'-');
    setCors(res);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=theseo-offerte-${today}.pdf`);
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).send(pdf);
  }catch(e){
    console.error('PDF error:', e);
    setCors(res);
    return res.status(500).send('PDF error');
  }
}

/* ===== HTML (compact, netjes) ===== */
function buildHTML(data){
  const { contact={}, totals={}, lines=[] } = data;
  const rows = (lines.length?lines:[['(geen regels geselecteerd)','']])
    .map(([l,r])=>`<tr><td class="col-l">${esc(l||'')}</td><td class="col-r">${esc(r||'')}</td></tr>`).join('');
  const logo = "https://ek68sppdjsi.exactdn.com/wp-content/uploads/2025/06/THESEAO_LOGO_FIXED-1024x552.png?strip=all&lossy=1&sharp=1&ssl=1";
  const brand= "#1652F0"; const grid="#2D3750"; const bg="#080A0E"; const today=new Date().toLocaleDateString('nl-NL');
  return `<!doctype html><html lang="nl"><head>
<meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;800&display=swap" rel="stylesheet">
<style>
:root{--bg:${bg};--text:#fff;--muted:#AFC3DE;--grid:${grid};--brand:${brand};--r:16px}
*{box-sizing:border-box}html,body{margin:0;background:var(--bg);color:var(--text);font-family:Inter,system-ui,Segoe UI,Roboto,Helvetica,Arial,sans-serif}
.page{width:794px;min-height:1123px;padding:36px 42px}
header{display:flex;align-items:center;justify-content:space-between}
.logo img{height:36px;width:auto;display:block}
.pill{border:1px solid #fff;border-radius:999px;padding:8px 16px;font-weight:800;letter-spacing:.6px}
.date{margin:10px 0 12px;font-size:12px;color:#EAF0FF}
.card,.chip,.note{border-radius:var(--r);background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.28)}
.card{padding:16px 18px}
.contact{margin-top:12px;display:grid;grid-template-columns:1fr 1fr;gap:10px;font-size:13px}
.contact small{display:block;color:var(--muted);text-transform:uppercase;font-weight:800;margin-bottom:4px;font-size:11px}
table{width:100%;border-collapse:separate;border-spacing:0;margin-top:16px;font-size:13px;border-radius:var(--r);overflow:hidden;border:1px solid var(--grid)}
thead th{background:var(--brand);color:#fff;text-align:left;padding:12px 14px;font-weight:800}
td{padding:11px 14px;border-top:1px solid var(--grid)}
td.col-r{text-align:right;width:160px;border-left:1px solid var(--grid)}
tbody tr:nth-child(odd) td{background:rgba(255,255,255,.03)}
.totals{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-top:16px}
.chip{padding:14px 16px}
.chip small{display:block;color:var(--muted);text-transform:uppercase;font-weight:800;margin-bottom:6px;font-size:11px}
.note{margin-top:18px;padding:14px 16px;display:flex;justify-content:space-between;align-items:center}
.fine{margin-top:10px;font-size:11px;color:var(--muted)}
</style></head><body><div class="page">
<header><div class="logo"><img src="${logo}" alt="theseo"></div><div class="pill">OFFERTE</div></header>
<div class="date">datum ${today}</div>
<section class="card"><div style="font-weight:800;margin-bottom:6px">theseo</div>
  <div class="contact">
    <div><small>voornaam</small><strong>${esc(contact.firstName||'-')}</strong></div>
    <div><small>achternaam</small><strong>${esc(contact.lastName||'-')}</strong></div>
    <div><small>bedrijfsnaam</small><strong>${esc(contact.company||'-')}</strong></div>
    <div><small>email</small><strong>${esc(contact.email||'-')}</strong></div>
  </div>
</section>
<table><thead><tr><th>omschrijving</th><th>bedrag</th></tr></thead><tbody>${rows}</tbody></table>
<div class="totals">
  <div class="chip"><small>maandelijks</small><strong>${esc(totals.monthly||'€0')}</strong></div>
  <div class="chip"><small>eenmalig</small><strong>${esc(totals.onetime||'€0')}</strong></div>
  <div class="chip"><small>totaal eerste maand</small><strong>${esc(totals.grand||'€0')}</strong></div>
</div>
<div class="note"><div style="font-weight:800">Vragen? Neem contact op.</div><div style="font-size:12px;color:#EAF0FF">sales@theseo.nl · theseo.nl</div></div>
<div class="fine">alle bedragen exclusief btw. indicatie op basis van de geselecteerde opties</div>
</div></body></html>`;
}
const esc = s => String(s).replace(/[&<>"']/g, m=>({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[m]));

async function renderPDF(html){
  chromium.setHeadlessMode = true;
  chromium.setGraphicsMode = false;

  const execPath = typeof chromium.executablePath === 'function'
    ? await chromium.executablePath()
    : await chromium.executablePath;

  if (!execPath) throw new Error('Chromium executablePath not resolved');

  const browser = await puppeteer.launch({
    args: [...chromium.args, '--no-sandbox', '--disable-setuid-sandbox', '--single-process'],
    defaultViewport: chromium.defaultViewport || { width: 1123, height: 794, deviceScaleFactor: 2 },
    executablePath: execPath,
    headless: chromium.headless
  });

  try{
    const page = await browser.newPage();
    await page.emulateMediaType('screen');
    const dataUrl = 'data:text/html;charset=utf-8,' + encodeURIComponent(html);
    await page.goto(dataUrl, { waitUntil: ['load','networkidle0'] });
    return await page.pdf({ format:'A4', printBackground:true, margin:{top:0,right:0,bottom:0,left:0}, preferCSSPageSize:true });
  } finally { await browser.close(); }
}
