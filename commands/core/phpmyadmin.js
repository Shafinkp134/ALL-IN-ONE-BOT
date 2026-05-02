const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const mysql = require('mysql2/promise');

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1']);

function ensureConfigured() {
    const required = ['MYSQL_HOST', 'MYSQL_USER', 'MYSQL_DATABASE'];
    const missing = required.filter((key) => !process.env[key]);
    if (missing.length) {
        throw new Error(`Missing env: ${missing.join(', ')}`);
    }
}

function enforceLocalHosting() {
    const host = String(process.env.MYSQL_HOST || '').trim().toLowerCase();
    if (!LOCAL_HOSTS.has(host)) {
        throw new Error('This command is restricted to self-hosted/local MySQL only (localhost / 127.0.0.1 / ::1).');
    }
}

function createPool() {
    ensureConfigured();
    enforceLocalHosting();

    return mysql.createPool({
        host: process.env.MYSQL_HOST,
        port: Number(process.env.MYSQL_PORT || 3306),
        user: process.env.MYSQL_USER,
        password: process.env.MYSQL_PASSWORD || '',
        database: process.env.MYSQL_DATABASE,
        connectionLimit: 3,
        waitForConnections: true,
        charset: 'utf8mb4'
    });
}

function truncate(value, max = 1800) {
    const text = String(value ?? 'null');
    return text.length > max ? `${text.slice(0, max - 3)}...` : text;
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('phpmyadmin')
        .setDescription('Local-hosted MySQL manager (self-host use)')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addSubcommand((sub) =>
            sub
                .setName('status')
                .setDescription('Check local MySQL connection health')
        )
        .addSubcommand((sub) =>
            sub
                .setName('tables')
                .setDescription('List tables in current local database')
        )
        .addSubcommand((sub) =>
            sub
                .setName('schema')
                .setDescription('Show CREATE TABLE schema')
                .addStringOption((opt) =>
                    opt.setName('table').setDescription('Table name').setRequired(true)
                )
        )
        .addSubcommand((sub) =>
            sub
                .setName('query')
                .setDescription('Run read-only query on local database')
                .addStringOption((opt) =>
                    opt.setName('sql').setDescription('SELECT / SHOW / DESCRIBE / EXPLAIN').setRequired(true)
                )
        ),

    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });

        const sub = interaction.options.getSubcommand();
        let pool;

        try {
            pool = createPool();

            if (sub === 'status') {
                const [rows] = await pool.query('SELECT NOW() AS server_time, DATABASE() AS current_database, @@hostname AS server_hostname');
                const row = rows[0] || {};
                const embed = new EmbedBuilder()
                    .setColor(0x57f287)
                    .setTitle('✅ Local MySQL Status')
                    .setDescription('Connected successfully to your self-hosted MySQL server.')
                    .addFields(
                        { name: 'Database', value: String(row.current_database || 'unknown'), inline: true },
                        { name: 'Server Hostname', value: String(row.server_hostname || 'unknown'), inline: true },
                        { name: 'Server Time', value: String(row.server_time || 'unknown'), inline: false }
                    );

                return interaction.editReply({ embeds: [embed] });
            }

            if (sub === 'tables') {
                const [rows] = await pool.query('SHOW TABLES');
                const keys = rows.length ? Object.keys(rows[0]) : [];
                const nameKey = keys[0];
                const tableNames = rows.map((row) => row[nameKey]);

                const embed = new EmbedBuilder()
                    .setColor(0x5865f2)
                    .setTitle('📚 Local Database Tables')
                    .setDescription(tableNames.length ? truncate(tableNames.join('\n'), 3800) : 'No tables found.');

                return interaction.editReply({ embeds: [embed] });
            }

            if (sub === 'schema') {
                const table = interaction.options.getString('table', true).trim();
                if (!/^[a-zA-Z0-9_]+$/.test(table)) {
                    return interaction.editReply('❌ Invalid table name. Use alphanumeric characters and underscores only.');
                }

                const [rows] = await pool.query(`SHOW CREATE TABLE \`${table}\``);
                if (!rows.length) {
                    return interaction.editReply('❌ No schema returned for that table.');
                }

                const createSql = rows[0]['Create Table'] || rows[0]['Create View'] || JSON.stringify(rows[0], null, 2);
                return interaction.editReply(`\`\`\`sql\n${truncate(createSql)}\n\`\`\``);
            }

            if (sub === 'query') {
                const sql = interaction.options.getString('sql', true).trim();
                const normalized = sql.toLowerCase();
                const allowed = ['select', 'show', 'describe', 'desc', 'explain'];

                if (!allowed.some((keyword) => normalized.startsWith(keyword))) {
                    return interaction.editReply('❌ Only read-only queries are allowed: SELECT, SHOW, DESCRIBE, DESC, EXPLAIN.');
                }

                if (normalized.includes(';')) {
                    return interaction.editReply('❌ Multi-statement queries are not allowed.');
                }

                const [rows] = await pool.query(sql);
                const preview = Array.isArray(rows) ? rows.slice(0, 15) : rows;
                const json = truncate(JSON.stringify(preview, null, 2), 3800);
                return interaction.editReply(`\`\`\`json\n${json}\n\`\`\``);
            }

            return interaction.editReply('❌ Unknown subcommand.');
        } catch (error) {
            console.error('[phpmyadmin command error]', error);
            return interaction.editReply(`❌ ${truncate(error.message, 1800)}`);
        } finally {
            if (pool) {
                await pool.end();
            }
        }
    }
};
