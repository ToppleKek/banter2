const forever = require('forever');

forever.start('./src/banter.js', { stream: true });
