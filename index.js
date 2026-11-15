
require('dotenv').config();

const fs = require('fs');
const path = require('path');

const {
    Client,
    GatewayIntentBits,
    REST,
    Routes,
    SlashCommandBuilder,
    EmbedBuilder,
    Events
} = require('discord.js');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

const startTime = Date.now();

// ================================
// SETTINGS
// ================================

const DISBOARD_ID = '302050872383242240';
const BUMP_COOLDOWN = 2 * 60 * 60 * 1000;

const WELCOME_CHANNEL_ID = process.env.WELCOME_CHANNEL_ID;
const WELCOME_BANNER_URL = process.env.WELCOME_BANNER_URL;

const REMINDER_FILE = path.join(__dirname, 'bump-reminders.json');

let reminders = {};

try {
    if (fs.existsSync(REMINDER_FILE)) {
        reminders = JSON.parse(fs.readFileSync(REMINDER_FILE, 'utf8'));
    }
} catch (error) {
    console.error('Could not load bump reminders:', error);
    reminders = {};
}

function saveReminders() {
    fs.writeFileSync(
        REMINDER_FILE,
        JSON.stringify(reminders, null, 2)
    );
}

// ================================
// SLASH COMMANDS
// ================================

const commands = [
    new SlashCommandBuilder()
        .setName('ping')
        .setDescription('Check the bot response speed'),

    new SlashCommandBuilder()
        .setName('help')
        .setDescription('View all available commands'),

    new SlashCommandBuilder()
        .setName('userinfo')
        .setDescription('View information about a user')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('The user you want to check')
                .setRequired(false)
        ),

    new SlashCommandBuilder()
        .setName('serverinfo')
        .setDescription('View information about this server'),

    new SlashCommandBuilder()
        .setName('avatar')
        .setDescription('View a user avatar')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('The user whose avatar you want to see')
                .setRequired(false)
        ),

    new SlashCommandBuilder()
        .setName('botinfo')
        .setDescription('View information about Giselle'),

    new SlashCommandBuilder()
        .setName('uptime')
        .setDescription('Check how long the bot has been online')
].map(command => command.toJSON());

// ================================
// EMBED DESIGN
// ================================

function createEmbed(title, description) {
    return new EmbedBuilder()
        .setColor('#2B2D31')
        .setTitle(title)
        .setDescription(description)
        .setFooter({
            text: 'Giselle • Writers Crypt'
        })
        .setTimestamp();
}

function formatDuration(ms) {
    const seconds = Math.floor(ms / 1000) % 60;
    const minutes = Math.floor(ms / 60000) % 60;
    const hours = Math.floor(ms / 3600000) % 24;
    const days = Math.floor(ms / 86400000);

    return `${days}d ${hours}h ${minutes}m ${seconds}s`;
}

// ================================
// WELCOME SYSTEM
// ================================

client.on(Events.GuildMemberAdd, async member => {
    try {
        if (!WELCOME_CHANNEL_ID) {
            console.error('WELCOME_CHANNEL_ID is missing in Railway Variables!');
            return;
        }

        const channel = await client.channels.fetch(WELCOME_CHANNEL_ID);

        if (!channel || !channel.isTextBased()) {
            console.error('Welcome channel could not be found.');
            return;
        }

        const memberNumber = member.guild.memberCount;

        const embed = new EmbedBuilder()
            .setColor('#2B2D31')
            .setAuthor({
                name: 'WRITERS CRYPT • WELCOME',
                iconURL: client.user.displayAvatarURL()
            })
            .setThumbnail(
                member.user.displayAvatarURL({
                    size: 1024,
                    extension: 'png'
                })
            )
            .setTitle('A New Soul Has Entered...')
            .setDescription(
                `Welcome, ${member}!\n\n` +
                `*"Every story begins somewhere. Yours begins here."*\n\n` +
                `Welcome to **Writers Crypt**, a sanctuary for those who write, dream, and create.\n\n` +
                `**✦ Make yourself at home.**\n` +
                `**✦ Read the rules and introduce yourself.**\n` +
                `**✦ Let your imagination wander.**\n\n` +
                `**Member #${memberNumber}**`
            )
            .setFooter({
                text: 'WRITERS CRYPT • ENJOY YOUR STAY'
            })
            .setTimestamp();

        if (WELCOME_BANNER_URL) {
            embed.setImage(WELCOME_BANNER_URL);
        }

        await channel.send({
            content: `Welcome to Writers Crypt, ${member}!`,
            embeds: [embed],
            allowedMentions: {
                users: [member.id]
            }
        });

        console.log(`Welcome message sent for ${member.user.tag}`);

    } catch (error) {
        console.error('Welcome system error:', error);
    }
});

// ================================
// DISBOARD BUMP REMINDER
// ================================

const bumpTimers = new Map();

