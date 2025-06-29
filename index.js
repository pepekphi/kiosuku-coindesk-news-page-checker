const axios = require('axios');
const cheerio = require('cheerio');

const POLL_INTERVAL_MS = 2000;
const URL = 'https://www.coindesk.com/latest-crypto-news';

// How many bytes to pull at most when we do GET
const MAX_BYTES = 32 * 1024; // 32 KiB

let lastSeenAge = null;
let lastSeenLink = null;
let intervalId;

async function pollPage() {
  const now = new Date().toISOString();
  try {
    // 1) HEAD to check cache age
    const head = await axios.head(URL, { timeout: 3000 });
    const age  = parseInt(head.headers.age || '0', 10);

    if (lastSeenAge !== null && age >= lastSeenAge) {
      // nothing new at the edge cache yet
      console.log(`${now} – HEAD age ${age}, no change`);
      lastSeenAge = age;
      return;
    }

    console.log(`${now} – HEAD age ${age}, fetching top ${MAX_BYTES} bytes…`);
    lastSeenAge = age;

    // 2) GET only the first MAX_BYTES bytes via Range
    const resp = await axios.get(URL, {
      headers: { Range: `bytes=0-${MAX_BYTES - 1}` },
      timeout: 5000,
      responseType: 'arraybuffer',    // so we get raw bytes
      validateStatus: s => s === 206 || s === 200
    });

    // 3) Convert buffer → string and parse
    const htmlChunk = resp.data.toString('utf8');
    const $         = cheerio.load(htmlChunk);

    // 4) Extract the top article link & title
    const container = $('div.bg-white.flex.gap-6.w-full.shrink.justify-between').first();
    if (!container.length) {
      console.warn(`${now} – selector not found in first ${MAX_BYTES} bytes`);
      return;
    }

    const anchor = container.find('a[title]').first();
    const href   = anchor.attr('href');
    const title  = anchor.attr('title')?.trim();

    if (!href || !title) {
      console.warn(`${now} – incomplete <a[title]> in chunk`);
      return;
    }

    const absoluteLink = href.startsWith('http')
      ? href
      : `https://www.coindesk.com${href}`;

    // 5) Detect and log only on change
    if (absoluteLink !== lastSeenLink) {
      lastSeenLink = absoluteLink;
      console.log(`${now} → New top article:`);
      console.log(`    Title: ${title}`);
      console.log(`    Link : ${absoluteLink}`);
    } else {
      console.log(`${now} – top article still ${title}`);
    }

  } catch (err) {
    if (err.response && err.response.status === 429) {
      console.warn(`${now} – rate limited (429), stopping poll`);
      clearInterval(intervalId);
    } else {
      console.error(`${now} – error:`, err.message);
    }
  }
}

console.log(`Starting optimized poller every ${POLL_INTERVAL_MS} ms`);
pollPage();  // immediate first run
intervalId = setInterval(pollPage, POLL_INTERVAL_MS);
