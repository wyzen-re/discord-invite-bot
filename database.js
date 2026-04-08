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
    // Custom invites table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS discovery_methods (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        guild_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        method TEXT NOT NULL,
        inviter_id TEXT,
        custom_reason TEXT,
        discovered_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(guild_id, user_id)
      )
    `);

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS custom_invites (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        guild_id TEXT NOT NULL,
        creator_id TEXT NOT NULL,
        invite_code TEXT UNIQUE NOT NULL,
        discord_invite_url TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(guild_id, invite_code)
      )
    `);

    // Invite uses table (tracks who used each invite)
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS invite_uses (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        guild_id TEXT NOT NULL,
        invite_code TEXT NOT NULL,
        invited_user_id TEXT NOT NULL,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(invite_code) REFERENCES custom_invites(invite_code)
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
   * Create a custom invite
   */
  createCustomInvite(guildId, creatorId, inviteCode, discordUrl) {
    try {
      const stmt = this.db.prepare(
        `INSERT INTO custom_invites (guild_id, creator_id, invite_code, discord_invite_url)
         VALUES (?, ?, ?, ?)`
      );
      stmt.run(guildId, creatorId, inviteCode, discordUrl);
      return true;
    } catch (error) {
      console.error('Error creating custom invite:', error);
      throw error;
    }
  }

  /**
   * Record an invite use
   */
  recordInviteUse(guildId, inviteCode, invitedUserId) {
    try {
      const stmt = this.db.prepare(
        `INSERT INTO invite_uses (guild_id, invite_code, invited_user_id)
         VALUES (?, ?, ?)`
      );
      stmt.run(guildId, inviteCode, invitedUserId);
      return true;
    } catch (error) {
      console.error('Error recording invite use:', error);
      throw error;
    }
  }

  /**
   * Get invite count for a user (by creator_id)
   */
  getInviteCount(guildId, userId) {
    try {
      const stmt = this.db.prepare(`
        SELECT COUNT(*) as count FROM discovery_methods
        WHERE guild_id = ? AND method = 'invite' AND inviter_id = ?
      `);
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
        `SELECT iu.invited_user_id, iu.timestamp, ci.invite_code FROM invite_uses iu
         JOIN custom_invites ci ON iu.invite_code = ci.invite_code
         WHERE iu.guild_id = ? AND ci.creator_id = ?
         ORDER BY iu.timestamp DESC`
      );
      return stmt.all(guildId, userId) || [];
    } catch (error) {
      console.error('Error getting user invites:', error);
      throw error;
    }
  }

  /**
   * Get all custom invites for a user
   */
  getUserCustomInvites(guildId, userId) {
    try {
      const stmt = this.db.prepare(
        `SELECT invite_code, discord_invite_url, created_at FROM custom_invites
         WHERE guild_id = ? AND creator_id = ?
         ORDER BY created_at DESC`
      );
      return stmt.all(guildId, userId) || [];
    } catch (error) {
      console.error('Error getting user custom invites:', error);
      throw error;
    }
  }

  /**
   * Get top inviters (leaderboard)
   */
  getLeaderboard(guildId, limit = 10) {
    try {
      const stmt = this.db.prepare(
        `SELECT ci.creator_id, COUNT(*) as invite_count 
         FROM invite_uses iu
         JOIN custom_invites ci ON iu.invite_code = ci.invite_code
         WHERE iu.guild_id = ? 
         GROUP BY ci.creator_id 
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
   * Get invite creator by code
   */
  getInviteCreator(inviteCode) {
    try {
      const stmt = this.db.prepare(
        `SELECT creator_id FROM custom_invites WHERE invite_code = ?`
      );
      const result = stmt.get(inviteCode);
      return result?.creator_id || null;
    } catch (error) {
      console.error('Error getting invite creator:', error);
      throw error;
    }
  }

  /**
   * Get invite by code
   */
  getInviteByCode(code) {
    try {
      const stmt = this.db.prepare(
        `SELECT * FROM custom_invites WHERE invite_code = ?`
      );
      return stmt.get(code) || null;
    } catch (error) {
      console.error('Error getting invite by code:', error);
      throw error;
    }
  }

  /**
   * Record discovery method
   */
  recordDiscoveryMethod(guildId, userId, method, inviterId, customReason = null) {
    try {
      const stmt = this.db.prepare(`
        INSERT INTO discovery_methods (guild_id, user_id, method, inviter_id, custom_reason)
        VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(guild_id, user_id) DO UPDATE SET
          method = excluded.method,
          inviter_id = excluded.inviter_id,
          custom_reason = excluded.custom_reason
      `);
      stmt.run(guildId, userId, method, inviterId, customReason);
      return true;
    } catch (error) {
      console.error('Error recording discovery method:', error);
      throw error;
    }
  }

  /**
   * Get discovery stats for a guild
   */
  getDiscoveryStats(guildId) {
    try {
      const stmt = this.db.prepare(`
        SELECT method, COUNT(*) as count FROM discovery_methods
        WHERE guild_id = ?
        GROUP BY method
      `);
      return stmt.all(guildId) || [];
    } catch (error) {
      console.error('Error getting discovery stats:', error);
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
