const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('verify')
    .setDescription('Verify your invite code to get credited')
    .addStringOption(option =>
      option
        .setName('code')
        .setDescription('Your invite code (e.g., WYZEN-ABC123)')
        .setRequired(true)
    ),

  async execute(interaction, db) {
    await interaction.deferReply({ ephemeral: true });

    const guildId = interaction.guildId;
    const userId = interaction.user.id;
    const code = interaction.options.getString('code').toUpperCase();

    try {
      // Check if the code exists
      const inviteData = db.getInviteByCode(code);

      if (!inviteData) {
        const errorEmbed = new EmbedBuilder()
          .setColor('#ff0000')
          .setTitle('❌ Invalid Code')
          .setDescription('That invite code doesn\'t exist. Make sure you copied it correctly!')
          .setTimestamp();

        await interaction.editReply({ embeds: [errorEmbed] });
        return;
      }

      // Check if user already verified with this code
      const existingVerification = db.getVerificationByUserAndCode(guildId, userId, code);
      if (existingVerification) {
        const alreadyEmbed = new EmbedBuilder()
          .setColor('#ffaa00')
          .setTitle('⚠️ Already Verified')
          .setDescription('You\'ve already verified with this code!')
          .setTimestamp();

        await interaction.editReply({ embeds: [alreadyEmbed] });
        return;
      }

      // Record the verification
      await db.recordVerification(guildId, userId, inviteData.creator_id, code);

      // Get the inviter's new count
      const inviteCount = await db.getInviteCount(guildId, inviteData.creator_id);

      // Check for rewards
      const rewards = await db.getRewardsForMilestone(guildId, inviteCount);

      const successEmbed = new EmbedBuilder()
        .setColor('#00ff00')
        .setTitle('✅ Verified!')
        .setDescription(`Thanks for joining! **${inviteData.creator_id}** now has **${inviteCount}** invites!`)
        .setTimestamp();

      await interaction.editReply({ embeds: [successEmbed] });

      // Apply rewards if any
      if (rewards.length > 0) {
        try {
          const inviter = await interaction.guild.members.fetch(inviteData.creator_id);
          
          for (const reward of rewards) {
            if (reward.type === 'role') {
              const role = await interaction.guild.roles.fetch(reward.value);
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
    } catch (error) {
      console.error('Error in /verify command:', error);
      
      const errorEmbed = new EmbedBuilder()
        .setColor('#ff0000')
        .setTitle('❌ Error')
        .setDescription('An error occurred while verifying your code.')
        .setTimestamp();

      await interaction.editReply({ embeds: [errorEmbed] });
    }
  }
};
