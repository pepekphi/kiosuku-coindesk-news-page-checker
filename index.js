const axios = require('axios');
const cheerio = require('cheerio');

const POLL_INTERVAL_MS = 2000;
const URL = 'https://www.coindesk.com/latest-crypto-news';
const MAX_BYTES = 28 * 1024; // only fetch first 32 KiB of HTML

let lastSeenAge = null;
let lastSeenLink = null;
let intervalId;

async function pollPage() {
  const now = new Date().toISOString();

  try {
    // 1) HEAD to check edge-cache age
    const head = await axios.head(URL, { timeout: 3000 });
    const age  = parseInt(head.headers.age || '0', 10);

    // 2) Skip GET if cache age hasn't dropped
    if (lastSeenAge !== null && age >= lastSeenAge) {
      console.log(`${now} – HEAD age ${age}, no change`);
      lastSeenAge = age;
      return;
    }
    console.log(`${now} – HEAD age ${age}, fetching first ${MAX_BYTES} bytes…`);
    lastSeenAge = age;

    // 3) GET only the first MAX_BYTES via Range
    const resp = await axios.get(URL, {
      headers: { Range: `bytes=0-${MAX_BYTES - 1}` },
      timeout: 5000,
      responseType: 'arraybuffer',
      validateStatus: s => s === 206 || s === 200
    });

    // 4) Convert chunk and parse
    const htmlChunk = resp.data.toString('utf8');
    const $         = cheerio.load(htmlChunk);

    // 5) Locate top article via its H2 headline
    const container = $('div.bg-white.flex.gap-6.w-full.shrink.justify-between').first();
    const headline  = container.find('h2.font-headline-xs').first();
    if (!headline.length) {
      console.warn(`${now} – no <h2.font-headline-xs> in first ${MAX_BYTES} bytes`);
      return;
    }

    // 6) Grab its parent <a> for URL, text for title
    const anchor = headline.closest('a');
    const href   = anchor.attr('href');
    const title  = headline.text().trim();
    if (!href) {
      console.warn(`${now} – headline’s <a> has no href`);
      return;
    }

    // 7) Normalize link
    const absoluteLink = href.startsWith('http')
      ? href
      : `https://www.coindesk.com${href}`;

    // 8) Detect & log only on change
    if (lastSeenLink === null || absoluteLink !== lastSeenLink) {
      lastSeenLink = absoluteLink;
      console.log(`${now} → New top article detected:`);
      console.log(`    Title : ${title}`);
      console.log(`    Link  : ${absoluteLink}`);
    } else {
      console.log(`${now} – no change (still ${title})`);
    }

  } catch (err) {
    if (err.response && err.response.status === 429) {
      console.warn(`${now} – rate limited (429) – stopping poll`);
      clearInterval(intervalId);
    } else {
      console.error(`${now} – error:`, err.message);
    }
  }
}

console.log(`Starting optimized poller every ${POLL_INTERVAL_MS} ms`);
pollPage(); // run immediately
intervalId = setInterval(pollPage, POLL_INTERVAL_MS);
