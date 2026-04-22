# Discord Ticket Bot (All Files Included)

This folder is a complete standalone Node.js ticket bot.

## Files
- `package.json` - dependencies and scripts
- `.env.example` - required environment variables
- `src/index.js` - bot logic (commands, buttons, ticket channels, close flow)

## Setup
```bash
cd ticket-bot
npm install
cp .env.example .env
# Edit .env with your bot + guild IDs
npm run start
```

## TicketTool Dashboard Website
Run the dashboard UI to manage ticket category IDs and generate `.env` content:

```bash
cd ticket-bot
npm run dashboard
```

Open `http://localhost:3000` in your browser.

## Commands
- `/ticket-panel` → posts a ticket creation button.
- `/ticket-close` → closes the current ticket channel.

## Ticket Types
- **FRP** ticket
- **VIP** ticket
- **Gang Apply** ticket
- **Faction Apply** ticket

## Env vars
- `SUPPORT_ROLE_ID` for support team access.
- `DISCORD_GUILD_ID` defaults to `1468448626169745478` if omitted.
- `FRP_CATEGORY_ID` separate category for FRP tickets.
- `VIP_CATEGORY_ID` separate category for VIP tickets.
- `GANG_APPLY_CATEGORY_ID` separate category for Gang Apply tickets.
- `FACTION_APPLY_CATEGORY_ID` separate category for Faction Apply tickets.
- `TRANSCRIPT_CHANNEL_ID` to receive a close summary.

> Default category IDs are preconfigured in `src/index.js`:
> FRP `1495469385853173952`, VIP `1493158192266608731`, Gang `1495443479260827738`, Faction `1493158395191234611`.
