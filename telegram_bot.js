const TelegramBot = require('node-telegram-bot-api');
require('dotenv').config();

const token = process.env.BOT_TOKEN;
const webAppUrl = process.env.MINI_APP_URL;
const backendUrl = process.env.BACKEND_URL;
const botUsername = process.env.BOT_USERNAME;

const bot = new TelegramBot(token, { 
    polling: true,
    filepath: false, 
    request: { 
        timeout: 30000
    }
});

async function sendWelcomeMessage(chatId, firstName, referralCode = null) {
    try {
        const appUrl = referralCode 
            ? `${webAppUrl}?ref=${referralCode}`
            : webAppUrl;

        const options = {
            parse_mode: 'HTML',
            reply_markup: {
                inline_keyboard: [
                    [{
                        text: '🚀 Launch App',
                        url: appUrl
                    }]
                ]
            }
        };

        let welcomeMessage;
        if (referralCode) {
            welcomeMessage = `Welcome ${firstName}! 👋\n\nYou've been invited to join MemeIndex! Click the Launch button below to start your journey and claim your referral bonus! 🎁`;
        } else {
            welcomeMessage = `Welcome ${firstName}! 👋\n\nI'm your gateway to the MemeIndex Mini App. Click the button below to start exploring the world of meme tokens! 🌟`;
        }

        await bot.sendMessage(
            chatId,
            welcomeMessage,
            options
        );
    } catch (error) {
        console.error('Error sending welcome message:', error.message);
    }
}

bot.onText(/\/start(?:\s+(\w+))?/, async (msg, match) => {
    const referralCode = match[1];
    await sendWelcomeMessage(msg.chat.id, msg.from.first_name, referralCode);
});

bot.on('new_chat_members', async (msg) => {
    const newMembers = msg.new_chat_members;
    for (const member of newMembers) {
        if (!member.is_bot) {
            await sendWelcomeMessage(msg.chat.id, member.first_name, referralCode);
        }
    }
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