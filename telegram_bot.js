const TelegramBot = require('node-telegram-bot-api');
const express = require('express');
require('dotenv').config();

const app = express();
const token = process.env.BOT_TOKEN;
const webAppUrl = process.env.MINI_APP_URL;
const botUsername = process.env.BOT_USERNAME;

// Validate required environment variables
if (!token) {
    console.error('BOT_TOKEN is not set in environment variables');
    process.exit(1);
}

if (!botUsername) {
    console.error('BOT_USERNAME is not set in environment variables');
    process.exit(1);
}

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

// Initialize bot with polling options
let bot;
try {
    bot = new TelegramBot(token, { 
        polling: {
            interval: 300,
            autoStart: true,
            params: {
                timeout: 10
            }
        },
        filepath: false,
        request: { 
            timeout: 30000
        }
    });

    // Add reconnection logic
    let reconnectAttempts = 0;
    const MAX_RECONNECT_ATTEMPTS = 5;
    const RECONNECT_DELAY = 5000;

    function handlePollingError(error) {
        console.error('Polling error:', error.message);
        
        if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
            reconnectAttempts++;
            console.log(`Attempting to reconnect (${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})...`);
            
            setTimeout(() => {
                bot.startPolling();
            }, RECONNECT_DELAY);
        } else {
            console.error('Max reconnection attempts reached. Please check your bot token and internet connection.');
            process.exit(1);
        }
    }

    // Enhanced error handlers
    bot.on('polling_error', handlePollingError);
    bot.on('error', handlePollingError);
    bot.on('webhook_error', handlePollingError);

    // Handle successful connection
    bot.on('connected', () => {
        console.log('Bot successfully connected to Telegram');
        reconnectAttempts = 0;
    });

    // Handle disconnection
    bot.on('disconnected', () => {
        console.log('Bot disconnected from Telegram');
        handlePollingError(new Error('Bot disconnected'));
    });

    // Handle /start command
    bot.onText(/\/start(?:\s+(\w+))?/, async (msg, match) => {
        try {
            const referralCode = match[1];
            
            const appUrl = referralCode 
                ? `https://t.me/MemeBattleArenaBot/app?startapp=${referralCode}`
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

            const welcomeMessage = referralCode
                ? `Welcome ${msg.from.first_name}! 👋\n\nYou've been invited to join MemeIndex! Click the Launch button below to start your journey and claim your referral bonus! 🎁`
                : `Welcome ${msg.from.first_name}! 👋\n\nI'm your gateway to the MemeIndex Mini App. Click the button below to start exploring the world of meme tokens! 🌟`;

            await bot.sendMessage(msg.chat.id, welcomeMessage, options);
        } catch (error) {
            await bot.sendMessage(
                msg.chat.id,
                `Welcome ${msg.from.first_name}! 👋\n\nI'm your gateway to the MemeIndex Mini App. Click the button below to start exploring! 🌟`,
                {
                    parse_mode: 'HTML',
                    reply_markup: {
                        inline_keyboard: [
                            [{
                                text: '🚀 Launch App',
                                url: webAppUrl
                            }]
                        ]
                    }
                }
            );
        }
    });

    // Handle inline queries
    bot.on('inline_query', async (query) => {
        try {
            if (!query.query) {
                await bot.answerInlineQuery(query.id, [{
                    type: 'article',
                    id: '1',
                    title: 'Error',
                    description: 'No referral code provided',
                    input_message_content: {
                        message_text: 'Sorry, no referral code was provided.'
                    }
                }]);
                return;
            }

            // Extract the referral code from the query
            const referralCode = query.query.trim();

            if (!referralCode) {
                await bot.answerInlineQuery(query.id, [{
                    type: 'article',
                    id: '1',
                    title: 'Error',
                    description: 'Invalid referral code format',
                    input_message_content: {
                        message_text: 'Sorry, the referral code format is invalid.'
                    }
                }]);
                return;
            }

            // Create the share message
            const messageText = 
                `Hidden door to the MemeIndex Treasury found... Let's open it together!`;

            // Create the inline keyboard with the referral link
            const inlineKeyboard = {    
                inline_keyboard: [
                    [{
                        text: 'Unlock the Treasury',
                        url: `https://t.me/MemeBattleArenaBot/app?startapp=${referralCode}`
                    }]
                ]
            };

            // Image URL for treasury door - optional
            const imageUrl = "https://i.ibb.co/qjzDmnG/treasury-door.jpg";

            // Answer the inline query
            await bot.answerInlineQuery(query.id, [{
                type: 'article',
                id: '1',
                title: 'Share MemeIndex Invitation',
                description: 'Share this invitation with your friends',
                thumb_url: imageUrl,
                input_message_content: {
                    message_text: messageText,
                    parse_mode: 'HTML'
                },
                reply_markup: inlineKeyboard
            }], {
                cache_time: 0,
                is_personal: false
            });
        } catch (error) {
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

} catch (error) {
    console.error('Failed to initialize bot:', error);
    process.exit(1);
}

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Bot server is running on port ${PORT}`);
}); 