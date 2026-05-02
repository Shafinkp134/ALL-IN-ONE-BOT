const fs = require('fs');
const path = require('path');
const { REST, Routes } = require('discord.js');

const PHPMYADMIN_ONLY = String(process.env.PHPMYADMIN_ONLY || 'true').toLowerCase() === 'true';

module.exports = async (client, config, colors) => {
    const commandsPath = path.join(__dirname, '../commands');
    const commandFolders = fs.readdirSync(commandsPath);
    const enabledCommandFolders = PHPMYADMIN_ONLY
        ? commandFolders.filter(folder => folder === 'core')
        : commandFolders.filter(folder => config.categories[folder]);

    const commands = [];

    for (const folder of enabledCommandFolders) {
        const commandFiles = fs.readdirSync(path.join(commandsPath, folder)).filter(file => file.endsWith('.js'));

        for (const file of commandFiles) {
            const command = require(path.join(commandsPath, folder, file));
            if (PHPMYADMIN_ONLY && command.data.name !== 'phpmyadmin') continue;
            client.commands.set(command.data.name, command);
            commands.push(command.data.toJSON());
        }
    }

    // ✅ Register commands to Discord
    const rest = new REST({ version: '10' }).setToken(process.env.TOKEN || config.token);

    try {
        const registeredCommands = await rest.get(
            Routes.applicationCommands(client.user.id)
        );

        console.log('\n' + '─'.repeat(40));
        console.log(`${colors.yellow}${colors.bright}⚡ SLASH COMMANDS${colors.reset}`);
        console.log('─'.repeat(40));

        if (registeredCommands.length !== commands.length) {
            console.log(`${colors.red}[ LOADER ]${colors.reset} ${colors.green}Loading Slash Commands 🛠️${colors.reset}`);
        }

        await rest.put(
            Routes.applicationCommands(client.user.id),
            { body: commands }
        );

        console.log(`${colors.red}[ LOADER ]${colors.reset} ${colors.green}Successfully Loaded Slash Commands ✅${colors.reset}`);
    } catch (error) {
        console.log(`${colors.red}[ ERROR ]${colors.reset} ${colors.red}${error}${colors.reset}`);
    }
};
