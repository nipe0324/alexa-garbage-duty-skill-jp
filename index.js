// TODO
// 1. ごみ捨て当番の登録と選択
// [x] ゴミ捨て当番の選択
// [x] ゴミ捨て当番の保存
// [x] ゴミ捨て当番の登録
// [x] ゴミ捨て当番の確認
// 2. ゴミ捨て情報APIと連携
// [x] ゴミ捨て情報APIに適した地域の登録->APIの登録料が少なくて使えなかった
// [x] ゴミ捨て情報APIからゴミ捨て情報を取得->実施しない。集めていける仕組みを作ったほうがよさそう
// 3. 優先度低のやつら
// [x] ゴミ捨て地域の変更->地域登録しないでリリースする
// [ ] ゴミ捨て当番の削除
// [ ] ゴミ捨て情報を作成/更新できる仕組みを考えて仕込んでおく
// 4. 審査申請
// [ ] アイコンをつくる
// [ ]

"use strict";
const Alexa = require('alexa-sdk');

////////////////////////////////////
// ハンドラー登録
////////////////////////////////////
exports.handler = function(event, context, callback) {
  var alexa = Alexa.handler(event, context);
  alexa.dynamoDBTableName = 'GarbageDutySkillTable';
  alexa.appId = process.env.APP_ID;
  alexa.registerHandlers(handlers);
  alexa.execute();
};

////////////////////////////////////
// ハンドラー
////////////////////////////////////
// メイン
var handlers = {
  'LaunchRequest': function () {
    this.emit('AMAZON.HelpIntent');
  },
  'AMAZON.HelpIntent': function () {
    var userList = this.attributes['userList'];
    console.log('HelpIntent Read:', userList);

    // 初回振り分け
    var message = 'ゴミ捨て当番にようこそ。';
    if (!userList) {
      message += 'まずは当番を登録します。ひとりずつ追加しますので、たとえば、ゴミ捨て当番に太郎を登録して、と言ってください。';
    } else {
      message += '今日のゴミ捨て当番を知りたい場合は、ゴミ捨て当番は誰と聞いてください。' +
                 '登録されている当番や地域を知りたい場合は、ゴミ捨て当番の登録情報を教えてと聞いてください。';
    }

    // 表示
    this.emit(':ask', message);
    console.log('HelpIntent Message:', message);
  },
  'RegisterIntent': function () {
    var message,
        userList = this.attributes['userList'] || [];
    console.log('RegisterIntent Read:', userList);

    // 担当の追加/登録
    var userName = this.event.request.intent.slots.FirstName.value;
    if (userName && userName != '') {
      userList.push(userName); // リストに追加
      userList = userList.filter(onlyUnique); // 重複除去
      this.attributes['userList'] = userList; // 保存/更新
      message = userName + 'さんを登録しました。';
    } else {
      message = 'すいませんがうまく登録できませんでした。';
    }
    // メッセージ
    message += '引き続き登録する場合は、ゴミ捨て当番に太郎を登録して、と言ってください。'
    this.emit(':ask', message);
    console.log('RegisterIntent Message:', message);
  },
  'SettingIntent': function () {
    var userList = this.attributes['userList'];
    console.log('SettingIntent Read:', userList);

    // 初期設置がない場合はヘルプへ
    if (!userList) {
      this.emit('AMAZON.HelpIntent');
      return;
    }

    // メッセージ
    var message = '登録されている当番は' + userList.length + '名で';
    for (var i = 0; i < userList.length; i += 1) {
      message += '、' + userList[i] + 'さん';
    }
    message += 'です。'
    this.emit(':tell', message);
    console.log('SettingIntent Message:', message);
  },
  'ChoiceIntent': function () {
    var userList = this.attributes['userList'];
    console.log('ChoiceIntent Read:', userList);

    // 初期設置がない場合はヘルプへ
    if (!userList) {
      this.emit('AMAZON.HelpIntent');
      return;
    }

    // 選択
    var dayUser = this.attributes['dayUser'];
    var today = getToday();
    console.log('ChoiceIntent Read:', dayUser);

    // DBにデータがないか、あっても日付が今日でないデータの場合選択する
    if (!dayUser || dayUser['date'] != today) {
      var user = choice(userList);
      dayUser = { date: today, user: user };
      this.attributes['dayUser'] = dayUser; // 保存/更新
      console.log('ChoiceIntent Choice:', dayUser);
    }
    var message = '今日のゴミ捨て当番は' + dayUser['user'] + 'さんです。';

    // メッセージ
    this.emit(':tell', message);
    console.log('ChoiceIntent Message:', message);
  },
  // スキルの中断時にもDynamoDBへのデータ保存を実行する設定
  // https://github.com/alexa/alexa-skills-kit-sdk-for-nodejs#making-skill-state-management-simpler
  'SessionEndedRequest': function () {
    this.emit(':saveState', true);
  }
};

////////////////////////////////////
// 関数
////////////////////////////////////
// 選択関数
var choice = function (userList) {
  return userList[Math.floor(Math.random() * userList.length)];
};

// 日付を取得 (YYYY/MM/DD)
var getToday = function () {
  var today = new Date();
  var year = today.getFullYear();
  var month = today.getMonth() + 1;
  var day = today.getDate();
  return year + '/' + month + '/' + day;
};

var onlyUnique = function (value, index, self) {
  return self.indexOf(value) === index;
}
