const Logger = require("./logger");
const Https = require('https');
const { pledge, command_error_if } = require("./utils/utils");
const EventEmitter = require('node:events');

class Interaction {
    constructor(bot, id, token) {
        this.bot = bot;
        this.id = id;
        this.token = token;
    }

    respond(payload) {
        return new Promise((resolve, reject) => {
            // Escape all unicode characters
            payload = JSON.stringify(payload).split('').map((char) =>
                /[\u0080-\uFFFF]/g.test(char) ? `\\u${char.charCodeAt(0).toString(16).padStart(4, '0')}` : char
            ).join('');

            Logger.info(`Responding to interaction id=${this.id}`);

            const options = {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Content-Length': payload.length,
                    'User-Agent': 'DiscordBot (https://github.com/ToppleKek/banter2)'
                }
            };

            let response_data = '';
            const request = Https.request(`https://discord.com/api/v10/interactions/${this.id}/${this.token}/callback`, options, (response) => {
                response.on('data', (chunk) => {
                    response_data += chunk;
                });

                response.on('end', () => {
                    resolve(response_data);
                });

                response.on('error', (err) => {
                    reject(err);
                });
            });

            request.write(payload);
            request.end();
        });
    }

    async respond_modal(title, components) {
        const custom_id = `${this.id}_modal`;
        const modal_dialog = new ModalDialog(this.bot);

        const [err] = await pledge(this.respond({
            type: 9,
            data: {
                custom_id,
                title,
                components: [{
                    type: 1,
                    components,
                }],
            }
        }));

        command_error_if(err, 'APIError');

        let modal_timeout_id;
        const modal_interact = (data) => {
            if (data.data.custom_id === custom_id) {
                this.bot.client.removeListener('banter_modalInteraction', modal_interact);
                modal_dialog.modal_submit(data);
                clearTimeout(modal_timeout_id);
            }
        };

        // Discord does not tell us if the modal was cancelled, so we will automatically timeout and remove all
        // listeners after 10 minutes.
        modal_timeout_id = setTimeout(() => {
            Logger.info(`Modal timeout (id=${this.id})`);
            modal_dialog.removeAllListeners();
            this.bot.client.removeListener('banter_modalInteraction', modal_interact);
        }, 10 * 60 * 1000);

        this.bot.client.on('banter_modalInteraction', modal_interact);
        return modal_dialog;
    }

    async followup(payload) {
        return new Promise((resolve, reject) => {
            // Escape all unicode characters
            payload = JSON.stringify(payload).split('').map((char) =>
                /[\u0080-\uFFFF]/g.test(char) ? `\\u${char.charCodeAt(0).toString(16).padStart(4, '0')}` : char
            ).join('');

            Logger.info(`Following up to interaction id=${this.id}`);

            const options = {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Content-Length': payload.length,
                    'User-Agent': 'DiscordBot (https://github.com/ToppleKek/banter2)'
                }
            };

            let response_data = '';
            const request = Https.request(`https://discord.com/api/v10/webhooks/${this.bot.appid}/${this.token}`, options, (response) => {
                response.on('data', (chunk) => {
                    response_data += chunk;
                });

                response.on('end', () => {
                    resolve(response_data);
                });

                response.on('error', (err) => {
                    reject(err);
                });
            });

            request.write(payload);
            request.end();
        });
    }
}

class ModalDialog extends EventEmitter {
    constructor(bot) {
        super();
        this.bot = bot;
    }

    modal_submit(data) {
        const ret = {
            interaction: data.interaction,
            components: data.data.components[0].components
        };

        this.emit('submit', ret);
    }
}

module.exports = { Interaction, ModalDialog };
