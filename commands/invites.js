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
      const inviteCount = await db.getInviteCount(guildId, targetUser.id);
      const userInvites = await db.getUserInvites(guildId, targetUser.id);

      const embed = new EmbedBuilder()
        .setColor('#00ffff')
        .setTitle(`📊 Invite Statistics`)
        .setThumbnail(targetUser.displayAvatarURL({ dynamic: true }))
        .addFields(
          { 
            name: 'User', 
            value: `${targetUser.username}`, 
            inline: true 
          },
          { 
            name: 'Total Invites', 
            value: `**${inviteCount}**`, 
            inline: true 
          },
          { 
            name: 'Recent Invites', 
            value: userInvites.length > 0 
              ? userInvites.slice(0, 5).map((inv, i) => 
                  `${i + 1}. <t:${Math.floor(new Date(inv.timestamp).getTime() / 1000)}:R>`
                ).join('\n')
              : 'No recent invites',
            inline: false 
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
