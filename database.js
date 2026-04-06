const sqlite3 = require('sqlite3').verbose();
const path = require('path');

class Database {
  constructor() {
    this.db = new sqlite3.Database(path.join(__dirname, 'invites.db'), (err) => {
      if (err) {
        console.error('Database connection error:', err);
      } else {
        console.log('✅ Connected to SQLite database');
        this.initialize();
      }
    });
  }

  initialize() {
    this.db.serialize(() => {
      // Invites table
      this.db.run(`
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
      this.db.run(`
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
      this.db.run(`
        CREATE TABLE IF NOT EXISTS guild_settings (
          guild_id TEXT PRIMARY KEY,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      console.log('📊 Database tables initialized');
    });
  }

  /**
   * Initialize a new guild
   */
  initializeGuild(guildId) {
    return new Promise((resolve, reject) => {
      this.db.run(
        'INSERT OR IGNORE INTO guild_settings (guild_id) VALUES (?)',
        [guildId],
        (err) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });
  }

  /**
   * Add an invite record
   */
  addInvite(guildId, inviterId, invitedUserId, inviteCode) {
    return new Promise((resolve, reject) => {
      this.db.run(
        `INSERT OR IGNORE INTO invites (guild_id, inviter_id, invited_user_id, invite_code)
         VALUES (?, ?, ?, ?)`,
        [guildId, inviterId, invitedUserId, inviteCode],
        (err) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });
  }

  /**
   * Get total invite count for a user
   */
  getInviteCount(guildId, userId) {
    return new Promise((resolve, reject) => {
      this.db.get(
        `SELECT COUNT(*) as count FROM invites 
         WHERE guild_id = ? AND inviter_id = ?`,
        [guildId, userId],
        (err, row) => {
          if (err) reject(err);
          else resolve(row?.count || 0);
        }
      );
    });
  }

  /**
   * Get all invites for a user
   */
  getUserInvites(guildId, userId) {
    return new Promise((resolve, reject) => {
      this.db.all(
        `SELECT invited_user_id, timestamp FROM invites 
         WHERE guild_id = ? AND inviter_id = ?
         ORDER BY timestamp DESC`,
        [guildId, userId],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows || []);
        }
      );
    });
  }

  /**
   * Get top inviters (leaderboard)
   */
  getLeaderboard(guildId, limit = 10) {
    return new Promise((resolve, reject) => {
      this.db.all(
        `SELECT inviter_id, COUNT(*) as invite_count 
         FROM invites 
         WHERE guild_id = ? 
         GROUP BY inviter_id 
         ORDER BY invite_count DESC 
         LIMIT ?`,
        [guildId, limit],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows || []);
        }
      );
    });
  }

  /**
   * Add a reward for a milestone
   */
  addReward(guildId, milestone, type, value) {
    return new Promise((resolve, reject) => {
      this.db.run(
        `INSERT OR REPLACE INTO rewards (guild_id, milestone, type, value)
         VALUES (?, ?, ?, ?)`,
        [guildId, milestone, type, value],
        (err) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });
  }

  /**
   * Get rewards for a specific milestone
   */
  getRewardsForMilestone(guildId, milestone) {
    return new Promise((resolve, reject) => {
      this.db.all(
        `SELECT * FROM rewards 
         WHERE guild_id = ? AND milestone = ?`,
        [guildId, milestone],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows || []);
        }
      );
    });
  }

  /**
   * Get all rewards for a guild
   */
  getAllRewards(guildId) {
    return new Promise((resolve, reject) => {
      this.db.all(
        `SELECT * FROM rewards 
         WHERE guild_id = ? 
         ORDER BY milestone ASC`,
        [guildId],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows || []);
        }
      );
    });
  }

  /**
   * Remove a reward
   */
  removeReward(guildId, milestone, type, value) {
    return new Promise((resolve, reject) => {
      this.db.run(
        `DELETE FROM rewards 
         WHERE guild_id = ? AND milestone = ? AND type = ? AND value = ?`,
        [guildId, milestone, type, value],
        (err) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });
  }

  /**
   * Close database connection
   */
  close() {
    return new Promise((resolve, reject) => {
      this.db.close((err) => {
        if (err) reject(err);
        else {
          console.log('Database connection closed');
          resolve();
        }
      });
    });
  }
}

module.exports = Database;
