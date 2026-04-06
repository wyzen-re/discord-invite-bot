const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('rewards')
    .setDescription('View all configured rewards for this server (Admin only)')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction, db) {
    await interaction.deferReply();

    const guildId = interaction.guildId;
    const guild = interaction.guild;

    try {
      // Check if user is admin
      if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
        await interaction.editReply({
          content: '❌ You need Administrator permissions to use this command',
          ephemeral: true
        });
        return;
      }

      const rewards = await db.getAllRewards(guildId);

      if (rewards.length === 0) {
        await interaction.editReply({
          content: '📊 No rewards configured yet. Use `/setreward` to add one!',
          ephemeral: true
        });
        return;
      }

      let description = '';
      for (const reward of rewards) {
        if (reward.type === 'role') {
          const role = await guild.roles.fetch(reward.value).catch(() => null);
          const roleName = role?.name || 'Unknown Role';
          description += `**${reward.milestone} invites** → Role: ${roleName}\n`;
        }
      }

      const embed = new EmbedBuilder()
        .setColor('#00ffff')
        .setTitle('🎁 Configured Rewards')
        .setDescription(description || 'No rewards found')
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      console.error('Error in /rewards command:', error);
      await interaction.editReply({
        content: '❌ Error fetching rewards',
        ephemeral: true
      });
    }
  }
};