function scheduleBumpReminder(guildId) {
    if (bumpTimers.has(guildId)) {
        clearTimeout(bumpTimers.get(guildId));
        bumpTimers.delete(guildId);
    }

    const reminder = reminders[guildId];

    if (!reminder) return;

    const remaining = reminder.remindAt - Date.now();

    if (remaining <= 0) {
        sendBumpReminder(guildId);
        return;
    }

    const timer = setTimeout(() => {
        sendBumpReminder(guildId);
    }, remaining);

    bumpTimers.set(guildId, timer);
}

async function sendBumpReminder(guildId) {
    const reminder = reminders[guildId];

    if (!reminder) return;

    try {
        const channel = await client.channels.fetch(reminder.channelId);

        if (!channel || !channel.isTextBased()) {
            console.error('Bump reminder channel could not be found.');
            return;
        }

        const content = reminder.userId
            ? `<@${reminder.userId}> It's time to bump **Writers Crypt** again! Use \`/bump\` to keep our server visible on DISBOARD.`
            : `It's time to bump **Writers Crypt** again! Use \`/bump\` to keep our server visible on DISBOARD.`;

        await channel.send({
            content,
            allowedMentions: {
                users: reminder.userId ? [reminder.userId] : []
            }
        });

        console.log(`Bump reminder sent in guild ${guildId}.`);

    } catch (error) {
        console.error('Failed to send bump reminder:', error);
    } finally {
        delete reminders[guildId];
        bumpTimers.delete(guildId);
        saveReminders();
    }
}

// Detect DISBOARD confirmation.
client.on(Events.MessageCreate, async message => {
    try {
        if (!message.guild) return;
        if (message.author.id !== DISBOARD_ID) return;

        const embedText = message.embeds
            .map(embed => [
                embed.title || '',
                embed.description || '',
                ...(embed.fields || []).map(field =>
                    `${field.name} ${field.value}`
                )
            ].join(' '))
            .join(' ');

        const confirmationText = `${message.content} ${embedText}`;

        if (!/thank you for bumping|bump done|check it out on disboard|successfully bumped/i.test(confirmationText)) {
            return;
        }

        const bumper =
            message.interactionMetadata?.user ||
            message.interaction?.user ||
            message.mentions.users.first() ||
            null;

        const bumperId = bumper?.id || null;

        reminders[message.guild.id] = {
            channelId: message.channel.id,
            userId: bumperId,
            remindAt: Date.now() + BUMP_COOLDOWN
        };

        saveReminders();
        scheduleBumpReminder(message.guild.id);

        console.log('Successful DISBOARD bump detected!');
        console.log(`Bumper: ${bumperId || 'Not available'}`);

        await message.react('⏰').catch(() => {});

        await message.channel.send({
            content: bumperId
                ? `Thank you for bumping, <@${bumperId}>! The next bump is available <t:${Math.floor(reminders[message.guild.id].remindAt / 1000)}:R>.`
                : `Thank you for bumping Writers Crypt! The next bump is available <t:${Math.floor(reminders[message.guild.id].remindAt / 1000)}:R>.`,
            allowedMentions: {
                users: bumperId ? [bumperId] : []
            }
        });

    } catch (error) {
        console.error('Bump detection error:', error);
    }
});

// ================================
// BOT READY
// ================================

client.once(Events.ClientReady, readyClient => {
    console.log(`${readyClient.user.tag} is online!`);

    for (const guildId of Object.keys(reminders)) {
        scheduleBumpReminder(guildId);
    }

    console.log('Bump reminder system loaded!');
    console.log('Welcome system loaded!');
});

// ================================
// SLASH COMMAND HANDLER
// ================================

