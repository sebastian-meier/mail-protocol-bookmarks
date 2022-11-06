require('dotenv').config();
const Imap = require('imap');
const fs = require('fs');
const puppeteer = require("puppeteer");
const allowedSenders = process.env.ALLOWED_SENDERS.split(',');

if (!fs.existsSync('./src')) {
  fs.mkdirSync('./src');
}
if (!fs.existsSync('./src/assets')) {
  fs.mkdirSync('./src/assets');
}
if (!fs.existsSync('./src/assets/screenshots')) {
  fs.mkdirSync('./src/assets/screenshots');
}
if (!fs.existsSync('./src/bookmarks')) {
  fs.mkdirSync('./src/bookmarks');
}

puppeteer
  .launch({
    defaultViewport: {
      width: 1920,
      height: 1080,
    },
  })
  .then(async (browser) => {
    const page = await browser.newPage();
    const imap = await imapConnect();
    await imapOpen(imap);
    const res = await imapSearch(imap);

    if (res && res.length >= 1) {
      const bookmarks = await imapFetch(imap, res);
      for (let b = 0; b < bookmarks.length; b += 1) {
        await page.goto(bookmarks[b].url);
        await page.screenshot({ path: `./src/assets/screenshots/${bookmarks[b].date}.png` });
        const md = `---
title: '${bookmarks[b].subject}'
url: ${bookmarks[b].url}
image: ${bookmarks[b].date}.png
tags: '${bookmarks[b].tags.join(',')}'
description: '${bookmarks[b].description}'
---`;
        fs.writeFileSync(`./src/bookmarks/${bookmarks[b].date}.md`, md, 'utf-8');
      }
    }

    imap.end();
    await page.close();
    await browser.close();
  });
 
const imapConnect = () => {
  return new Promise((resolve, reject) => {
    const imap = new Imap({
      user: process.env.IMAP_USER,
      password: process.env.IMAP_PASSWORD,
      host: process.env.IMAP_SERVER,
      port: 993,
      tls: true
    });

    imap.once('ready', () => {
      resolve(imap);
    });

    imap.once('error', (err) => {
      reject(err);
    });
     
    imap.connect();
  });
};

const imapOpen = (imap) => {
  return new Promise((resolve, reject) => {
    imap.getBoxes((err, boxes) => {
      console.log(boxes);
    });
    imap.openBox('INBOX', true, (err, box) => {
      if (err) {
        reject(err);
      } else {
        resolve(box);
      }
    });
  });
};

const imapSearch = (imap) => {
  return new Promise((resolve, reject) => {
    imap.search([['TO', process.env.BOOKMARK_MAIL]], (err, res) => {
      if (err) {
        reject(err);
      } else {
        resolve(res);
      }
    });
  });
};

const imapFetch = (imap, res) => {
  return new Promise((resolve, reject) => {
    const f = imap.fetch(res, {
      bodies: [
        'HEADER.FIELDS (DKIM-SIGNATURE FROM DATE SUBJECT)',
        '1',
      ],
      struct: true
    });

    const bookmarks = [];

    f.on('message', (msg) => {
      const bookmark = {};
      msg.on('body', (stream, info) => {
        let buffer = '';
        stream.on('data', (chunk) => {
          buffer += chunk.toString('utf8');
        });
        stream.once('end', () => {
          if (parseInt(info.which) !== 1) {
            const els = Imap.parseHeader(buffer);
            Object.keys(els).forEach(key => {
              if (key === 'date') {
                els[key][0] = Date.parse(els[key][0]);
              }
              bookmark[key] = els[key][0];
            });
          } else {
            const message = buffer.split('\r\n').filter((l, li) => (li <= 4 && (li%2 === 0)));
            bookmark.url = message[0];
            bookmark.tags = message[1].split(',').map(t => t.trim());
            bookmark.description = message[2];
          }
        });
      });
      msg.once('end', () => {
        if (allowedSenders.includes(bookmark.from)) {
          bookmarks.push(bookmark);
        }
      });
    });

    f.once('error', (err) => {
      reject(err);
    });

    f.once('end', () => {
      imap.move(res, 'PROCESSED', (err) => {
        if (err) {
          reject(err);
        } else {
          resolve(bookmarks);
        }
      });
    });
  });
};
