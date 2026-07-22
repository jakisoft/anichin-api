const express = require('express');
const axios = require('axios');
const cors = require('cors');
const morgan = require('morgan');
const path = require('path');
const fs = require('fs');
const { Resvg } = require('@resvg/resvg-js');
const Anichin = require('./anichin');

const app = express();
app.set('trust proxy', true);
const ani = new Anichin();

// Load local TTF font buffer for Resvg rendering
let fontBuffer = null;
const fontPath = path.join(__dirname, 'public', 'fonts', 'PlusJakartaSans-Bold.ttf');
if (fs.existsSync(fontPath)) {
  try {
    fontBuffer = fs.readFileSync(fontPath);
  } catch (e) {
    console.warn('Failed to load local font TTF:', e.message);
  }
}

// Helper to construct secure absolute URL for OpenGraph tags
function getBaseUrl(req) {
  const host = req.get('host') || 'localhost:3000';
  let proto = req.headers['x-forwarded-proto'] || req.protocol || 'https';
  if (host.includes('.run.app') || host.includes('.studio') || host.includes('anichin')) {
    proto = 'https';
  }
  return `${proto}://${host}`;
}

app.use(cors());
app.use(morgan('dev'));
app.set('json spaces', 2);

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));

// Favicon routes
app.get(['/favicon.ico', '/favicon.svg'], (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'favicon.svg'));
});

// Helper function to escape XML characters for SVG
const escapeXml = (unsafe) => String(unsafe || '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&apos;');

// Helper function to wrap text into array of strings for SVG multi-line rendering
function wrapText(text, maxChars = 28, maxLines = 3) {
  if (!text) return [];
  const words = String(text).trim().split(/\s+/);
  const lines = [];
  let current = '';

  for (const word of words) {
    if ((current + ' ' + word).trim().length <= maxChars) {
      current = (current + ' ' + word).trim();
    } else {
      if (current) lines.push(current);
      current = word;
      if (lines.length >= maxLines) break;
    }
  }
  if (current && lines.length < maxLines) {
    lines.push(current);
  }
  if (lines.length === maxLines && words.length > 0) {
    const totalJoined = lines.join(' ');
    if (totalJoined.length < String(text).length) {
      lines[lines.length - 1] = lines[lines.length - 1].replace(/\.?\s*$/, '...');
    }
  }
  return lines;
}

