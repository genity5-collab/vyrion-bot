import fs from "node:fs";
import {
    Client,
    GatewayIntentBits,
    Events,
    SlashCommandBuilder,
    PermissionFlagsBits,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
} from "discord.js";
import { loadingBar } from "./loading.js";

const TOKEN = process.env.DISCORD_BOT_TOKEN;
if (!TOKEN) {
    console.error("[vyrion] FATAL: DISCORD_BOT_TOKEN env is not set.");
    process.exit(1);
}

const PRIVILEGED = process.env.VYRION_PRIVILEGED !== "0";

const NITRO_GIFT_URL = "https://base44.app/api/apps/6a6c7d9e14b0784991815f94/files/mp/public/6a6c7d9e14b0784991815f94/5657858ee_gift.jpg";
const NITRO_LOGO_URL = "https://base44.app/api/apps/6a6c7d9e14b0784991815f94/files/mp/public/6a6c7d9e14b0784991815f94/6738847a2_logo.jpg";

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

const store = {
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

// ---------- helpers ----------
const modEmbed = (action, target, moderator, reason, extra) => {
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
};

// returns an error string, or null if ok
function hierarchyError(interaction, target) {
    if (target.user?.bot || target.id === interaction.user.id) return "❌ You can't use this on bots or yourself.";
    if (target.roles.highest.comparePositionTo(interaction.member.roles.highest) >= 0 && interaction.guild.ownerId !== interaction.user.id)
        return "❌ You can't moderate someone with an equal or higher role.";
    if (target.roles.highest.comparePositionTo(interaction.guild.members.me.roles.highest) >= 0)
        return "❌ Vyrion's role is below that user's role. Move Vyrion's role higher.";
    return null;
}

// ---------- commands ----------
const commands = [
    {
        data: new SlashCommandBuilder()
            .setName("mute").setDescription("Timeout a member (mutes them).")
            .addUserOption((o) => o.setName("member").setDescription("Who to mute").setRequired(true))
            .addIntegerOption((o) => o.setName("minutes").setDescription("How long (minutes, max 40320)").setMinValue(1).setMaxValue(40320))
            .addStringOption((o) => o.setName("reason").setDescription("Why"))
            .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
            .setDMPermission(false),
        async execute(interaction) {
            await loadingBar(interaction);
            const member = interaction.options.getMember("member");
            const minutes = interaction.options.getInteger("minutes") ?? 10;
            const reason = interaction.options.getString("reason");
            const err = hierarchyError(interaction, member);
            if (err) return interaction.editReply({ content: err });
            await member.timeout(minutes * 60_000, reason || `Muted by ${interaction.user.tag}`);
            await interaction.editReply({ embeds: [modEmbed("🔇 Muted", member.user, interaction.user, reason, `Duration: **${minutes} min**`)] });
        },
    },
    {
        data: new SlashCommandBuilder()
            .setName("unmute").setDescription("Remove a member's timeout.")
            .addUserOption((o) => o.setName("member").setDescription("Who to unmute").setRequired(true))
            .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
            .setDMPermission(false),
        async execute(interaction) {
            await loadingBar(interaction);
            const member = interaction.options.getMember("member");
            if (!member.isCommunicationDisabled()) return interaction.editReply({ content: `✅ ${member} isn't muted.` });
            await member.timeout(null, `Unmuted by ${interaction.user.tag}`);
            await interaction.editReply({ embeds: [modEmbed("🔊 Unmuted", member.user, interaction.user, "Timeout removed")] });
        },
    },
    {
        data: new SlashCommandBuilder()
            .setName("kick").setDescription("Kick a member.")
            .addUserOption((o) => o.setName("member").setDescription("Who to kick").setRequired(true))
            .addStringOption((o) => o.setName("reason").setDescription("Why"))
            .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers)
            .setDMPermission(false),
        async execute(interaction) {
            await loadingBar(interaction);
            const member = interaction.options.getMember("member");
            const reason = interaction.options.getString("reason");
            const err = hierarchyError(interaction, member);
            if (err) return interaction.editReply({ content: err });
            await member.kick(reason || `Kicked by ${interaction.user.tag}`);
            await interaction.editReply({ embeds: [modEmbed("👢 Kicked", member.user, interaction.user, reason)] });
        },
    },
    {
        data: new SlashCommandBuilder()
            .setName("ban").setDescription("Ban a member.")
            .addUserOption((o) => o.setName("member").setDescription("Who to ban").setRequired(true))
            .addStringOption((o) => o.setName("reason").setDescription("Why"))
            .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
            .setDMPermission(false),
        async execute(interaction) {
            await loadingBar(interaction);
            const member = interaction.options.getMember("member");
            const reason = interaction.options.getString("reason");
            const err = hierarchyError(interaction, member);
            if (err) return interaction.editReply({ content: err });
            await interaction.guild.members.ban(member.id, { reason: reason || `Banned by ${interaction.user.tag}`, deleteMessageSeconds: 0 });
            await interaction.editReply({ embeds: [modEmbed("🔨 Banned", member.user, interaction.user, reason)] });
        },
    },
    {
        data: new SlashCommandBuilder()
            .setName("unban").setDescription("Unban a user by their ID.")
            .addStringOption((o) => o.setName("user_id").setDescription("The user's ID to unban").setRequired(true))
            .addStringOption((o) => o.setName("reason").setDescription("Why"))
            .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
            .setDMPermission(false),
        async execute(interaction) {
            await loadingBar(interaction);
            const id = interaction.options.getString("user_id").trim();
            if (!/^\d{17,20}$/.test(id)) return interaction.editReply({ content: "❌ That's not a valid user ID." });
            try {
                await interaction.guild.bans.remove(id, interaction.options.getString("reason") || `Unbanned by ${interaction.user.tag}`);
            } catch {
                return interaction.editReply({ content: "❌ That user isn't banned (or Vyrion lacks permissions)." });
            }
            await interaction.editReply({ embeds: [modEmbed("🕊️ Unbanned", `<@${id}> (${id})`, interaction.user, interaction.options.getString("reason"))] });
        },
    },
    {
        data: new SlashCommandBuilder()
            .setName("clear").setDescription("Bulk-delete recent messages in this channel.")
            .addIntegerOption((o) => o.setName("amount").setDescription("How many messages to delete (1-100)").setMinValue(1).setMaxValue(100).setRequired(true))
            .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
            .setDMPermission(false),
        async execute(interaction) {
            await loadingBar(interaction);
            const amount = interaction.options.getInteger("amount");
            const deleted = await interaction.channel.bulkDelete(amount, true);
            await interaction.editReply({ content: `🧹 Deleted **${deleted.size}** messages. Squeaky clean!` });
        },
    },
    {
        data: new SlashCommandBuilder()
            .setName("strike").setDescription("Give a member a strike (warning). Auto-punishes at 3.")
            .addUserOption((o) => o.setName("member").setDescription("Who to strike").setRequired(true))
            .addStringOption((o) => o.setName("reason").setDescription("Why"))
            .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
            .setDMPermission(false),
        async execute(interaction) {
            await loadingBar(interaction);
            const member = interaction.options.getMember("member");
            const reason = interaction.options.getString("reason");
            const err = hierarchyError(interaction, member);
            if (err) return interaction.editReply({ content: err });
            store.add(interaction.guild.id, member.id, interaction.user.id, reason);
            const count = store.count(interaction.guild.id, member.id);
            let extra = `Total strikes: **${count}**`;
            if (count === 3) {
                await member.timeout(60 * 60_000, "Vyrion: 3 strikes");
                extra += "\n🤖 3 strikes — auto-muted for 1 hour.";
            } else if (count >= 5) {
                try {
                    await member.kick("Vyrion: 5 strikes");
                    extra += "\n🤖 5 strikes — auto-kicked.";
                } catch {
                    extra += "\n🤖 5 strikes — kick failed (missing perms).";
                }
            }
            await interaction.editReply({ embeds: [modEmbed("⚠️ Struck", member.user, interaction.user, reason, extra)] });
            try {
                await member.send(`⚠️ You received strike #${count} in **${interaction.guild.name}** for: ${reason || "No reason given"}`);
            } catch {}
        },
    },
    {
        data: new SlashCommandBuilder()
            .setName("strikes").setDescription("Show a member's strikes.")
            .addUserOption((o) => o.setName("member").setDescription("Who to look up").setRequired(true))
            .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
            .setDMPermission(false),
        async execute(interaction) {
            await loadingBar(interaction);
            const member = interaction.options.getMember("member");
            const rows = store.list(interaction.guild.id, member.id);
            if (!rows.length) return interaction.editReply({ content: `✨ ${member} has a clean record.` });
            const emb = new EmbedBuilder().setTitle(`⚠️ Strikes for ${member.user.tag}`).setColor(0xee8434);
            rows.slice(0, 10).forEach((r, i) => emb.addFields({ name: `#${i + 1} • ${String(r.created_at).slice(0, 16)}`, value: r.reason || "No reason given", inline: false }));
            emb.setFooter({ text: `Total: ${rows.length}` });
            await interaction.editReply({ embeds: [emb] });
        },
    },
    {
        data: new SlashCommandBuilder()
            .setName("clearstrikes").setDescription("Clear all strikes for a member.")
            .addUserOption((o) => o.setName("member").setDescription("Who to clear").setRequired(true))
            .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
            .setDMPermission(false),
        async execute(interaction) {
            await loadingBar(interaction);
            const member = interaction.options.getMember("member");
            store.clear(interaction.guild.id, member.id);
            await interaction.editReply({ content: `🧽 Cleared all strikes for ${member}.` });
        },
    },
    {
        data: new SlashCommandBuilder()
            .setName("gaymeter").setDescription("Measure how gay someone is. 100% scientific.*")
            .addUserOption((o) => o.setName("member").setDescription("Who to measure (defaults to you)")),
        async execute(interaction) {
            const user = interaction.options.getUser("member") ?? interaction.user;
            if (user.bot) return interaction.reply({ content: "🤖 Robots are immune to the gay meter. Blame physics." });
            await loadingBar(interaction, "🏳️‍🌈 Calibrating the sensors");
            const score = Math.floor(Math.random() * 101);
            const tiers = [
                [95, "The math is mathing WAY too hard 🌈"],
                [85, "Slaying on a daily basis ✨"],
                [75, "Certified fruit fly magnet 🍇"],
                [65, "Definitely owns at least one rainbow item 🌈"],
                [55, "The vibes are... fabulously ambiguous 💅"],
                [45, "Equal opportunity flirter 😏"],
                [35, "Casually curious 🤨"],
                [20, "A single gay thought has been detected 👀"],
                [10, "Just vibing, nothing to see here 😐"],
                [0, "Straight as a ruler 📏... suspiciously straight."],
            ];
            const tier = tiers.find(([t]) => score >= t)[1];
            const filled = Math.round(score / 10);
            const bar = "🌈".repeat(filled) + "⬛".repeat(10 - filled);
            const emb = new EmbedBuilder()
                .setTitle("🏳️‍🌈 Gay Meter 3000").setColor(0xff73fa)
                .addFields(
                    { name: "Target", value: `${user}`, inline: true },
                    { name: "Result", value: `**${score}%** gay`, inline: true },
                    { name: "Reading", value: `${bar}\n${tier}`, inline: false },
                )
                .setFooter({ text: "Results are randomly generated. Definitely. Probably.*" });
            await interaction.editReply({ embeds: [emb] });
        },
    },
    {
        data: new SlashCommandBuilder()
            .setName("fakenitro").setDescription("Gift someone 100% real, totally legit Nitro. 🎁")
            .addUserOption((o) => o.setName("member").setDescription("Who gets the 'gift' (defaults to you)")),
        async execute(interaction) {
            const target = interaction.options.getUser("member") ?? interaction.user;
            await loadingBar(interaction, "🎁 Wrapping your gift");
            const plans = [
                "1 month of Discord Nitro Full",
                "3 months of Discord Nitro Full",
                "1 month of Discord Nitro Basic",
                "1 year of Discord Nitro Full",
            ];
            const plan = plans[Math.floor(Math.random() * plans.length)];
            const emb = new EmbedBuilder()
                .setColor(0x5865F2)
                .setAuthor({ name: "Nitro", iconURL: NITRO_LOGO_URL })
                .setTitle("You've been gifted Nitro!")
                .setDescription(
                    `**${target.username}** has gifted you **${plan}!**\n\n` +
                    "This gift was purchased from a shop, so you can enjoy Nitro without any worries! 🎉\n\n" +
                    "This gift expires **in 48 hours**."
                )
                .setThumbnail(NITRO_GIFT_URL)
                .setFooter({ text: "Guaranteed to be legit or your money back.", iconURL: NITRO_LOGO_URL });
            const accept = new ButtonBuilder()
                .setLabel("Accept Gift")
                .setStyle(ButtonStyle.Link)
                .setURL("https://www.youtube.com/watch?v=dQw4w9WgXcQ")
                .setEmoji("🎁");
            await interaction.editReply({ embeds: [emb], components: [new ActionRowBuilder().addComponents(accept)] });
        },
    },
    {
        data: new SlashCommandBuilder().setName("vyrion").setDescription("What even is this bot?"),
        async execute(interaction) {
            await loadingBar(interaction);
            const emb = new EmbedBuilder()
                .setTitle("🐉 Vyrion")
                .setDescription("AI-powered Discord bot with Roblox integration, moderation and safety features.\n*(AI + Roblox coming soon — currently just vibes and ban hammers)*")
                .setColor(0x9b59b6)
                .addFields(
                    { name: "🏓 Ping", value: `${Math.round(interaction.client.ws.ping)} ms`, inline: true },
                    { name: "🛡️ Anti-spam", value: store.available ? "Online" : "Disabled", inline: true },
                    { name: "Servers", value: `${interaction.client.guilds.cache.size}`, inline: true },
                    { name: "Commands", value: "`/mute` `/unmute` `/kick` `/ban` `/unban` `/clear` `/strike` `/strikes` `/clearstrikes` `/gaymeter` `/fakenitro` `/vyrion`", inline: false },
                );
            await interaction.editReply({ embeds: [emb] });
        },
    },
];

