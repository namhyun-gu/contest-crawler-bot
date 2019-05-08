const TelegramBot = require('node-telegram-bot-api');
const request = require('request');
const cheerio = require('cheerio');

const token = process.env.TELEGRAM_TOKEN;

const bot = new TelegramBot(token, {
  polling: true
});

var chatIds = new Set();

function parseContest(category, callback) {
  const targetOptions = {
    uri: 'https://www.thinkcontest.com/m/Contest/CateField.html',
    qs: {
      c: category
    }
  }

  request(targetOptions, (error, response, body) => {
    if (error) callback(error, null);

    const $ = cheerio.load(body);

    let results = [];
    const list = $('.contest-list').children();
    for (let i = 0; i < list.length; i++) {
      const element = list.eq(i);

      const url = element.find('a').attr('href');
      const title = element.find('h3 > span').text();
      const organizer = element.find('.organizer').text();
      const timeLimit = element.find('.time-limit').text();
      const views = element.find('.views > .num').text();
      const status = element.find('.status').text();
      const dday = element.find('span.d-day').text();

      results.push({
        url,
        title,
        organizer,
        timeLimit,
        views,
        status,
        dday
      });
    }
    callback(null, results);
  });
}

bot.onText(/\/start/, (msg, match) => {
  chatIds.add(msg.chat.id);
});

bot.onText(/\/cancel/, (msg, match) => {
  const chatId = msg.chat.id;
  if (chatIds.has(chatId)) {
    chatIds.delete(chatId);
  }
});

bot.onText(/\/list/, (msg, match) => {
  parseContest(12, (err, results) => {
    let message = '';
    results.forEach(result => {
      message += `[${result.title}](https://www.thinkcontest.com${result.url})\n`;
      message += `${result.organizer}\n\n`;
      message += `기간: ${result.timeLimit}`;
      if (result.dday != '') {
        message += ` (${result.dday})\n`;
      } else {
        message += '\n';
      }
      message += `상태: ${result.status}\n`;
      message += `조회수: ${result.views}\n`;
      message += '\n';
    });

    bot.sendMessage(msg.chat.id, message, {
      parse_mode: 'Markdown'
    });
  });
});