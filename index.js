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

    // Grab the first article container
    const container = $('div.bg-white.flex.gap-6.w-full.shrink.justify-between').first();
    if (!container.length) {
      console.warn(`${now} – selector not found`);
      return;
    }

    // Within that, find the first <a> that has a title attribute (the real article link)
    const anchor = container.find('a[title]').first();
    if (!anchor.length) {
      console.warn(`${now} – no <a[title]> in top container`);
      return;
    }

    const href  = anchor.attr('href');
    const title = anchor.attr('title').trim();
    if (!href) {
      console.warn(`${now} – <a> has no href`);
      return;
    }

    // Normalize to absolute URL
    const absoluteLink = href.startsWith('http')
      ? href
      : `https://www.coindesk.com${href}`;

    // Detect change (or first run)
    if (lastSeenLink === null || absoluteLink !== lastSeenLink) {
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
pollPage();  // immediate first check
intervalId = setInterval(pollPage, POLL_INTERVAL_MS);
