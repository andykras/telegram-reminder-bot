"use strict";

const util = require('util');
const EventEmitter = require('events');
const debug = require('debug')('reminder');

var ID = 0;
var timeoutIds = {};

String.prototype.trunc = String.prototype.trunc || function (n) {
        return this.length > n ? this.substr(0, n - 1) + '…' : this;
    };

class Reminder extends EventEmitter {
    constructor(from, chat, options) {
        super();
        this.from = from;
        this.chat = chat;
        this.options = options || {date: 0, duration: 0, text: ''};
        this.id = ID++;
    }

    parse(command) {
        this.options = parseDuration(command);

        var result = {
            error: '',
            date: this.options.date,
            duration: this.options.duration,
            text: this.options.text
        };
        Object.defineProperty(result, "ok", {
            get: function () {
                return this.error ? false : true;
            }
        });
        function toStr(opt) {
            return util.format("%s | %ss | '%s'", opt.date ? new Date(opt.date).toLocaleString() : 'nodate', opt.duration/1000.0, opt.text)
        }
        function add(msg) {
            if (result.error) result.error += '\n';
            result.error += msg;
        }

        debug("parse %s", toStr(this.options));
        if (isNaN(this.options.date)) add('Date is invalid');
        if (isNaN(this.options.duration)) add('Duration is invalid');
        if (!this.options.text) add('Reminder text is empty');
        this.emit('parse', result, this.chat.id, this);
    }

    setup(start) {
        var start = !!start;
        var id = this.chat.id;
        var user = this.from.username;
        var text = this.options.text;
        if (start) {
            this.options.date = this.options.date || Date.now();
            var duration = this.options.duration;
            var date = new Date(this.options.date + duration);
            debug("will send '%s' on %s to @%s", text.trunc(20), date.toLocaleString(), user);
            var self = this;
            timeoutIds[this.id] = {id: undefined};
            runAtDate(function () {
                self.emit('completed', user, text, id, self);
            }, date, timeoutIds[this.id]);
        } else {
            debug(`clear '${text}' for @${user}`);
            this.cancel();
        }
        this.emit('setup', start, id, this);
    }

    cancel() {
        if (timeoutIds[this.id] !== undefined) {
            clearTimeout(timeoutIds[this.id].id);
            delete timeoutIds[this.id];
        }
    }
}

// https://regex101.com/r/bN2pQ7
function parseDuration(str) {
    var re = /((\s|\,)*\d+d|(\s|\,)*\d+h|(\s|\,)*\d+mo|(\s|\,)*\d+s|(\s|\,)*\d+y|(\s|\,)*\d+m(?!o)|(\s|\,)*\d+w)/g;
    var m;
    var time = [];
    var len = 0;
    debug('parsing input command');
    while ((m = re.exec(str)) !== null && len == m.index) {
        if (m.index === re.lastIndex) {
            re.lastIndex++;
        }
        time.push(m[0]);
        len += m[0].length;
        debug(len, time);
    }

    var delta = time.reduce(function (total, str) {
        var val = parseInt(str.match(/[0-9]+/));
        var m = 0;
        if (str.indexOf('s') !== -1)
            return total + 1000 * val;
        if (str.indexOf('mo') !== -1)     m = 60 * 60 * 24 * 30.5;
        else if (str.indexOf('m') !== -1) m = 60;
        else if (str.indexOf('h') !== -1) m = 60 * 60;
        else if (str.indexOf('d') !== -1) m = 60 * 60 * 24;
        else if (str.indexOf('w') !== -1) m = 60 * 60 * 24 * 7;
        else if (str.indexOf('y') !== -1) m = 60 * 60 * 24 * 365;
        return total + 1000 * m * val;
    }, 0)

    return {
        date: 0,
        duration: delta,
        text: str.substr(len).trim()
    };
}

function runAtDate(func, date, p) {
    var p = p || {id: undefined};
    var diff = Math.max((date.getTime() - Date.now()), 0);
    var interval = 0x7FFFFFFF;
    if (diff > interval) {
        p.id = setTimeout(function () {
            runAtDate(func, date, p);
        }, interval);
    } else {
        p.id = setTimeout(func, diff);
    }
}

module.exports = Reminder;