const { Client, GatewayIntentBits, EmbedBuilder, AuditLogEvent } = require('discord.js');
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
    
    // Check if bot has permission to view audit logs
    if (!guild.members.me.permissions.has('ViewAuditLog')) {
      console.warn(`⚠️ No permission to view audit log in ${guild.name}`);
      return;
    }

    // Fetch recent audit logs for member joins
    const auditLogs = await guild.fetchAuditLogs({
      limit: 10,
      type: AuditLogEvent.MemberUpdate,
    });

    let inviter = null;

    // Look through audit logs to find who invited this member
    for (const log of auditLogs.entries.values()) {
      // Check if this is a member join event
      if (log.targetId === member.id && log.createdTimestamp > Date.now() - 5000) {
        // The executor is the inviter
        inviter = log.executor;
        break;
      }
    }

    // If not found in member updates, try checking the member's join event
    if (!inviter) {
      const joinLogs = await guild.fetchAuditLogs({
        limit: 5,
        type: AuditLogEvent.MemberUpdate,
      });

      for (const log of joinLogs.entries.values()) {
        if (log.targetId === member.id) {
          inviter = log.executor;
          break;
        }
      }
    }

    if (inviter && inviter.id !== client.user.id) {
      // Track the invite
      await db.addInvite(guild.id, inviter.id, member.id, 'audit-log');
      
      // Get inviter's invite count
      const inviteCount = await db.getInviteCount(guild.id, inviter.id);
      
      // Check if they reached a reward milestone
      const rewards = await db.getRewardsForMilestone(guild.id, inviteCount);
      
      if (rewards.length > 0) {
        // Apply rewards
        for (const reward of rewards) {
          if (reward.type === 'role') {
            try {
              const role = await guild.roles.fetch(reward.value);
              if (role) {
                const inviterMember = await guild.members.fetch(inviter.id);
                await inviterMember.roles.add(role);
                
                // Notify inviter
                const embed = new EmbedBuilder()
                  .setColor('#00ff00')
                  .setTitle('🎉 Reward Unlocked!')
                  .setDescription(`You've reached **${inviteCount} invites**!`)
                  .addFields(
                    { name: 'Reward', value: `Role: ${role.name}`, inline: false },
                    { name: 'New Member', value: `${member.user.username}`, inline: false }
                  )
                  .setTimestamp();
                
                try {
                  await inviter.send({ embeds: [embed] });
                } catch (e) {
                  console.log(`Could not DM ${inviter.tag}`);
                }
              }
            } catch (error) {
              console.error(`Failed to apply role reward:`, error.message);
            }
          }
        }
      }

      console.log(`📈 ${inviter.tag} now has ${inviteCount} invites (${member.user.tag} joined)`);
    } else {
      console.log(`❓ Could not determine inviter for ${member.user.tag}`);
    }
  } catch (error) {
    console.error('Error in guildMemberAdd:', error);
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
