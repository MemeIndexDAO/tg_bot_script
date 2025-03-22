const TelegramBot = require('node-telegram-bot-api');
const express = require('express');
require('dotenv').config();

const app = express();
const token = process.env.BOT_TOKEN;
const webAppUrl = process.env.MINI_APP_URL;
const backendUrl = process.env.BACKEND_URL;

const botUsername = process.env.BOT_USERNAME;

// Add CORS middleware
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
    if (req.method === 'OPTIONS') {
        return res.sendStatus(200);
    }
    next();
});

// Add express middleware
app.use(express.json());

// Health check endpoint
app.get('/', (req, res) => {
    res.send('Bot is running!');
});

app.get('/health', (req, res) => {
    res.status(200).json({ status: 'healthy', timestamp: new Date() });
});

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

// Add this after the other app.use statements
app.post('/send-template', async (req, res) => {
    try {
        const { chatId, referralCode } = req.body;
        
        if (!chatId) {
            return res.status(400).json({ 
                success: false, 
                error: 'Missing chatId',
                received: { chatId, referralCode }
            });
        }

        if (!referralCode) {
            return res.status(400).json({ 
                success: false, 
                error: 'Missing referralCode',
                received: { chatId, referralCode }
            });
        }

        if (!botUsername) {
            return res.status(500).json({ 
                success: false, 
                error: 'Bot username not configured',
                botUsername
            });
        }

        const options = {
            parse_mode: 'HTML',
            protect_content: false, // Allow forwarding
            reply_markup: {
                inline_keyboard: [
                    [{
                        text: '🎁 Join MemeIndex',
                        url: `https://t.me/${botUsername}?start=${referralCode}`
                    }]
                ]
            }
        };

        const messageText = 
            `🌟 <b>Hidden door to the MemeIndex Treasury found...</b>\n\n` +
            `Let's open it together!\n\n` +
            `💰 Join now and receive:\n` +
            `• 2 FREE votes for joining\n` +
            `• Access to exclusive meme token listings\n` +
            `• Early voting privileges`;

        try {
            // First send the message to the user
            const sentMessage = await bot.sendMessage(chatId, messageText, options);
            
            res.json({ 
                success: true, 
                messageId: sentMessage.message_id,
                chatId: sentMessage.chat.id,
                canBeForwarded: true
            });
        } catch (botError) {
            console.error('Bot error:', botError);
            res.status(500).json({ 
                success: false, 
                error: 'Failed to send message',
                details: {
                    message: botError.message,
                    code: botError.code,
                    description: botError.description
                },
                params: { chatId, botUsername }
            });
        }
    } catch (error) {
        console.error('Server error:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Server error',
            details: {
                message: error.message,
                type: error.constructor.name
            }
        });
    }
});

// Handle inline queries
bot.on('inline_query', async (query) => {
    try {
        const messageText = 
            `🌟 <b>Hidden door to the MemeIndex Treasury found...</b>\n\n` +
            `Let's open it together!\n\n` +
            `💰 Join now and receive:\n` +
            `• 2 FREE votes for joining\n` +
            `• Access to exclusive meme token listings\n` +
            `• Early voting privileges`;

        const options = {
            parse_mode: 'HTML',
            reply_markup: {
                inline_keyboard: [
                    [{
                        text: '🎁 Join MemeIndex',
                        url: `https://t.me/${botUsername}?start=${query.query}`
                    }]
                ]
            }
        };

        await bot.answerInlineQuery(query.id, [{
            type: 'article',
            id: '1',
            title: 'Share MemeIndex Invitation',
            description: 'Share this invitation with your friends to earn rewards!',
            input_message_content: {
                message_text: messageText,
                parse_mode: 'HTML'
            },
            reply_markup: options.reply_markup
        }]);
    } catch (error) {
        console.error('Error handling inline query:', error);
        await bot.answerInlineQuery(query.id, [{
            type: 'article',
            id: '1',
            title: 'Error',
            description: 'Failed to generate invitation message',
            input_message_content: {
                message_text: 'Sorry, there was an error generating the invitation message.'
            }
        }]);
    }
});

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Bot server is running on port ${PORT}`);
}); 