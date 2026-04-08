const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');
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

// Store custom invite codes that are waiting to be used
const pendingInvites = new Map(); // guildId -> Set of invite codes

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
  client.user.setActivity('custom invites | /help', { type: 'WATCHING' });
});

client.on('guildMemberAdd', async (member) => {
  try {
    const guild = member.guild;
    console.log(`\n👤 ${member.user.tag} joined the server!`);
    
    // Get all custom invites for this guild
    const customInvites = await guild.invites.fetch();
    
    let usedInvite = null;
    let creatorId = null;

    // Check each custom invite to see if it was used
    for (const [code, invite] of customInvites) {
      // Check if this invite code matches a custom invite pattern
      const creator = db.getInviteCreator(code);
      
      if (creator) {
        // This is one of our custom invites
        usedInvite = code;
        creatorId = creator;
        console.log(`✅ Found custom invite: ${code} (creator: ${creatorId})`);
        break;
      }
    }

    if (usedInvite && creatorId) {
      // Record the invite use
      await db.recordInviteUse(guild.id, usedInvite, member.id);
      
      // Get creator's invite count
      const inviteCount = await db.getInviteCount(guild.id, creatorId);
      console.log(`📈 ${creatorId} now has ${inviteCount} invites`);
      
      // Check if they reached a reward milestone
      const rewards = await db.getRewardsForMilestone(guild.id, inviteCount);
      
      if (rewards.length > 0) {
        console.log(`🎁 Checking rewards for ${inviteCount} invites...`);
        // Apply rewards
        for (const reward of rewards) {
          if (reward.type === 'role') {
            try {
              const role = await guild.roles.fetch(reward.value);
              if (role) {
                const creatorMember = await guild.members.fetch(creatorId);
                await creatorMember.roles.add(role);
                console.log(`✅ Gave role ${role.name} to ${creatorId}`);
                
                // Notify creator
                const creator = await client.users.fetch(creatorId);
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
                  await creator.send({ embeds: [embed] });
                } catch (e) {
                  console.log(`Could not DM creator`);
                }
              }
            } catch (error) {
              console.error(`Failed to apply role reward:`, error.message);
            }
          }
        }
      }
    } else {
      console.log(`❓ No custom invite detected for ${member.user.tag}`);
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
  pendingInvites.delete(guild.id);
});

// Login to Discord
client.login(process.env.DISCORD_TOKEN);

module.exports = { client, db };
