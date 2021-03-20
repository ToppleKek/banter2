const Https = require('https');
const fs = require('fs');
const TOKEN = require('./config.json').token;
const APPID = require('./config.json').appid;
const TYPES = {
    "string": 3,
    "number": 4,
    "boolean": 5,
    "user": 6,
    "channel": 7,
    "role": 8
}

function register_command(cmd) {
    const cmd_payload = {
        name: cmd.name,
        options: [],
        description: cmd.data.help,
    }

    for (const arg of cmd.data.args_list.args) {
        cmd_payload.options.push({
            name: arg.name,
            type: TYPES[arg.types[0]],
            description: 'unknown',
            required: true
        });
    }

    for (const arg of cmd.data.args_list.optional_args) {
        cmd_payload.options.push({
            name: arg.name,
            type: TYPES[arg.types[0]],
            description: '(optional) unknown',
            required: false
        });
    }

    const payload = JSON.stringify(cmd_payload);

    const options = {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Content-Length": payload.length,
            "User-Agent": "Banter2 (https://github.com/ToppleKek/banter2)",
            Authorization: `Bot ${TOKEN}`
        }
    };


    return new Promise((resolve, reject) => {
        let response_data = "";
        const request = Https.request(`https://discord.com/api/v8/applications/${APPID}/guilds/585205338081460224/commands`, options, (response) => {
            response.on('data', (chunk) => {
                response_data += chunk;
            });
    
            response.on('end', () => {
                console.log(`Request end: ${response_data}`);
                const json_data = JSON.parse(response_data);
                resolve(json_data.id);
            });
        });
    
        request.write(payload);
        request.end();
    });
}

async function register_commands() {
    const command_map = {};
    const command_files = fs.readdirSync(`./src/commands`);

    for (let file of command_files) {
        if (file.endsWith('.js')) {
            const command =  {
                name: file.slice(0, -3),
                data: require(`./src/commands/${file}`)
            };

            command_map[command.name] = await register_command(command);
            console.log('Registered command: ' + file);
        }
    }

    fs.appendFileSync('./slash_command_map.json', JSON.stringify(command_map));
}

register_commands();