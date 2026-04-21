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

const {
  DISCORD_TOKEN: TOKEN,
  DISCORD_CLIENT_ID: CLIENT_ID,
  DISCORD_GUILD_ID: GUILD_ID,
  SUPPORT_ROLE_ID,
  FRP_CATEGORY_ID,
  VIP_CATEGORY_ID,
  GANG_APPLY_CATEGORY_ID,
  FACTION_APPLY_CATEGORY_ID,
  TRANSCRIPT_CHANNEL_ID,
} = process.env;

const DEFAULT_CATEGORY_IDS = {
  frp: '1495469385853173952',
  vip: '1493158192266608731',
  gang_apply: '1495443479260827738',
  faction_apply: '1493158395191234611',
};

const DEFAULT_GUILD_ID = '1468448626169745478';
const ACTIVE_GUILD_ID = GUILD_ID || DEFAULT_GUILD_ID;

if (!TOKEN || !CLIENT_ID) {
  console.error('Missing required env vars: DISCORD_TOKEN, DISCORD_CLIENT_ID');
  process.exit(1);
}

const commands = [
  new SlashCommandBuilder()
    .setName('ticket-panel')
    .setDescription('Post the ticket open panel in the current channel.')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
  new SlashCommandBuilder()
    .setName('ticket-close')
    .setDescription('Close the current ticket channel.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),
].map((command) => command.toJSON());

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent],
});

function sanitizeUsername(username) {
  return username.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').slice(0, 80);
}

function buildTicketName(user) {
  return `ticket-${sanitizeUsername(user.username) || user.id.slice(0, 6)}`;
}

const ticketTypes = {
  frp: {
    key: 'frp',
    label: 'FRP',
    emoji: '🛟',
    buttonStyle: ButtonStyle.Primary,
    description: 'FRP support ticket.',
    categoryId: FRP_CATEGORY_ID || DEFAULT_CATEGORY_IDS.frp,
  },
  vip: {
    key: 'vip',
    label: 'VIP',
    emoji: '💎',
    buttonStyle: ButtonStyle.Success,
    description: 'VIP support and premium member requests.',
    categoryId: VIP_CATEGORY_ID || DEFAULT_CATEGORY_IDS.vip,
  },
  gang_apply: {
    key: 'gang_apply',
    label: 'Gang Apply',
    emoji: '📝',
    buttonStyle: ButtonStyle.Secondary,
    description: 'Application ticket for gang/team joining.',
    categoryId: GANG_APPLY_CATEGORY_ID || DEFAULT_CATEGORY_IDS.gang_apply,
  },
  faction_apply: {
    key: 'faction_apply',
    label: 'Faction Apply',
    emoji: '🏴',
    buttonStyle: ButtonStyle.Secondary,
    description: 'Application ticket for faction recruitment.',
    categoryId: FACTION_APPLY_CATEGORY_ID || DEFAULT_CATEGORY_IDS.faction_apply,
  },
};

async function registerCommands() {
  const rest = new REST({ version: '10' }).setToken(TOKEN);
  await rest.put(Routes.applicationGuildCommands(CLIENT_ID, ACTIVE_GUILD_ID), { body: commands });
  console.log('Slash commands registered.');
}

function getTicketCategoryId(ticketTypeKey) {
  return ticketTypes[ticketTypeKey]?.categoryId || null;
}

function getTicketTopic(userId, ticketTypeKey) {
  return `ticket-owner:${userId};ticket-type:${ticketTypeKey}`;
}

function getTicketTypeFromTopic(topic) {
  if (!topic) return 'unknown';
  const match = topic.match(/ticket-type:([a-z_]+)/);
  return match?.[1] || 'unknown';
}

async function createTicketChannel(interaction, ticketTypeKey) {
  const ticketType = ticketTypes[ticketTypeKey];
  if (!ticketType) {
    await interaction.reply({ content: 'Unknown ticket type.', ephemeral: true });
    return;
  }

  const ticketName = `${ticketType.key}-${buildTicketName(interaction.user)}`;
  const categoryId = getTicketCategoryId(ticketTypeKey);
  if (!categoryId) {
    await interaction.reply({
      content: `Category is not configured for **${ticketType.label}** tickets. Set the related *_CATEGORY_ID in .env.`,
      ephemeral: true,
    });
    return;
  }

  const existing = interaction.guild.channels.cache.find(
    (channel) => channel.type === ChannelType.GuildText && channel.name === ticketName
  );

  if (existing) {
    await interaction.reply({ content: `You already have an open ticket: ${existing}`, ephemeral: true });
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
    name: ticketName,
    type: ChannelType.GuildText,
    parent: categoryId,
    topic: getTicketTopic(interaction.user.id, ticketTypeKey),
    permissionOverwrites,
  });

  const closeButton = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('ticket:close').setLabel('Close Ticket').setStyle(ButtonStyle.Danger)
  );

  await ticketChannel.send({
    content: `${interaction.user} ${SUPPORT_ROLE_ID ? `<@&${SUPPORT_ROLE_ID}>` : ''}`.trim(),
    embeds: [
      new EmbedBuilder()
        .setTitle(`${ticketType.label} Ticket Opened`)
        .setColor(0x57f287)
        .setDescription(`Type: **${ticketType.label}**\n${ticketType.description}\n\nPlease explain your issue. A support member will assist you shortly.`),
    ],
    components: [closeButton],
  });

  await interaction.reply({ content: `Ticket created: ${ticketChannel}`, ephemeral: true });
}

