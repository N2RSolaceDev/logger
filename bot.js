require('dotenv').config(); // Load .env file
const { Client, GatewayIntentBits, Partials, AuditLogEvent } = require('discord.js');
const fs = require('fs');
const path = require('path');
const express = require('express'); // Import express

// Setup logging directory
const LOG_DIR = path.join(__dirname, 'logs');
if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR);

// Create Express App
const app = express();
const PORT = process.env.PORT || 10000;

app.get('/', (req, res) => {
    res.send('Discord Logger Bot is running!');
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`🌐 Web server listening on port ${PORT}`);
});

// Define intents and partials
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildBans,
        GatewayIntentBits.GuildEmojisAndStickers,
        GatewayIntentBits.GuildIntegrations,
        GatewayIntentBits.GuildWebhooks,
        GatewayIntentBits.GuildInvites,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.DirectMessages
    ],
    partials: [Partials.Message, Partials.Channel, Partials.User, Partials.GuildMember]
});

// Configuration
const MONITOR_GUILD_ID = process.env.MONITOR_GUILD_ID;
const LOG_CHANNEL_ID = process.env.LOG_CHANNEL_ID;

function formatTime(date) {
    return new Date(date).toLocaleString();
}

function saveLogToFile(guildId, content) {
    const date = new Date().toISOString().split('T')[0];
    const filePath = path.join(LOG_DIR, `${guildId}-${date}.log`);
    const timestamped = `[${new Date().toISOString()}] ${content}
`;
    fs.appendFileSync(filePath, timestamped);
}

function getUserInfo(user) {
    return {
        name: `${user.username}#${user.discriminator}`,
        value: `**User ID:** ${user.id}
**Created At:** ${formatTime(user.createdAt)}`,
        inline: false
    };
}

function getExecutorInfo(entry, guild) {
    if (!entry || !entry.executor) return null;
    const user = entry.executor;
    return getUserInfo(user);
}

function sendLog(embed) {
    const logChannel = client.channels.cache.get(LOG_CHANNEL_ID);
    if (!logChannel) {
        console.warn("Log channel not found.");
        return;
    }
    saveLogToFile(MONITOR_GUILD_ID, JSON.stringify(embed));
    logChannel.send({ embeds: [embed] }).catch(console.error);
}

client.once('ready', () => {
    console.log(`✅ Logged in as ${client.user.tag}`);
    console.log(`Monitoring server: ${MONITOR_GUILD_ID}`);
    console.log(`Logging to channel: ${LOG_CHANNEL_ID}`);
});

// --- MESSAGE EVENTS ---
client.on('messageCreate', msg => {
    if (!msg.author || msg.guild?.id !== MONITOR_GUILD_ID || msg.author.bot) return;
    const embed = {
        color: 0x98fb98,
        title: '💬 Message Sent',
        description: `**Channel:** <#${msg.channel.id}>`,
        fields: [
            getUserInfo(msg.author),
            {
                name: 'Message Content',
                value: `\`\`\`${msg.content.slice(0, 1024)}\`\`\``,
                inline: false
            }
        ],
        timestamp: new Date()
    };
    sendLog(embed);
});

// Include all existing event handlers from your original file...

// Start the bot
client.login(process.env.TOKEN);