// ---------- anti-spam ----------
const spamBuckets = new Map();

function buildClient(privileged) {
    const intents = [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages];
    if (privileged) {
        intents.push(GatewayIntentBits.MessageContent, GatewayIntentBits.GuildMembers);
    }
    return new Client({ intents });
}

async function start(privileged) {
    const client = buildClient(privileged);

    client.once(Events.ClientReady, async (c) => {
        console.log(`[vyrion] logged in as ${c.user.tag} (${c.user.id})`);
        if (!privileged) console.warn("[vyrion] privileged intents OFF — anti-spam is DISABLED. Enable Message Content + Server Members in the Dev Portal.");
        try {
            const synced = await c.application.commands.set(commands.map((cmd) => cmd.data));
            console.log(`[vyrion] synced ${synced.size} slash commands: ${[...synced.keys()].sort().join(", ")}`);
            console.log(`[vyrion] invite url: https://discord.com/oauth2/authorize?client_id=${c.user.id}&permissions=1099511701510&scope=bot%20applications.commands`);
        } catch (err) {
            console.error("[vyrion] command sync failed:", err);
        }
    });

    client.on(Events.InteractionCreate, async (interaction) => {
        if (!interaction.isChatInputCommand()) return;
        const command = commands.find((cmd) => cmd.data.name === interaction.commandName);
        if (!command) return;
        try {
            await command.execute(interaction);
        } catch (err) {
            console.error(`[vyrion] command ${interaction.commandName} failed for ${interaction.user.tag}:`, err);
            let msg = `Something went wrong: \`${err.name || "Error"}: ${err.message}\``;
            if (/Missing Permissions/i.test(err.message)) msg = "❌ Vyrion lacks a permission for that — check Vyrion's role position in Server Settings → Roles.";
            try {
                if (interaction.deferred || interaction.replied) await interaction.editReply({ content: msg });
                else await interaction.reply({ content: msg, ephemeral: true });
            } catch {}
        }
    });

    if (privileged) {
        client.on(Events.MessageCreate, async (message) => {
            try {
                if (!message.guild || message.author.bot) return;
                if (message.member?.permissions?.has(PermissionFlagsBits.ManageMessages)) return; // staff exempt
                const key = `${message.guild.id}:${message.author.id}`;
                const now = Date.now();
                const bucket = (spamBuckets.get(key) ?? []).filter((t) => now - t <= 3000);
                bucket.push(now);
                spamBuckets.set(key, bucket);
                if (bucket.length >= 5) {
                    spamBuckets.set(key, []);
                    await message.member.timeout(10 * 60_000, "Vyrion anti-spam: message flood");
                    const cutoff = Date.now() - 5000;
                    const spamMsgs = (await message.channel.messages.fetch({ limit: 12 }))
                        .filter((m) => m.author.id === message.author.id && m.createdTimestamp >= cutoff && !m.system);
                    if (spamMsgs.size) await message.channel.bulkDelete(spamMsgs, true).catch(() => {});
                    await message.channel.send({ content: `🛡️ ${message.author} got auto-muted for 10 minutes by Vyrion anti-spam.` })
                        .then((m) => setTimeout(() => m.delete().catch(() => {}), 10_000)).catch(() => {});
                }
            } catch {
                // stay silent (e.g. missing perms)
            }
        });
    }

    try {
        await client.login(TOKEN);
    } catch (err) {
        if (/disallowed intents/i.test(err.message) && privileged) {
            console.warn("[vyrion] privileged intents not enabled in Dev Portal — retrying WITHOUT them (anti-spam off).");
            console.warn("[vyrion] FIX: Discord Developer Portal → your app → Bot → enable MESSAGE CONTENT + SERVER MEMBERS intents.");
            await start(false);
            return;
        }
        throw err;
    }
}

start(PRIVILEGED).catch((err) => {
    console.error("[vyrion] FATAL:", err);
    process.exit(1);
});