async function closeTicket(interaction) {
  const channel = interaction.channel;

  if (!channel || (!channel.name.includes('-ticket-') && !channel.name.startsWith('ticket-'))) {
    await interaction.reply({ content: 'This is not a ticket channel.', ephemeral: true });
    return;
  }

  await channel.messages.fetch({ limit: 100 }).catch(() => null);
  const ticketType = getTicketTypeFromTopic(channel.topic);

  const transcript = channel.messages.cache
    .sort((a, b) => a.createdTimestamp - b.createdTimestamp)
    .map((msg) => `[${new Date(msg.createdTimestamp).toISOString()}] ${msg.author.tag}: ${msg.content || '[embed/attachment]'}`)
    .join('\n')
    .slice(0, 3900);

  if (TRANSCRIPT_CHANNEL_ID) {
    const transcriptChannel = await interaction.guild.channels.fetch(TRANSCRIPT_CHANNEL_ID).catch(() => null);
    if (transcriptChannel?.isTextBased()) {
      await transcriptChannel.send({
        embeds: [
          new EmbedBuilder()
            .setTitle('Ticket Closed')
            .setColor(0xed4245)
            .addFields(
              { name: 'Channel', value: `${channel.name}`, inline: true },
              { name: 'Type', value: ticketType, inline: true },
              { name: 'Closed By', value: `${interaction.user.tag}`, inline: true },
              { name: 'Transcript (latest cached messages)', value: transcript || 'No cached messages.' }
            ),
        ],
      });
    }
  }

  await interaction.reply({ content: 'Closing ticket in 3 seconds...' });
  setTimeout(async () => {
    if (channel.deletable) {
      await channel.delete(`Closed by ${interaction.user.tag}`);
    }
  }, 3000);
}

client.once(Events.ClientReady, () => {
  console.log(`Logged in as ${client.user.tag}`);
});

client.on(Events.InteractionCreate, async (interaction) => {
  try {
    if (interaction.isChatInputCommand()) {
      if (interaction.commandName === 'ticket-panel') {
        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId('ticket:create:frp')
            .setLabel('FRP Ticket')
            .setStyle(ticketTypes.frp.buttonStyle)
            .setEmoji(ticketTypes.frp.emoji),
          new ButtonBuilder()
            .setCustomId('ticket:create:vip')
            .setLabel('VIP Ticket')
            .setStyle(ticketTypes.vip.buttonStyle)
            .setEmoji(ticketTypes.vip.emoji),
          new ButtonBuilder()
            .setCustomId('ticket:create:gang_apply')
            .setLabel('Gang Apply Ticket')
            .setStyle(ticketTypes.gang_apply.buttonStyle)
            .setEmoji(ticketTypes.gang_apply.emoji),
          new ButtonBuilder()
            .setCustomId('ticket:create:faction_apply')
            .setLabel('Faction Apply Ticket')
            .setStyle(ticketTypes.faction_apply.buttonStyle)
            .setEmoji(ticketTypes.faction_apply.emoji)
        );

        const embed = new EmbedBuilder()
          .setColor(0x5865f2)
          .setTitle('Support Ticket')
          .setDescription('Press a button to open the ticket category you need: FRP, VIP, Gang Apply, or Faction Apply.');

        await interaction.reply({ embeds: [embed], components: [row] });
      }

      if (interaction.commandName === 'ticket-close') {
        await closeTicket(interaction);
      }
    }

    if (interaction.isButton()) {
      if (interaction.customId.startsWith('ticket:create:')) {
        const ticketTypeKey = interaction.customId.split(':')[2];
        await createTicketChannel(interaction, ticketTypeKey);
      }

      if (interaction.customId === 'ticket:close') {
        await closeTicket(interaction);
      }
    }
  } catch (error) {
    console.error('Interaction error:', error);
    if (interaction.deferred || interaction.replied) {
      await interaction.followUp({ content: 'An error occurred while handling this interaction.', ephemeral: true });
    } else {
      await interaction.reply({ content: 'An error occurred while handling this interaction.', ephemeral: true });
    }
  }
});

(async () => {
  await registerCommands();
  await client.login(TOKEN);
})();
