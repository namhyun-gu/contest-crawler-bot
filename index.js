const TelegramBot = require("node-telegram-bot-api");
const request = require("request");
const cheerio = require("cheerio");
const firebaseAdmin = require("firebase-admin");
const express = require('express');

const token = process.env.TELEGRAM_TOKEN || require('./config.dev.json').telegram_token;
const firebasePrivateKey = process.env.FIREBASE_PRIVATE_KEY || require('./config.dev.json').firebase_private_key;

firebasePrivateKey.replace(/\\n/g, '\n');

const bot = new TelegramBot(token, {
  polling: true
});

const app = express();

app.get('/', (req, res) => {
  res.send({
    status: 200,
    message: "Service is running"
  });
});

app.get('/cron', (req, res) => {
  console.info('Run cron job');
  parseContest(12, (err, results) => {
    saveResults(results, (newSavedIds) => {
      console.info('newSavedIds: ');
      console.info(newSavedIds);

      const filteredResults = results.filter(result => {
        const contestId = result.url.split('=')[1];
        return newSavedIds.find((id) => id == contestId) != undefined;
      });

      let message = '새 공모전이 등록되었습니다.\n\n';

      filteredResults.forEach(result => {
        message = generateMessage(message, result);
      });

      console.info('filteredResults: ');
      console.info(filteredResults);

      getChatIds((ids) => {
        console.info('ids: ')
        console.info(ids);
        ids.forEach((id) => {
          console.info(`Send message ${id}`)
          bot.sendMessage(id, message, {
            parse_mode: 'Markdown'
          });
        })
      });
    });
  });

  res.send({
    status: 200,
    message: "Run cron job"
  });
});

app.listen(process.env.PORT || 8000);

firebaseAdmin.initializeApp({
  credential: firebaseAdmin.credential.cert({
    projectId: "contest-crawler-bot",
    clientEmail: "firebase-adminsdk-ib6rr@contest-crawler-bot.iam.gserviceaccount.com",
    privateKey: firebasePrivateKey
  }),
  databaseURL: "https://contest-crawler-bot.firebaseio.com"
});

const database = firebaseAdmin.database();
const userRef = database.ref("/user");
const contestRef = database.ref("/contest");

function parseContest(category, callback) {
  const targetOptions = {
    uri: "https://www.thinkcontest.com/m/Contest/CateField.html",
    qs: {
      c: category
    }
  };

  request(targetOptions, (error, response, body) => {
    if (error) callback(error, null);

    const $ = cheerio.load(body);

    let results = [];
    const list = $(".contest-list").children();
    for (let i = 0; i < list.length; i++) {
      const element = list.eq(i);

      const url = element.find("a").attr("href");
      const title = element.find("h3 > span").text();
      const organizer = element.find(".organizer").text();
      const timeLimit = element.find(".time-limit").text();
      const views = element.find(".views > .num").text();
      const status = element.find(".status").text();
      const dday = element.find("span.d-day").text();

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

function saveResults(results, callback) {
  contestRef.once("value").then(snapshot => {
    let existsId = [];
    snapshot.forEach(child => {
      existsId.push(child.val().contestId);
    });
    let newSavedId = [];
    results.forEach((result) => {
      const contestId = result.url.split('=')[1];
      if (existsId.find((id) => id == contestId) == undefined) {
        let newContestRef = contestRef.push();
        newContestRef.set({
          contestId
        });
        newSavedId.push(contestId);
      }
    });
    callback(newSavedId);
  });
}

function getChatIds(callback) {
  userRef.once("value").then(snapshot => {
    let chatIds = [];
    snapshot.forEach(child => {
      const val = child.val();
      chatIds.push(val.chatId);
    });
    callback(chatIds);
  });
}

bot.onText(/\/start/, (msg, match) => {
  const chatId = msg.chat.id;
  let newUserRef = userRef.push();
  newUserRef.set({
    chatId
  });
  bot.sendMessage(
    chatId,
    "알림 목록에 추가되었습니다. /cancel 로 목록에서 삭제할 수 있습니다."
  );
});

bot.onText(/\/cancel/, (msg, match) => {
  const chatId = msg.chat.id;
  userRef.once("value").then(snapshot => {
    snapshot.forEach(child => {
      const key = child.key;
      const val = child.val();

      if (val.chatId == chatId) {
        userRef.child(key).remove();
        bot.sendMessage(
          chatId,
          "알림 목록에서 삭제되었습니다. /start 로 다시 시작할 수 있습니다."
        );
        return true;
      }
    });
  });
});

bot.onText(/\/list/, (msg, match) => {
  parseContest(12, (err, results) => {
    let message = "";
    results.forEach(result => {
      message = generateMessage(message, result);
    });

    bot.sendMessage(msg.chat.id, message, {
      parse_mode: "Markdown"
    });
  });
});

function generateMessage(message, result) {
  message += `[${result.title}](https://www.thinkcontest.com${result.url})\n`;
  message += `${result.organizer}\n\n`;
  message += `기간: ${result.timeLimit}`;
  if (result.dday != "") {
    message += ` (${result.dday})\n`;
  } else {
    message += "\n";
  }
  message += `상태: ${result.status}\n`;
  message += `조회수: ${result.views}\n`;
  message += "\n";
  return message;
}