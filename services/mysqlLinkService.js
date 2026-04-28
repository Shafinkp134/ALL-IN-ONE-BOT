const mysql = require('mysql2/promise');

let pool;
let tableReady = false;

function isConfigured() {
    return Boolean(process.env.MYSQL_HOST && process.env.MYSQL_USER && process.env.MYSQL_DATABASE);
}

function sanitizeIdentifier(name, fallback) {
    const value = String(name || fallback).trim();
    if (!/^[a-zA-Z0-9_]+$/.test(value)) {
        throw new Error(`Invalid SQL identifier: ${value}`);
    }
    return value;
}

function getPool() {
    if (!isConfigured()) {
        throw new Error('Missing MySQL configuration. Set MYSQL_HOST, MYSQL_USER, MYSQL_PASSWORD, MYSQL_DATABASE.');
    }

    if (!pool) {
        pool = mysql.createPool({
            host: process.env.MYSQL_HOST,
            port: Number(process.env.MYSQL_PORT || 3306),
            user: process.env.MYSQL_USER,
            password: process.env.MYSQL_PASSWORD || '',
            database: process.env.MYSQL_DATABASE,
            waitForConnections: true,
            connectionLimit: Number(process.env.MYSQL_CONNECTION_LIMIT || 10),
            queueLimit: 0,
            charset: 'utf8mb4'
        });
    }

    return pool;
}

async function ensureTable() {
    if (tableReady) return;

    const db = getPool();
    await db.query(`
        CREATE TABLE IF NOT EXISTS user_discord_links (
            id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
            account_identifier VARCHAR(191) NOT NULL,
            discord_user_id VARCHAR(64) NOT NULL,
            discord_tag VARCHAR(100) NULL,
            guild_id VARCHAR(64) NULL,
            linked_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            UNIQUE KEY uq_account_identifier (account_identifier),
            UNIQUE KEY uq_discord_user_id (discord_user_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    tableReady = true;
}

async function getLinkByDiscordId(discordUserId) {
    await ensureTable();
    const db = getPool();
    const [rows] = await db.query(
        'SELECT * FROM user_discord_links WHERE discord_user_id = ? LIMIT 1',
        [String(discordUserId)]
    );
    return rows[0] || null;
}

async function getLinkByAccountIdentifier(accountIdentifier) {
    await ensureTable();
    const db = getPool();
    const [rows] = await db.query(
        'SELECT * FROM user_discord_links WHERE account_identifier = ? LIMIT 1',
        [String(accountIdentifier)]
    );
    return rows[0] || null;
}

async function findUserRecordByName(inGameName) {
    const tableName = sanitizeIdentifier(process.env.MYSQL_USERS_TABLE, 'users');
    const nameColumn = sanitizeIdentifier(process.env.MYSQL_USERS_NAME_COLUMN, 'name');

    const db = getPool();
    const [rows] = await db.query(
        `SELECT * FROM \`${tableName}\` WHERE LOWER(\`${nameColumn}\`) = LOWER(?) LIMIT 1`,
        [String(inGameName).trim()]
    );

    return rows[0] || null;
}

async function linkAccount({ accountIdentifier, discordUserId, discordTag, guildId }) {
    const normalizedAccount = String(accountIdentifier).trim();
    const normalizedDiscordId = String(discordUserId).trim();

    if (!normalizedAccount) {
        throw new Error('Account identifier is required.');
    }

    await ensureTable();
    const db = getPool();

    const existingByAccount = await getLinkByAccountIdentifier(normalizedAccount);
    if (existingByAccount && existingByAccount.discord_user_id !== normalizedDiscordId) {
        throw new Error('This account is already linked to another Discord user.');
    }

    const existingByDiscord = await getLinkByDiscordId(normalizedDiscordId);
    if (existingByDiscord && existingByDiscord.account_identifier !== normalizedAccount) {
        throw new Error('This Discord account is already linked to a different in-game name. Use unlink first.');
    }

    await db.query(
        `INSERT INTO user_discord_links (account_identifier, discord_user_id, discord_tag, guild_id)
         VALUES (?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
            account_identifier = VALUES(account_identifier),
            discord_tag = VALUES(discord_tag),
            guild_id = VALUES(guild_id),
            updated_at = CURRENT_TIMESTAMP`,
        [normalizedAccount, normalizedDiscordId, discordTag || null, guildId || null]
    );

    return getLinkByDiscordId(normalizedDiscordId);
}

async function unlinkAccountByDiscord(discordUserId) {
    await ensureTable();
    const db = getPool();
    const [result] = await db.query(
        'DELETE FROM user_discord_links WHERE discord_user_id = ?',
        [String(discordUserId)]
    );
    return result.affectedRows > 0;
}

module.exports = {
    isConfigured,
    ensureTable,
    linkAccount,
    getLinkByDiscordId,
    getLinkByAccountIdentifier,
    findUserRecordByName,
    unlinkAccountByDiscord
};