// Dynamic OpenGraph Banner Generator Endpoint (Outputs real PNG for WhatsApp / Social Media)
app.get(['/api/og', '/api/og.png', '/og.png', '/og-image'], async (req, res) => {
  try {
    const type = (req.query.type || '').toLowerCase();
    const title = (req.query.title || 'Anichin Donghua Stream').slice(0, 100);
    const ep = (req.query.ep || req.query.chapter || '3D Donghua Subtitle Indonesia').slice(0, 50);
    const desc = (req.query.desc || req.query.synopsis || req.query.description || '').slice(0, 220);
    let imgUrl = req.query.img || req.query.thumb || req.query.poster || '';
    const status = (req.query.status || 'Sub Indo').slice(0, 30);
    const studio = (req.query.studio || '').slice(0, 40);
    const icon = (req.query.icon || 'play').toLowerCase();

    if (imgUrl.startsWith('//')) {
      imgUrl = 'https:' + imgUrl;
    }

    const safeTitle = escapeXml(title);
    const safeEp = escapeXml(ep);
    const safeDesc = escapeXml(desc);
    const safeStatus = escapeXml(status);
    const safeStudio = escapeXml(studio);

    // Fetch poster image to Base64 if image URL is provided
    let posterBase64 = null;
    if (imgUrl && imgUrl.startsWith('http')) {
      try {
        const imgRes = await axios.get(imgUrl, {
          responseType: 'arraybuffer',
          timeout: 4000,
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
            'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
            'Referer': 'https://anichin.vip/'
          }
        });
        const contentType = imgRes.headers['content-type'] || 'image/jpeg';
        posterBase64 = `data:${contentType};base64,${Buffer.from(imgRes.data).toString('base64')}`;
      } catch (e) {
        console.warn('OG Poster Image Fetch Warning (fallback to styled graphic):', e.message);
      }
    }

    const isDetailOrWatch = (type === 'detail' || type === 'watch' || posterBase64 || (imgUrl && imgUrl.length > 5));

    let svg = '';

    if (isDetailOrWatch) {
      // DETAIL / WATCH EPISODE PAGE OPENGRAPH TEMPLATE
      const titleLines = wrapText(safeTitle, 26, 2);
      const descLines = wrapText(safeDesc || 'Nonton streaming Donghua 3D Subtitle Indonesia gratis kualitas HD jernih di Anichin Stream.', 44, 3);

      const headerBadgeText = type === 'watch' ? 'WATCH PLAYER • 1080P HD' : 'DETAIL SERIAL DONGHUA';
      const headerBadgeBg = type === 'watch' ? '#ff6f61' : '#b9fbc0';
      const headerBadgeColor = type === 'watch' ? '#ffffff' : '#1e1e1e';

      svg = `
      <svg width="1200" height="630" viewBox="0 0 1200 630" fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <style>
            .font-main { font-family: sans-serif, Arial, Helvetica; }
            .brand { font-family: sans-serif, Arial, Helvetica; font-weight: 900; font-size: 28px; fill: #1e1e1e; }
            .title { font-family: sans-serif, Arial, Helvetica; font-weight: 900; font-size: 34px; fill: #1e1e1e; }
            .meta { font-family: sans-serif, Arial, Helvetica; font-weight: 800; font-size: 15px; fill: #1e1e1e; }
            .synopsis-title { font-family: sans-serif, Arial, Helvetica; font-weight: 900; font-size: 14px; fill: #ff6f61; letter-spacing: 1.5px; }
            .synopsis-text { font-family: sans-serif, Arial, Helvetica; font-weight: 700; font-size: 18px; fill: #1e1e1e; }
            .badge-text { font-family: sans-serif, Arial, Helvetica; font-weight: 900; font-size: 16px; fill: #1e1e1e; }
            .footer-text { font-family: sans-serif, Arial, Helvetica; font-weight: 800; font-size: 16px; fill: #757575; }
          </style>
          
          <!-- Poster Clip Path -->
          <clipPath id="posterClip">
            <rect x="64" y="156" width="280" height="410" rx="20"/>
          </clipPath>
        </defs>

        <!-- Background Canvas -->
        <rect width="1200" height="630" fill="#fbf9f4"/>

        <!-- Dot Pattern Background -->
        <pattern id="dots" x="0" y="0" width="24" height="24" patternUnits="userSpaceOnUse">
          <circle cx="2" cy="2" r="1.5" fill="#1e1e1e" opacity="0.10"/>
        </pattern>
        <rect width="1200" height="630" fill="url(#dots)"/>

        <!-- Card Shadow & Border Container -->
        <rect x="40" y="40" width="1120" height="550" rx="32" fill="#1e1e1e"/>
        <rect x="32" y="32" width="1120" height="550" rx="32" fill="#ffffff" stroke="#1e1e1e" stroke-width="8"/>

        <!-- Top Header Bar -->
        <rect x="32" y="32" width="1120" height="96" rx="32" fill="#faae2b"/>
        <rect x="32" y="96" width="1120" height="32" fill="#faae2b"/>
        <line x1="32" y1="128" x2="1152" y2="128" stroke="#1e1e1e" stroke-width="8"/>

        <!-- Brand Logo Header Left -->
        <rect x="64" y="52" width="56" height="56" rx="16" fill="#ffffff" stroke="#1e1e1e" stroke-width="4"/>
        <text x="92" y="90" text-anchor="middle" class="brand">AN</text>
        <text x="136" y="90" class="brand">Anichin Stream</text>

        <!-- Category Badge Header Right -->
        <rect x="820" y="56" width="280" height="48" rx="24" fill="${headerBadgeBg}" stroke="#1e1e1e" stroke-width="4"/>
        <text x="960" y="86" text-anchor="middle" class="badge-text" fill="${headerBadgeColor}">${headerBadgeText}</text>

        <!-- LEFT COLUMN: POSTER FRAME -->
        <!-- Shadow behind poster -->
        <rect x="72" y="164" width="280" height="410" rx="20" fill="#1e1e1e"/>
        <!-- Poster Border / Background -->
        <rect x="64" y="156" width="280" height="410" rx="20" fill="#ff6f61" stroke="#1e1e1e" stroke-width="6"/>

        ${posterBase64 ? `
          <image href="${posterBase64}" x="64" y="156" width="280" height="410" preserveAspectRatio="xMidYMid slice" clip-path="url(#posterClip)"/>
          <rect x="64" y="156" width="280" height="410" rx="20" fill="none" stroke="#1e1e1e" stroke-width="6"/>
        ` : `
          <!-- High-Contrast Poster Card Graphic when image fails -->
          <rect x="64" y="156" width="280" height="410" rx="20" fill="#2d2d2d" stroke="#1e1e1e" stroke-width="6"/>
          <circle cx="204" cy="270" r="48" fill="#ff6f61" stroke="#1e1e1e" stroke-width="5"/>
          <polygon points="192,250 228,270 192,290" fill="#ffffff"/>
          <rect x="80" y="340" width="248" height="50" rx="12" fill="#faae2b" stroke="#1e1e1e" stroke-width="3"/>
          <text x="204" y="372" text-anchor="middle" font-family="sans-serif, Arial" font-weight="900" font-size="18" fill="#1e1e1e">3D DONGHUA HD</text>
        `}

        <!-- Overlay Tag Pill on Bottom of Poster -->
        <rect x="76" y="508" width="256" height="42" rx="21" fill="#faae2b" stroke="#1e1e1e" stroke-width="4"/>
        <text x="204" y="535" text-anchor="middle" class="badge-text">${safeEp}</text>

        <!-- RIGHT COLUMN: CONTENT & METADATA -->
        <!-- Status & Studio Badges -->
        <rect x="372" y="160" width="160" height="38" rx="19" fill="#b9fbc0" stroke="#1e1e1e" stroke-width="3"/>
        <text x="452" y="185" text-anchor="middle" class="meta">${safeStatus}</text>

        <rect x="548" y="160" width="220" height="38" rx="19" fill="#e8aeff" stroke="#1e1e1e" stroke-width="3"/>
        <text x="658" y="185" text-anchor="middle" class="meta">${safeStudio || 'Anichin 3D'}</text>

        <!-- Title Lines (Explicit Y coordinates for SVG text baselines) -->
        ${titleLines[0] ? `<text x="372" y="242" class="title">${titleLines[0]}</text>` : ''}
        ${titleLines[1] ? `<text x="372" y="282" class="title">${titleLines[1]}</text>` : ''}

        <!-- Synopsis / Details Box -->
        <rect x="372" y="315" width="730" height="165" rx="20" fill="#f5f3ef" stroke="#1e1e1e" stroke-width="4"/>
        <text x="394" y="345" class="synopsis-title">SINOPSIS / DETAILED INFO:</text>
        ${descLines[0] ? `<text x="394" y="378" class="synopsis-text">${descLines[0]}</text>` : ''}
        ${descLines[1] ? `<text x="394" y="408" class="synopsis-text">${descLines[1]}</text>` : ''}
        ${descLines[2] ? `<text x="394" y="438" class="synopsis-text">${descLines[2]}</text>` : ''}

        <!-- Action / Quality Footer Tag -->
        <rect x="372" y="508" width="440" height="42" rx="21" fill="#a0c4ff" stroke="#1e1e1e" stroke-width="4"/>
        <text x="592" y="535" text-anchor="middle" class="badge-text">● STREAMING SUB INDO FULL HD</text>

        <!-- Footer Watermark Right -->
        <text x="1112" y="536" text-anchor="end" class="footer-text">anichin.stream</text>
      </svg>
      `;
    } else {
      // GENERAL PAGE OPENGRAPH TEMPLATE (Home, Schedule, Developer, Search, Genres, Bookmarks, History, 404, etc.)
      const titleLines = wrapText(safeTitle, 28, 2);
      const descLines = wrapText(safeDesc || 'Platform streaming Donghua 3D Subtitle Indonesia terlengkap dengan pemutar video jernih, filter genre, dan update setiap hari.', 42, 3);

      let cardBg = '#faae2b';
      let headerCategory = 'OFFICIAL PLATFORM';

      if (icon === 'schedule') { cardBg = '#ff6f61'; headerCategory = 'JADWAL RILIS HARIAN'; }
      else if (icon === 'developer') { cardBg = '#e8aeff'; headerCategory = 'REST API DEVELOPER'; }
      else if (icon === 'search') { cardBg = '#a0c4ff'; headerCategory = 'PENCARIAN DONGHUA'; }
      else if (icon === 'genres' || icon === 'grid') { cardBg = '#b9fbc0'; headerCategory = 'KATEGORI GENRE 3D'; }
      else if (icon === 'popular') { cardBg = '#faae2b'; headerCategory = 'POPULER & RATING TINGGI'; }
      else if (icon === 'bookmarks') { cardBg = '#ffb7b2'; headerCategory = 'FAVORIT SAYA'; }
      else if (icon === 'history') { cardBg = '#a0c4ff'; headerCategory = 'RIWAYAT NONTON'; }
      else if (icon === '404') { cardBg = '#ff6f61'; headerCategory = '404 NOT FOUND'; }

      svg = `
      <svg width="1200" height="630" viewBox="0 0 1200 630" fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <style>
            .brand { font-family: sans-serif, Arial, Helvetica; font-weight: 900; font-size: 28px; fill: #1e1e1e; }
            .title { font-family: sans-serif, Arial, Helvetica; font-weight: 900; font-size: 38px; fill: #1e1e1e; }
            .badge-text { font-family: sans-serif, Arial, Helvetica; font-weight: 900; font-size: 16px; fill: #1e1e1e; }
            .desc-text { font-family: sans-serif, Arial, Helvetica; font-weight: 700; font-size: 20px; fill: #1e1e1e; }
            .chip-text { font-family: sans-serif, Arial, Helvetica; font-weight: 900; font-size: 14px; fill: #1e1e1e; }
            .footer-text { font-family: sans-serif, Arial, Helvetica; font-weight: 800; font-size: 16px; fill: #757575; }
          </style>
        </defs>

        <!-- Background Canvas -->
        <rect width="1200" height="630" fill="#fbf9f4"/>

        <!-- Dot Pattern Background -->
        <pattern id="dots" x="0" y="0" width="24" height="24" patternUnits="userSpaceOnUse">
          <circle cx="2" cy="2" r="1.5" fill="#1e1e1e" opacity="0.10"/>
        </pattern>
        <rect width="1200" height="630" fill="url(#dots)"/>

        <!-- Card Shadow & Border Container -->
        <rect x="40" y="40" width="1120" height="550" rx="32" fill="#1e1e1e"/>
        <rect x="32" y="32" width="1120" height="550" rx="32" fill="#ffffff" stroke="#1e1e1e" stroke-width="8"/>

        <!-- Top Header Bar -->
        <rect x="32" y="32" width="1120" height="96" rx="32" fill="#faae2b"/>
        <rect x="32" y="96" width="1120" height="32" fill="#faae2b"/>
        <line x1="32" y1="128" x2="1152" y2="128" stroke="#1e1e1e" stroke-width="8"/>

        <!-- Brand Logo Header Left -->
        <rect x="64" y="52" width="56" height="56" rx="16" fill="#ffffff" stroke="#1e1e1e" stroke-width="4"/>
        <text x="92" y="90" text-anchor="middle" class="brand">AN</text>
        <text x="136" y="90" class="brand">Anichin Stream</text>

        <!-- Category Badge Header Right -->
        <rect x="800" y="56" width="300" height="48" rx="24" fill="#b9fbc0" stroke="#1e1e1e" stroke-width="4"/>
        <text x="950" y="86" text-anchor="middle" class="badge-text">${headerCategory}</text>

        <!-- LEFT COLUMN: DYNAMIC ILLUSTRATION GRAPHIC CARD -->
        <rect x="72" y="164" width="320" height="410" rx="24" fill="#1e1e1e"/>
        <rect x="64" y="156" width="320" height="410" rx="24" fill="${cardBg}" stroke="#1e1e1e" stroke-width="6"/>

        ${icon === 'schedule' ? `
          <!-- Calendar Vector Graphic -->
          <rect x="114" y="210" width="220" height="240" rx="20" fill="#ffffff" stroke="#1e1e1e" stroke-width="6"/>
          <rect x="114" y="210" width="220" height="60" rx="20" fill="#ff6f61"/>
          <line x1="114" y1="270" x2="334" y2="270" stroke="#1e1e1e" stroke-width="6"/>
          <!-- Calendar Grid Dots -->
          <circle cx="154" cy="310" r="10" fill="#1e1e1e"/>
          <circle cx="194" cy="310" r="10" fill="#1e1e1e"/>
          <circle cx="234" cy="310" r="10" fill="#1e1e1e"/>
          <circle cx="274" cy="310" r="10" fill="#ff6f61"/>
          <circle cx="154" cy="350" r="10" fill="#1e1e1e"/>
          <circle cx="194" cy="350" r="10" fill="#faae2b"/>
          <circle cx="234" cy="350" r="10" fill="#1e1e1e"/>
          <circle cx="274" cy="350" r="10" fill="#1e1e1e"/>
          <circle cx="154" cy="390" r="10" fill="#1e1e1e"/>
          <circle cx="194" cy="390" r="10" fill="#1e1e1e"/>
          <circle cx="234" cy="390" r="10" fill="#b9fbc0"/>
          <circle cx="274" cy="390" r="10" fill="#1e1e1e"/>
          <!-- Calendar Hooks -->
          <rect x="160" y="190" width="16" height="36" rx="8" fill="#1e1e1e"/>
          <rect x="270" y="190" width="16" height="36" rx="8" fill="#1e1e1e"/>
          <text x="224" y="490" text-anchor="middle" font-family="sans-serif, Arial" font-weight="900" font-size="20" fill="#1e1e1e">JADWAL RILIS</text>
        ` : icon === 'developer' ? `
          <!-- Code Terminal Vector Graphic -->
          <rect x="104" y="210" width="240" height="230" rx="20" fill="#1e1e1e"/>
          <rect x="104" y="210" width="240" height="40" rx="20" fill="#757575"/>
          <circle cx="128" cy="230" r="6" fill="#ff6f61"/>
          <circle cx="148" cy="230" r="6" fill="#faae2b"/>
          <circle cx="168" cy="230" r="6" fill="#b9fbc0"/>
          <!-- Code Lines -->
          <text x="124" y="280" font-family="monospace" font-weight="800" font-size="18" fill="#b9fbc0">&gt; GET /api/slide</text>
          <text x="124" y="315" font-family="monospace" font-weight="800" font-size="16" fill="#a0c4ff">{</text>
          <text x="144" y="340" font-family="monospace" font-weight="800" font-size="16" fill="#faae2b">"status": true,</text>
          <text x="144" y="365" font-family="monospace" font-weight="800" font-size="16" fill="#ffffff">"data": [...]</text>
          <text x="124" y="390" font-family="monospace" font-weight="800" font-size="16" fill="#a0c4ff">}</text>
          <text x="224" y="490" text-anchor="middle" font-family="sans-serif, Arial" font-weight="900" font-size="20" fill="#1e1e1e">REST API v1</text>
        ` : icon === 'search' ? `
          <!-- Search Glass Vector Graphic -->
          <circle cx="210" cy="300" r="70" fill="#ffffff" stroke="#1e1e1e" stroke-width="8"/>
          <line x1="260" y1="350" x2="320" y2="410" stroke="#1e1e1e" stroke-width="16" stroke-linecap="round"/>
          <circle cx="185" cy="275" r="16" fill="#a0c4ff"/>
          <text x="224" y="490" text-anchor="middle" font-family="sans-serif, Arial" font-weight="900" font-size="20" fill="#1e1e1e">PENCARIAN DONGHUA</text>
        ` : icon === 'genres' || icon === 'grid' ? `
          <!-- Genres Tag Stack -->
          <rect x="100" y="210" width="160" height="48" rx="24" fill="#ffffff" stroke="#1e1e1e" stroke-width="5"/>
          <text x="180" y="240" text-anchor="middle" font-family="sans-serif, Arial" font-weight="800" font-size="16" fill="#1e1e1e"># ACTION 3D</text>

          <rect x="150" y="275" width="180" height="48" rx="24" fill="#ff6f61" stroke="#1e1e1e" stroke-width="5"/>
          <text x="240" y="305" text-anchor="middle" font-family="sans-serif, Arial" font-weight="800" font-size="16" fill="#ffffff"># CULTIVATION</text>

          <rect x="110" y="340" width="170" height="48" rx="24" fill="#faae2b" stroke="#1e1e1e" stroke-width="5"/>
          <text x="195" y="370" text-anchor="middle" font-family="sans-serif, Arial" font-weight="800" font-size="16" fill="#1e1e1e"># FANTASY</text>
          <text x="224" y="490" text-anchor="middle" font-family="sans-serif, Arial" font-weight="900" font-size="20" fill="#1e1e1e">FILTER GENRE</text>
        ` : `
          <!-- Standard Home / Player Vector Graphic -->
          <rect x="104" y="210" width="240" height="200" rx="20" fill="#ffffff" stroke="#1e1e1e" stroke-width="6"/>
          <rect x="104" y="210" width="240" height="40" rx="20" fill="#1e1e1e"/>
          <circle cx="130" cy="230" r="6" fill="#ff6f61"/>
          <circle cx="150" cy="230" r="6" fill="#faae2b"/>
          <circle cx="170" cy="230" r="6" fill="#b9fbc0"/>

          <circle cx="224" cy="320" r="42" fill="#ff6f61" stroke="#1e1e1e" stroke-width="5"/>
          <polygon points="212,300 244,320 212,340" fill="#ffffff"/>
          <text x="224" y="490" text-anchor="middle" font-family="sans-serif, Arial" font-weight="900" font-size="20" fill="#1e1e1e">ANICHIN STREAM</text>
        `}

        <!-- Overlay Tag Pill on Bottom of Graphic -->
        <rect x="76" y="508" width="296" height="42" rx="21" fill="#ffffff" stroke="#1e1e1e" stroke-width="4"/>
        <text x="224" y="535" text-anchor="middle" class="badge-text">${safeEp}</text>

        <!-- RIGHT COLUMN: CONTENT & DETAILS -->
        <!-- Page Title -->
        ${titleLines[0] ? `<text x="420" y="210" class="title">${titleLines[0]}</text>` : ''}
        ${titleLines[1] ? `<text x="420" y="255" class="title">${titleLines[1]}</text>` : ''}

        <!-- Description Box Container -->
        <rect x="420" y="295" width="680" height="180" rx="20" fill="#f5f3ef" stroke="#1e1e1e" stroke-width="4"/>
        ${descLines[0] ? `<text x="444" y="340" class="desc-text">${descLines[0]}</text>` : ''}
        ${descLines[1] ? `<text x="444" y="378" class="desc-text">${descLines[1]}</text>` : ''}
        ${descLines[2] ? `<text x="444" y="416" class="desc-text">${descLines[2]}</text>` : ''}

        <!-- Feature Chips Footer Bar -->
        <rect x="420" y="508" width="180" height="42" rx="21" fill="#faae2b" stroke="#1e1e1e" stroke-width="3"/>
        <text x="510" y="534" text-anchor="middle" class="chip-text">3D DONGHUA HD</text>

        <rect x="615" y="508" width="170" height="42" rx="21" fill="#b9fbc0" stroke="#1e1e1e" stroke-width="3"/>
        <text x="700" y="534" text-anchor="middle" class="chip-text">SUB INDONESIA</text>

        <rect x="800" y="508" width="160" height="42" rx="21" fill="#e8aeff" stroke="#1e1e1e" stroke-width="3"/>
        <text x="880" y="534" text-anchor="middle" class="chip-text">UPDATE HARIAN</text>

        <!-- Footer Watermark Right -->
        <text x="1112" y="536" text-anchor="end" class="footer-text">anichin.stream</text>
      </svg>
      `;
    }

    if (req.query.format === 'svg') {
      res.setHeader('Content-Type', 'image/svg+xml; charset=utf-8');
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Cache-Control', 'public, max-age=86400, s-maxage=86400');
      return res.send(svg.trim());
    }

    const resvgOptions = {
      fitTo: { mode: 'width', value: 1200 }
    };

    if (fontBuffer) {
      resvgOptions.font = {
        fontBuffers: [fontBuffer],
        defaultFontFamily: 'Plus Jakarta Sans',
        loadSystemFonts: false
      };
    } else {
      resvgOptions.font = {
        loadSystemFonts: true,
        defaultFontFamily: 'sans-serif'
      };
    }

    const resvg = new Resvg(svg, resvgOptions);
    const pngData = resvg.render();
    const pngBuffer = pngData.asPng();

    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Content-Length', pngBuffer.length);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'public, max-age=86400, s-maxage=86400');
    return res.end(pngBuffer);
  } catch (err) {
    console.error('OG Image generation error:', err);
    res.status(500).send('Error generating image');
  }
});


