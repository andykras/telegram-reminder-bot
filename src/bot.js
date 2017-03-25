"use strict";

if (typeof global.localStorage === "undefined" || global.localStorage === null) {
    var LocalStorage = require('node-localstorage').LocalStorage;
    global.localStorage = new LocalStorage('./data', Number.MAX_VALUE);
}

const store = require('store');
const util = require('util');
const TelegramBot = require('node-telegram-bot-api');
const debug = require('debug')('bot');
const Reminder = require('./reminder.js');

class Bot {
    // Bot commands
    static get commandTypes() {
        return {
            '/rem': Bot.usage(),
            '/help': Bot.help(),
            '/legend': Bot.legend(),
            '/info': Bot.info(),
            '/start': Bot.start()
        };
    }

    static get stickersList() {
        return [
            'BQADAgADdQADpkRIC_4q8GPeLnX2Ag',
            'BQADAgADmwADpkRIC6dSgZOe8tzHAg',
            'BQADAgADnQADpkRICxohVKOxfMmUAg',
            'BQADAgADlQADpkRIC2PvU3MOg7uQAg',
            'BQADAgADXQADpkRICxWBr0F1Rq-JAg',
            'BQADAgADmQADpkRICxS7DIIGYIELAg',
            'BQADAQADAjgAAtpxZgdszLqbN_DAxAI',
            'BQADAgADhAcAAlOx9wN2LBTASKuaxgI',
            'BQADAgADjAEAAnlc4glAXrI8nldX0gI',
            'BQADAgAD6AEAAnlc4gmUPXjG7RweBAI',
            'BQADAQAD8jcAAtpxZgdDM9BDFDwWBwI',
            'BQADAgAD4A4AAmHpagQDKfQAAWViSTwC',
            'BQADAgADyQwAAmHpagRfplm-fcETaAI',
            'BQADAgADMgADmqLABuVk3nrF1p01Ag'];
    }

    constructor(token, IP, port, key, cert) {
        this.bot = new TelegramBot(token, {
            webHook: {
                port: port,
                key: key,
                cert: cert
            }
        });
        this.bot.setWebHook(IP + ':' + port + '/bot' + token, cert);
        this.botname = 'unknown';
        this.reminders = {};
        this.waiting = {};

        var fromDisk = store.get('reminders') || {};
        var reminders = this.reminders;
        var self = this;
        Object.keys(fromDisk).forEach(function (user) {
            reminders[user] = reminders[user] || [];
            fromDisk[user].forEach(function (rem) {
                var reminder = new Reminder(rem.from, rem.chat, rem.options);
                reminders[user].push(reminder);
                reminder.on('completed', self.onCompleted.bind(self));
                reminder.setup(true);
            });
        });
    }

    run() {
        var self = this;
        this.bot.getMe().then(function (me) {
            self.botname = me.username;
            self._run();
        });
    }

    _run() {
        debug(`${this.botname} has been deployed`);
        var self = this;

        // Matches on /rem duration
        var durRegExp = new RegExp(String.raw`/rem(@${this.botname})*\s+(\d+d|\d+h|\d+m|\d+s|\d+y|\d+w)`);
        this.bot.onText(durRegExp, function (msg, match) {
            debug('on /rem duration');
            var reminder = new Reminder(msg.from, msg.chat);
            reminder.on('parse', self.onParse.bind(self));
            reminder.on('completed', self.onCompleted.bind(self));
            reminder.on('setup', self.onSetup.bind(self));
            var re = new RegExp(String.raw`.*/rem(\s|@${self.botname})*`);
            var command = match.input.replace(re, '');
            reminder.parse(command);
        });

        // Matches on /rem date
        var dateRegExp = new RegExp(String.raw`/rem(@${this.botname})*\s+([0-9]+\.[0-9]+\.[0-9]+|[0-9]+:[0-9]+)`);
        this.bot.onText(dateRegExp, function (msg) {
            debug('on /rem date');
            self.bot.sendMessage(msg.chat.id, 'In progress...');
        });

        // Matches on /rem Incorrect format
        var errRegExp = new RegExp(String.raw`\/rem(@${this.botname})*\s*[A-Z,a-z]+`);
        this.bot.onText(errRegExp, function (msg) {
            debug('on /rem incorrect format');
            self.bot.sendMessage(msg.chat.id, '_Incorrect format_\n' + Bot.usage(), {parse_mode: 'markdown'});
        });

        // Matches on text, but not command
        this.bot.on('text', function (msg) {
            if (Object.keys(Bot.commandTypes).some((m)=>msg.text.indexOf(m) != -1))
                return;
            debug('on text: %s', msg.text);
            if (self.waiting[msg.chat.id]) {
                self.waiting[msg.chat.id].setup(msg.text == "OK");
                delete self.waiting[msg.chat.id];
            }
        });

        // To grab sticker id
        this.bot.on('sticker', function (msg) {
            debug(`file_id: '${msg.sticker.file_id}'`);
        });

        // Matches commands
        var cmds = Object.keys(Bot.commandTypes).reduce(function (m, s) {
            if (m) m += '|';
            return m + s;
        }, '');
        var commandsRegExp = new RegExp(String.raw`^(${cmds})(@${this.botname})*$`);
        self.bot.onText(commandsRegExp, function (msg, match) {
            debug('on %s', match.input);
            match.input = match.input.replace(`@${self.botname}`, '');
            self.bot.sendMessage(msg.chat.id, Bot.commandTypes[match.input], {parse_mode: 'markdown'}).then(function () {
                //if (match.input.match(/(info|start)/)) {
                if (match.input == '/start') {
                    self.bot.sendSticker(msg.chat.id, Bot.stickersList[Math.trunc(Math.random() * Bot.stickersList.length)]);
                }
            });
        });
    }

