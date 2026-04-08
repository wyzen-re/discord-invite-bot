const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('invites')
    .setDescription('Check your invite count or someone else\'s')
    .addUserOption(option =>
      option
        .setName('user')
        .setDescription('User to check invites for (default: yourself)')
        .setRequired(false)
    ),

  async execute(interaction, db) {
    await interaction.deferReply();

    const targetUser = interaction.options.getUser('user') || interaction.user;
    const guildId = interaction.guildId;

    try {
      const stats = await db.getInviterStats(guildId, targetUser.id);

      const embed = new EmbedBuilder()
        .setColor('#00ffff')
        .setTitle(`📊 Invite Statistics`)
        .setThumbnail(targetUser.displayAvatarURL({ dynamic: true }))
        .addFields(
          { 
            name: 'User', 
            value: `${targetUser.username}`, 
            inline: false 
          },
          { 
            name: 'Total', 
            value: `**${stats.total || 0}**`, 
            inline: true 
          },
          { 
            name: 'Stayed', 
            value: `**${stats.stayed || 0}**`, 
            inline: true 
          },
          { 
            name: 'Left', 
            value: `**${stats.left || 0}**`, 
            inline: true 
          }
        )
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      console.error('Error in /invites command:', error);
      await interaction.editReply({
        content: '❌ Error fetching invite data',
        ephemeral: true
      });
    }
  }
};