// Developer API Documentation page
app.get(['/api/developer', '/developer'], (req, res) => {
  const currentUrl = req.protocol + '://' + req.get('host') + req.originalUrl;
  const ogImage = `${req.protocol}://${req.get('host')}/og.png?title=${encodeURIComponent('Anichin API Developer Hub')}&ep=${encodeURIComponent('Dokumentasi REST API & Console Sandbox')}`;
  const base = req.protocol + '://' + req.get('host');
  res.render('developer', { base, currentUrl, ogImage });
});

// JSON API Routes
app.get(['/api/slide', '/slide/json'], async (req, res) => {
  try {
    const data = await ani.SwipperSlide();
    res.json({ status: true, data });
  } catch (e) {
    res.status(500).json({ status: false, message: e.message });
  }
});

app.get(['/api/popular', '/popular/json'], async (req, res) => {
  try {
    const data = await ani.popular();
    res.json({ status: true, data });
  } catch (e) {
    res.status(500).json({ status: false, message: e.message });
  }
});

app.get(['/api/genres', '/genres/json'], async (req, res) => {
  try {
    const data = await ani.genres();
    res.json({ status: true, data });
  } catch (e) {
    res.status(500).json({ status: false, message: e.message });
  }
});

app.get(['/api/genres/:genre', '/genres/:genre/json'], async (req, res) => {
  try {
    const page = parseInt(req.query.page || '1');
    const data = await ani.genre(req.params.genre, page);
    if (!data || !data.items || data.items.length === 0) {
      return res.status(404).json({ status: false, message: `Genre "${req.params.genre}" tidak ditemukan.` });
    }
    res.json({ status: true, data });
  } catch (e) {
    res.status(500).json({ status: false, message: e.message });
  }
});

