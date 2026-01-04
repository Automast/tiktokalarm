const TelegramBot = require('node-telegram-bot-api');
const { DateTime } = require('luxon');

// --- USER CONFIGURATION ---
const TOKEN = '8374668400:AAHhqLLW9U32kIjrL_3yluzRmTh92aK8sh8'; 
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
let completedSlots = new Set(); // Stores 'Day-Time' strings

console.log("Bot started. Monitoring New York time...");

// --- COMMANDS ---

// 1. /test command - Triggers a fake alarm immediately
bot.onText(/\/test/, (msg) => {
    const chatId = msg.chat.id;
    // Security check: ensure only YOU can test it
    if (chatId.toString() !== YOUR_CHAT_ID) return;

    if (activeAlarm) {
        bot.sendMessage(chatId, "⚠️ An alarm is already active! Clear it first by clicking 'Done'.");
    } else {
        bot.sendMessage(chatId, "🧪 Starting Test Mode...");
        startAlarm('TEST MODE');
    }
});

// 2. Handle "Done" button clicks
bot.on('callback_query', (query) => {
    const data = query.data;
    const chatId = query.message.chat.id;

    if (data === 'stop_alarm') {
        if (activeAlarm) {
            const nowNY = DateTime.now().setZone('America/New_York');
            const dayName = nowNY.toFormat('cccc'); 
            
            // If it's a real scheduled alarm, mark it as done for the day
            if (activeAlarm.time !== 'TEST MODE') {
                const slotKey = `${dayName}-${activeAlarm.time}`;
                completedSlots.add(slotKey);
            }
            
            bot.sendMessage(chatId, `✅ Great job! Alarm for ${activeAlarm.time} stopped.`);
            
            // Clear the alarm
            activeAlarm = null;
            
            // Remove the "Done" button from the previous message
            bot.editMessageReplyMarkup({ inline_keyboard: [] }, {
                chat_id: chatId,
                message_id: query.message.message_id
            }).catch(() => {}); 
        } else {
            bot.answerCallbackQuery(query.id, { text: "No active alarm to stop." });
        }
    }
});

// --- HEARTBEAT ---
setInterval(() => {
    const nowNY = DateTime.now().setZone('America/New_York');
    const dayName = nowNY.toFormat('cccc'); 
    const currentTimeString = nowNY.toFormat('hh:mm a'); 
    
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

    // 3. Reset completed slots at midnight
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
