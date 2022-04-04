const puppeteer = require('puppeteer-extra');

const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

const AdBlockerPlugin = require('puppeteer-extra-plugin-adblocker');
puppeteer.use(AdBlockerPlugin({ blockTrackers: true }));

const xlsx = require("node-xlsx");
const fs = require('fs');

const query = process.argv.slice(2).join(' ');
console.log("Query: ", query);

puppeteer
  .launch({ headless: true })
  .then(async browser => {
    console.log('Performing search in google...');
    const page = await browser.newPage();
    await page.setViewport({ width: 1366, height: 768 });
    await page.goto('https://www.google.com');
    await page.type('input[name="q"]', query);
    await page.keyboard.press('Enter');
    await page.waitForNavigation();
    console.log('Acquiring links...');
    const links = await Promise.all(
      (await Promise.all((await page.$$('div[data-header-feature] a[data-ved][ping]')).map(async link => {
        const url = await link.getProperty('href');
        const text = await (await link.$$('h3'))[0].getProperty('textContent');
        return { url: await url.jsonValue(), text: await text.jsonValue() };
      })))
        .map(async link => {
          const nPage = await browser.newPage();
          await nPage.setViewport({ width: 1366, height: 768 });
          console.log('Opening link...', link.url);
          await nPage.goto(link.url);
          console.log('Collecting data...', link.url);
          const pLinks = await Promise.all((await nPage.$$('a')).map(async link => {
            const url = (await (await link.getProperty('href')).jsonValue());
            if(url.includes('linkedin.com/company')) {
              return url;
            }
            return null;
          }));
          await nPage.close();
          console.log('Closing page...', link.url);
          return {
            url: link.url,
            text: link.text,
            links: pLinks.filter((link, index, list) => link !== null && list.indexOf(link) === index),
          };
        }));
    console.log('Writing to file...');
    const data = links.map(link => ([
      link.url,
      link.text,
      link.links.join('\n'),
    ]));
    const buffer = xlsx.build([{name: query, data}]);

    fs.writeFileSync(`${query}.xlsx`, buffer);
    console.log('Closing browser...');
    await page.close();
    await browser.close();
    console.log('Done!');
  });