app.get(['/api/latest', '/latest/json'], async (req, res) => {
  try {
    const page = parseInt(req.query.page || '1');
    const data = await ani.latest(page);
    res.json({ status: true, data });
  } catch (e) {
    res.status(500).json({ status: false, message: e.message });
  }
});

app.get(['/api/detail/:slug', '/detail/:slug/json'], async (req, res) => {
  try {
    const data = await ani.detail(req.params.slug);
    if (!data || !data.title) {
      return res.status(404).json({ status: false, message: `Serial Donghua "${req.params.slug}" tidak ditemukan.` });
    }
    res.json({ status: true, data });
  } catch (e) {
    res.status(404).json({ status: false, message: `Serial Donghua "${req.params.slug}" tidak ditemukan.` });
  }
});

app.get(['/api/episode/:slug', '/episode/:slug/json'], async (req, res) => {
  try {
    const data = await ani.episode(req.params.slug);
    if (!data || (!data.title && (!data.stream || data.stream.length === 0))) {
      return res.status(404).json({ status: false, message: `Episode "${req.params.slug}" tidak ditemukan.` });
    }
    res.json({ status: true, data });
  } catch (e) {
    res.status(404).json({ status: false, message: `Episode "${req.params.slug}" tidak ditemukan.` });
  }
});

