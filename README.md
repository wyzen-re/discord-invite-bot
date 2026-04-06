# Discord Invite Tracker Bot

A powerful Discord bot that tracks server invites and rewards members with customizable roles based on invite milestones.

## ✨ Features

- **Automatic Invite Tracking** - Tracks who invited each new member
- **Invite Leaderboard** - View top inviters with `/leaderboard`
- **Customizable Rewards** - Set role rewards for specific invite milestones
- **Admin Controls** - Easy-to-use admin commands to manage rewards
- **SQLite Database** - Persistent storage of invite data
- **Real-time Updates** - Instant notifications when rewards are unlocked

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- A Discord bot token
- Administrator permissions on your Discord server

### Installation

1. **Clone or download this project**

```bash
git clone https://github.com/yourusername/discord-invite-bot.git
cd discord-invite-bot
```

2. **Install dependencies**

```bash
npm install
```

3. **Configure the bot**

```bash
cp .env.example .env
```

Edit `.env` and add:
- `DISCORD_TOKEN` - Your bot token from Discord Developer Portal
- `CLIENT_ID` - Your bot's application ID

4. **Run the bot**

```bash
node bot.js
```

## 📖 Commands

### User Commands

**`/invites [user]`** - Check invite count
- Shows your total invites or another user's
- Displays recent invites with timestamps

**`/leaderboard [limit]`** - View top inviters
- Shows top 10 inviters by default
- Customizable limit (1-20)
- Displays medals for top 3 (🥇🥈🥉)

### Admin Commands

**`/setreward <milestone> <type> <role>`** - Set a reward
- `milestone` - Number of invites needed (e.g., 5, 10, 25)
- `type` - Type of reward (currently: role)
- `role` - Discord role to give as reward

**`/rewards`** - View all configured rewards
- Shows all active rewards and their milestones
- Admin only

## 🎯 How It Works

1. **Member Joins** - Bot detects which invite was used
2. **Tracking** - Records inviter and invited user
3. **Milestone Check** - Checks if inviter reached a reward milestone
4. **Reward** - Automatically gives role if milestone reached
5. **Notification** - Sends DM to inviter about reward

## 🔧 Setup Guide

### 1. Create a Discord Application

1. Go to [Discord Developer Portal](https://discord.com/developers/applications)
2. Click "New Application"
3. Go to "Bot" section and click "Add Bot"
4. Copy the token and paste it in `.env`

### 2. Get Your Client ID

1. In Developer Portal, go to "General Information"
2. Copy "Application ID" and paste it in `.env`

### 3. Set Bot Permissions

1. Go to "OAuth2" → "URL Generator"
2. Select scopes: `bot`
3. Select permissions:
   - `Manage Roles`
   - `Read Messages/View Channels`
   - `Send Messages`
4. Copy the generated URL and open it to invite bot to your server

### 4. Configure Rewards

In your Discord server:

```
/setreward milestone:5 type:role role:@Inviter5
/setreward milestone:10 type:role role:@Inviter10
/setreward milestone:25 type:role role:@Inviter25
```

## 📊 Database

The bot uses SQLite with three tables:

- **invites** - Tracks each invite (inviter, invited user, timestamp)
- **rewards** - Stores reward configurations (milestone, type, value)
- **guild_settings** - Guild-specific settings

Database file: `invites.db` (auto-created)

## 🐛 Troubleshooting

| Issue | Solution |
|-------|----------|
| Bot doesn't respond | Check token in `.env`, ensure bot has permissions |
| Invites not tracking | Make sure bot has "Manage Guild" permission |
| Rewards not given | Check role exists and bot can assign it |
| Database error | Delete `invites.db` and restart bot |

## 🔐 Security Notes

- Never share your bot token
- Keep `.env` file private (add to `.gitignore`)
- Bot needs admin role to manage other roles
- Only admins can configure rewards

## 📝 Configuration Examples

### Basic Setup (5, 10, 25 invites)

```
/setreward milestone:5 type:role role:@Inviter
/setreward milestone:10 type:role role:@Senior Inviter
/setreward milestone:25 type:role role:@VIP Inviter
```

### Aggressive Growth (1, 3, 5, 10 invites)

```
/setreward milestone:1 type:role role:@Starter
/setreward milestone:3 type:role role:@Contributor
/setreward milestone:5 type:role role:@Promoter
/setreward milestone:10 type:role role:@Legend
```

## 🚀 Deployment

### Using PM2 (Recommended)

```bash
npm install -g pm2
pm2 start bot.js --name "invite-bot"
pm2 save
pm2 startup
```

### Using Docker

```dockerfile
FROM node:18
WORKDIR /app
COPY . .
RUN npm install
CMD ["node", "bot.js"]
```

### On Heroku

```bash
heroku create your-app-name
git push heroku main
```

## 📞 Support

- Check the troubleshooting section
- Review Discord.js documentation: https://discord.js.org
- Discord Developer Portal: https://discord.com/developers

## 📄 License

MIT License - Feel free to use and modify

## 🙏 Credits

Built with:
- [Discord.js](https://discord.js.org) - Discord API wrapper
- [SQLite3](https://www.sqlite.org) - Database
- Node.js

---

**Happy inviting! 🎉**
