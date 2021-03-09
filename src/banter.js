const Bot = require('./bot');
const CONFIG = require('../config.json');

const banter = new Bot(CONFIG);

banter.start();