    push(reminder) {
        var id = reminder.from.id;
        this.reminders[id] = this.reminders[id] || [];
        this.reminders[id].push(reminder);
    }

    remove(reminder) {
        var id = reminder.from.id;
        this.reminders[id] = this.reminders[id] || [];
        var index = this.reminders[id].indexOf(reminder);
        this.reminders[id].splice(index, 1);
        if (this.reminders[id].length == 0) {
            delete this.reminders[id];
        }
        this.store();
    }

    store() {
        debug('save reminders to disk');
        store.set('reminders', this.reminders);
    }

    static start() {
        return 'Let the fun begin...';
    }

    static usage() {
        return '*Usage:* /rem 5m In a five minutes';
    }

    static info() {
        return `My name is [Andrey Krasnov](http://andykras.org)
Currently I'm working at *Intel* company. This simple bot was made in my free time, because I was curious to find out how it works ☼
\`\`\`
╒═════════════════╕
 ►   Feel free   ◄
 ► to contact me ◄
╘═════════════════╛\`\`\`
[♫](https://youtu.be/JMhRHi3rWQY)`;
    }

    static help() {
        return `This bot can create simple reminders for you.

To set timer:
/rem 5m In a five minutes
/rem 15s  fifteen seconds

To set by date:
/rem 31.12.1999 23:59 Happy millennium!`;
    }

    static legend() {
        return `*Legend*
\`\`\`
—————————————
  y · year
 mo · month
  w · week
  d · day
  h · hour
  m · minute
  s · second\`\`\``;
    }

    onParse(result, id, reminder) {
        var self = this;
        if (result.ok) {
            var opts = {
                //reply_to_message_id: messageId,
                parse_mode: 'markdown',
                reply_markup: JSON.stringify({
                    // force_reply: true,
                    one_time_keyboard: true,
                    // hide_keyboard: true,
                    keyboard: [
                        ["OK"],
                        ["No, I've changed my mind"]
                    ]
                })
            };
            var date, text;
            if (result.date) {
                date = new Date(result.date);
                text = `Set reminder '_${result.text}_' on *${date.toLocaleTimeString()} ${date.toLocaleDateString()}*\nin ${(result.date - Date.now()) / 1000.0} seconds`;
            } else if (result.duration) {
                date = new Date(Date.now() + result.duration);
                text = `Set reminder '_${result.text}_' in *${result.duration / 1000.0} seconds*\n${date.toLocaleTimeString()} ${date.toLocaleDateString()}`;
            } else {
                debug('bad result: %s | %s [%s]', result.date, result.duration, result.error);
                return;
            }
            self.bot.sendMessage(id, text, opts).then(function (sent) {
                debug(`request was sent to @${reminder.from.username}`);
                self.waiting[id] = reminder;
                self.push(reminder);
            });
        } else {
            debug('parse error: %s', result.error);
            self.bot.sendMessage(id, result.error);
        }
    }

    onCompleted(user, text, id, rem) {
        var self = this;
        self.bot.sendMessage(id, util.format("@%s asked to recall\n%s", user, text)).then(function () {
            debug(`reminder '${text}' completed for ${user}`);
            self.remove(rem);
        }).catch(function(e) {
            debug(`reminder '${text}' failed for ${user} with ${e}`);
            self.remove(rem);
        });
    }

    onSetup(result, id, rem) {
        var self = this;
        if (result) {
            self.bot.sendMessage(id, 'Yes, sir!', {
                reply_markup: JSON.stringify({
                    hide_keyboard: true
                })
            });
            self.store();
        } else {
            self.bot.sendMessage(id, 'As you wish...', {
                reply_markup: JSON.stringify({
                    hide_keyboard: true
                })
            });
            self.remove(rem);
        }
    }
}

module.exports = Bot;