app.get(['/api/search', '/search/json'], async (req, res) => {
  try {
    const q = req.query.q;
    const page = parseInt(req.query.page || '1');
    if (!q) return res.status(400).json({ status: false, message: 'Missing query parameter ?q=' });
    const data = await ani.search(q, page);
    res.json({ status: true, data });
  } catch (e) {
    res.status(500).json({ status: false, message: e.message });
  }
});

app.get(['/api/ongoing', '/ongoing/json'], async (req, res) => {
  try {
    const page = parseInt(req.query.page || '1');
    const data = await ani.ongoing(page);
    res.json({ status: true, data });
  } catch (e) {
    res.status(500).json({ status: false, message: e.message });
  }
});

app.get(['/api/completed', '/completed/json'], async (req, res) => {
  try {
    const page = parseInt(req.query.page || '1');
    const data = await ani.completed(page);
    res.json({ status: true, data });
  } catch (e) {
    res.status(500).json({ status: false, message: e.message });
  }
});

app.get(['/api/schedule', '/schedule/json'], async (req, res) => {
  try {
    const data = await ani.schedule();
    res.json({ status: true, data });
  } catch (e) {
    res.status(500).json({ status: false, message: e.message });
  }
});

// SSR EJS PAGE ROUTES WITH DYNAMIC OPENGRAPH METADATA & CUSTOM 404 HANDLING

// 1. Home Page
app.get('/', async (req, res) => {
  const baseUrl = getBaseUrl(req);
  const currentUrl = baseUrl + req.originalUrl;
  try {
    const [slides, populars, latestRes, genres] = await Promise.all([
      ani.SwipperSlide().catch(() => []),
      ani.popular().catch(() => []),
      ani.latest(1).catch(() => ({ items: [] })),
      ani.genres().catch(() => [])
    ]);

    const ogImage = `${baseUrl}/og.png?type=page&icon=home` +
      `&title=${encodeURIComponent('Anichin Stream — Donghua Subtitle Indonesia')}` +
      `&desc=${encodeURIComponent('Platform streaming Donghua 3D Subtitle Indonesia terlengkap dengan pemutar video jernih, filter genre, dan update setiap hari.')}` +
      `&ep=${encodeURIComponent('Update Episode Terbaru 3D')}`;

    res.render('index', {
      title: 'Anichin Stream — Nonton Donghua Subtitle Indonesia Terlengkap',
      description: 'Platform streaming Donghua 3D Subtitle Indonesia terlengkap dengan pemutar video jernih, filter genre, dan update setiap hari.',
      currentUrl,
      ogImage,
      slides,
      populars,
      latests: latestRes.items || [],
      genres
    });
  } catch (e) {
    res.status(500).send('Gangguan koneksi ke server.');
  }
});

// 2. Detail Series Page
app.get('/detail/:slug', async (req, res) => {
  const slug = req.params.slug;
  const baseUrl = getBaseUrl(req);
  const currentUrl = baseUrl + req.originalUrl;
  const ogImage = `${baseUrl}/og.png?type=page&icon=404` +
    `&title=${encodeURIComponent('Donghua Tidak Ditemukan')}` +
    `&desc=${encodeURIComponent('Serial Donghua yang Anda cari tidak ditemukan di database Anichin Stream.')}` +
    `&ep=${encodeURIComponent('Detail Serial 3D')}`;

  try {
    const detail = await ani.detail(slug);
    if (!detail || !detail.title) {
      return res.status(404).render('not-found', {
        title: 'Donghua Tidak Ditemukan — Anichin Stream',
        description: `Serial Donghua dengan slug "${slug}" tidak ditemukan.`,
        currentUrl,
        ogImage,
        errorType: 'series',
        message: `Maaf, serial Donghua dengan ID/slug "${slug}" tidak ditemukan di database Anichin atau telah dihapus.`
      });
    }

    const title = `${detail.title} — Anichin Stream`;
    const description = (detail.synopsis || `Nonton ${detail.title} Subtitle Indonesia gratis kualitas HD.`).slice(0, 160);
    const studioName = detail.info ? (detail.info.studio || detail.info.studios || 'Anichin 3D') : 'Anichin 3D';
    const statusName = detail.info ? (detail.info.status || 'Ongoing') : 'Ongoing';
    const epCount = detail.info ? (detail.info.episodes || (detail.episodes ? `${detail.episodes.length} Ep` : 'Sub Indo')) : 'Sub Indo';

    const detailOg = `${baseUrl}/og.png?type=detail` +
      `&title=${encodeURIComponent(detail.title)}` +
      `&desc=${encodeURIComponent((detail.synopsis || `Nonton ${detail.title} Subtitle Indonesia gratis kualitas HD.`).slice(0, 160))}` +
      `&img=${encodeURIComponent(detail.thumb || detail.image || '')}` +
      `&status=${encodeURIComponent(statusName)}` +
      `&studio=${encodeURIComponent(studioName)}` +
      `&ep=${encodeURIComponent(epCount)}`;

    // Gather Recommendations (Maksimal 6: Same Studio, First Genre, Same Network)
    const networkName = detail.info ? (detail.info.network || detail.info.networks || '') : '';

    let firstGenreSlug = '';
    let firstGenreName = '';
    if (detail.tags && detail.tags.length > 0) {
      firstGenreName = detail.tags[0].name || '';
      if (detail.tags[0].href) {
        firstGenreSlug = detail.tags[0].href.replace(/\/+$/, '').split('/').pop();
      } else {
        firstGenreSlug = firstGenreName.toLowerCase().replace(/\s+/g, '-');
      }
    }

    const getItemSlug = (item) => {
      if (item.slug) return item.slug;
      if (item.href) {
        return item.href.replace(/\/+$/, '').split('/').pop();
      }
      return '';
    };

    const fetchPromises = [];

    // 1. Studio
    if (studioName && studioName !== '-' && studioName.length > 2) {
      fetchPromises.push(
        ani.search(studioName).then(res => ({
          type: 'studio',
          items: Array.isArray(res) ? res : (res && res.results ? res.results : [])
        })).catch(() => ({ type: 'studio', items: [] }))
      );
    }

    // 2. Genre Pertama
    if (firstGenreSlug) {
      fetchPromises.push(
        ani.genre(firstGenreSlug).then(res => ({
          type: 'genre',
          items: res && res.items ? res.items : []
        })).catch(() => {
          if (firstGenreName) {
            return ani.search(firstGenreName).then(res => ({
              type: 'genre',
              items: Array.isArray(res) ? res : (res && res.results ? res.results : [])
            })).catch(() => ({ type: 'genre', items: [] }));
          }
          return { type: 'genre', items: [] };
        })
      );
    }

    // 3. Network
    if (networkName && networkName !== '-' && networkName.length > 2) {
      fetchPromises.push(
        ani.search(networkName).then(res => ({
          type: 'network',
          items: Array.isArray(res) ? res : (res && res.results ? res.results : [])
        })).catch(() => ({ type: 'network', items: [] }))
      );
    }

    // 4. Popular (fallback)
    fetchPromises.push(
      ani.popular().then(res => ({
        type: 'popular',
        items: Array.isArray(res) ? res : []
      })).catch(() => ({ type: 'popular', items: [] }))
    );

    const fetchedResults = await Promise.all(fetchPromises);

    let studioItems = [];
    let genreItems = [];
    let networkItems = [];
    let popularItems = [];

    fetchedResults.forEach(res => {
      if (res.type === 'studio') studioItems = res.items;
      else if (res.type === 'genre') genreItems = res.items;
      else if (res.type === 'network') networkItems = res.items;
      else if (res.type === 'popular') popularItems = res.items;
    });

    const relatedItems = detail.related || [];

    const recommendations = [];
    const seenSlugs = new Set();
    seenSlugs.add(slug);

    const addItem = (item, badgeLabel, badgeBg) => {
      const itemSlug = getItemSlug(item);
      if (!itemSlug || seenSlugs.has(itemSlug)) return false;
      seenSlugs.add(itemSlug);
      recommendations.push({
        title: item.title,
        slug: itemSlug,
        image: item.image || item.thumb || 'https://via.placeholder.com/300x400',
        ep: item.ep || (item.episodes ? `${item.episodes.length} Ep` : null),
        type: item.type || '3D',
        status: item.status || 'Ongoing',
        badge: badgeLabel,
        badgeBg: badgeBg
      });
      return true;
    };

    // Take up to 2 items from Studio
    let cStudio = 0;
    const cleanStudioLabel = studioName.split(/[\/,]/)[0].trim() || 'Studio';
    for (const item of studioItems) {
      if (cStudio >= 2) break;
      if (addItem(item, `Studio: ${cleanStudioLabel}`, 'bg-saweria-purple text-white')) cStudio++;
    }

    // Take up to 2 items from First Genre
    let cGenre = 0;
    for (const item of genreItems) {
      if (cGenre >= 2) break;
      if (addItem(item, `Genre: ${firstGenreName || 'Sama'}`, 'bg-saweria-coral text-white')) cGenre++;
    }

    // Take up to 2 items from Network
    let cNetwork = 0;
    const cleanNetworkLabel = networkName.split(/[\/,]/)[0].trim() || 'Network';
    for (const item of networkItems) {
      if (cNetwork >= 2) break;
      if (addItem(item, `Network: ${cleanNetworkLabel}`, 'bg-saweria-blue text-white')) cNetwork++;
    }

    // Fill remaining up to 6
    const backupPool = [
      ...studioItems.map(x => ({ item: x, badge: `Studio: ${cleanStudioLabel}`, bg: 'bg-saweria-purple text-white' })),
      ...genreItems.map(x => ({ item: x, badge: `Genre: ${firstGenreName}`, bg: 'bg-saweria-coral text-white' })),
      ...networkItems.map(x => ({ item: x, badge: `Network: ${cleanNetworkLabel}`, bg: 'bg-saweria-blue text-white' })),
      ...relatedItems.map(x => ({ item: x, badge: 'Seri Terkait', bg: 'bg-saweria-green text-saweria-dark' })),
      ...popularItems.map(x => ({ item: x, badge: 'Populer', bg: 'bg-saweria-yellow text-saweria-dark' }))
    ];

    for (const entry of backupPool) {
      if (recommendations.length >= 6) break;
      addItem(entry.item, entry.badge, entry.bg);
    }

    res.render('detail', {
      title,
      description,
      currentUrl,
      ogImage: detailOg,
      slug,
      detail,
      recommendations: recommendations.slice(0, 6)
    });
  } catch (e) {
    res.status(404).render('not-found', {
      title: 'Donghua Tidak Ditemukan — Anichin Stream',
      description: `Gagal memuat detail serial "${slug}".`,
      currentUrl,
      ogImage,
      errorType: 'series',
      message: `Maaf, serial Donghua dengan ID "${slug}" tidak ditemukan atau terjadi gangguan saat menghubungi server sumber.`
    });
  }
});

