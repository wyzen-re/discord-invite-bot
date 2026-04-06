const { REST, Routes } = require('discord.js');
const fs = require('fs');
const path = require('path');

class CommandHandler {
  constructor(client, db) {
    this.client = client;
    this.db = db;
    this.commands = new Map();
    this.loadCommands();
    this.registerCommands();
  }

  loadCommands() {
    const commandsPath = path.join(__dirname);
    const commandFiles = fs.readdirSync(commandsPath).filter(file => 
      file.endsWith('.js') && file !== 'commandHandler.js'
    );

    for (const file of commandFiles) {
      const filePath = path.join(commandsPath, file);
      const command = require(filePath);
      
      if (command.data && command.execute) {
        this.commands.set(command.data.name, command);
        console.log(`✅ Loaded command: ${command.data.name}`);
      }
    }
  }

  async registerCommands() {
    const commands = Array.from(this.commands.values()).map(cmd => cmd.data.toJSON());
    
    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

    try {
      console.log(`🔄 Registering ${commands.length} slash commands...`);
      
      await rest.put(
        Routes.applicationCommands(process.env.CLIENT_ID),
        { body: commands }
      );

      console.log('✅ Slash commands registered successfully');
    } catch (error) {
      console.error('Failed to register slash commands:', error);
    }
  }

  async handleCommand(interaction) {
    const command = this.commands.get(interaction.commandName);

    if (!command) {
      await interaction.reply({ 
        content: '❌ Command not found', 
        ephemeral: true 
      });
      return;
    }

    try {
      await command.execute(interaction, this.db);
    } catch (error) {
      console.error(`Error executing command ${interaction.commandName}:`, error);
      throw error;
    }
  }
}

module.exports = CommandHandler;
