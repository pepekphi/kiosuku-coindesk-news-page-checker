const axios = require('axios');
const cheerio = require('cheerio');

const POLL_INTERVAL_MS = 4000;
const URL = 'https://www.coindesk.com/latest-crypto-news';
const MAX_BYTES = 5 * 1024; // pull only first x KiB

let lastSeenLink = null;
let intervalId;

async function pollPage() {
  const now = new Date().toISOString();
  try {
    // 1) GET only the first MAX_BYTES of the page
    const resp = await axios.get(URL, {
      headers: { Range: `bytes=0-${MAX_BYTES - 1}` },
      timeout: 5000,
      responseType: 'arraybuffer',
      validateStatus: s => s === 206 || s === 200
    });

    // 2) Convert to string and load into Cheerio
    const html = resp.data.toString('utf8');
    const $    = cheerio.load(html);

    // 3) Find the first container and its H2 headline
    const container = $('div.bg-white.flex.gap-6.w-full.shrink.justify-between').first();
    const headline  = container.find('h2.font-headline-xs').first();
    if (!headline.length) {
      console.warn(`${now} – no <h2.font-headline-xs> in first ${MAX_BYTES} bytes`);
      return;
    }

    // 4) Get its parent <a> for the URL
    const anchor = headline.closest('a');
    const href   = anchor.attr('href');
    const title  = headline.text().trim();
    if (!href) {
      console.warn(`${now} – headline’s <a> has no href`);
      return;
    }

    // 5) Normalize to absolute URL
    const absoluteLink = href.startsWith('http')
      ? href
      : `https://www.coindesk.com${href}`;

    // 6) Detect change
    if (lastSeenLink === null || absoluteLink !== lastSeenLink) {
      lastSeenLink = absoluteLink;
      console.log(`${now} → New top article detected:`);
      console.log(`    Title: ${title}`);
      console.log(`    Link : ${absoluteLink}`);
    } else {
      console.log(`${now} – no change (still ${title})`);
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

console.log(`Starting partial‐GET poller every ${POLL_INTERVAL_MS} ms`);
pollPage();  // run once immediately
intervalId = setInterval(pollPage, POLL_INTERVAL_MS);
