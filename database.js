const Database = require('better-sqlite3');
const path = require('path');

class InviteDatabase {
  constructor() {
    this.db = new Database(path.join(__dirname, 'invites.db'));
    this.db.pragma('journal_mode = WAL');
    console.log('✅ Connected to SQLite database');
    this.initialize();
  }

  initialize() {
    // Invites table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS invites (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        guild_id TEXT NOT NULL,
        inviter_id TEXT NOT NULL,
        invited_user_id TEXT NOT NULL,
        invite_code TEXT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(guild_id, inviter_id, invited_user_id)
      )
    `);

    // Rewards table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS rewards (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        guild_id TEXT NOT NULL,
        milestone INTEGER NOT NULL,
        type TEXT NOT NULL,
        value TEXT NOT NULL,
        UNIQUE(guild_id, milestone, type, value)
      )
    `);

    // Guild settings table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS guild_settings (
        guild_id TEXT PRIMARY KEY,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    console.log('📊 Database tables initialized');
  }

  /**
   * Initialize a new guild
   */
  initializeGuild(guildId) {
    try {
      const stmt = this.db.prepare(
        'INSERT OR IGNORE INTO guild_settings (guild_id) VALUES (?)'
      );
      stmt.run(guildId);
      return true;
    } catch (error) {
      console.error('Error initializing guild:', error);
      throw error;
    }
  }

  /**
   * Add an invite record
   */
  addInvite(guildId, inviterId, invitedUserId, inviteCode) {
    try {
      const stmt = this.db.prepare(
        `INSERT OR IGNORE INTO invites (guild_id, inviter_id, invited_user_id, invite_code)
         VALUES (?, ?, ?, ?)`
      );
      stmt.run(guildId, inviterId, invitedUserId, inviteCode);
      return true;
    } catch (error) {
      console.error('Error adding invite:', error);
      throw error;
    }
  }

  /**
   * Get total invite count for a user
   */
  getInviteCount(guildId, userId) {
    try {
      const stmt = this.db.prepare(
        `SELECT COUNT(*) as count FROM invites 
         WHERE guild_id = ? AND inviter_id = ?`
      );
      const result = stmt.get(guildId, userId);
      return result?.count || 0;
    } catch (error) {
      console.error('Error getting invite count:', error);
      throw error;
    }
  }

  /**
   * Get all invites for a user
   */
  getUserInvites(guildId, userId) {
    try {
      const stmt = this.db.prepare(
        `SELECT invited_user_id, timestamp FROM invites 
         WHERE guild_id = ? AND inviter_id = ?
         ORDER BY timestamp DESC`
      );
      return stmt.all(guildId, userId) || [];
    } catch (error) {
      console.error('Error getting user invites:', error);
      throw error;
    }
  }

  /**
   * Get top inviters (leaderboard)
   */
  getLeaderboard(guildId, limit = 10) {
    try {
      const stmt = this.db.prepare(
        `SELECT inviter_id, COUNT(*) as invite_count 
         FROM invites 
         WHERE guild_id = ? 
         GROUP BY inviter_id 
         ORDER BY invite_count DESC 
         LIMIT ?`
      );
      return stmt.all(guildId, limit) || [];
    } catch (error) {
      console.error('Error getting leaderboard:', error);
      throw error;
    }
  }

  /**
   * Add a reward for a milestone
   */
  addReward(guildId, milestone, type, value) {
    try {
      const stmt = this.db.prepare(
        `INSERT OR REPLACE INTO rewards (guild_id, milestone, type, value)
         VALUES (?, ?, ?, ?)`
      );
      stmt.run(guildId, milestone, type, value);
      return true;
    } catch (error) {
      console.error('Error adding reward:', error);
      throw error;
    }
  }

  /**
   * Get rewards for a specific milestone
   */
  getRewardsForMilestone(guildId, milestone) {
    try {
      const stmt = this.db.prepare(
        `SELECT * FROM rewards 
         WHERE guild_id = ? AND milestone = ?`
      );
      return stmt.all(guildId, milestone) || [];
    } catch (error) {
      console.error('Error getting rewards for milestone:', error);
      throw error;
    }
  }

  /**
   * Get all rewards for a guild
   */
  getAllRewards(guildId) {
    try {
      const stmt = this.db.prepare(
        `SELECT * FROM rewards 
         WHERE guild_id = ? 
         ORDER BY milestone ASC`
      );
      return stmt.all(guildId) || [];
    } catch (error) {
      console.error('Error getting all rewards:', error);
      throw error;
    }
  }

  /**
   * Remove a reward
   */
  removeReward(guildId, milestone, type, value) {
    try {
      const stmt = this.db.prepare(
        `DELETE FROM rewards 
         WHERE guild_id = ? AND milestone = ? AND type = ? AND value = ?`
      );
      stmt.run(guildId, milestone, type, value);
      return true;
    } catch (error) {
      console.error('Error removing reward:', error);
      throw error;
    }
  }

  /**
   * Close database connection
   */
  close() {
    try {
      this.db.close();
      console.log('Database connection closed');
      return true;
    } catch (error) {
      console.error('Error closing database:', error);
      throw error;
    }
  }
}

module.exports = InviteDatabase;