// 3. Streaming Watch Episode Page
app.get(['/watch/:slug', '/episode/:slug'], async (req, res) => {
  const slug = req.params.slug;
  const baseUrl = getBaseUrl(req);
  const currentUrl = baseUrl + req.originalUrl;
  const ogImage = `${baseUrl}/og.png?type=page&icon=404` +
    `&title=${encodeURIComponent('Episode Tidak Ditemukan')}` +
    `&desc=${encodeURIComponent('Episode yang Anda cari tidak dapat diputar.')}` +
    `&ep=${encodeURIComponent('Pemutar Video')}`;

  try {
    const epData = await ani.episode(slug);
    if (!epData || (!epData.title && (!epData.stream || epData.stream.length === 0))) {
      return res.status(404).render('not-found', {
        title: 'Episode Tidak Ditemukan — Anichin Stream',
        description: `Episode dengan ID "${slug}" tidak dapat diputar.`,
        currentUrl,
        ogImage,
        errorType: 'episode',
        message: `Maaf, episode Donghua dengan ID "${slug}" tidak ditemukan, belum dirilis, atau server pemutar sedang tidak tersedia.`
      });
    }

    let seriesDetail = null;
    let seriesSlug = '';
    let seriesTitle = '';

    if (epData.nav && epData.nav.allEpisodes) {
      seriesSlug = epData.nav.allEpisodes.replace(/\/+$/, '').split('/').pop();
      if (seriesSlug) {
        seriesDetail = await ani.detail(seriesSlug).catch(() => null);
        if (seriesDetail && seriesDetail.title) {
          seriesTitle = seriesDetail.title;
        }
      }
    }

    if (!seriesTitle && epData.title) {
      seriesTitle = epData.title
        .replace(/\s+Episode\s+\d+.*$/i, '')
        .replace(/\s+Subtitle\s+Indonesia.*$/i, '')
        .trim();
    }

    const title = `Nonton ${epData.title || 'Episode'} Subtitle Indonesia — Anichin Stream`;
    const description = `Nonton streaming ${epData.title} Subtitle Indonesia gratis di Anichin Stream dengan pemutar HD.`;

    const watchOg = `${baseUrl}/og.png?type=watch` +
      `&title=${encodeURIComponent(epData.title || 'Nonton Episode')}` +
      `&desc=${encodeURIComponent((seriesDetail?.synopsis || `Nonton streaming ${epData.title || 'Episode'} Subtitle Indonesia gratis di Anichin Stream.`).slice(0, 160))}` +
      `&img=${encodeURIComponent(epData.img || seriesDetail?.thumb || seriesDetail?.image || '')}` +
      `&status=${encodeURIComponent('HD 1080P Sub Indo')}` +
      `&studio=${encodeURIComponent(seriesTitle || 'Anichin Stream')}` +
      `&ep=${encodeURIComponent(epData.episode ? ('Episode ' + epData.episode) : 'Sub Indo')}`;

    res.render('watch', {
      title,
      description,
      currentUrl,
      ogImage: watchOg,
      slug,
      epData,
      seriesDetail,
      seriesTitle,
      seriesSlug
    });
  } catch (e) {
    res.status(404).render('not-found', {
      title: 'Episode Tidak Ditemukan — Anichin Stream',
      description: `Gagal memuat pemutar episode "${slug}".`,
      currentUrl,
      ogImage,
      errorType: 'episode',
      message: `Maaf, episode dengan ID "${slug}" tidak ditemukan atau terjadi kendala pada server pemutar video.`
    });
  }
});

