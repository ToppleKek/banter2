const Bot = require('./src/bot');
const CONFIG = require('./config.json');

const banter = new Bot(CONFIG);

banter.start();
