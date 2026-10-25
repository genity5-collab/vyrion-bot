import fs from "node:fs";
import { EmbedBuilder } from "discord.js";

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export const NITRO_GIFT_URL = "https://base44.app/api/apps/6a6c7d9e14b0784991815f94/files/mp/public/6a6c7d9e14b0784991815f94/5657858ee_gift.jpg";
export const NITRO_LOGO_URL = "https://base44.app/api/apps/6a6c7d9e14b0784991815f94/files/mp/public/6a6c7d9e14b0784991815f94/6738847a2_logo.jpg";

// ---------- storage: bun:sqlite under Bun, JSON file fallback under plain Node ----------
fs.mkdirSync("data", { recursive: true });
let db = null;
try {
    const { Database } = await import("bun:sqlite");
    db = new Database("data/vyrion.db");
    db.run(`CREATE TABLE IF NOT EXISTS strikes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        guild_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        moderator_id INTEGER NOT NULL,
        reason TEXT,
        created_at TEXT DEFAULT (datetime('now'))
    )`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_strikes_lookup ON strikes (guild_id, user_id)`);
    console.log("[vyrion] strike database ready (bun:sqlite)");
} catch {
    console.warn("[vyrion] bun:sqlite unavailable — using JSON file fallback for strikes");
}

const JSON_PATH = "data/strikes.json";
const loadJson = () => { try { return JSON.parse(fs.readFileSync(JSON_PATH, "utf8")); } catch { return []; } };
const saveJson = (rows) => fs.writeFileSync(JSON_PATH, JSON.stringify(rows, null, 2));
const now = () => new Date().toISOString().slice(0, 19).replace("T", " ");

export const store = {
    available: true,
    add(guildId, userId, modId, reason) {
        const r = { reason: reason || "No reason given", created_at: now() };
        if (db) db.run("INSERT INTO strikes (guild_id, user_id, moderator_id, reason) VALUES (?, ?, ?, ?)", [guildId, userId, modId, r.reason]);
        else { const rows = loadJson(); rows.push({ guild_id: guildId, user_id: userId, reason: r.reason, created_at: r.created_at }); saveJson(rows); }
    },
    count(guildId, userId) {
        if (db) return db.query("SELECT COUNT(*) AS c FROM strikes WHERE guild_id = ? AND user_id = ?").get(guildId, userId).c;
        return loadJson().filter((r) => r.guild_id === guildId && r.user_id === userId).length;
    },
    list(guildId, userId) {
        if (db) return db.query("SELECT reason, created_at FROM strikes WHERE guild_id = ? AND user_id = ? ORDER BY id DESC").all(guildId, userId);
        return loadJson().filter((r) => r.guild_id === guildId && r.user_id === userId).reverse();
    },
    clear(guildId, userId) {
        if (db) db.run("DELETE FROM strikes WHERE guild_id = ? AND user_id = ?", [guildId, userId]);
        else saveJson(loadJson().filter((r) => !(r.guild_id === guildId && r.user_id === userId)));
    },
};

// last deleted message per channel, for /snipe
export const snipeMap = new Map();

// ---------- embed / check helpers ----------
export function modEmbed(action, target, moderator, reason, extra) {
    const emb = new EmbedBuilder()
        .setTitle(action)
        .setColor(action.startsWith("Un") ? 0x57f287 : 0xed4245)
        .setTimestamp()
        .addFields(
            { name: "User", value: `${target}`, inline: true },
            { name: "Moderator", value: `${moderator}`, inline: true },
            { name: "Reason", value: reason || "No reason given", inline: false },
        );
    if (extra) emb.addFields({ name: "Info", value: extra, inline: false });
    return emb;
}

// returns an error string, or null if ok
export function hierarchyError(interaction, target) {
    if (target.user?.bot || target.id === interaction.user.id) return "❌ You can't use this on bots or yourself.";
    if (target.roles.highest.comparePositionTo(interaction.member.roles.highest) >= 0 && interaction.guild.ownerId !== interaction.user.id)
        return "❌ You can't moderate someone with an equal or higher role.";
    if (target.roles.highest.comparePositionTo(interaction.guild.members.me.roles.highest) >= 0)
        return "❌ Vyrion's role is below that user's role. Move Vyrion's role higher.";
    return null;
}
