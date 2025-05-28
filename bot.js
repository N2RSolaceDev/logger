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

client.on('messageUpdate', async (oldMsg, newMsg) => {
    if (oldMsg.guild?.id !== MONITOR_GUILD_ID || oldMsg.author?.bot) return;
    if (oldMsg.content === newMsg.content) return;
    const embed = {
        color: 0xffd700,
        title: '✏️ Message Edited',
        description: `**Channel:** <#${newMsg.channel.id}>`,
        fields: [
            getUserInfo(newMsg.author),
            {
                name: 'Before',
                value: `\`\`\`${oldMsg.content.slice(0, 1024)}\`\`\``,
                inline: false
            },
            {
                name: 'After',
                value: `\`\`\`${newMsg.content.slice(0, 1024)}\`\`\``,
                inline: false
            }
        ],
        timestamp: new Date()
    };
    sendLog(embed);
});

client.on('messageDelete', async message => {
    if (message.guild?.id !== MONITOR_GUILD_ID || message.author?.bot) return;
    const embed = {
        color: 0xff6347,
        title: '🗑️ Message Deleted',
        description: `**Channel:** <#${message.channel.id}>`,
        fields: [
            getUserInfo(message.author),
            {
                name: 'Deleted Message',
                value: `\`\`\`${message.content.slice(0, 1024)}\`\`\``,
                inline: false
            }
        ],
        timestamp: new Date()
    };
    sendLog(embed);
});

// --- MEMBER EVENTS ---
client.on('guildMemberAdd', member => {
    if (member.guild.id !== MONITOR_GUILD_ID) return;
    const embed = {
        color: 0x66ff66,
        title: '📥 Member Joined',
        description: `**Account Created:** ${formatTime(member.user.createdAt)}`,
        fields: [getUserInfo(member.user)],
        timestamp: new Date()
    };
    sendLog(embed);
});

client.on('guildMemberRemove', member => {
    if (member.guild.id !== MONITOR_GUILD_ID) return;
    const embed = {
        color: 0xffa500,
        title: '🚪 Member Left',
        fields: [getUserInfo(member.user)],
        timestamp: new Date()
    };
    sendLog(embed);
});

// --- BAN EVENTS ---
client.on('guildBanAdd', async (guild, user) => {
    if (guild.id !== MONITOR_GUILD_ID) return;
    const audit = await guild.fetchAuditLogs({ limit: 1, type: AuditLogEvent.MemberBanAdd });
    const entry = audit.entries.first();
    const embed = {
        color: 0xff0000,
        title: '⛔ User Banned',
        fields: [
            getUserInfo(user),
            getExecutorInfo(entry, guild) || {
                name: 'Moderator',
                value: 'Could not retrieve.',
                inline: false
            }
        ],
        timestamp: new Date()
    };
    sendLog(embed);
});

client.on('guildBanRemove', async (guild, user) => {
    if (guild.id !== MONITOR_GUILD_ID) return;
    const audit = await guild.fetchAuditLogs({ limit: 1, type: AuditLogEvent.MemberBanRemove });
    const entry = audit.entries.first();
    const embed = {
        color: 0x00ccff,
        title: '🔓 User Unbanned',
        fields: [
            getUserInfo(user),
            getExecutorInfo(entry, guild) || {
                name: 'Moderator',
                value: 'Could not retrieve.',
                inline: false
            }
        ],
        timestamp: new Date()
    };
    sendLog(embed);
});

// --- GUILD METADATA EVENTS ---
client.on('guildUpdate', async (oldGuild, newGuild) => {
    if (newGuild.id !== MONITOR_GUILD_ID) return;
    let changes = [];
    if (oldGuild.name !== newGuild.name) {
        changes.push(`**Name:** \`${oldGuild.name}\` → \`${newGuild.name}\``);
    }
    if (oldGuild.region !== newGuild.region) {
        changes.push(`**Region:** \`${oldGuild.region}\` → \`${newGuild.region}\``);
    }
    if (changes.length === 0) return;
    const audit = await newGuild.fetchAuditLogs({ limit: 1, type: AuditLogEvent.GuildUpdate });
    const entry = audit.entries.first();
    const embed = {
        color: 0x800080,
        title: `🌐 Server Updated: ${newGuild.name}`,
        description: changes.join('\n'),
        fields: [
            getExecutorInfo(entry, newGuild) || {
                name: 'Moderator',
                value: 'Could not retrieve.',
                inline: false
            }
        ],
        timestamp: new Date()
    };
    sendLog(embed);
});

// --- CHANNEL EVENTS ---
client.on('channelCreate', async channel => {
    if (channel.guild?.id !== MONITOR_GUILD_ID) return;
    const audit = await channel.guild.fetchAuditLogs({ limit: 1, type: AuditLogEvent.ChannelCreate });
    const entry = audit.entries.first();
    const embed = {
        color: 0x00ccff,
        title: `${channel.isText() ? '📝' : '🔊'} Channel Created: ${channel.name}`,
        description: `**Type:** ${channel.type}`,
        fields: [
            { name: 'Channel ID', value: channel.id },
            getExecutorInfo(entry, channel.guild) || {
                name: 'Moderator',
                value: 'Could not retrieve.',
                inline: false
            }
        ],
        timestamp: new Date()
    };
    sendLog(embed);
});

