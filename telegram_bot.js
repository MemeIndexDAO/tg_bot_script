const TelegramBot = require('node-telegram-bot-api');
const express = require('express');
require('dotenv').config();
const axios = require('axios');

const app = express();
const token = process.env.BOT_TOKEN;
const webAppUrl = process.env.MINI_APP_URL;
const backendUrl = process.env.BACKEND_URL;
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
            interval: 300, // Poll every 300ms
            autoStart: true,
            params: {
                timeout: 10 // Long polling timeout
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
    const RECONNECT_DELAY = 5000; // 5 seconds

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

    bot.on('error', (error) => {
        console.error('Bot error:', error.message);
        handlePollingError(error);
    });

    bot.on('webhook_error', (error) => {
        console.error('Webhook error:', error.message);
        handlePollingError(error);
    });

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

    async function sendWelcomeMessage(chatId, firstName, referralCode = null) {
        try {
            // If there's a referral code, verify it with the backend
            if (referralCode) {
                try {
                    const response = await axios.get(`${backendUrl}/referral/stats/${referralCode}`);
                    if (!response.data || !response.data.referralCode) {
                        // Invalid referral code, send normal welcome message
                        referralCode = null;
                    }
                } catch (error) {
                    console.error('Error verifying referral code:', error);
                    referralCode = null;
                }
            }

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
        try {
            const referralCode = match[1];
            console.log('Received start command with referral code:', referralCode);
            await sendWelcomeMessage(msg.chat.id, msg.from.first_name, referralCode);
        } catch (error) {
            console.error('Error in start command handler:', error);
            // Send a basic welcome message if there's an error
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
            console.log('Received inline query:', query);
            
            if (!query.query) {
                console.error('No query text received');
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

} catch (error) {
    console.error('Failed to initialize bot:', error);
    process.exit(1);
}

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Bot server is running on port ${PORT}`);
}); 