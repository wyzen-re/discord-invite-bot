const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setreward')
    .setDescription('Set a reward for reaching an invite milestone (Admin only)')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addIntegerOption(option =>
      option
        .setName('milestone')
        .setDescription('Number of invites needed for this reward')
        .setMinValue(1)
        .setRequired(true)
    )
    .addStringOption(option =>
      option
        .setName('type')
        .setDescription('Type of reward')
        .addChoices(
          { name: 'Role', value: 'role' }
        )
        .setRequired(true)
    )
    .addRoleOption(option =>
      option
        .setName('role')
        .setDescription('Role to give as reward')
        .setRequired(true)
    ),

  async execute(interaction, db) {
    await interaction.deferReply();

    const milestone = interaction.options.getInteger('milestone');
    const type = interaction.options.getString('type');
    const role = interaction.options.getRole('role');
    const guildId = interaction.guildId;

    try {
      // Check if user is admin using the correct method for Discord.js v14
      const hasAdminPermission = interaction.memberPermissions?.has(PermissionFlagsBits.Administrator);
      
      if (!hasAdminPermission) {
        await interaction.editReply({
          content: '❌ You need Administrator permissions to use this command',
          ephemeral: true
        });
        return;
      }

      // Add reward to database
      await db.addReward(guildId, milestone, type, role.id);

      const embed = new EmbedBuilder()
        .setColor('#00ff00')
        .setTitle('✅ Reward Set')
        .addFields(
          { name: 'Milestone', value: `${milestone} invites`, inline: true },
          { name: 'Type', value: type, inline: true },
          { name: 'Reward', value: `${role.name}`, inline: true }
        )
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      console.error('Error in /setreward command:', error);
      await interaction.editReply({
        content: '❌ Error setting reward',
        ephemeral: true
      });
    }
  }
};
