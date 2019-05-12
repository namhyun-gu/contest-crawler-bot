const telegramBot = require("node-telegram-bot-api");
const request = require("request");
const cheerio = require("cheerio");
const firebaseAdmin = require("firebase-admin");
const express = require("express");

process.env.NODE_ENV =
  process.env.NODE_ENV &&
  process.env.NODE_ENV.trim().toLowerCase() == "production";

const isProduction =
  process.env.NODE_ENV == undefined || process.env.NODE_ENV == "development";

let config;

if (isProduction) {
  config = {
    telegram_token: process.env.TELEGRAM_TOKEN,
    firebase: {
      project_id: process.env.FIREBASE_PROJECT_ID,
      private_key: process.env.FIREBASE_PRIVATE_KEY,
      client_email: process.env.FIREBASE_CLIENT_EMAIL,
      database_url: process.env.FIREBASE_DATABASE_URL
    }
  }
} else {
  config = require("./config.dev.json");
}

console.info(`TELEGRAM_TOKEN: ${config.telegram_token}`);
console.info(`FIREBASE_PROJECT_ID: ${config.firebase.project_id}`);
console.info(`FIREBASE_CLIENT_EMAIL: ${config.firebase.client_email}`);
console.info(`FIREBASE_DATABASE_URL: ${config.firebase.database_url}`);

// Setup TelegramBot
const bot = new telegramBot(config.telegram_token, {
  polling: true
});

// Setup firebase
firebaseAdmin.initializeApp({
  credential: firebaseAdmin.credential.cert({
    projectId: config.firebase.project_id,
    clientEmail: config.firebase.client_email,
    privateKey: config.firebase.private_key.replace(/\\n/g, "\n")
  }),
  databaseURL: config.firebase.database_url
});

const database = firebaseAdmin.database();
const userRef = database.ref("/user");
const contestRef = database.ref("/contest");

// Setup express router
const app = express();

app.get("/", (req, res) => {
  res.send({
    status: 200,
    message: "Service is running"
  });
});

app.get("/cron", (req, res) => {
  console.info("Run cron job");
  parseContest(12, (err, results) => {
    saveResults(results, newSavedIds => {
      console.info(`newSavedIds length: ${newSavedIds.length}`);

      const filteredResults = results.filter(result => {
        const contestId = result.url.split("=")[1];
        return newSavedIds.find(id => id == contestId) != undefined;
      });

      if (filteredResults.length == 0) {
        console.log("New contest not updated.");
        return;
      }

      let message = "새 공모전이 등록되었습니다.\n\n";

      filteredResults.forEach(result => {
        message = generateMessage(message, result);
      });

      console.info(`filteredResults length: ${filteredResults.length}`);

      getChatIds(ids => {
        console.info("ids: ");
        console.info(ids);
        ids.forEach(id => {
          console.info(`Send message ${id}`);
          bot.sendMessage(id, message, {
            parse_mode: "Markdown"
          });
        });
      });
    });
  });

  res.send({
    status: 200,
    message: "Run cron job"
  });
});

app.listen(process.env.PORT || 8000);

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

      if (dday.length == 0) {
        continue;
      }

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
    results.forEach(result => {
      const contestId = result.url.split("=")[1];
      if (existsId.find(id => id == contestId) == undefined) {
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
  console.info(`${chatId} is run /start command`);
  userRef.once("value").then(snapshot => {
    let isExist = false;
    snapshot.forEach(child => {
      const key = child.key;
      const val = child.val();

      if (val.chatId == chatId) {
        isExist = true;
        return true;
      }
    });
    if (isExist) {
      bot.sendMessage(chatId, "이미 알림 목록에 추가되어있습니다.");
    } else {
      let newUserRef = userRef.push();
      newUserRef.set({
        chatId
      });
      bot.sendMessage(
        chatId,
        "알림 목록에 추가되었습니다. /cancel 로 목록에서 삭제할 수 있습니다."
      );
      bot.sendMessage(chatId, generateHelpMessage());
    }
  });
});

bot.onText(/\/cancel/, (msg, match) => {
  const chatId = msg.chat.id;
  console.info(`${chatId} is run /cancel command`);
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
  console.info(`${msg.chat.id} is run /list command`);
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

bot.onText(/\/help/, (msg, match) => {
  const chatId = msg.chat.id;
  bot.sendMessage(chatId, generateHelpMessage(), {
    parse_mode: "Markdown"
  });
});

function generateHelpMessage() {
  let message = "";
  message += "봇 사용법\n\n";
  message += "/start - 봇이 알림을 보낼 알림 목록에 등록합니다.\n";
  message += "/cancel - 알림 목록에서 제거하여 알림을 받지 않습니다.\n";
  message += "/list - 현재 올라와있는 공모전 목록을 가져옵니다\n\n";
  message +=
    "서비스 이용에 문제가 있거나, 추가하였으면 하는 기능이 있다면 https://github.com/namhyun-gu/contest-crawler-bot 에 접속하여 Issue를 추가해주세요!";
  return message;
}

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