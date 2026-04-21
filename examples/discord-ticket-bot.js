require('dotenv').config();
const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  Client,
  EmbedBuilder,
  Events,
  GatewayIntentBits,
  PermissionFlagsBits,
  REST,
  Routes,
  SlashCommandBuilder,
} = require('discord.js');

const TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.DISCORD_CLIENT_ID;
const GUILD_ID = process.env.DISCORD_GUILD_ID;
const SUPPORT_ROLE_ID = process.env.SUPPORT_ROLE_ID;
const TICKET_CATEGORY_ID = process.env.TICKET_CATEGORY_ID;

if (!TOKEN || !CLIENT_ID || !GUILD_ID) {
  console.error('Missing env vars: DISCORD_TOKEN, DISCORD_CLIENT_ID, DISCORD_GUILD_ID are required.');
  process.exit(1);
}

const commands = [
  new SlashCommandBuilder()
    .setName('setup-ticket')
    .setDescription('Send the ticket creation panel in this channel.')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
  new SlashCommandBuilder()
    .setName('close-ticket')
    .setDescription('Close the current ticket channel.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),
].map((command) => command.toJSON());

async function registerCommands() {
  const rest = new REST({ version: '10' }).setToken(TOKEN);
  await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), { body: commands });
  console.log('✅ Slash commands registered.');
}

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once(Events.ClientReady, () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
});

client.on(Events.InteractionCreate, async (interaction) => {
  try {
    if (interaction.isChatInputCommand()) {
      if (interaction.commandName === 'setup-ticket') {
        const panel = new EmbedBuilder()
          .setTitle('Support Tickets')
          .setDescription('Need help? Click the button below to open a private support ticket.')
          .setColor(0x5865f2);

        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId('ticket:create')
            .setLabel('Create Ticket')
            .setStyle(ButtonStyle.Primary)
            .setEmoji('🎫')
        );

        await interaction.reply({ embeds: [panel], components: [row] });
      }

      if (interaction.commandName === 'close-ticket') {
        if (!interaction.channel.name.startsWith('ticket-')) {
          await interaction.reply({ content: 'This command can only be used in ticket channels.', ephemeral: true });
          return;
        }

        await interaction.reply({ content: 'Closing ticket in 5 seconds...' });
        setTimeout(async () => {
          if (interaction.channel?.deletable) {
            await interaction.channel.delete('Ticket closed by command');
          }
        }, 5000);
      }
    }

    if (interaction.isButton() && interaction.customId === 'ticket:create') {
      const channelName = `ticket-${interaction.user.username}`.toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 90);

      const existing = interaction.guild.channels.cache.find(
        (channel) => channel.type === ChannelType.GuildText && channel.name === channelName
      );

      if (existing) {
        await interaction.reply({ content: `You already have an open ticket: ${existing}.`, ephemeral: true });
        return;
      }

      const permissionOverwrites = [
        {
          id: interaction.guild.roles.everyone.id,
          deny: [PermissionFlagsBits.ViewChannel],
        },
        {
          id: interaction.user.id,
          allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.SendMessages,
            PermissionFlagsBits.ReadMessageHistory,
            PermissionFlagsBits.AttachFiles,
          ],
        },
      ];

      if (SUPPORT_ROLE_ID) {
        permissionOverwrites.push({
          id: SUPPORT_ROLE_ID,
          allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.SendMessages,
            PermissionFlagsBits.ReadMessageHistory,
            PermissionFlagsBits.ManageMessages,
          ],
        });
      }

      const ticketChannel = await interaction.guild.channels.create({
        name: channelName,
        type: ChannelType.GuildText,
        parent: TICKET_CATEGORY_ID || null,
        permissionOverwrites,
        topic: `Ticket owner: ${interaction.user.id}`,
      });

      const closeRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('ticket:close')
          .setLabel('Close Ticket')
          .setStyle(ButtonStyle.Danger)
      );

      await ticketChannel.send({
        content: `${interaction.user} ${SUPPORT_ROLE_ID ? `<@&${SUPPORT_ROLE_ID}>` : ''}`.trim(),
        embeds: [
          new EmbedBuilder()
            .setTitle('Ticket Opened')
            .setDescription('Describe your issue and a staff member will help you soon.')
            .setColor(0x57f287),
        ],
        components: [closeRow],
      });

      await interaction.reply({ content: `Ticket created: ${ticketChannel}`, ephemeral: true });
    }

    if (interaction.isButton() && interaction.customId === 'ticket:close') {
      if (!interaction.channel.name.startsWith('ticket-')) {
        await interaction.reply({ content: 'This button only works inside ticket channels.', ephemeral: true });
        return;
      }

      await interaction.reply({ content: 'Closing ticket in 5 seconds...' });
      setTimeout(async () => {
        if (interaction.channel?.deletable) {
          await interaction.channel.delete('Ticket closed from button');
        }
      }, 5000);
    }
  } catch (error) {
    console.error('Ticket bot error:', error);

    if (interaction.deferred || interaction.replied) {
      await interaction.followUp({ content: 'Something went wrong while processing this interaction.', ephemeral: true });
    } else {
      await interaction.reply({ content: 'Something went wrong while processing this interaction.', ephemeral: true });
    }
  }
});

(async () => {
  await registerCommands();
  await client.login(TOKEN);
})();