client.on(Events.InteractionCreate, async interaction => {
    if (!interaction.isChatInputCommand()) return;

    try {
        await interaction.deferReply();

        const commandName = interaction.commandName;

        if (commandName === 'ping') {
            return interaction.editReply({
                embeds: [
                    createEmbed(
                        'Pong!',
                        `**WebSocket Latency:** ${client.ws.ping}ms`
                    )
                ]
            });
        }

        if (commandName === 'help') {
            const embed = createEmbed(
                'Giselle’s Command List',
                'Here are the currently available commands.'
            );

            embed.addFields(
                {
                    name: 'General Commands',
                    value:
                        '`/ping` — Check bot response speed\n' +
                        '`/help` — View this command list\n' +
                        '`/userinfo` — View user information\n' +
                        '`/serverinfo` — View server information\n' +
                        '`/avatar` — View a user avatar\n' +
                        '`/botinfo` — View bot information\n' +
                        '`/uptime` — Check bot uptime'
                },
                {
                    name: 'Community Features',
                    value:
                        '**Automatic Welcome** — Welcomes new members with their avatar and a custom banner.\n' +
                        '**Automatic Bump Reminder** — Reminds members when the next DISBOARD bump is available.'
                }
            );

            return interaction.editReply({ embeds: [embed] });
        }

        if (commandName === 'userinfo') {
            const user = interaction.options.getUser('user') || interaction.user;
            const member = await interaction.guild.members.fetch(user.id).catch(() => null);

            const embed = createEmbed(
                'User Information',
                `Information about ${user}.`
            );

            embed.setThumbnail(user.displayAvatarURL({ size: 1024 }));

            embed.addFields(
                {
                    name: 'Username',
                    value: user.tag,
                    inline: true
                },
                {
                    name: 'Bot Account',
                    value: user.bot ? 'Yes' : 'No',
                    inline: true
                },
                {
                    name: 'Account Created',
                    value: `<t:${Math.floor(user.createdTimestamp / 1000)}:F>`
                },
                {
                    name: 'Joined Server',
                    value: member
                        ? `<t:${Math.floor(member.joinedTimestamp / 1000)}:F>`
                        : 'Not available'
                },
                {
                    name: 'User ID',
                    value: user.id
                }
            );

            return interaction.editReply({ embeds: [embed] });
        }

        if (commandName === 'serverinfo') {
            const guild = interaction.guild;
            const owner = await guild.fetchOwner();

            const embed = createEmbed(
                'Server Information',
                `Information about **${guild.name}**.`
            );

            if (guild.iconURL()) {
                embed.setThumbnail(guild.iconURL({ size: 1024 }));
            }

            embed.addFields(
                {
                    name: 'Server Owner',
                    value: owner.user.tag,
                    inline: true
                },
                {
                    name: 'Members',
                    value: `${guild.memberCount}`,
                    inline: true
                },
                {
                    name: 'Channels',
                    value: `${guild.channels.cache.size}`,
                    inline: true
                },
                {
                    name: 'Roles',
                    value: `${guild.roles.cache.size}`,
                    inline: true
                },
                {
                    name: 'Created On',
                    value: `<t:${Math.floor(guild.createdTimestamp / 1000)}:F>`
                },
                {
                    name: 'Server ID',
                    value: guild.id
                }
            );

            return interaction.editReply({ embeds: [embed] });
        }

        if (commandName === 'avatar') {
            const user = interaction.options.getUser('user') || interaction.user;
            const avatar = user.displayAvatarURL({
                size: 1024,
                extension: 'png'
            });

            const embed = createEmbed(
                'Avatar',
                `Avatar of ${user}.`
            );

            embed.setImage(avatar);

            embed.addFields({
                name: 'Direct Link',
                value: `[Click here to view avatar](${avatar})`
            });

            return interaction.editReply({ embeds: [embed] });
        }

        if (commandName === 'botinfo') {
            await client.application.fetch();

            const embed = createEmbed(
                'About Giselle',
                'Your Writers Crypt companion.'
            );

            embed.setThumbnail(client.user.displayAvatarURL({ size: 1024 }));

            embed.addFields(
                {
                    name: 'Bot Name',
                    value: client.user.username,
                    inline: true
                },
                {
                    name: 'Servers',
                    value: `${client.guilds.cache.size}`,
                    inline: true
                },
                {
                    name: 'Created On',
                    value: `<t:${Math.floor(client.user.createdTimestamp / 1000)}:F>`
                },
                {
                    name: 'Discord.js',
                    value: require('discord.js').version,
                    inline: true
                },
                {
                    name: 'Node.js',
                    value: process.version,
                    inline: true
                }
            );

            return interaction.editReply({ embeds: [embed] });
        }

        if (commandName === 'uptime') {
            return interaction.editReply({
                embeds: [
                    createEmbed(
                        'Bot Uptime',
                        `I've been online for:\n\n**${formatDuration(Date.now() - startTime)}**`
                    )
                ]
            });
        }

    } catch (error) {
        console.error('Command Error:', error);

        const errorMessage = {
            content: 'Something went wrong while executing that command. Please try again.',
            embeds: []
        };

        if (interaction.deferred || interaction.replied) {
            await interaction.editReply(errorMessage).catch(console.error);
        } else {
            await interaction.reply({
                ...errorMessage,
                ephemeral: true
            }).catch(console.error);
        }
    }
});

// ================================
// START BOT
// ================================

async function startBot() {
    if (
        !process.env.DISCORD_TOKEN ||
        !process.env.CLIENT_ID ||
        !process.env.GUILD_ID
    ) {
        console.error('Missing Discord environment variables!');
        process.exit(1);
    }

    try {
        const rest = new REST({ version: '10' })
            .setToken(process.env.DISCORD_TOKEN);

        console.log('Registering slash commands...');

        await rest.put(
            Routes.applicationGuildCommands(
                process.env.CLIENT_ID,
                process.env.GUILD_ID
            ),
            { body: commands }
        );

        console.log('Slash commands registered!');

        await client.login(process.env.DISCORD_TOKEN);

    } catch (error) {
        console.error('Failed to start bot:', error);
        process.exit(1);
    }
}

startBot();
