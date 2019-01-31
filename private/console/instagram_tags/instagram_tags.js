const
    fs = require('fs'),
    mysql = require('mysql2/promise'),
    puppeteer = require('puppeteer'),

    messages = {
        'ARGV2_ERROR': 'укажите в параметре проект с конфигурацией',
        'FILE_NOT_FOUND': 'файл не найден ',
        'TAG_NOT_FOUND': 'Тэг для парсинга не найдена',
        'DB_CONFIG_NOT_FOUND': 'Конфигурация БД не найдена',
        'TABLE_CONFIG_NOT_FOUND': 'Настройки таблицы не найдены',
        'REQUEST_LIMIT_NOT_FOUND': 'Настройки лимита запросов не найдены'
    },

    errorLog = (message) => {
        console.error(message);
        process.exit(1);
    },

    pathResolve = require('path').resolve,

    configPath = process.argv[2] ? pathResolve(__dirname + '/config/' + process.argv[2] + '.json') : errorLog(messages.ARGV2_ERROR),
    config = fs.existsSync(configPath) ? require('cjson').load(configPath) : errorLog(messages.FILE_NOT_FOUND + configPath),
    tag = config.tag ? config.tag : errorLog(messages.TAG_NOT_FOUND),
    connectionData = config.mysql ? config.mysql : errorLog(messages.DB_CONFIG_NOT_FOUND),
    table = config.table ? config.table : errorLog(messages.TABLE_CONFIG_NOT_FOUND),
    testSQL = 'SELECT COUNT(id) as `flag` FROM `' + table + '` WHERE id = ? LIMIT 1;',
    insertSQl = 'INSERT INTO `' + table + '` (`id`, `dimensions`, `display_url`, `shortcode`, `edge_liked_by`) VALUES (?, ?, ?, ?, ?);',

    requestLimit = config.requestLimit ? config.requestLimit : errorLog(messages.REQUEST_LIMIT_NOT_FOUND),

    viewPort = {width: 1280, height: 960}, //PUPPETTER PAGE

    writeFile = (path, data, opts = 'utf8') => new Promise((resolve, reject) => {
        fs.writeFile(path, data, opts, (err) => {
            if (err) {
                reject(err);
            } else {
                resolve();
            }
        })
    }),

    randomInteger = (min, max) => Math.round(min - 0.5 + Math.random() * (max - min + 1)),

    delay = (timeout) => new Promise((resolve) => {
        setTimeout(resolve, timeout);
    });

let requestCount = 0;

async function autoScroll(page) {
    try {
        await page.evaluate(async () => {
            await new Promise((resolve, reject) => {
                try {
                    let totalHeight = 0,
                        scrollLimit = 3,
                        scrollCounter = 0,
                        distance = Math.round(456 - 0.5 + Math.random() * (765 - 456 + 1)),
                        timer = setInterval(() => {
                            scrollCounter++;
                            let scrollHeight = document.body.scrollHeight;
                            window.scrollBy(0, distance);
                            totalHeight += distance;
                            if (totalHeight >= scrollHeight || scrollCounter >= scrollLimit) {
                                clearInterval(timer);
                                resolve();
                            }

                        }, Math.round(345 - 0.5 + Math.random() * (654 - 345 + 1)));
                } catch (e) {
                    reject(e);
                }
            }).catch(error => {
                console.error(error) // add catch here
            })
        })
    } catch (error) {
        console.log('Error while scrolling:', error);
    }
}

(async () => {

    const conn = await mysql.createConnection(connectionData).catch(error => console.log(`Error mysql connect: ${error}.`));

    const browser = await puppeteer.launch({
        args: [
            '--disable-dev-shm-usage',
            //'--no-sandbox',
            //'--shm-size=1gb',
            '--unlimited-storage',
            '--full-memory-crash-report'
        ],
        //headless: false
    });

    const page = await browser.newPage();

    await page.setViewport(viewPort);

    page.on('response', async response => {
        const url = response.url();

        try {
            const req = response.request();
            const orig = req.url();
            if ((orig.indexOf('__a=1') > -1 || orig.indexOf('query_hash') > -1)
                && (orig.indexOf('include_logged_out') < 0)) {

                const text = await response.text();
                const jsonText = JSON.parse(text);

                const edges = jsonText.data.hashtag.edge_hashtag_to_media.edges;

                for (let index = 0; index < edges.length; index++) {
                    let node = edges[index].node;

                    if (node.__typename === 'GraphImage') {
                        let [testRows] = await conn.execute(testSQL, [node.id]);

                        if (parseInt(testRows[0].flag) === 0) {
                            await conn.execute(insertSQl, [
                                node.id,
                                JSON.stringify(node.dimensions),
                                node.display_url,
                                node.shortcode,
                                node.edge_liked_by.count
                            ]);
                        }
                    }
                }

                requestCount++;
                await writeFile(pathResolve(`${__dirname}/data/${tag}_${requestCount}.json`), text);

                if (requestCount >= requestLimit) {
                    await page.close().catch(error => console.log(`Error closing page: ${error}.`));
                    await browser.close();
                    process.exit();
                }
            }
        } catch (err) {
            console.error(`Failed getting data from: ${url}`);
            console.error(err);
        }
    });

    await page.goto('https://www.instagram.com/explore/tags/' + tag + '/');
    await page.emulateMedia('screen');

    for (let i = 0; i <= requestLimit; i++) {
        await delay(randomInteger(1001, 2001));
        console.log('start scroll ' + i);
        await autoScroll(page);
    }

    await page.close().catch(error => console.log(`Error closing page: ${error}.`));
    await browser.close();
    console.log('script finished');
    process.exit();
})();