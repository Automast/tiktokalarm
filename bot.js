const TelegramBot = require('node-telegram-bot-api');
const { DateTime } = require('luxon');

// --- USER CONFIGURATION (FILL THESE) ---
// 1. Get Token from @BotFather on Telegram
const TOKEN = '8374668400:AAHhqLLW9U32kIjrL_3yluzRmTh92aK8sh8'; 
// 2. Get your Chat ID from @userinfobot (it's a number like 123456789)
const YOUR_CHAT_ID = '1277452628'; 

// --- THE SCHEDULE (New York Time) ---
const SCHEDULE = {
    'Sunday':    ['08:00 AM', '12:00 PM', '04:00 PM', '08:00 PM'],
    'Monday':    ['06:00 AM', '12:00 PM', '04:00 PM', '10:00 PM'],
    'Tuesday':   ['09:00 AM', '02:00 PM', '05:00 PM', '09:00 PM'],
    'Wednesday': ['07:00 AM', '01:00 PM', '05:00 PM', '10:00 PM'],
    'Thursday':  ['09:00 AM', '12:00 PM', '03:00 PM', '07:00 PM'],
    'Friday':    ['07:00 AM', '01:00 PM', '04:00 PM', '08:00 PM'],
    'Saturday':  ['11:00 AM', '03:00 PM', '06:00 PM', '09:00 PM']
};

// --- LOGIC ---
const bot = new TelegramBot(TOKEN, { polling: true });

// State variables to track alarms
let activeAlarm = null; // { time: '08:00 AM', lastNag: timestamp }
let completedSlots = new Set(); // Stores 'Day-Time' strings (e.g., "Monday-06:00 AM")

console.log("Bot started. Monitoring New York time...");

// Handle "Done" button clicks
bot.on('callback_query', (query) => {
    const data = query.data;
    const chatId = query.message.chat.id;

    if (data === 'stop_alarm') {
        if (activeAlarm) {
            const nowNY = DateTime.now().setZone('America/New_York');
            const dayName = nowNY.toFormat('cccc'); // e.g., "Monday"
            
            // Mark this slot as completed so it doesn't trigger again today
            const slotKey = `${dayName}-${activeAlarm.time}`;
            completedSlots.add(slotKey);
            
            bot.sendMessage(chatId, `✅ Great job! Alarm for ${activeAlarm.time} stopped.`);
            
            // Clear the alarm
            activeAlarm = null;
            
            // Remove the "Done" button from the previous message to clean up
            bot.editMessageReplyMarkup({ inline_keyboard: [] }, {
                chat_id: chatId,
                message_id: query.message.message_id
            }).catch(() => {}); // Ignore errors if message is too old
        } else {
            bot.answerCallbackQuery(query.id, { text: "No active alarm to stop." });
        }
    }
});

// The Heartbeat: Runs every 60 seconds
setInterval(() => {
    const nowNY = DateTime.now().setZone('America/New_York');
    const dayName = nowNY.toFormat('cccc'); // "Sunday", "Monday", etc.
    const currentTimeString = nowNY.toFormat('hh:mm a'); // "08:00 AM"
    
    // 1. Check if we need to START a new alarm
    const todaysSlots = SCHEDULE[dayName];
    if (todaysSlots && todaysSlots.includes(currentTimeString)) {
        const slotKey = `${dayName}-${currentTimeString}`;
        
        // Only start if not already active and not already completed
        if (!activeAlarm && !completedSlots.has(slotKey)) {
            startAlarm(currentTimeString);
        }
    }

    // 2. Handle ACTIVE alarms (Nagging logic)
    if (activeAlarm) {
        const diffInMinutes = nowNY.diff(activeAlarm.lastNag, 'minutes').minutes;
        
        // If 5 minutes have passed since last nag
        if (diffInMinutes >= 5) {
            sendNagMessage(activeAlarm.time);
        }
    }

    // 3. Reset completed slots at midnight (optional safety cleanup)
    if (currentTimeString === '12:00 AM') {
        completedSlots.clear();
    }

}, 60 * 1000); // Check every minute

function startAlarm(timeString) {
    console.log(`Starting alarm for ${timeString}`);
    activeAlarm = {
        time: timeString,
        lastNag: DateTime.now().setZone('America/New_York') // Set initial nag time
    };
    sendNagMessage(timeString);
}

function sendNagMessage(timeString) {
    const opts = {
        reply_markup: {
            inline_keyboard: [
                [{ text: '✅ DONE (I posted)', callback_data: 'stop_alarm' }]
            ]
        }
    };
    
    bot.sendMessage(YOUR_CHAT_ID, `🚨 **TIKTOK TIME!** 🚨\n\nIt is ${timeString}.\nPost your video now!`, { 
        parse_mode: 'Markdown',
        ...opts
    }).then(() => {
        // Update the last nag time ONLY after successful send
        if (activeAlarm) {
            activeAlarm.lastNag = DateTime.now().setZone('America/New_York');
        }
    }).catch((err) => {
        console.error("Failed to send message:", err.message);
    });
}
