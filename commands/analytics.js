const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('analytics')
    .setDescription('View server growth analytics and discovery methods'),

  async execute(interaction, db) {
    await interaction.deferReply();

    const guildId = interaction.guildId;

    try {
      // Fetch fresh analytics data every time
      const analytics = await db.getGuildAnalytics(guildId);
      const { discovery, retention } = analytics;

      // Calculate percentages for discovery methods
      const totalDiscoveries = discovery.reduce((sum, d) => sum + d.count, 0);
      
      let discoveryBreakdown = '';
      if (totalDiscoveries === 0) {
        discoveryBreakdown = 'No discovery data yet';
      } else {
        const methodMap = {
          'invite': '📨 Invite Links',
          'voting_site': '🗳️ Voting Sites',
          'other': '🔍 Other'
        };

        // Sort by count descending
        discovery.sort((a, b) => b.count - a.count);

        for (const method of discovery) {
          const label = methodMap[method.method] || method.method;
          const percentage = ((method.count / totalDiscoveries) * 100).toFixed(1);
          const barLength = Math.round((method.count / totalDiscoveries) * 20);
          const bar = '█'.repeat(barLength) + '░'.repeat(20 - barLength);
          
          discoveryBreakdown += `${label}\n\`${bar}\` ${percentage}% (\`${method.count}\`)\n\n`;
        }
      }

      // Calculate retention percentage
      const retentionPercentage = retention.total_members > 0 
        ? ((retention.active_members / retention.total_members) * 100).toFixed(1)
        : 0;

      const embed = new EmbedBuilder()
        .setColor('#00ffff')
        .setTitle('📊 Server Growth Analytics')
        .addFields(
          {
            name: '🌍 Member Discovery Methods',
            value: discoveryBreakdown || 'No data',
            inline: false
          },
          {
            name: '👥 Member Retention',
            value: `\`\`\`\nTotal Members: ${retention.total_members}\nActive: ${retention.active_members} ✅\nLeft: ${retention.left_members} ❌\nRetention Rate: ${retentionPercentage}%\n\`\`\``,
            inline: false
          }
        )
        .setFooter({ text: '🔄 Real-time analytics | Updates every 5 minutes' })
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      console.error('Error in /analytics command:', error);
      await interaction.editReply({
        content: '❌ Error fetching analytics',
        ephemeral: true
      });
    }
  }
};
