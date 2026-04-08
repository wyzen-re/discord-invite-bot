const { Client, GatewayIntentBits, Collection, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const Database = require('./database');
const CommandHandler = require('./commands/commandHandler');
require('dotenv').config();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildInvites,
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.MessageContent,
  ],
});

// Initialize database
const db = new Database();

// Command handler
const commandHandler = new CommandHandler(client, db);

// Store invites for tracking
const guildInvites = new Map();

client.once('ready', async () => {
  console.log(`✅ Bot logged in as ${client.user.tag}`);
  console.log(`📍 Bot is in ${client.guilds.cache.size} guild(s)`);
  
  // Initialize invites for all guilds
  for (const guild of client.guilds.cache.values()) {
    try {
      console.log(`🔍 Attempting to fetch invites for ${guild.name}...`);
      const invites = await guild.invites.fetch();
      guildInvites.set(guild.id, new Map(invites.map(inv => [inv.code, inv.uses])));
      console.log(`📊 Cached ${invites.size} invites for ${guild.name}`);
    } catch (error) {
      console.error(`❌ Failed to fetch invites for ${guild.name}:`, error.message);
      console.error(`   Make sure bot has 'Manage Guild' permission!`);
    }
  }

  // Set bot status
  client.user.setActivity('invites | /help', { type: 'WATCHING' });
});

client.on('guildMemberAdd', async (member) => {
  try {
    const guild = member.guild;
    const newInvites = await guild.invites.fetch();
    const oldInvites = guildInvites.get(guild.id) || new Map();

    let usedInvite = null;
    let inviter = null;

    // Find which invite was used
    for (const [code, uses] of newInvites) {
      const oldUses = oldInvites.get(code) || 0;
      if (uses > oldUses) {
        usedInvite = code;
        const invite = newInvites.get(code);
        inviter = invite.inviter;
        break;
      }
    }

    // Update cache
    guildInvites.set(guild.id, new Map(newInvites.map(inv => [inv.code, inv.uses])));

    if (inviter) {
      // Track the invite
      await db.addInvite(guild.id, inviter.id, member.id, usedInvite);
      
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
                await member.guild.members.fetch(inviter.id).then(m => m.roles.add(role));
                
                // Notify inviter
                const embed = new EmbedBuilder()
                  .setColor('#00ff00')
                  .setTitle('🎉 Reward Unlocked!')
                  .setDescription(`You've reached **${inviteCount} invites**!`)
                  .addFields(
                    { name: 'Reward', value: `Role: ${role.name}`, inline: false }
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
  
  // Fetch initial invites
  try {
    const invites = await guild.invites.fetch();
    guildInvites.set(guild.id, new Map(invites.map(inv => [inv.code, inv.uses])));
  } catch (error) {
    console.error(`Failed to fetch invites for new guild:`, error.message);
  }
});

// Handle guild leave
client.on('guildDelete', (guild) => {
  console.log(`❌ Left guild: ${guild.name}`);
  guildInvites.delete(guild.id);
});

// Login to Discord
client.login(process.env.DISCORD_TOKEN);

module.exports = { client, db };
