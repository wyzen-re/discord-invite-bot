const { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType } = require('discord.js');
const Database = require('./database');
const CommandHandler = require('./commands/commandHandler');
require('dotenv').config();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.MessageContent,
  ],
});

// Initialize database
const db = new Database();

// Command handler
const commandHandler = new CommandHandler(client, db);

// Store pending verifications (userId -> { guildId, createdAt })
const pendingVerifications = new Map();

client.once('ready', async () => {
  console.log(`✅ Bot logged in as ${client.user.tag}`);
  console.log(`📍 Bot is in ${client.guilds.cache.size} guild(s)`);
  
  // Initialize database for all guilds
  for (const guild of client.guilds.cache.values()) {
    try {
      await db.initializeGuild(guild.id);
      console.log(`📊 Initialized database for ${guild.name}`);
    } catch (error) {
      console.error(`Failed to initialize guild ${guild.name}:`, error.message);
    }
  }

  // Set bot status
  client.user.setActivity('invites | /help', { type: 'WATCHING' });
});

client.on('guildMemberAdd', async (member) => {
  try {
    const guild = member.guild;
    console.log(`\n👤 ${member.user.tag} joined ${guild.name}!`);
    
    // Send DM to new member asking for invite code
    try {
      const embed = new EmbedBuilder()
        .setColor('#00ffff')
        .setTitle('👋 Welcome to ' + guild.name + '!')
        .setDescription('Which invite link did you use to join?')
        .addFields(
          { name: '📝 How to verify', value: 'Reply with your invite code (e.g., `WYZEN-ABC123`)', inline: false },
          { name: '💡 Tip', value: 'The code was given to you by the person who invited you', inline: false }
        )
        .setFooter({ text: 'You have 5 minutes to respond' })
        .setTimestamp();

      await member.send({ embeds: [embed] });
      
      // Store pending verification
      pendingVerifications.set(member.id, {
        guildId: guild.id,
        createdAt: Date.now()
      });

      console.log(`📧 Sent verification DM to ${member.user.tag}`);
    } catch (error) {
      console.error(`Could not send DM to ${member.user.tag}:`, error.message);
    }
  } catch (error) {
    console.error('Error in guildMemberAdd:', error);
  }
});

client.on('messageCreate', async (message) => {
  try {
    // Only handle DMs
    if (message.channel.type !== ChannelType.DM) return;
    
    // Ignore bot messages
    if (message.author.bot) return;

    const userId = message.author.id;
    const code = message.content.trim().toUpperCase();

    // Check if user has a pending verification
    const pending = pendingVerifications.get(userId);
    if (!pending) return;

    // Check if code is valid format
    if (code.length < 5 || !code.includes('-')) {
      await message.reply('❌ Invalid code format. Please use the format: `WYZEN-ABC123`');
      return;
    }

    // Check if verification has expired (5 minutes)
    if (Date.now() - pending.createdAt > 5 * 60 * 1000) {
      pendingVerifications.delete(userId);
      await message.reply('⏰ Verification expired. Please rejoin the server to get a new code.');
      return;
    }

    // Look up the invite code
    const inviteData = db.getInviteByCode(code);

    if (!inviteData) {
      await message.reply('❌ That code doesn\'t exist. Make sure you copied it correctly!');
      return;
    }

    // Check if code is for the right guild
    if (inviteData.guild_id !== pending.guildId) {
      await message.reply('❌ That code is for a different server!');
      return;
    }

    // Check if user already verified with this code
    const existingVerification = db.getVerificationByUserAndCode(pending.guildId, userId, code);
    if (existingVerification) {
      await message.reply('⚠️ You\'ve already verified with this code!');
      return;
    }

    // Record the verification
    await db.recordVerification(pending.guildId, userId, inviteData.creator_id, code);
    pendingVerifications.delete(userId);

    // Get the inviter's new count
    const inviteCount = await db.getInviteCount(pending.guildId, inviteData.creator_id);

    // Send success message
    const successEmbed = new EmbedBuilder()
      .setColor('#00ff00')
      .setTitle('✅ Verified!')
      .setDescription(`Thanks for joining! **${inviteData.creator_id}** now has **${inviteCount}** invite(s)!`)
      .setTimestamp();

    await message.reply({ embeds: [successEmbed] });

    // Check for rewards
    const rewards = await db.getRewardsForMilestone(pending.guildId, inviteCount);

    if (rewards.length > 0) {
      try {
        const guild = client.guilds.cache.get(pending.guildId);
        const inviter = await guild.members.fetch(inviteData.creator_id);
        
        for (const reward of rewards) {
          if (reward.type === 'role') {
            const role = await guild.roles.fetch(reward.value);
            if (role && !inviter.roles.cache.has(role.id)) {
              await inviter.roles.add(role);
              
              // Notify inviter
              const rewardEmbed = new EmbedBuilder()
                .setColor('#00ff00')
                .setTitle('🎉 Reward Unlocked!')
                .setDescription(`You've reached **${inviteCount} invites**!`)
                .addFields(
                  { name: 'Reward', value: `Role: ${role.name}`, inline: false },
                  { name: 'New Member', value: `${message.author.username}`, inline: false }
                )
                .setTimestamp();

              try {
                await inviter.user.send({ embeds: [rewardEmbed] });
              } catch (e) {
                console.log(`Could not DM inviter`);
              }
            }
          }
        }
      } catch (error) {
        console.error('Error applying rewards:', error);
      }
    }
  } catch (error) {
    console.error('Error in messageCreate:', error);
  }
});

// Handle slash commands
client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  try {
    await commandHandler.handleCommand(interaction);
  } catch (error) {
    console.error('Error handling command:', error);
    
    const errorEmbed = new EmbedBuilder()
      .setColor('#ff0000')
      .setTitle('❌ Error')
      .setDescription('An error occurred while executing this command.')
      .setTimestamp();

    if (interaction.replied || interaction.deferred) {
      await interaction.editReply({ embeds: [errorEmbed] });
    } else {
      await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
    }
  }
});

// Handle guild join
client.on('guildCreate', async (guild) => {
  console.log(`✅ Joined guild: ${guild.name}`);
  
  // Initialize database for this guild
  await db.initializeGuild(guild.id);
});

// Handle guild leave
client.on('guildDelete', (guild) => {
  console.log(`❌ Left guild: ${guild.name}`);
});

// Login to Discord
client.login(process.env.DISCORD_TOKEN);

module.exports = { client, db };
