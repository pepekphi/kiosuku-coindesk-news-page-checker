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

    // 1) Select the top article's <a> inside that div.bg-white.flex…
    const topAnchor = $('div.bg-white.flex.gap-6.w-full.shrink.justify-between')
      .find('a').first();

    const link = topAnchor.attr('href');
    const title = topAnchor.find('title, h2, h3').text().trim()  
      || topAnchor.text().trim();

    if (!link) {
      console.warn(`${now} – could not find top article selector`);
      return;
    }

    // 2) Normalize to absolute URL
    const absoluteLink = link.startsWith('http')
      ? link
      : `https://www.coindesk.com${link}`;

    // 3) Compare & log only on change
    if (absoluteLink !== lastSeenLink) {
      lastSeenLink = absoluteLink;
      console.log(`${now} → New top article:`);
      console.log(`    Title: ${title}`);
      console.log(`    Link : ${absoluteLink}`);
    } else {
      console.log(`${now} – no change`);
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
