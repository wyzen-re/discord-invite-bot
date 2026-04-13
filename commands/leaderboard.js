const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('leaderboard')
    .setDescription('Show the top inviters in the server')
    .addIntegerOption(option =>
      option
        .setName('limit')
        .setDescription('Number of top inviters to show (1-20)')
        .setMinValue(1)
        .setMaxValue(20)
        .setRequired(false)
    ),

  async execute(interaction, db) {
    await interaction.deferReply();

    const limit = interaction.options.getInteger('limit') || 10;
    const guildId = interaction.guildId;
    const guild = interaction.guild;

    try {
      // Fetch fresh leaderboard data every time
      const leaderboard = await db.getLeaderboard(guildId, limit);

      if (leaderboard.length === 0) {
        await interaction.editReply({
          content: '📊 No invites recorded yet!',
          ephemeral: true
        });
        return;
      }

      let description = '';
      for (let i = 0; i < leaderboard.length; i++) {
        const entry = leaderboard[i];
        const user = await guild.members.fetch(entry.inviter_id).catch(() => null);
        const username = user?.user.username || 'Unknown User';
        
        const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`;
        const retentionPercentage = entry.total > 0 
          ? ((entry.stayed / entry.total) * 100).toFixed(1)
          : 0;
        
        description += `${medal} **${username}**\n`;
        description += `   📈 Total: \`${entry.total}\` | ✅ Stayed: \`${entry.stayed}\` | ❌ Left: \`${entry.left}\` | 📊 ${retentionPercentage}%\n\n`;
      }

      const embed = new EmbedBuilder()
        .setColor('#ff00ff')
        .setTitle('🏆 Invite Leaderboard')
        .setDescription(description)
        .setFooter({ text: `Showing top ${limit} inviters | 🔄 Real-time data` })
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      console.error('Error in /leaderboard command:', error);
      await interaction.editReply({
        content: '❌ Error fetching leaderboard',
        ephemeral: true
      });
    }
  }
};
