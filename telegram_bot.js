const TelegramBot = require('node-telegram-bot-api');
require('dotenv').config();

const token = process.env.BOT_TOKEN;

const webAppUrl = process.env.MINI_APP_URL;

const bot = new TelegramBot(token, { 
    polling: true,
    filepath: false, 
    request: { 
        timeout: 30000
    }
});


async function sendWelcomeMessage(chatId, firstName) {
    try {
        const options = {
            parse_mode: 'HTML',
            reply_markup: {
                inline_keyboard: [
                    [{
                        text: '🚀 Launch App',
                        url: webAppUrl
                    }]
                ]
            }
        };

        await bot.sendMessage(
            chatId,
            `Welcome ${firstName}! 👋\n\nI'm your gateway to the MemeIndex Mini App. Click the button below to start exploring the world of meme tokens! 🌟`,
            options
        );
    } catch (error) {
        console.error('Error sending welcome message:', error.message);
    }
}

bot.on('new_chat_members', async (msg) => {
    const newMembers = msg.new_chat_members;
    for (const member of newMembers) {
        if (!member.is_bot) {
            await sendWelcomeMessage(msg.chat.id, member.first_name);
        }
    }
});


bot.onText(/\/start/, async (msg) => {
    await sendWelcomeMessage(msg.chat.id, msg.from.first_name);
});


bot.on('message', async (msg) => {
    try {
        const chatId = msg.chat.id;
        
        if (!msg.text?.startsWith('/') && !msg.new_chat_members) {
            const options = {
                parse_mode: 'HTML',
                reply_markup: {
                    inline_keyboard: [
                        [{
                            text: '🚀 Launch App',
                            url: webAppUrl
                        }]
                    ]
                }
            };
            
            await bot.sendMessage(
                chatId,
                "Ready to explore MemeIndex? Hit the button below! 🎯",
                options
            );
        }
    } catch (error) {
        console.error('Error in message handler:', error.message);
    }
});


bot.on('polling_error', (error) => {
    console.error('Polling error:', error.message);
});


bot.on('error', (error) => {
    console.error('Bot error:', error.message);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

console.log('Bot is running... Press Ctrl+C to stop'); 