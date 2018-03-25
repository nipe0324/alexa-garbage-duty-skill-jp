// TODO
// 1. ごみ捨て当番の登録と選択
// [x] ゴミ捨て当番の選択
// [x] ゴミ捨て当番の保存
// [ ] ゴミ捨て当番の登録
// 2. ゴミ捨て情報APIと連携
// [ ] ゴミ捨て情報APIに適した住所の取得
// [ ] ゴミ捨て情報APIから情報を取得

"use strict";
const Alexa = require('alexa-sdk');
const userLists = ['太郎', '花子', '次郎'];

// 選択関数
var choice = function (userLists) {
  return userLists[Math.floor(Math.random()*userLists.length)];
};

// 日付を取得 (YYYY/MM/DD)
var getToday = function () {
  var today = new Date();
  var year = today.getFullYear();
  var month = today.getMonth() + 1;
  var day = today.getDate();
  return year + '/' + month + '/' + day;
};

exports.handler = function(event, context, callback) {
  var alexa = Alexa.handler(event, context);
  alexa.dynamoDBTableName = 'GarbageDutySkillTable';
  // alexa.appId = process.env.APP_ID;
  alexa.registerHandlers(handlers);
  alexa.execute();
};

var handlers = {
  'LaunchRequest': function () {
    this.emit('AMAZON.HelpIntent');
  },
  'AMAZON.HelpIntent': function () {
    this.emit(':ask', 'ゴミ捨て当番にようこそ。' +
                      'ゴミ捨て当番は誰と聞いてください');
  },
  'ChoiceIntent': function () {
    var dayUser = this.attributes['dayUser'];
    var today = getToday();
    console.log('read:', dayUser);

    // DBにデータがないか、あっても日付が今日でないデータの場合選択する
    if (!dayUser || dayUser['date'] != today) {
      var user = choice(userLists);
      dayUser = { date: today, user: user };
      this.attributes['dayUser'] = dayUser; // 保存/更新
      console.log('choice:', dayUser);
    }

    // メッセージ
    var message = '今日のゴミ捨て当番は' + dayUser['user'] + 'さんです。';
    this.emit(':tell', message);
    console.log(message);
  },
  // スキルの中断時にもDynamoDBへのデータ保存を実行する設定
  // https://github.com/alexa/alexa-skills-kit-sdk-for-nodejs#making-skill-state-management-simpler
  'SessionEndedRequest': function () {
    this.emit(':saveState', true);
  }
};
