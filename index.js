const puppeteer = require('puppeteer-extra');

const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

const AdBlockerPlugin = require('puppeteer-extra-plugin-adblocker');
puppeteer.use(AdBlockerPlugin({ blockTrackers: true }));

const query = process.argv[2];
console.log({query});

puppeteer
  .launch({ headless: false })
  .then(async browser => {
    const page = await browser.newPage();
    await page.setViewport({ width: 1366, height: 768 });
    await page.goto('https://www.google.com');
    await page.type('input[name="q"]', 'some sort of "blog"');
    await page.keyboard.press('Enter');
    await page.waitForNavigation();
    const links = await Promise.all(
      (await Promise.all((await page.$$('div[data-header-feature] a[data-ved][ping]')).map(async link => {
        const url = await link.getProperty('href');
        const text = await (await link.$$('h3'))[0].getProperty('textContent');
        return { url: await url.jsonValue(), text: await text.jsonValue() };
      })))
        .map(async link => {
          const nPage = await browser.newPage();
          await nPage.setViewport({ width: 1366, height: 768 });
          await nPage.goto(link.url);
          const pLinks = await Promise.all((await nPage.$$('a')).map(async link => {
            const url = (await (await link.getProperty('href')).jsonValue());
            if(url.includes('linkedin.com/company')) {
              return url;
            }
            return null;
          }));
          await nPage.close();
          return {
            url: link.url,
            text: link.text,
            links: pLinks.filter((link, index, list) => link !== null && list.indexOf(link) === index),
          };
        }));
    console.log(links);
  });

