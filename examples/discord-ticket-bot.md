# Discord Ticket Bot (Node.js + discord.js v14)

A minimal ticket bot that uses slash commands and buttons.

## Features
- `/setup-ticket` posts a **Create Ticket** button.
- `/close-ticket` closes a ticket channel.
- Button-based ticket create/close flow.
- Private ticket channels with permission overwrites.

## 1) Create `.env`

```bash
DISCORD_TOKEN=your_bot_token
DISCORD_CLIENT_ID=your_application_id
DISCORD_GUILD_ID=your_test_guild_id
SUPPORT_ROLE_ID=optional_support_role_id
TICKET_CATEGORY_ID=optional_category_channel_id
```

## 2) Run

```bash
node examples/discord-ticket-bot.js
```

## Notes
- Keep this running while you test commands.
- Guild command registration is instant for the configured guild.
- For production, consider transcripts + persistent ticket tracking in a DB.
