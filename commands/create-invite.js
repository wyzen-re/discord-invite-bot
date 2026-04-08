const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { nanoid } = require('nanoid');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('create-invite')
    .setDescription('Create a custom tracked invite link')
    .addStringOption(option =>
      option
        .setName('label')
        .setDescription('Label for this invite (e.g., "Twitter", "Friends")')
        .setRequired(false)
    ),

  async execute(interaction, db) {
    await interaction.deferReply();

    const guildId = interaction.guildId;
    const userId = interaction.user.id;
    const label = interaction.options.getString('label') || 'Custom Invite';

    try {
      // Generate a unique invite code
      const customCode = `${interaction.user.username.toUpperCase().slice(0, 5)}-${nanoid(6).toUpperCase()}`;

      // Create a Discord invite
      const channel = interaction.guild.channels.cache.find(ch => ch.isTextBased() && ch.permissionsFor(interaction.guild.members.me).has('CreateInstantInvite'));
      
      if (!channel) {
        await interaction.editReply({
          content: '❌ Bot cannot create invites in this server. Make sure it has permission to create invites.',
          ephemeral: true
        });
        return;
      }

      const discordInvite = await channel.createInvite({
        maxAge: 0, // Never expires
        maxUses: 0, // Unlimited uses
        reason: `Custom invite: ${customCode}`
      });

      // Store in database
      await db.createCustomInvite(guildId, userId, customCode, discordInvite.url);

      const embed = new EmbedBuilder()
        .setColor('#00ffff')
        .setTitle('✅ Custom Invite Created')
        .setDescription(`Your custom invite is ready to share!`)
        .addFields(
          { name: 'Label', value: label, inline: true },
          { name: 'Code', value: `\`${customCode}\``, inline: true },
          { name: 'Invite Link', value: `[Click here](${discordInvite.url})`, inline: false },
          { name: 'Share This', value: `\`\`\`${discordInvite.url}\`\`\``, inline: false }
        )
        .setFooter({ text: 'This invite will track all joins to your account' })
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      console.error('Error in /create-invite command:', error);
      await interaction.editReply({
        content: '❌ Error creating invite',
        ephemeral: true
      });
    }
  }
};
