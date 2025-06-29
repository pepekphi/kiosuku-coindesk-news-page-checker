const axios = require('axios');
const cheerio = require('cheerio');

const POLL_INTERVAL_MS = 2000;
const URL = 'https://www.coindesk.com/latest-crypto-news';

let lastSeenLink = null;
let intervalId;

async function pollPage() {
  const now = new Date().toISOString();
  try {
    const resp = await axios.get(URL, { timeout: 5000 });
    const $ = cheerio.load(resp.data);

    // 1) Grab the first "bg-white flex gap-6 w-full shrink justify-between" block
    const container = $('div.bg-white.flex.gap-6.w-full.shrink.justify-between').first();
    if (!container.length) {
      console.warn(`${now} – selector not found`);
      return;
    }

    // 2) Within that block, grab the first <a>
    const anchor = container.find('a').first();
    const href   = anchor.attr('href');
    const title  = anchor.text().trim();

    if (!href) {
      console.warn(`${now} – no <a> href in top container`);
      return;
    }

    // 3) Normalize to absolute URL
    const absoluteLink = href.startsWith('http')
      ? href
      : `https://www.coindesk.com${href}`;

    // 4) Log on change
    if (absoluteLink !== lastSeenLink) {
      lastSeenLink = absoluteLink;
      console.log(`${now} → New top article detected:`);
      console.log(`    Title : ${title}`);
      console.log(`    Link  : ${absoluteLink}`);
    } else {
      console.log(`${now} – no change (still ${absoluteLink})`);
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

console.log(`Starting page poller every ${POLL_INTERVAL_MS} ms`);
intervalId = setInterval(pollPage, POLL_INTERVAL_MS);