client.on('channelDelete', async channel => {
    if (channel.guild?.id !== MONITOR_GUILD_ID) return;
    const audit = await channel.guild.fetchAuditLogs({ limit: 1, type: AuditLogEvent.ChannelDelete });
    const entry = audit.entries.first();
    const embed = {
        color: 0xff6347,
        title: '❌ Channel Deleted',
        description: `**Name:** ${channel.name}
**Type:** ${channel.type}`,
        fields: [
            { name: 'Channel ID', value: channel.id },
            getExecutorInfo(entry, channel.guild) || {
                name: 'Moderator',
                value: 'Could not retrieve.',
                inline: false
            }
        ],
        timestamp: new Date()
    };
    sendLog(embed);
});

client.on('channelUpdate', async (oldChannel, newChannel) => {
    if (newChannel.guild?.id !== MONITOR_GUILD_ID) return;
    let changes = [];
    if (oldChannel.name !== newChannel.name) {
        changes.push(`**Name:** \`${oldChannel.name}\` → \`${newChannel.name}\``);
    }
    if (oldChannel.position !== newChannel.position) {
        changes.push(`**Position:** \`${oldChannel.position}\` → \`${newChannel.position}\``);
    }
    if (changes.length === 0) return;
    const audit = await newChannel.guild.fetchAuditLogs({ limit: 1, type: AuditLogEvent.ChannelUpdate });
    const entry = audit.entries.first();
    const embed = {
        color: 0xffd700,
        title: `📝 Channel Updated: ${newChannel.name}`,
        description: changes.join('\n'),
        fields: [
            { name: 'Channel ID', value: newChannel.id },
            getExecutorInfo(entry, newChannel.guild) || {
                name: 'Moderator',
                value: 'Could not retrieve.',
                inline: false
            }
        ],
        timestamp: new Date()
    };
    sendLog(embed);
});

// --- ROLE EVENTS ---
client.on('roleCreate', async role => {
    if (role.guild.id !== MONITOR_GUILD_ID) return;
    const audit = await role.guild.fetchAuditLogs({ limit: 1, type: AuditLogEvent.RoleCreate });
    const entry = audit.entries.first();
    const embed = {
        color: 0x800080,
        title: '🆕 Role Created',
        description: `**Role Name:** ${role.name}`,
        fields: [
            { name: 'Role ID', value: role.id },
            getExecutorInfo(entry, role.guild) || {
                name: 'Moderator',
                value: 'Could not retrieve.',
                inline: false
            }
        ],
        timestamp: new Date()
    };
    sendLog(embed);
});

client.on('roleDelete', async role => {
    if (role.guild.id !== MONITOR_GUILD_ID) return;
    const audit = await role.guild.fetchAuditLogs({ limit: 1, type: AuditLogEvent.RoleDelete });
    const entry = audit.entries.first();
    const embed = {
        color: 0xff6347,
        title: '❌ Role Deleted',
        description: `**Role Name:** ${role.name}`,
        fields: [
            { name: 'Role ID', value: role.id },
            getExecutorInfo(entry, role.guild) || {
                name: 'Moderator',
                value: 'Could not retrieve.',
                inline: false
            }
        ],
        timestamp: new Date()
    };
    sendLog(embed);
});

client.on('roleUpdate', async (oldRole, newRole) => {
    if (newRole.guild.id !== MONITOR_GUILD_ID) return;
    let changes = [];
    if (oldRole.name !== newRole.name) {
        changes.push(`**Name:** \`${oldRole.name}\` → \`${newRole.name}\``);
    }
    if (oldRole.color !== newRole.color) {
        changes.push(`**Color:** \`${oldRole.color.toString(16)}\` → \`${newRole.color.toString(16)}\``);
    }
    if (changes.length === 0) return;
    const audit = await newRole.guild.fetchAuditLogs({ limit: 1, type: AuditLogEvent.RoleUpdate });
    const entry = audit.entries.first();
    const embed = {
        color: 0xffff00,
        title: `🎭 Role Updated: ${newRole.name}`,
        description: changes.join('\n'),
        fields: [
            { name: 'Role ID', value: newRole.id },
            getExecutorInfo(entry, newRole.guild) || {
                name: 'Moderator',
                value: 'Could not retrieve.',
                inline: false
            }
        ],
        timestamp: new Date()
    };
    sendLog(embed);
});

// --- VOICE STATE ---
client.on('voiceStateUpdate', (oldState, newState) => {
    if (!newState.guild || newState.guild.id !== MONITOR_GUILD_ID) return;
    let title = '';
    let description = '';
    if (!oldState.channel && newState.channel) {
        title = '🔊 Joined Voice';
        description = `**Channel:** <#${newState.channel.id}>`;
    } else if (oldState.channel && !newState.channel) {
        title = '🔇 Left Voice';
        description = `**Channel:** <#${oldState.channel.id}>`;
    } else if (oldState.channel && newState.channel && oldState.channel.id !== newState.channel.id) {
        title = '🔁 Moved Voice';
        description = `**From:** <#${oldState.channel.id}> → **To:** <#${newState.channel.id}>`;
    } else if (oldState.mute !== newState.mute) {
        title = newState.mute ? '🔇 Muted' : '🔊 Unmuted';
    } else if (oldState.deaf !== newState.deaf) {
        title = newState.deaf ? '🎧 Deafened' : '🔊 Undeafened';
    } else {
        return;
    }
    const embed = {
        color: 0x0099ff,
        title,
        description,
        fields: [getUserInfo(newState.member.user)],
        timestamp: new Date()
    };
    sendLog(embed);
});

// Start the bot
client.login(process.env.TOKEN);
