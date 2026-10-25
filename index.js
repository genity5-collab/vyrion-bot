import {
    Client,
    GatewayIntentBits,
    Events,
    PermissionFlagsBits,
} from "discord.js";
import { commands, modCommands, funCommands } from "./commands.js";
import { snipeMap } from "./helpers.js";

const TOKEN = process.env.DISCORD_BOT_TOKEN;
if (!TOKEN) {
    console.error("[vyrion] FATAL: DISCORD_BOT_TOKEN env is not set.");
    process.exit(1);
}

const PRIVILEGED = process.env.VYRION_PRIVILEGED !== "0";

function buildClient(privileged) {
    const intents = [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages];
    if (privileged) intents.push(GatewayIntentBits.MessageContent, GatewayIntentBits.GuildMembers);
    return new Client({ intents });
}

async function start(privileged) {
    const client = buildClient(privileged);
    client.__privileged = privileged;

    client.once(Events.ClientReady, async (c) => {
        console.log(`[vyrion] logged in as ${c.user.tag} (${c.user.id})`);
        if (!privileged) console.warn("[vyrion] privileged intents OFF — anti-spam is DISABLED. Enable Message Content + Server Members in the Dev Portal.");
        try {
            const synced = await c.application.commands.set(commands.map((cmd) => cmd.data));
            console.log(`[vyrion] synced ${synced.size} slash commands (${modCommands.length} mod + ${funCommands.length} fun): ${[...synced.keys()].sort().join(", ")}`);
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

    // /snipe support: remember the last deleted message per channel
    client.on(Events.MessageDelete, (message) => {
        if (!message.guild) return;
        snipeMap.set(message.channel.id, {
            author: message.author?.tag ?? "Unknown",
            avatar: message.author?.displayAvatarURL(),
            content: message.content || "",
            at: new Date(),
        });
        if (snipeMap.size > 500) snipeMap.delete(snipeMap.keys().next().value);
    });

    // anti-spam: 5+ messages in 3s -> 10 min timeout + purge
    const spamBuckets = new Map();
    if (privileged) {
        client.on(Events.MessageCreate, async (message) => {
            try {
                if (!message.guild || message.author.bot) return;
                if (message.member?.permissions?.has(PermissionFlagsBits.ManageMessages)) return; // staff exempt
                const key = `${message.guild.id}:${message.author.id}`;
                const nowT = Date.now();
                const bucket = (spamBuckets.get(key) ?? []).filter((t) => nowT - t <= 3000);
                bucket.push(nowT);
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
