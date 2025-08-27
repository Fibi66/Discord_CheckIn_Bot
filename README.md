# Discord Check-In Bot

**Built with: Cloudflare Workers | Discord API | D1 Database | JavaScript**

![Confidence Level Meme](1730642416968.jpg)

A Discord bot designed to track LeetCode study group check-ins and boost organizational engagement.

## Commands

### `/checkin`
Daily check-in to maintain your study streak.

### `/board`
Shows top 10 members ranked by consecutive check-in days.

### `/leaveday`
Use your weekly leave pass to make up for yesterday's missed check-in.

## Setup

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

The secret variable must be named exactly: `DISCORD_PUBLIC_KEY`

The database binding must be named exactly: `db`