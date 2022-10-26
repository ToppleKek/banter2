const Https = require('https');
const fs = require('fs');
const TOKEN = require('./config.json').token;
const APPID = require('./config.json').appid;
const TYPES = {
    'word': 3,
    'string': 3,
    'number': 4,
    'boolean': 5,
    'user': 6,
    'channel': 7,
    'role': 8
};

function sleep(t) {
    return new Promise((resolve) => setTimeout(resolve, t));
}

function post_registration(payload, options) {
    return new Promise((resolve, reject) => {
        let response_data = '';
        const request = Https.request(`https://discord.com/api/v10/applications/${APPID}/guilds/585205338081460224/commands`, options, async (response) => {
            console.log(`X-RateLimit-Remaining: ${response.headers['x-ratelimit-remaining']} X-RateLimit-Reset-After: ${response.headers['x-ratelimit-reset-after']}`);
            if (response.headers['x-ratelimit-remaining'] === '0')
                await sleep(Number.parseFloat(response.headers['x-ratelimit-reset-after']) * 1000);

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

function register_other_interaction(interaction) {
    const payload = JSON.stringify({
        type: interaction.type,
        name: interaction.name
    });

    const options = {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Content-Length': payload.length,
            'User-Agent': 'DiscordBot (https://github.com/ToppleKek/banter2)',
            Authorization: `Bot ${TOKEN}`
        }
    };

    return post_registration(payload, options);
}

function register_message_interaction(interaction) {
    const payload = JSON.stringify({
        type: 3,
        name: interaction.name
    });

    const options = {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Content-Length': payload.length,
            'User-Agent': 'DiscordBot (https://github.com/ToppleKek/banter2)',
            Authorization: `Bot ${TOKEN}`
        }
    };

    return post_registration(payload, options);
}

function register_command(cmd) {
    const cmd_payload = {
        type: 1,
        name: cmd.name,
        options: [],
        description: cmd.data.help,
    };

    for (const arg of cmd.data.args_list.args) {
        cmd_payload.options.push({
            name: arg.name,
            type: TYPES[arg.type],
            description: arg.description,
            required: true
        });
    }

    for (const arg of cmd.data.args_list.optional_args) {
        cmd_payload.options.push({
            name: arg.name,
            type: TYPES[arg.type],
            description: arg.description,
            required: false
        });
    }

    const payload = JSON.stringify(cmd_payload);

    const options = {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Content-Length': payload.length,
            'User-Agent': 'DiscordBot (https://github.com/ToppleKek/banter2)',
            Authorization: `Bot ${TOKEN}`
        }
    };

    return post_registration(payload, options);
}

async function register_interactions() {
    const interaction_map = {};
    const interaction_files = fs.readdirSync('./src/interactions');

    for (const file of interaction_files) {
        const interaction = require(`./src/interactions/${file}`);
        interaction_map[await register_other_interaction(interaction)] = file.slice(0, -3);

        console.log(`Registered interaction: ${file}`);
    }

    fs.writeFileSync('./interaction_map.json', JSON.stringify(interaction_map));
}

async function register_commands() {
    const command_map = {};
    const command_files = fs.readdirSync('./src/commands');

    for (const file of command_files) {
        if (file.endsWith('.js')) {
            const command = {
                name: file.slice(0, -3),
                data: require(`./src/commands/${file}`)
            };

            command_map[command.name] = await register_command(command);
            console.log('Registered command: ' + file);
        }
    }

    fs.writeFileSync('./slash_command_map.json', JSON.stringify(command_map));
}

async function main() {
    await register_interactions();
    await register_commands();
}

main();
