
require('dotenv').config();

const {
    Client,
    GatewayIntentBits,
    REST,
    Routes,
    SlashCommandBuilder
} = require('discord.js');

const client = new Client({
    intents: [GatewayIntentBits.Guilds]
});

// Create the /ping command
const commands = [
    new SlashCommandBuilder()
        .setName('ping')
        .setDescription('Check if the bot is alive!')
        .toJSON()
];

// Register the command in your test server
const rest = new REST({ version: '10' })
    .setToken(process.env.DISCORD_TOKEN);

async function startBot() {
    try {
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
        console.error('Error:', error);
    }
}

client.once('ready', () => {
    console.log(`🖤 ${client.user.tag} is online!`);
});

client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;

    if (interaction.commandName === 'ping') {
        await interaction.reply({
            content: '🏓 **Pong!** I am alive and working! 🖤'
        });
    }
});

startBot();