// 4. Popular Page
app.get('/popular', async (req, res) => {
  const baseUrl = getBaseUrl(req);
  const currentUrl = baseUrl + req.originalUrl;
  try {
    const items = await ani.popular();
    const ogImage = `${baseUrl}/og.png?type=page&icon=popular` +
      `&title=${encodeURIComponent('Donghua Populer Subtitle Indonesia')}` +
      `&desc=${encodeURIComponent('Daftar serial Donghua paling populer dengan rating tinggi dan jumlah penonton terbanyak di Anichin Stream.')}` +
      `&ep=${encodeURIComponent('Most Popular 3D')}`;

    res.render('grid', {
      title: 'Donghua Populer Subtitle Indonesia — Anichin Stream',
      description: 'Daftar Donghua paling populer dengan rating tinggi dan penonton terbanyak.',
      currentUrl,
      ogImage,
      pageTitle: 'Donghua Populer',
      items,
      pagination: null,
      currentPage: 1,
      baseUrl: '/popular'
    });
  } catch (e) {
    res.status(500).send('Gagal memuat data populer.');
  }
});

// 5. Latest Releases Page
app.get('/latest', async (req, res) => {
  const page = parseInt(req.query.page || '1');
  const baseUrl = getBaseUrl(req);
  const currentUrl = baseUrl + req.originalUrl;
  try {
    const resData = await ani.latest(page);
    const ogImage = `${baseUrl}/og.png?type=page&icon=sparkles` +
      `&title=${encodeURIComponent('Rilisan Episode Terbaru (Halaman ' + page + ')')}` +
      `&desc=${encodeURIComponent('Episode Donghua terbaru yang baru rilis minggu ini dengan subtitle Bahasa Indonesia jernih.')}` +
      `&ep=${encodeURIComponent('Update Setiap Hari')}`;

    res.render('grid', {
      title: `Rilisan Episode Terbaru (Halaman ${page}) — Anichin Stream`,
      description: 'Episode Donghua terbaru yang baru rilis minggu ini dengan subtitle Bahasa Indonesia.',
      currentUrl,
      ogImage,
      pageTitle: `Rilisan Episode Terbaru (Halaman ${page})`,
      items: resData.items,
      pagination: resData.pagination,
      currentPage: page,
      baseUrl: '/latest'
    });
  } catch (e) {
    res.status(500).send('Gagal memuat data rilis terbaru.');
  }
});

// 6. Ongoing Donghua Page
app.get('/ongoing', async (req, res) => {
  const page = parseInt(req.query.page || '1');
  const baseUrl = getBaseUrl(req);
  const currentUrl = baseUrl + req.originalUrl;
  try {
    const resData = await ani.ongoing(page);
    const ogImage = `${baseUrl}/og.png?type=page&icon=play` +
      `&title=${encodeURIComponent('Ongoing Donghua (Halaman ' + page + ')')}` +
      `&desc=${encodeURIComponent('Koleksi serial Donghua 3D yang sedang aktif tayang episode terbarunya setiap minggu.')}` +
      `&ep=${encodeURIComponent('Sedang Tayang')}`;

    res.render('grid', {
      title: `Ongoing Donghua (Halaman ${page}) — Anichin Stream`,
      description: 'Koleksi serial Donghua yang sedang aktif tayang setiap minggunya.',
      currentUrl,
      ogImage,
      pageTitle: `Ongoing Donghua (Halaman ${page})`,
      items: resData.items,
      pagination: resData.pagination,
      currentPage: page,
      baseUrl: '/ongoing'
    });
  } catch (e) {
    res.status(500).send('Gagal memuat data ongoing.');
  }
});

// 7. Completed Donghua Page
app.get('/completed', async (req, res) => {
  const page = parseInt(req.query.page || '1');
  const baseUrl = getBaseUrl(req);
  const currentUrl = baseUrl + req.originalUrl;
  try {
    const resData = await ani.completed(page);
    const ogImage = `${baseUrl}/og.png?type=page&icon=grid` +
      `&title=${encodeURIComponent('Donghua Tamat (Halaman ' + page + ')')}` +
      `&desc=${encodeURIComponent('Daftar serial Donghua yang sudah selesai rilis hingga episode tamat untuk marathon nonton.')}` +
      `&ep=${encodeURIComponent('Tamat Complete')}`;

    res.render('grid', {
      title: `Donghua Tamat (Halaman ${page}) — Anichin Stream`,
      description: 'Daftar serial Donghua yang sudah selesai rilis hingga episode tamat.',
      currentUrl,
      ogImage,
      pageTitle: `Donghua Tamat (Halaman ${page})`,
      items: resData.items,
      pagination: resData.pagination,
      currentPage: page,
      baseUrl: '/completed'
    });
  } catch (e) {
    res.status(500).send('Gagal memuat data completed.');
  }
});

// 8. Schedule Page
app.get('/schedule', async (req, res) => {
  const baseUrl = getBaseUrl(req);
  const currentUrl = baseUrl + req.originalUrl;
  try {
    const days = await ani.schedule();
    const ogImage = `${baseUrl}/og.png?type=page&icon=schedule` +
      `&title=${encodeURIComponent('Jadwal Rilis Donghua Harian')}` +
      `&desc=${encodeURIComponent('Jadwal tayang harian Donghua 3D terbaru dari Senin sampai Minggu di Anichin Stream.')}` +
      `&ep=${encodeURIComponent('Jadwal Senin - Minggu')}`;

    res.render('schedule', {
      title: 'Jadwal Rilis Donghua Harian — Anichin Stream',
      description: 'Jadwal tayang harian Donghua 3D terbaru dari Senin sampai Minggu.',
      currentUrl,
      ogImage,
      days
    });
  } catch (e) {
    res.status(500).send('Gagal memuat jadwal rilis.');
  }
});

// 9. Genres List Page
app.get('/genres', async (req, res) => {
  const baseUrl = getBaseUrl(req);
  const currentUrl = baseUrl + req.originalUrl;
  try {
    const genres = await ani.genres();
    const ogImage = `${baseUrl}/og.png?type=page&icon=genres` +
      `&title=${encodeURIComponent('Kategori Genre Donghua')}` +
      `&desc=${encodeURIComponent('Temukan Donghua berdasarkan genre Action, Cultivation, Romance, Reincarnation, dan lainnya.')}` +
      `&ep=${encodeURIComponent('Filter Genre')}`;

    res.render('genres', {
      title: 'Kategori Genre Donghua — Anichin Stream',
      description: 'Temukan Donghua berdasarkan genre Action, Cultivation, Romance, Reincarnation, dan lainnya.',
      currentUrl,
      ogImage,
      genres
    });
  } catch (e) {
    res.status(500).send('Gagal memuat daftar genre.');
  }
});

