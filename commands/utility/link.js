const { SlashCommandBuilder, EmbedBuilder, PermissionsBitField } = require('discord.js');
const {
    isConfigured,
    linkAccount,
    getLinkByDiscordId,
    unlinkAccountByDiscord,
    findUserRecordByName
} = require('../../services/mysqlLinkService');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('link')
        .setDescription('Link a Discord account to an in-game name (MySQL).')
        .addSubcommand(sub =>
            sub
                .setName('account')
                .setDescription('Select Discord account + in-game name, validate from MySQL users table, and link them.')
                .addUserOption(option =>
                    option
                        .setName('discord_account')
                        .setDescription('Discord account to link')
                        .setRequired(true)
                )
                .addStringOption(option =>
                    option
                        .setName('ingame_name')
                        .setDescription('In-game name to link')
                        .setRequired(true)
                )
        )
        .addSubcommand(sub =>
            sub
                .setName('status')
                .setDescription('Show current linked account status.')
                .addUserOption(option =>
                    option
                        .setName('discord_account')
                        .setDescription('Optional user to check (admins only)')
                        .setRequired(false)
                )
        )
        .addSubcommand(sub =>
            sub
                .setName('unlink')
                .setDescription('Remove link from a Discord account.')
                .addUserOption(option =>
                    option
                        .setName('discord_account')
                        .setDescription('Discord account to unlink (default: yourself)')
                        .setRequired(false)
                )
        ),

    async execute(ctx, args = []) {
        if (ctx.isCommand && ctx.isCommand()) {
            return this.handleSlash(ctx);
        }

        return this.handleMessage(ctx, args);
    },

    async handleSlash(interaction) {
        const subcommand = interaction.options.getSubcommand();

        if (!isConfigured()) {
            return interaction.reply({
                content: '❌ MySQL is not configured. Add MYSQL_HOST, MYSQL_USER, MYSQL_PASSWORD, MYSQL_DATABASE env vars.',
                ephemeral: true
            });
        }

        if (subcommand === 'account') {
            if (!this.canManageLinks(interaction.member)) {
                return interaction.reply({ content: '❌ You need Manage Nicknames or Administrator permission to link other users.', ephemeral: true });
            }

            const targetUser = interaction.options.getUser('discord_account', true);
            const ingameName = interaction.options.getString('ingame_name', true).trim();
            return this.processLink(interaction, targetUser, ingameName, true);
        }

        if (subcommand === 'status') {
            const targetUser = interaction.options.getUser('discord_account') || interaction.user;
            if (targetUser.id !== interaction.user.id && !this.canManageLinks(interaction.member)) {
                return interaction.reply({ content: '❌ You can only view your own status without permissions.', ephemeral: true });
            }
            return this.processStatus(interaction, targetUser, true);
        }

        if (subcommand === 'unlink') {
            const targetUser = interaction.options.getUser('discord_account') || interaction.user;
            if (targetUser.id !== interaction.user.id && !this.canManageLinks(interaction.member)) {
                return interaction.reply({ content: '❌ You need permissions to unlink another user.', ephemeral: true });
            }
            return this.processUnlink(interaction, targetUser, true);
        }

        return interaction.reply({ content: '❌ Unknown subcommand.', ephemeral: true });
    },

    async handleMessage(message, args) {
        if (!isConfigured()) {
            return message.reply('❌ MySQL is not configured. Add MYSQL_HOST, MYSQL_USER, MYSQL_PASSWORD, MYSQL_DATABASE env vars.');
        }

        const action = (args[0] || '').toLowerCase();

        if (!action || action === 'help') {
            return message.reply('Usage: `!link @discordUser <ingame_name>` | `!link status [@discordUser]` | `!link unlink [@discordUser]`');
        }

        if (action === 'status') {
            const targetUser = message.mentions.users.first() || message.author;
            if (targetUser.id !== message.author.id && !this.canManageLinks(message.member)) {
                return message.reply('❌ You can only view your own status without permissions.');
            }
            return this.processStatus(message, targetUser, false);
        }

        if (action === 'unlink') {
            const targetUser = message.mentions.users.first() || message.author;
            if (targetUser.id !== message.author.id && !this.canManageLinks(message.member)) {
                return message.reply('❌ You need permissions to unlink another user.');
            }
            return this.processUnlink(message, targetUser, false);
        }

        if (!this.canManageLinks(message.member)) {
            return message.reply('❌ You need Manage Nicknames or Administrator permission to link users.');
        }

        const targetUser = message.mentions.users.first();
        if (!targetUser) {
            return message.reply('❌ Mention the Discord user to link. Example: `!link @User InGameName`');
        }

        const ingameName = args.slice(1).join(' ').trim();
        if (!ingameName) {
            return message.reply('❌ Please provide an in-game name. Example: `!link @User InGameName`');
        }

        return this.processLink(message, targetUser, ingameName, false);
    },

    async processLink(ctx, targetUser, ingameName, ephemeral) {
        try {
            const normalizedIngameName = String(ingameName || '').trim();
            if (!normalizedIngameName) {
                return this.reply(ctx, { content: '❌ In-game name is required.', ephemeral });
            }

            const userRow = await findUserRecordByName(normalizedIngameName);
            if (!userRow) {
                return this.reply(ctx, {
                    content: `❌ In-game name \`${normalizedIngameName}\` was not found in MySQL users list.`,
                    ephemeral
                });
            }

            const linked = await linkAccount({
                accountIdentifier: normalizedIngameName,
                discordUserId: targetUser.id,
                discordTag: targetUser.tag,
                guildId: ctx.guild?.id || null
            });

            const nicknameResult = await this.trySyncNickname(ctx, targetUser.id, normalizedIngameName);

            const embed = new EmbedBuilder()
                .setColor('#2ecc71')
                .setTitle('✅ Account Linked')
                .setDescription('Discord account and in-game name have been linked successfully.')
                .addFields(
                    { name: 'Discord User', value: `<@${targetUser.id}>`, inline: true },
                    { name: 'In-Game Name', value: `\`${linked.account_identifier}\``, inline: true },
                    { name: 'Database Match', value: 'Found in MySQL users list', inline: true },
                    { name: 'Nickname Sync', value: nicknameResult, inline: false }
                )
                .setTimestamp();

            return this.reply(ctx, { embeds: [embed], ephemeral });
        } catch (error) {
            return this.reply(ctx, { content: `❌ ${error.message}`, ephemeral });
        }
    },

    async processStatus(ctx, targetUser, ephemeral) {
        try {
            const linked = await getLinkByDiscordId(targetUser.id);

            if (!linked) {
                return this.reply(ctx, {
                    content: `ℹ️ No linked account found for <@${targetUser.id}>.`,
                    ephemeral
                });
            }

            const embed = new EmbedBuilder()
                .setColor('#3498db')
                .setTitle('🔗 Link Status')
                .addFields(
                    { name: 'Discord User', value: `<@${targetUser.id}>`, inline: true },
                    { name: 'In-Game Name', value: `\`${linked.account_identifier}\``, inline: true },
                    { name: 'Linked At', value: `<t:${Math.floor(new Date(linked.linked_at).getTime() / 1000)}:F>`, inline: false }
                )
                .setTimestamp();

            return this.reply(ctx, { embeds: [embed], ephemeral });
        } catch (error) {
            return this.reply(ctx, { content: `❌ ${error.message}`, ephemeral });
        }
    },

    async processUnlink(ctx, targetUser, ephemeral) {
        try {
            const removed = await unlinkAccountByDiscord(targetUser.id);

            if (!removed) {
                return this.reply(ctx, {
                    content: `ℹ️ <@${targetUser.id}> does not have any linked account to remove.`,
                    ephemeral
                });
            }

            return this.reply(ctx, {
                content: `✅ Link removed for <@${targetUser.id}>.`,
                ephemeral
            });
        } catch (error) {
            return this.reply(ctx, { content: `❌ ${error.message}`, ephemeral });
        }
    },

    async trySyncNickname(ctx, targetUserId, nicknameTarget) {
        const guild = ctx.guild;
        if (!guild) {
            return '⚠️ Nickname sync skipped (no guild context).';
        }

        const botMember = guild.members.me;
        if (!botMember) {
            return '⚠️ Nickname sync skipped (bot member missing).';
        }

        if (!botMember.permissions.has(PermissionsBitField.Flags.ManageNicknames)) {
            return '⚠️ Nickname sync failed: bot needs `Manage Nicknames` permission.';
        }

        const targetMember = await guild.members.fetch(targetUserId).catch(() => null);
        if (!targetMember) {
            return '⚠️ Nickname sync failed: target member not found in guild.';
        }

        if (!targetMember.manageable) {
            return '⚠️ Nickname sync failed: target member role is higher than bot role.';
        }

        const safeNickname = nicknameTarget.slice(0, 32);
        await targetMember.setNickname(safeNickname, 'Linked in-game account sync');

        return `✅ Discord nickname changed to \`${safeNickname}\``;
    },

    canManageLinks(member) {
        if (!member || !member.permissions) return false;
        return (
            member.permissions.has(PermissionsBitField.Flags.Administrator) ||
            member.permissions.has(PermissionsBitField.Flags.ManageNicknames)
        );
    },

    reply(ctx, payload) {
        if (ctx.isCommand && ctx.isCommand()) {
            return ctx.reply(payload);
        }

        if (payload.embeds) {
            return ctx.reply({ embeds: payload.embeds });
        }

        return ctx.reply(payload.content);
    }
};
