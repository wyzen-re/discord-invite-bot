const { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, ChannelType } = require('discord.js');
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

// Store pending surveys (userId -> { guildId, createdAt })
const pendingSurveys = new Map();

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
    
    // Send welcome survey to new member
    try {
      const embed = new EmbedBuilder()
        .setColor('#00ffff')
        .setTitle(`👋 Welcome to ${guild.name}!`)
        .setDescription(`Hi **${member.user.username}**! 🎉\n\nWe'd love to know how you discovered our server so we can improve! It only takes 10 seconds.`)
        .setFooter({ text: 'Your feedback helps us grow!' })
        .setTimestamp();

      // Create buttons for survey options
      const row = new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
            .setCustomId(`survey_invite_${member.id}`)
            .setLabel('📨 Via Invite Link')
            .setStyle(ButtonStyle.Primary),
          new ButtonBuilder()
            .setCustomId(`survey_voting_${member.id}`)
            .setLabel('🗳️ Voting Sites')
            .setStyle(ButtonStyle.Primary),
          new ButtonBuilder()
            .setCustomId(`survey_other_${member.id}`)
            .setLabel('🔍 Other')
            .setStyle(ButtonStyle.Secondary)
        );

      await member.send({ embeds: [embed], components: [row] });
      
      // Store pending survey
      pendingSurveys.set(member.id, {
        guildId: guild.id,
        createdAt: Date.now()
      });

      console.log(`📧 Sent welcome survey to ${member.user.tag}`);
    } catch (error) {
      console.error(`Could not send DM to ${member.user.tag}:`, error.message);
    }
  } catch (error) {
    console.error('Error in guildMemberAdd:', error);
  }
});

client.on('interactionCreate', async (interaction) => {
  try {
    // Handle survey buttons
    if (interaction.isButton()) {
      const [action, type, userId] = interaction.customId.split('_');
      
      if (action === 'survey' && userId === interaction.user.id) {
        const pending = pendingSurveys.get(interaction.user.id);
        
        if (!pending) {
          await interaction.reply({ content: '❌ Survey expired. Please rejoin the server.', ephemeral: true });
          return;
        }

        if (type === 'invite') {
          // Ask for invite code
          const modal = new ModalBuilder()
            .setCustomId(`modal_invite_code_${interaction.user.id}`)
            .setTitle('Invite Code')
            .addComponents(
              new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                  .setCustomId('invite_code')
                  .setLabel('What was your invite code?')
                  .setPlaceholder('e.g., WYZEN-ABC123')
                  .setStyle(TextInputStyle.Short)
                  .setRequired(true)
              )
            );

          await interaction.showModal(modal);
        } else if (type === 'voting') {
          // Record voting site discovery
          await db.recordDiscoveryMethod(pending.guildId, interaction.user.id, 'voting_site', null);
          pendingSurveys.delete(interaction.user.id);

          const embed = new EmbedBuilder()
            .setColor('#00ff00')
            .setTitle('✅ Thanks!')
            .setDescription('Thanks for letting us know! We appreciate you discovering us through voting sites!')
            .setTimestamp();

          await interaction.reply({ embeds: [embed], ephemeral: true });
          console.log(`📊 ${interaction.user.tag} discovered server via voting sites`);
        } else if (type === 'other') {
          // Ask for custom answer
          const modal = new ModalBuilder()
            .setCustomId(`modal_other_reason_${interaction.user.id}`)
            .setTitle('How did you find us?')
            .addComponents(
              new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                  .setCustomId('other_reason')
                  .setLabel('Tell us how you found our server!')
                  .setPlaceholder('e.g., Friend told me, Google search, etc.')
                  .setStyle(TextInputStyle.Paragraph)
                  .setRequired(true)
              )
            );

          await interaction.showModal(modal);
        }
      }
    }

    // Handle modal submissions
    if (interaction.isModalSubmit()) {
      const pending = pendingSurveys.get(interaction.user.id);
      
      if (!pending) {
        await interaction.reply({ content: '❌ Survey expired. Please rejoin the server.', ephemeral: true });
        return;
      }

      if (interaction.customId.startsWith('modal_invite_code_')) {
        const code = interaction.fields.getTextInputValue('invite_code').toUpperCase();
        
        // Look up the invite code
        const inviteData = db.getInviteByCode(code);

        if (!inviteData) {
          await interaction.reply({ content: '❌ That code doesn\'t exist. Make sure you copied it correctly!', ephemeral: true });
          return;
        }

        if (inviteData.guild_id !== pending.guildId) {
          await interaction.reply({ content: '❌ That code is for a different server!', ephemeral: true });
          return;
        }

        // Record the discovery
        await db.recordDiscoveryMethod(pending.guildId, interaction.user.id, 'invite', inviteData.creator_id);
        pendingSurveys.delete(interaction.user.id);

        // Get the inviter's new count
        const inviteCount = await db.getInviteCount(pending.guildId, inviteData.creator_id);

        const embed = new EmbedBuilder()
          .setColor('#00ff00')
          .setTitle('✅ Thanks!')
          .setDescription(`Thanks for joining! **${inviteData.creator_id}** now has **${inviteCount}** invite(s)!`)
          .setTimestamp();

        await interaction.reply({ embeds: [embed], ephemeral: true });

        // Check for rewards
        const rewards = await db.getRewardsForMilestone(pending.guildId, inviteData.creator_id);

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
                      { name: 'New Member', value: `${interaction.user.username}`, inline: false }
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

        console.log(`📊 ${interaction.user.tag} joined via invite code: ${code}`);
      } else if (interaction.customId.startsWith('modal_other_reason_')) {
        const reason = interaction.fields.getTextInputValue('other_reason');
        
        // Record the discovery
        await db.recordDiscoveryMethod(pending.guildId, interaction.user.id, 'other', reason);
        pendingSurveys.delete(interaction.user.id);

        const embed = new EmbedBuilder()
          .setColor('#00ff00')
          .setTitle('✅ Thanks!')
          .setDescription('Thanks for letting us know! We appreciate your feedback!')
          .setTimestamp();

        await interaction.reply({ embeds: [embed], ephemeral: true });
        console.log(`📊 ${interaction.user.tag} discovered server via: ${reason}`);
      }
    }

    // Handle slash commands
    if (interaction.isChatInputCommand()) {
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
    }
  } catch (error) {
    console.error('Error in interactionCreate:', error);
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