// 10. Specific Genre Page
app.get(['/genres/:genre', '/genre/:genre', '/tag/:genre', '/kategori/:genre'], async (req, res) => {
  const genreSlug = req.params.genre;
  const page = parseInt(req.query.page || '1');
  const baseUrl = getBaseUrl(req);
  const currentUrl = baseUrl + req.originalUrl;
  const ogImage = `${baseUrl}/og.png?type=page&icon=genres` +
    `&title=${encodeURIComponent('Genre ' + genreSlug + ' (Hal ' + page + ')')}` +
    `&desc=${encodeURIComponent('Koleksi Donghua dengan genre ' + genreSlug + ' Subtitle Indonesia.')}` +
    `&ep=${encodeURIComponent('Kategori ' + genreSlug)}`;

  try {
    const resData = await ani.genre(genreSlug, page);
    if (!resData || !resData.items || resData.items.length === 0) {
      return res.status(404).render('not-found', {
        title: `Genre ${genreSlug} Tidak Ditemukan — Anichin Stream`,
        description: `Kategori genre "${genreSlug}" tidak memiliki koleksi Donghua.`,
        currentUrl,
        ogImage,
        errorType: 'genre',
        message: `Kategori genre "${genreSlug}" tidak ditemukan atau belum memiliki koleksi episode Donghua.`
      });
    }

    const genreName = resData.genre || genreSlug;
    res.render('grid', {
      title: `Genre ${genreName} (Halaman ${page}) — Anichin Stream`,
      description: `Koleksi Donghua dengan genre ${genreName} Subtitle Indonesia.`,
      currentUrl,
      ogImage,
      pageTitle: `Genre / Kategori: ${genreName}`,
      genreName,
      genreSlug,
      items: resData.items || [],
      pagination: resData.pagination,
      currentPage: page,
      baseUrl: `/genres/${genreSlug}`
    });
  } catch (e) {
    res.status(404).render('not-found', {
      title: `Genre ${genreSlug} Tidak Ditemukan — Anichin Stream`,
      description: `Gagal memuat genre "${genreSlug}".`,
      currentUrl,
      ogImage,
      errorType: 'genre',
      message: `Kategori genre "${genreSlug}" tidak ditemukan di sistem kami.`
    });
  }
});

// 11. Search Page
app.get('/search', async (req, res) => {
  const q = req.query.q ? req.query.q.trim() : '';
  const page = parseInt(req.query.page || '1');
  const baseUrl = getBaseUrl(req);
  const currentUrl = baseUrl + req.originalUrl;
  const ogImage = `${baseUrl}/og.png?type=page&icon=search` +
    `&title=${encodeURIComponent('Pencarian: ' + (q || 'Donghua'))}` +
    `&desc=${encodeURIComponent('Hasil pencarian judul Donghua ' + (q || '') + ' Subtitle Indonesia.')}` +
    `&ep=${encodeURIComponent('Hasil Cari Anichin')}`;

  try {
    if (!q) {
      return res.render('not-found', {
        title: 'Cari Donghua — Anichin Stream',
        description: 'Silakan masukkan kata kunci judul Donghua yang ingin dicari.',
        currentUrl,
        ogImage,
        errorType: 'search',
        message: 'Silakan masukkan kata kunci judul Donghua pada kolom pencarian di bawah ini.'
      });
    }

    const resData = await ani.search(q, page);
    if (!resData || !resData.results || resData.results.length === 0) {
      return res.status(404).render('not-found', {
        title: `Pencarian "${q}" Tidak Ditemukan — Anichin Stream`,
        description: `Tidak ada Donghua yang cocok dengan kata kunci "${q}".`,
        currentUrl,
        ogImage,
        errorType: 'search',
        message: `Tidak ditemukan hasil pencarian untuk kata kunci "${q}". Coba kata kunci yang lebih spesifik atau singkat.`
      });
    }

    res.render('grid', {
      title: `Pencarian "${q}" (Halaman ${page}) — Anichin Stream`,
      description: `Hasil pencarian judul Donghua "${q}" Subtitle Indonesia.`,
      currentUrl,
      ogImage,
      pageTitle: `Hasil Pencarian: "${q}"`,
      items: resData.results || [],
      pagination: resData.pagination,
      currentPage: page,
      baseUrl: `/search?q=${encodeURIComponent(q)}`
    });
  } catch (e) {
    res.status(404).render('not-found', {
      title: `Pencarian "${q}" Tidak Ditemukan — Anichin Stream`,
      description: `Gagal mencari kata kunci "${q}".`,
      currentUrl,
      ogImage,
      errorType: 'search',
      message: `Terjadi kendala saat mencari "${q}". Silakan coba lagi beberapa saat lagi.`
    });
  }
});

// 12. Bookmarks Page
app.get('/bookmarks', (req, res) => {
  const baseUrl = getBaseUrl(req);
  const currentUrl = baseUrl + req.originalUrl;
  const ogImage = `${baseUrl}/og.png?type=page&icon=bookmarks` +
    `&title=${encodeURIComponent('Favorit Saya — Anichin Stream')}` +
    `&desc=${encodeURIComponent('Daftar serial Donghua favorit yang Anda simpan untuk ditonton kembali.')}` +
    `&ep=${encodeURIComponent('Koleksi Tersimpan')}`;

  res.render('bookmarks', {
    title: 'Favorit Saya — Anichin Stream',
    description: 'Daftar serial Donghua favorit yang Anda simpan.',
    currentUrl,
    ogImage
  });
});

// 13. History Page
app.get('/history', (req, res) => {
  const baseUrl = getBaseUrl(req);
  const currentUrl = baseUrl + req.originalUrl;
  const ogImage = `${baseUrl}/og.png?type=page&icon=history` +
    `&title=${encodeURIComponent('Riwayat Nonton — Anichin Stream')}` +
    `&desc=${encodeURIComponent('Daftar episode Donghua yang pernah Anda tonton sebelumnya.')}` +
    `&ep=${encodeURIComponent('Watch History')}`;

  res.render('history', {
    title: 'Riwayat Nonton — Anichin Stream',
    description: 'Daftar episode Donghua yang pernah Anda tonton.',
    currentUrl,
    ogImage
  });
});

// Catch-all 404 for non-existent pages & invalid URLs
app.use((req, res) => {
  const baseUrl = getBaseUrl(req);
  const currentUrl = baseUrl + req.originalUrl;
  const ogImage = `${baseUrl}/og.png?type=page&icon=404` +
    `&title=${encodeURIComponent('404 Halaman Tidak Ditemukan')}` +
    `&desc=${encodeURIComponent('Halaman yang Anda cari tidak ada, telah dipindahkan, atau link yang dimasukkan tidak valid.')}` +
    `&ep=${encodeURIComponent('Anichin Stream 404')}`;

  if (req.path.startsWith('/api/')) {
    return res.status(404).json({
      status: 404,
      success: false,
      message: `Endpoint API "${req.originalUrl}" tidak ditemukan.`
    });
  }

  res.status(404).render('not-found', {
    title: '404 — Halaman Tidak Ditemukan — Anichin Stream',
    description: 'Halaman yang Anda cari tidak dapat ditemukan.',
    currentUrl,
    ogImage,
    errorType: 'page',
    message: `Waduh! Halaman "${req.originalUrl}" tidak ada, telah dipindahkan, atau link yang Anda masukkan tidak valid.`
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server berjalan di http://0.0.0.0:${PORT}`);
});
