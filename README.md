Simple reminder bot for Telegram
=======================================
This is a simple reminder bot for Telegram written in JavaScript for Node.js. Just use `/rem` command:
* `/rem` **1d, 2h   30m** Set reminder in one day 2 hours and 30 minutes
* `/rem` **1y ,3mo** Set reminder in one year and 3 months
* `/rem` **15s**    In feefteen seconds...

I have plans to add `/list` command to show all reminders, add ability to send reminder to specific `@person`, and set reminder by date.

Also can be useful to set reminders in groups: `/rem@your_bot_name` **15m** We've done!

REQUIREMENTS
------------
[Node.js](https://nodejs.org) runtime

INSTALLATION
------------
Run in arch linux shell
```sh
$ sudo pacman -S nodejs
$ npm install telegram-reminder-bot
```

USAGE
-----
Create js script 
```sh
$ nano test.js
```
with the following content
```javascript
var Bot = require('telegram-reminder-bot');

var token = '144..your_token_goes_here';
var IP = '1.2.3.4'; // your real IP
var port = 8443; // HTTPS port
var key = __dirname + '/crt.key';  // self-signed certificate
var cert = __dirname + '/crt.pem';

var bot = new Bot(token, IP, port, key, cert);
bot.run();
```

Generate self-signed certificate
```sh
$ openssl req -newkey rsa:2048 -sha256 -nodes -keyout crt.key -x509 -days 365 -out crt.pem -subj "/C=IT/ST=state/L=location/O=description/CN=1.2.3.4"
```
**replace 1.2.3.4 with your real IP**

And run
```sh
$ node test.js
```
or with debug output
```sh
$ DEBUG=bot,reminder node test.js
```

Should see something like this
```
bot **** has been deployed +273ms
```

Contacts
--------
You can find this bot working on http://telegram.me/andykrasbot

Feel free to contact [me](http://telegram.me/andykras) as well

License
-------
This is open-sourced software licensed under the [MIT license](http://opensource.org/licenses/MIT).
