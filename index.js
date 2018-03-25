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
// [x] ゴミ捨て当番の削除
// [ ] ゴミ捨て情報を作成/更新できる仕組みを考えて仕込んでおく
// [ ] インテントのconfirmationどうやってやる？
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
    var userNames = this.attributes['userNames'];
    console.log('HelpIntent Read:', userNames);

    // 初回振り分け
    var message = 'ゴミ捨て当番にようこそ。';
    if (!userNames) {
      message += 'まずは当番を登録します。ひとりずつ追加しますので、たとえば、太郎を追加して、と言ってください。';
    } else {
      message += '今日のゴミ捨て当番を知りたい場合は、ゴミ捨て当番は誰と聞いてください。' +
                 '登録されている当番を知りたい場合は、登録情報を教えてと聞いてください。';
    }

    // 表示
    this.emit(':ask', message);
    console.log('HelpIntent Message:', message);
  },
  'RegisterIntent': function () {
    var message,
        userNames = this.attributes['userNames'] || [];
    console.log('RegisterIntent Read:', userNames);

    // 担当の追加/登録
    var userName = this.event.request.intent.slots.FirstName.value;
    if (userName && userName != '') {
      userNames.push(userName); // リストに追加
      userNames = userNames.filter(onlyUnique); // 重複除去
      this.attributes['userNames'] = userNames; // 保存/更新
      message = userName + 'さんを追加しました。'
    } else {
      message = 'すいませんがうまく追加できませんでした。もう一度お試しください。';
    }
    // メッセージ
    this.emit(':ask', message);
    console.log('RegisterIntent Message:', message);

    // 保存
    this.emit(':saveState', true);
  },
  'RemoveIntent': function () {
    var message,
        userNames = this.attributes['userNames'] || [];
    console.log('DeleteIntent Read:', userNames);

    // 担当の追加/登録
    var userName = this.event.request.intent.slots.FirstName.value;
    if (userName && userName != '' && userNames.indexOf(userName) != -1) {
      userNames.splice(userNames.indexOf(userName), 1); // リストから削除
      this.attributes['userNames'] = userNames; // 保存/更新
      message = userName + 'さんを削除しました。';
    } else {
      message = 'すいませんがうまく削除できませんでした。もう一度お試しください。';
    }

    // メッセージ
    this.emit(':ask', message);
    console.log('DeleteIntent Message:', message);

    // 保存
    this.emit(':saveState', true);
  },
  'SettingIntent': function () {
    var userNames = this.attributes['userNames'];
    console.log('SettingIntent Read:', userNames);

    // 初期設置がない場合はヘルプへ
    if (!userNames) {
      this.emit('AMAZON.HelpIntent');
      return;
    }

    // メッセージ
    var message = '登録されている当番は' + userNames.length + '名で';
    for (var i = 0; i < userNames.length; i += 1) {
      message += '、' + userNames[i] + 'さん';
    }
    message += 'です。'
    message += '登録されている当番を追加したい場合は、たとえば、太郎を登録して、と言ってください。';
    message += '登録されている当番を削除したい場合は、たとえば、太郎を削除して、と言ってください。';
    this.emit(':ask', message);
    console.log('SettingIntent Message:', message);
  },
  'ChoiceIntent': function () {
    var userNames = this.attributes['userNames'];
    console.log('ChoiceIntent Read:', userNames);

    // 初期設置がない場合はヘルプへ
    if (!userNames) {
      this.emit('AMAZON.HelpIntent');
      return;
    }

    // 選択
    var dayUser = this.attributes['dayUser'];
    var today = getToday();
    console.log('ChoiceIntent Read:', dayUser);

    // DBにデータがないか、あっても日付が今日でないデータの場合選択する
    if (!dayUser || dayUser['date'] != today || userNames.indexOf(dayUser['userName'])) {
      var userName = choice(userNames);
      dayUser = { date: today, userName: userName };
      this.attributes['dayUser'] = dayUser; // 保存/更新
      console.log('ChoiceIntent Choice:', dayUser);
    }
    var message = '今日のゴミ捨て当番は' + dayUser['userName'] + 'さんです。';

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
var choice = function (userNames) {
  return userNames[Math.floor(Math.random() * userNames.length)];
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
