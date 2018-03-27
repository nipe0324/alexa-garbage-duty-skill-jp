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
  'AMAZON.CancelIntent': function () {
    this.emit('AMAZON.StopIntent');
  },
  'AMAZON.StopIntent': function () {
    this.emit(':tell', 'ゴミ捨て当番を終了します。');
  },
  'AMAZON.HelpIntent': function () {
    var userNames = this.attributes['userNames'];
    console.log('HelpIntent Read:', userNames);

    // 初回振り分け
    var message = 'ゴミ捨て当番にようこそ。';
    if (!userNames) {
      message += 'まずは当番を登録します。ひとりずつ追加しますので、たとえば、太郎を追加して、と言ってください。';
    } else {
      message += '今日のゴミ捨て当番を知りたい場合は、ゴミ捨て当番で当番を教えて、と聞いてください。' +
                 '登録されている当番を知りたい場合は、ゴミ捨て当番で登録情報を教えて、と聞いてください。';
    }
    this.emit(':ask', message);
    console.log('HelpIntent Message:', message);
  },
  'RegisterIntent': function () {
    var message,
        userNames = this.attributes['userNames'] || [];
    console.log('RegisterIntent Read:', userNames);

    // 担当の追加/登録
    var userName = this.event.request.intent.slots.FirstName.value;
    userNames.push(userName); // リストに追加
    userNames = userNames.filter(onlyUnique); // 重複除去
    this.attributes['userNames'] = userNames; // 保存/更新
    message = userName + 'さんを追加しました。'

    // メッセージ
    this.emit(':tell', message);
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
    if (userNames.indexOf(userName) != -1) {
      userNames.splice(userNames.indexOf(userName), 1); // リストから削除
      this.attributes['userNames'] = userNames; // 保存/更新
      this.emit(':saveState', true); // 保存
      message = userName + 'さんを削除しました。';
      this.emit(':tell', message);
    } else {
      message = 'すいませんが登録されているリストにない名前でした。もう一度お試しください。';
      this.emit(':ask', message);
    }
    console.log('DeleteIntent Message:', message);
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
    message += '登録されている当番を追加したい場合は、たとえば、ゴミ捨て当番で太郎を登録して、と言ってください。';
    message += '登録されている当番を削除したい場合は、たとえば、ゴミ捨て当番で太郎を削除して、と言ってください。';
    this.emit(':tell', message);
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

    // 選択処理
    var userNamesByDate = this.attributes['userNamesByDate'] || {};
    var dutyDate = this.event.request.intent.slots.dutyDate.value || getToday();
    dutyDate = formatDate(new Date(dutyDate));
    console.log('ChoiceIntent Read userNamesByDate:', userNamesByDate);
    console.log('ChoiceIntent Read dutyDate:', dutyDate);

    // DBにデータがないか、あっても日付が今日でないデータの場合選択する
    if (!userNamesByDate[dutyDate] || userNames.indexOf(userNamesByDate[dutyDate])) {
      var userName = choice(userNames);
      userNamesByDate[dutyDate] = userName;
      this.attributes['userNamesByDate'] = userNamesByDate; // 保存/更新
      console.log('ChoiceIntent Choice:', userNamesByDate[dutyDate]);
    }
    var message = messageFromDate(dutyDate) + 'のゴミ捨て当番は' + userNamesByDate[dutyDate] + 'さんです。';

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

// 今日の日付を取得(JST)
var getToday = function () {
  var date = new Date();
  date.setTime(date.getTime() + 32400000); // 日本時間に変更 1000 * 60 * 60 * 9(hour)
  return formatDate(date);
};

// 日付をYYYY-MM-DDでフォーマット、0パディング
var formatDate = function (date) {
  var y = date.getFullYear();
  var m = date.getMonth() + 1;
  var d = date.getDate();
  var y0 = ('0000' + y).slice(-4);
  var m0 = ('00' + m).slice(-2);
  var d0 = ('00' + d).slice(-2);
  return y0 + '-' + m0 + '-' + d0;
}

var onlyUnique = function (value, index, self) {
  return self.indexOf(value) === index;
}

var messageFromDate = function (dutyDate) {
  var startDate = Date.parse(getToday());
  var endDate = Date.parse(dutyDate);
  var diff = dateDiff(startDate, endDate);
  switch (diff) {
    case -2:
      return 'おととい';
    case -1:
      return '昨日';
    case 0:
      return '今日';
    case 1:
      return '明日';
    case 2:
      return 'あさって';
    case 3:
      return 'しあさって';
    default:
      return dutyDate;
  }
}

var dateDiff = function (startDate, endDate) {
  return (endDate - startDate) / (1000 * 60 * 60 * 24); // hour x min x sec x mili
}
