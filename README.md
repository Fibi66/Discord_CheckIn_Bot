# Discord Check-In Bot

![Confidence Level Meme](1730642416968.jpg)

A Discord bot designed to track LeetCode study group check-ins and boost organizational engagement.

## Purpose

This bot helps LeetCode study groups maintain accountability and motivation by:
- Tracking daily check-ins from members
- Recording progress and participation
- Encouraging consistent practice through automated reminders

## Setup

### Prerequisites
- Discord server with administrator permissions
- Cloudflare Workers account
- Discord Application and Bot Token

### Installation Steps

1. **Create Discord Application**
   - Go to [Discord Developer Portal](https://discord.com/developers/applications)
   - Create a new application
   - Navigate to Bot section and create a bot
   - Copy the Bot Token

2. **Set up Discord Guild**
   - Invite the bot to your server with necessary permissions
   - Note your Guild ID (Server ID)

3. **Configure Cloudflare Workers**
   - Deploy the worker script to your Cloudflare Workers account
   - Set up the following environment variables:

### Required Secrets Configuration

Configure these secrets in your Cloudflare Workers settings:

- `DISCORD_TOKEN`: Your Discord bot token
- `DISCORD_APPLICATION_ID`: Your Discord application ID  
- `DISCORD_PUBLIC_KEY`: Your Discord application public key
- `DISCORD_GUILD_ID`: Your Discord server/guild ID

### Database Setup

The database binding must be named exactly: `DB`

Create a D1 database in Cloudflare and bind it to your worker with the name `DB`.

### Deployment

```bash
npm install
npx wrangler deploy
```

## Usage

Once deployed, the bot will automatically track check-ins in your Discord server and help maintain engagement in your LeetCode study group.