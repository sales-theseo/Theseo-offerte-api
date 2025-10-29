import chromium from '@sparticuz/chromium';
import puppeteer from 'puppeteer-core';

export const config = { runtime: 'nodejs' };

function setCors(res){
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition');
}
function readJson(req){
  return new Promise(resolve=>{
    if (req.body && typeof req.body === 'object') return resolve(req.body);
    let d=''; req.on('data',c=>d+=c);
    req.on('end',()=>{ try{ resolve(JSON.parse(d||'{}')); } catch{ resolve({}); }});
    req.on('error',()=>resolve({}));
  });
}

export default async function handler(req,res){
  const t0 = Date.now();
  try{
    if(req.method==='OPTIONS'){ setCors(res); return res.status(204).end(); }
    if(req.method!=='POST'){ setCors(res); return res.status(405).send('Method Not Allowed'); }

    const { payload } = await readJson(req);
    if(!payload){ setCors(res); return res.status(400).send('Bad Request: missing payload'); }

    // diag: ?diag=1
    if((req.url||'').includes('diag=1')){
      setCors(res);
      return res.status(200).json({
        diag:true,
        info:{ node:process.version, platform:process.platform, arch:process.arch,
               chromiumHeadless: chromium.headless ? 'new':'old' },
        execPath: await chromium.executablePath()
      });
    }

    // Sparticuz: geen extra LIB paden zetten; binary is self-contained.
    chromium.setHeadlessMode = true;
    chromium.setGraphicsMode = false;

    const browser = await puppeteer.launch({
      executablePath: await chromium.executablePath(),
      headless: chromium.headless,
      args: [
        ...chromium.args,
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--font-render-hinting=medium'
      ],
      defaultViewport: { width: 1123, height: 794, deviceScaleFactor: 2 }
    });

    const html = buildHTML(payload);
    const page = await browser.newPage();
    await page.emulateMediaType('screen');
    await page.setContent(html, { waitUntil: ['domcontentloaded','networkidle0'] });
    const pdf = await page.pdf({
      format:'A4', printBackground:true, preferCSSPageSize:true,
      margin:{ top:0, right:0, bottom:0, left:0 }
    });
    await browser.close();

    const today = new Date().toLocaleDateString('nl-NL').replace(/\//g,'-');
    setCors(res);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=theseo-offerte-${today}.pdf`);
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).send(pdf);

  }catch(e){
    console.error('[theseo] FATAL', e?.stack || e);
    setCors(res);
    res.setHeader('Content-Type','text/plain; charset=utf-8');
    return res.status(500).send('PDF error: ' + (e?.message || String(e)));
  }
}

/* --- HTML --- */
function buildHTML(data){
  const { contact={}, totals={}, lines=[] } = data;
  const rows = (lines.length?lines:[['(geen regels geselecteerd)','']])
    .map(([l,r])=>`<tr><td class="col-l">${esc(l||'')}</td><td class="col-r">${esc(r||'')}</td></tr>`).join('');
  const logo="https://ek68sppdjsi.exactdn.com/wp-content/uploads/2025/06/THESEAO_LOGO_FIXED-1024x552.png?strip=all&lossy=1&sharp=1&ssl=1";
  const today=new Date().toLocaleDateString('nl-NL');
  return `<!doctype html><html lang="nl"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Offerte – TheSEO</title>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;800&display=swap" rel="stylesheet">
<style>
:root{--bg:#080A0E;--text:#fff;--muted:#AFC3DE;--grid:#2D3750;--brand:#1652F0;--radius:16px;}
*{box-sizing:border-box} html,body{margin:0;background:var(--bg);color:var(--text);font-family:Inter,system-ui,Segoe UI,Roboto,Helvetica,Arial,sans-serif}
.page{width:794px;min-height:1123px;padding:36px 42px;position:relative;}
header{display:flex;align-items:center;justify-content:space-between;margin-bottom:18px;}
.logo img{height:36px;display:block}
.pill{border:1px solid rgba(255,255,255,.9);border-radius:999px;padding:8px 16px;font-weight:800;letter-spacing:.6px;}
.date{margin-top:6px;font-size:12px;color:#EAF0FF}
.card{border-radius:var(--radius);background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.28);padding:16px 18px;}
.contact{margin-top:14px;display:grid;grid-template-columns:1fr 1fr;gap:10px;font-size:13px}
.contact small{display:block;color:var(--muted);text-transform:uppercase;font-weight:800;letter-spacing:.4px;margin-bottom:4px;font-size:11px}
table.spec{width:100%;border-collapse:separate;border-spacing:0;margin-top:18px;font-size:13px;overflow:hidden;border-radius:var(--radius);border:1px solid var(--grid);}
.spec thead th{background:var(--brand);color:#fff;text-align:left;padding:12px 14px;font-weight:800;}
.spec td{padding:11px 14px;border-top:1px solid var(--grid);}
.spec td.col-r{text-align:right;width:160px}
.spec tr:nth-child(odd) td{background:rgba(255,255,255,0.03)}
.spec tr td + td{border-left:1px solid var(--grid)}
.totals{margin-top:18px;display:grid;grid-template-columns:repeat(3,1fr);gap:12px;}
.chip{border-radius:var(--radius);background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.28);padding:14px 16px;}
.chip small{display:block;color:var(--muted);text-transform:uppercase;letter-spacing:.4px;font-weight:800;margin-bottom:6px;font-size:11px}
@page{size:A4;margin:0;}
</style></head><body><div class="page">
<header><div class="logo"><img src="${logo}" alt="theseo"></div><div class="pill">OFFERTE</div></header>
<div class="date">datum ${today}</div>
<section class="card" style="margin-top:12px;">
  <div style="font-weight:800;letter-spacing:.3px;margin-bottom:6px;">theseo</div>
  <div class="contact">
    <div><small>voornaam</small><strong>${esc(contact.firstName||'-')}</strong></div>
    <div><small>achternaam</small><strong>${esc(contact.lastName||'-')}</strong></div>
    <div><small>bedrijfsnaam</small><strong>${esc(contact.company||'-')}</strong></div>
    <div><small>email</small><strong>${esc(contact.email||'-')}</strong></div>
  </div>
</section>
<section style="margin-top:14px;">
  <table class="spec"><thead><tr><th>omschrijving</th><th style="text-align:right">bedrag</th></tr></thead>
  <tbody>${rows}</tbody></table>
</section>
<section class="totals">
  <div class="chip"><small>maandelijks</small><strong>${esc(totals.monthly||'€0')}</strong></div>
  <div class="chip"><small>eenmalig</small><strong>${esc(totals.onetime||'€0')}</strong></div>
  <div class="chip"><small>totaal eerste maand</small><strong>${esc(totals.grand||'€0')}</strong></div>
</section>
</div></body></html>`;
}
function esc(s){ return String(s).replace(/[&<>"']/g, m=>({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[m])); }
