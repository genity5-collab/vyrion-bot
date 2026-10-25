import {
    SlashCommandBuilder,
    PermissionFlagsBits,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ChannelType,
} from "discord.js";
import { loadingBar } from "./loading.js";
import { modEmbed, hierarchyError, store, snipeMap, NITRO_GIFT_URL, NITRO_LOGO_URL } from "./helpers.js";

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

// =====================================================================
// MODERATION — 24 commands
// =====================================================================
export const modCommands = [
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
            .setName("slowmode").setDescription("Set channel slowmode (0 = off).")
            .addIntegerOption((o) => o.setName("seconds").setDescription("Seconds between messages (0-21600)").setMinValue(0).setMaxValue(21600).setRequired(true))
            .addChannelOption((o) => o.addChannelTypes(ChannelType.GuildText).setName("channel").setDescription("Channel (defaults to current)"))
            .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
            .setDMPermission(false),
        async execute(interaction) {
            await loadingBar(interaction);
            const channel = interaction.options.getChannel("channel") ?? interaction.channel;
            const seconds = interaction.options.getInteger("seconds");
            await channel.setRateLimitPerUser(seconds, `Slowmode set by ${interaction.user.tag}`);
            await interaction.editReply({ content: seconds === 0 ? `🐢 Slowmode **disabled** in ${channel}.` : `🐢 Slowmode in ${channel} set to **${seconds}s**.` });
        },
    },
    {
        data: new SlashCommandBuilder()
            .setName("lock").setDescription("Lock a channel — nobody can send messages.")
            .addChannelOption((o) => o.addChannelTypes(ChannelType.GuildText).setName("channel").setDescription("Channel (defaults to current)"))
            .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
            .setDMPermission(false),
        async execute(interaction) {
            await loadingBar(interaction);
            const channel = interaction.options.getChannel("channel") ?? interaction.channel;
            await channel.permissionOverwrites.edit(interaction.guild.roles.everyone, { SendMessages: false });
            await interaction.editReply({ content: `🔒 ${channel} is now **locked**.` });
        },
    },
    {
        data: new SlashCommandBuilder()
            .setName("unlock").setDescription("Unlock a locked channel.")
            .addChannelOption((o) => o.addChannelTypes(ChannelType.GuildText).setName("channel").setDescription("Channel (defaults to current)"))
            .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
            .setDMPermission(false),
        async execute(interaction) {
            await loadingBar(interaction);
            const channel = interaction.options.getChannel("channel") ?? interaction.channel;
            await channel.permissionOverwrites.edit(interaction.guild.roles.everyone, { SendMessages: true });
            await interaction.editReply({ content: `🔓 ${channel} is now **unlocked**.` });
        },
    },
    {
        data: new SlashCommandBuilder()
            .setName("nick").setDescription("Change a member's nickname (leave empty to reset).")
            .addUserOption((o) => o.setName("member").setDescription("Who").setRequired(true))
            .addStringOption((o) => o.setName("nickname").setDescription("New nickname (max 32 chars)").setMaxLength(32))
            .setDefaultMemberPermissions(PermissionFlagsBits.ManageNicknames)
            .setDMPermission(false),
        async execute(interaction) {
            await loadingBar(interaction);
            const member = interaction.options.getMember("member");
            const nick = interaction.options.getString("nickname");
            if (member.id !== interaction.user.id) {
                const err = hierarchyError(interaction, member);
                if (err) return interaction.editReply({ content: err });
            }
            try {
                await member.setNickname(nick || null, `Nickname changed by ${interaction.user.tag}`);
            } catch {
                return interaction.editReply({ content: "❌ Couldn't change that nickname (Vyrion's role may be too low)." });
            }
            await interaction.editReply({ content: nick ? `✏️ ${member} is now known as **${nick}**.` : `✏️ ${member}'s nickname was reset.` });
        },
    },
    {
        data: new SlashCommandBuilder()
            .setName("warn").setDescription("Warn a member (sends them a DM, no strike recorded).")
            .addUserOption((o) => o.setName("member").setDescription("Who to warn").setRequired(true))
            .addStringOption((o) => o.setName("reason").setDescription("Why").setRequired(true))
            .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
            .setDMPermission(false),
        async execute(interaction) {
            await loadingBar(interaction);
            const member = interaction.options.getMember("member");
            const reason = interaction.options.getString("reason");
            const err = hierarchyError(interaction, member);
            if (err) return interaction.editReply({ content: err });
            let delivered = true;
            try {
                await member.send(`⚠️ You were **warned** in **${interaction.guild.name}** for: ${reason}`);
            } catch {
                delivered = false;
            }
            await interaction.editReply({ embeds: [modEmbed("⚠️ Warned", member.user, interaction.user, reason, delivered ? "Member was notified via DM." : "⚠️ Their DMs are closed — they didn't see the warning.")] });
        },
    },
    {
        data: new SlashCommandBuilder()
            .setName("softban").setDescription("Ban and instantly unban a member (deletes their recent messages).")
            .addUserOption((o) => o.setName("member").setDescription("Who to softban").setRequired(true))
            .addStringOption((o) => o.setName("reason").setDescription("Why"))
            .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
            .setDMPermission(false),
        async execute(interaction) {
            await loadingBar(interaction);
            const member = interaction.options.getMember("member");
            const reason = interaction.options.getString("reason");
            const err = hierarchyError(interaction, member);
            if (err) return interaction.editReply({ content: err });
            await interaction.guild.members.ban(member.id, { reason: `Softban by ${interaction.user.tag}: ${reason || "no reason"}`, deleteMessageSeconds: 604_800 });
            await interaction.guild.bans.remove(member.id, "Softban — auto-unban");
            await interaction.editReply({ embeds: [modEmbed("🧹 Softbanned", member.user, interaction.user, reason, "Their messages from the last 7 days were deleted. They can rejoin.")] });
        },
    },
    {
        data: new SlashCommandBuilder()
            .setName("tempban").setDescription("Ban a member for a set number of hours (auto-unban).")
            .addUserOption((o) => o.setName("member").setDescription("Who to tempban").setRequired(true))
            .addIntegerOption((o) => o.setName("hours").setDescription("Hours (1-720)").setMinValue(1).setMaxValue(720).setRequired(true))
            .addStringOption((o) => o.setName("reason").setDescription("Why"))
            .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
            .setDMPermission(false),
        async execute(interaction) {
            await loadingBar(interaction);
            const member = interaction.options.getMember("member");
            const hours = interaction.options.getInteger("hours");
            const reason = interaction.options.getString("reason");
            const err = hierarchyError(interaction, member);
            if (err) return interaction.editReply({ content: err });
            await interaction.guild.members.ban(member.id, { reason: `Tempban (${hours}h) by ${interaction.user.tag}`, deleteMessageSeconds: 86_400 });
            setTimeout(async () => {
                try {
                    await interaction.guild.bans.remove(member.id, "Tempban expired");
                    console.log(`[vyrion] tempban expired for ${member.id} in ${interaction.guild.id}`);
                } catch {}
            }, hours * 3_600_000);
            await interaction.editReply({ embeds: [modEmbed("⏳ Tempbanned", member.user, interaction.user, reason, `Auto-unban in **${hours}h** (resets if the bot restarts).`)] });
        },
    },
    {
        data: new SlashCommandBuilder()
            .setName("purgeuser").setDescription("Delete recent messages from one member.")
            .addUserOption((o) => o.setName("member").setDescription("Whose messages to purge").setRequired(true))
            .addIntegerOption((o) => o.setName("amount").setDescription("How many (1-100)").setMinValue(1).setMaxValue(100).setRequired(true))
            .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
            .setDMPermission(false),
        async execute(interaction) {
            await loadingBar(interaction);
            const member = interaction.options.getMember("member");
            const amount = interaction.options.getInteger("amount");
            const cutoff = Date.now() - 14 * 24 * 3600 * 1000; // bulkDelete limit
            const recent = await interaction.channel.messages.fetch({ limit: 100 });
            const targets = [...recent.values()].filter((m) => m.author.id === member.id && m.createdTimestamp > cutoff).slice(0, amount);
            if (!targets.length) return interaction.editReply({ content: "❌ No deletable messages from that member found in the last 100 messages (or last 14 days)." });
            const deleted = await interaction.channel.bulkDelete(targets, true);
            await interaction.editReply({ content: `🧹 Deleted **${deleted.size}** messages from **${member.user.tag}**.` });
        },
    },
    {
        data: new SlashCommandBuilder()
            .setName("announce").setDescription("Post an official-looking announcement embed.")
            .addStringOption((o) => o.setName("message").setDescription("The announcement").setRequired(true).setMaxLength(1500))
            .addChannelOption((o) => o.addChannelTypes(ChannelType.GuildText).setName("channel").setDescription("Where to post (defaults to current)"))
            .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
            .setDMPermission(false),
        async execute(interaction) {
            await loadingBar(interaction);
            const channel = interaction.options.getChannel("channel") ?? interaction.channel;
            const message = interaction.options.getString("message");
            const emb = new EmbedBuilder()
                .setTitle("📢 Announcement")
                .setColor(0x5865F2)
                .setDescription(message)
                .setFooter({ text: `${interaction.guild.name} • announced by ${interaction.user.tag}`, iconURL: interaction.guild.iconURL() ?? undefined })
                .setTimestamp();
            await channel.send({ embeds: [emb] });
            await interaction.editReply({ content: `📢 Announcement posted in ${channel}.` });
        },
    },
    {
        data: new SlashCommandBuilder()
            .setName("roleadd").setDescription("Give a member a role.")
            .addUserOption((o) => o.setName("member").setDescription("Who").setRequired(true))
            .addRoleOption((o) => o.setName("role").setDescription("Which role").setRequired(true))
            .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
            .setDMPermission(false),
        async execute(interaction) {
            await loadingBar(interaction);
            const member = interaction.options.getMember("member");
            const role = interaction.options.getRole("role");
            if (role.managed) return interaction.editReply({ content: "❌ That role belongs to a bot/integration and can't be assigned." });
            if (role.position >= interaction.guild.members.me.roles.highest.position)
                return interaction.editReply({ content: "❌ Vyrion's role is below that role — move Vyrion's role higher." });
            if (member.roles.cache.has(role.id)) return interaction.editReply({ content: `✅ ${member} already has **${role.name}**.` });
            await member.roles.add(role, `Role added by ${interaction.user.tag}`);
            await interaction.editReply({ content: `✅ Added **${role.name}** to ${member}.` });
        },
    },
    {
        data: new SlashCommandBuilder()
            .setName("roleremove").setDescription("Remove a role from a member.")
            .addUserOption((o) => o.setName("member").setDescription("Who").setRequired(true))
            .addRoleOption((o) => o.setName("role").setDescription("Which role").setRequired(true))
            .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
            .setDMPermission(false),
        async execute(interaction) {
            await loadingBar(interaction);
            const member = interaction.options.getMember("member");
            const role = interaction.options.getRole("role");
            if (role.managed) return interaction.editReply({ content: "❌ That role belongs to a bot/integration." });
            if (role.position >= interaction.guild.members.me.roles.highest.position)
                return interaction.editReply({ content: "❌ Vyrion's role is below that role — move Vyrion's role higher." });
            if (!member.roles.cache.has(role.id)) return interaction.editReply({ content: `✅ ${member} doesn't have **${role.name}**.` });
            await member.roles.remove(role, `Role removed by ${interaction.user.tag}`);
            await interaction.editReply({ content: `✅ Removed **${role.name}** from ${member}.` });
        },
    },
    {
        data: new SlashCommandBuilder()
            .setName("snipe").setDescription("Show the last deleted message in a channel.")
            .addChannelOption((o) => o.addChannelTypes(ChannelType.GuildText).setName("channel").setDescription("Channel (defaults to current)"))
            .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
            .setDMPermission(false),
        async execute(interaction) {
            await loadingBar(interaction);
            const channel = interaction.options.getChannel("channel") ?? interaction.channel;
            const sniped = snipeMap.get(channel.id);
            if (!sniped) return interaction.editReply({ content: "🕳️ Nothing to snipe here." });
            const emb = new EmbedBuilder()
                .setColor(0xfee75c)
                .setAuthor({ name: `Deleted message from ${sniped.author}`, iconURL: sniped.avatar ?? undefined })
                .setDescription(sniped.content || "*[no text — maybe an attachment]*")
                .setFooter({ text: `#${channel.name}` })
                .setTimestamp(sniped.at);
            await interaction.editReply({ embeds: [emb] });
        },
    },
    {
        data: new SlashCommandBuilder()
            .setName("nuke").setDescription("⚠️ Recreate this channel from scratch (deletes ALL its messages).")
            .addBooleanOption((o) => o.setName("confirm").setDescription("Type true to confirm the nuke").setRequired(true))
            .addChannelOption((o) => o.addChannelTypes(ChannelType.GuildText).setName("channel").setDescription("Channel to nuke (defaults to current)"))
            .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
            .setDMPermission(false),
        async execute(interaction) {
            if (!interaction.options.getBoolean("confirm")) return interaction.reply({ content: "❌ Nuke cancelled. Set `confirm` to true if you really want to obliterate that channel.", ephemeral: true });
            await loadingBar(interaction, "💥 Nuking channel");
            const channel = interaction.options.getChannel("channel") ?? interaction.channel;
            const position = channel.position;
            const parent = channel.parent;
            const topic = channel.topic;
            const nukedBy = interaction.user.tag;
            const newChannel = await channel.clone({ topic, parent, position });
            await channel.delete(`Nuked by ${nukedBy}`);
            const emb = new EmbedBuilder()
                .setTitle("💥 Channel nuked")
                .setColor(0xed4245)
                .setDescription(`All messages obliterated by ${interaction.user}.\nFresh start, baby. 🚀`)
                .setTimestamp();
            await newChannel.send({ embeds: [emb] });
        },
    },
    {
        data: new SlashCommandBuilder()
            .setName("dm").setDescription("Send a member a DM as Vyrion (from server staff).")
            .addUserOption((o) => o.setName("member").setDescription("Who to DM").setRequired(true))
            .addStringOption((o) => o.setName("message").setDescription("What to send").setRequired(true).setMaxLength(1000))
            .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
            .setDMPermission(false),
        async execute(interaction) {
            await loadingBar(interaction);
            const member = interaction.options.getMember("member");
            const message = interaction.options.getString("message");
            try {
                await member.send(`📩 **A message from the staff of ${interaction.guild.name}:**\n\n${message}`);
            } catch {
                return interaction.editReply({ content: "❌ Their DMs are closed — couldn't deliver." });
            }
            await interaction.editReply({ content: `📬 DM delivered to ${member}.` });
        },
    },
    {
        data: new SlashCommandBuilder()
            .setName("emojiadd").setDescription("Add an emoji to this server (steal one from elsewhere or use an image URL).")
            .addStringOption((o) => o.setName("emoji").setDescription("Paste a custom emoji here, or an image URL").setRequired(true))
            .addStringOption((o) => o.setName("name").setDescription("Name for the emoji").setRequired(true))
            .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
            .setDMPermission(false),
        async execute(interaction) {
            await loadingBar(interaction);
            const input = interaction.options.getString("emoji").trim();
            let name = interaction.options.getString("name").trim().replace(/\s+/g, "_").toLowerCase();
            if (!/^[\w-]{2,32}$/.test(name)) return interaction.editReply({ content: "❌ Emoji names must be 2-32 characters, letters/numbers/underscores only." });
            let url = null;
            const custom = input.match(/<(a)?:(\w{2,32}):(\d{17,20})>/);
            if (custom) {
                url = `https://cdn.discordapp.com/emojis/${custom[3]}.${custom[1] ? "gif" : "png"}`;
                if (name === "emoji") name = custom[2];
            } else if (/^https?:\/\/.+/i.test(input)) {
                url = input;
            } else {
                return interaction.editReply({ content: "❌ Paste a **custom emoji** (from another server) or an **image URL**." });
            }
            try {
                const emoji = await interaction.guild.emojis.create({ attachment: url, name, reason: `Added by ${interaction.user.tag}` });
                await interaction.editReply({ content: `✨ Added ${emoji} as **:${name}:**` });
            } catch (err) {
                await interaction.editReply({ content: `❌ Couldn't add that emoji (slots may be full, or the image is too big): \`${err.message}\`` });
            }
        },
    },
];

// =====================================================================
// FUN — 18 commands
// =====================================================================
export const funCommands = [
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
                    { name: "🛡️ Anti-spam", value: interaction.client.__privileged ? "Online" : "Disabled", inline: true },
                    { name: "Servers", value: `${interaction.client.guilds.cache.size}`, inline: true },
                    { name: "🛡️ Moderation", value: "`/mute /unmute /kick /ban /unban /clear /strike /strikes /clearstrikes /slowmode /lock /unlock /nick /warn /softban /tempban /purgeuser /announce /roleadd /roleremove /snipe /nuke /dm /emojiadd`", inline: false },
                    { name: "🎉 Fun", value: "`/ship /8ball /coinflip /dice /rps /joke /say /avatar /serverinfo /userinfo /ppsize /hug /kill /rate /owoify /gaymeter /fakenitro /vyrion`", inline: false },
                );
            await interaction.editReply({ embeds: [emb] });
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
            const plan = pick(plans);
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
        data: new SlashCommandBuilder()
            .setName("ship").setDescription("How compatible are two people? 💘")
            .addUserOption((o) => o.setName("first").setDescription("First person").setRequired(true))
            .addUserOption((o) => o.setName("second").setDescription("Second person").setRequired(true)),
        async execute(interaction) {
            const a = interaction.options.getUser("first");
            const b = interaction.options.getUser("second");
            await loadingBar(interaction, "💘 Matching the vibes");
            const score = Math.floor(Math.random() * 101);
            const shipName = a.username.slice(0, Math.ceil(a.username.length / 2)) + b.username.slice(Math.floor(b.username.length / 2));
            const tiers = [
                [90, "💍 MARRIAGE. RIGHT NOW. I'll officiate. 💒"],
                [75, "😍 Powerful couple energy. The server trembles."],
                [55, "👀 There's something here. Deny it all you want."],
                [35, "🤝 Good friends. Maybe more after one more conversation."],
                [15, "😬 Awkward small talk at best."],
                [0, "💔 Scientists advise these two stay in separate servers."],
            ];
            const tier = tiers.find(([t]) => score >= t)[1];
            const filled = Math.round(score / 10);
            const bar = "❤️".repeat(filled) + "🤍".repeat(10 - filled);
            const emb = new EmbedBuilder()
                .setTitle(`💘 ${a.username} ❤ ${b.username}`)
                .setColor(0xff73fa)
                .addFields(
                    { name: "Ship name", value: `**${shipName}**`, inline: true },
                    { name: "Compatibility", value: `**${score}%**`, inline: true },
                    { name: "Reading", value: `${bar}\n${tier}`, inline: false },
                );
            await interaction.editReply({ embeds: [emb] });
        },
    },
    {
        data: new SlashCommandBuilder()
            .setName("8ball").setDescription("Ask the magic 8-ball a question.")
            .addStringOption((o) => o.setName("question").setDescription("Your question").setRequired(true)),
        async execute(interaction) {
            await loadingBar(interaction, "🔮 Shaking the 8-ball");
            const answers = [
                "It is certain.", "It is decidedly so.", "Without a doubt.", "Yes, definitely.", "You may rely on it.",
                "As I see it, yes.", "Most likely.", "Outlook good.", "Yes.", "Signs point to yes.",
                "Reply hazy, try again.", "Ask again later.", "Better not tell you now.", "Cannot predict now.", "Concentrate and ask again.",
                "Don't count on it.", "My reply is no.", "My sources say no.", "Outlook not so good.", "Very doubtful.",
            ];
            const emb = new EmbedBuilder()
                .setColor(0x5865F2)
                .setTitle("🎱 The 8-ball has spoken")
                .addFields(
                    { name: "Question", value: interaction.options.getString("question").slice(0, 1000) },
                    { name: "Answer", value: `**${pick(answers)}**` },
                );
            await interaction.editReply({ embeds: [emb] });
        },
    },
    {
        data: new SlashCommandBuilder().setName("coinflip").setDescription("Flip a coin."),
        async execute(interaction) {
            await loadingBar(interaction, "🪙 Flipping...");
            const result = pick(["🪙 **Heads!**", "🪙 **Tails!**"]);
            await interaction.editReply({ content: `The coin spins... and lands on ${result}` });
        },
    },
    {
        data: new SlashCommandBuilder()
            .setName("dice").setDescription("Roll the dice.")
            .addIntegerOption((o) => o.setName("sides").setDescription("Sides on the die (2-1000, default 6)").setMinValue(2).setMaxValue(1000))
            .addIntegerOption((o) => o.setName("count").setDescription("How many dice (1-10, default 1)").setMinValue(1).setMaxValue(10)),
        async execute(interaction) {
            await loadingBar(interaction, "🎲 Rolling the dice");
            const sides = interaction.options.getInteger("sides") ?? 6;
            const count = interaction.options.getInteger("count") ?? 1;
            const rolls = Array.from({ length: count }, () => Math.floor(Math.random() * sides) + 1);
            const total = rolls.reduce((a, b) => a + b, 0);
            await interaction.editReply({
                content: `🎲 Rolled ${count > 1 ? `**${rolls.join(", ")}** — total **${total}**` : `a **${rolls[0]}**`} (d${sides})`,
            });
        },
    },
    {
        data: new SlashCommandBuilder()
            .setName("rps").setDescription("Rock, paper, scissors — against Vyrion.")
            .addStringOption((o) => o.setName("choice").setDescription("Your move").setRequired(true)
                .addChoices(
                    { name: "🪨 Rock", value: "rock" },
                    { name: "📄 Paper", value: "paper" },
                    { name: "✂️ Scissors", value: "scissors" },
                )),
        async execute(interaction) {
            await loadingBar(interaction, "✊ ✋ ✌️ ...");
            const emoji = { rock: "🪨", paper: "📄", scissors: "✂️" };
            const player = interaction.options.getString("choice");
            const bot = pick(["rock", "paper", "scissors"]);
            let verdict;
            if (player === bot) verdict = "🤝 It's a tie!";
            else if ((player === "rock" && bot === "scissors") || (player === "paper" && bot === "rock") || (player === "scissors" && bot === "paper"))
                verdict = "🏆 You win! (lucky...)";
            else verdict = "💀 Vyrion wins! Better luck next time.";
            await interaction.editReply({ content: `You: ${emoji[player]} vs Vyrion: ${emoji[bot]}\n${verdict}` });
        },
    },
    {
        data: new SlashCommandBuilder().setName("joke").setDescription("A random joke, freshly squeezed."),
        async execute(interaction) {
            await loadingBar(interaction, "🎭 Writing something funny...");
            const jokes = [
                "Why do programmers prefer dark mode? Because light attracts bugs. 🐛",
                "I told my computer I needed a break... it said 'no problem, I'll go to sleep.' 💤",
                "Why did the developer go broke? Because he used up all his cache. 💸",
                "There are only 10 types of people: those who understand binary and those who don't.",
                "Why was the JavaScript developer sad? Because he didn't Node how to Express himself. 😢",
                "A SQL query walks into a bar, goes up to two tables and asks: 'Can I JOIN you?' 🍺",
                "Why did the Roblox noob cross the road? To get to the other *baseplate*. 🧱",
                "My password is the last 8 digits of pi. Good luck. 🥧",
                "I would tell you a UDP joke, but you might not get it. 📡",
                "Why don't bungee jumpers use Discord? Too many dropped connections. 🪢",
                "Debugging: being the detective in a crime movie where you are also the murderer. 🔍",
                "Why did the chicken join Discord? To get the co-op achievements. 🐔",
                "Knock knock. Who's there? *Ping timeout.* 🚪",
                "I'm not lazy, I'm on energy-saving mode — like a potato. 🥔",
                "Why do Java developers wear glasses? Because they can't C#. 👓",
            ];
            await interaction.editReply({ content: pick(jokes) });
        },
    },
    {
        data: new SlashCommandBuilder()
            .setName("say").setDescription("Make Vyrion say something (mention-free).")
            .addStringOption((o) => o.setName("text").setDescription("What to say").setRequired(true).setMaxLength(500)),
        async execute(interaction) {
            const text = interaction.options.getString("text").replace(/@(everyone|here)/gi, "@\u200b$1");
            await loadingBar(interaction, "🎙️ Clearing my throat");
            await interaction.deleteReply().catch(() => {});
            await interaction.channel.send({ content: text });
        },
    },
    {
        data: new SlashCommandBuilder()
            .setName("avatar").setDescription("Show someone's avatar in HD.")
            .addUserOption((o) => o.setName("member").setDescription("Whose avatar (defaults to you)")),
        async execute(interaction) {
            const user = interaction.options.getUser("member") ?? interaction.user;
            await loadingBar(interaction, "📸 Zooming in");
            const emb = new EmbedBuilder()
                .setTitle(`${user.username}'s avatar`)
                .setColor(0x5865F2)
                .setImage(user.displayAvatarURL({ size: 1024, extension: "png" }));
            await interaction.editReply({ embeds: [emb] });
        },
    },
    {
        data: new SlashCommandBuilder().setName("serverinfo").setDescription("Stats about this server.").setDMPermission(false),
        async execute(interaction) {
            await loadingBar(interaction);
            const g = interaction.guild;
            try { await g.members.fetch(); } catch {}
            const emb = new EmbedBuilder()
                .setTitle(`🏰 ${g.name}`)
                .setColor(0x5865F2)
                .setThumbnail(g.iconURL())
                .addFields(
                    { name: "Owner", value: `<@${g.ownerId}>`, inline: true },
                    { name: "Members", value: `${g.memberCount}`, inline: true },
                    { name: "Boosts", value: `Level ${g.premiumTier} (${g.premiumSubscriptionCount ?? 0} boosts)`, inline: true },
                    { name: "Created", value: `<t:${Math.floor(g.createdTimestamp / 1000)}:D>`, inline: true },
                    { name: "Channels", value: `${g.channels.cache.size}`, inline: true },
                    { name: "Roles", value: `${g.roles.cache.size}`, inline: true },
                    { name: "Server ID", value: g.id, inline: false },
                );
            await interaction.editReply({ embeds: [emb] });
        },
    },
    {
        data: new SlashCommandBuilder()
            .setName("userinfo").setDescription("Info about a member.")
            .addUserOption((o) => o.setName("member").setDescription("Who (defaults to you)"))
            .setDMPermission(false),
        async execute(interaction) {
            const member = interaction.options.getMember("member") ?? interaction.member;
            const user = member.user;
            await loadingBar(interaction, "🔎 Running a background check");
            const emb = new EmbedBuilder()
                .setTitle(`👤 ${user.tag}`)
                .setColor(0x5865F2)
                .setThumbnail(user.displayAvatarURL({ size: 256 }))
                .addFields(
                    { name: "Joined server", value: member.joinedAt ? `<t:${Math.floor(member.joinedTimestamp / 1000)}:D>` : "?", inline: true },
                    { name: "Account created", value: `<t:${Math.floor(user.createdTimestamp / 1000)}:D>`, inline: true },
                    { name: "Strikes", value: `${store.count(interaction.guild.id, user.id)}`, inline: true },
                    { name: `Roles (${member.roles.cache.size - 1})`, value: member.roles.cache.filter((r) => r.id !== interaction.guild.id).map((r) => r).sort((a, b) => b.position - a.position).join(" ").slice(0, 1024) || "*none*", inline: false },
                );
            await interaction.editReply({ embeds: [emb] });
        },
    },
    {
        data: new SlashCommandBuilder()
            .setName("ppsize").setDescription("📏 Scientifically measure pp size.")
            .addUserOption((o) => o.setName("member").setDescription("Who to measure (defaults to you)")),
        async execute(interaction) {
            const user = interaction.options.getUser("member") ?? interaction.user;
            await loadingBar(interaction, "📏 Getting the ruler");
            const cm = Math.floor(Math.random() * 30);
            const tiers = [[24, "MY GOD. 🗿"], [16, "Respectable. 👏"], [9, "Perfectly average. 🫡"], [4, "It's the motion that counts. 🙃"], [0, "Microscopic. 🔬"]];
            const tier = tiers.find(([t]) => cm >= t)[1];
            await interaction.editReply({ content: `**${user.username}'s pp size:**\n8${"=".repeat(cm)}D\n📏 **${cm}cm** — ${tier}` });
        },
    },
    {
        data: new SlashCommandBuilder()
            .setName("hug").setDescription("Give someone a big warm hug 🤗")
            .addUserOption((o) => o.setName("member").setDescription("Who to hug").setRequired(true)),
        async execute(interaction) {
            const target = interaction.options.getUser("member");
            if (target.id === interaction.user.id) {
                await loadingBar(interaction, "🤗 Approaching...");
                return interaction.editReply({ content: "🤗 Self-love is important, but maybe hug a friend instead? *hugs you anyway*" });
            }
            await loadingBar(interaction, "🤗 Charging up the hug");
            const flavors = [
                `${interaction.user} wraps ${target} in the warmest, longest hug! 🤗💗`,
                `${interaction.user} tackle-hugs ${target} off their feet! 💫`,
                `${interaction.user} gives ${target} a gentle pat-hug combo. 🫂`,
                `${interaction.user} squeeze-hugs ${target} until they squeak! 🐹`,
            ];
            await interaction.editReply({ content: pick(flavors) });
        },
    },
    {
        data: new SlashCommandBuilder()
            .setName("kill").setDescription("Dramatically eliminate a member (fictionally).")
            .addUserOption((o) => o.setName("member").setDescription("Who to eliminate").setRequired(true)),
        async execute(interaction) {
            const target = interaction.options.getUser("member");
            if (target.id === interaction.user.id) return interaction.reply({ content: "☠️ Self-elimination detected. Vyrion refuses. Seek hugs instead: `/hug`", ephemeral: true });
            await loadingBar(interaction, "☠️ Loading dramatic music");
            const deaths = [
                `${interaction.user} yeeted ${target} into the void. 🕳️`,
                `${target} stepped on a Roblox spike trap set by ${interaction.user}. 💀`,
                `${interaction.user} used /ban in real life on ${target}. 🔨`,
                `${target} was gently pushed off a 1-stud-wide bridge by ${interaction.user}. 🌉`,
                `${interaction.user} dropped a grand piano on ${target}. 🎹 BOOM.`,
                `${target} tripped over ${interaction.user}'s ultra-rare garden gnome. 🧙`,
            ];
            await interaction.editReply({ content: `${pick(deaths)}\n*No members were actually harmed.* 🎬` });
        },
    },
    {
        data: new SlashCommandBuilder()
            .setName("rate").setDescription("Vyrion rates anything out of 10.")
            .addStringOption((o) => o.setName("thing").setDescription("What should be rated").setRequired(true)),
        async execute(interaction) {
            await loadingBar(interaction, "⭐ Judging intensely");
            const score = Math.floor(Math.random() * 11);
            const thing = interaction.options.getString("thing").slice(0, 200);
            const comments = [
                [10, "Masterpiece. No notes. 🏆"],
                [8, "Very solid, would recommend. 👌"],
                [6, "Decent. Has potential. 📈"],
                [4, "Mid. The jury is unimpressed. 😐"],
                [2, "Rough. Very rough. 🪨"],
                [0, "Absolute zero. Icy. ❄️"],
            ];
            const comment = comments.find(([t]) => score >= t)[1];
            const stars = "⭐".repeat(score) + "✩".repeat(10 - score);
            const emb = new EmbedBuilder()
                .setTitle("⭐ Vyrion's Rating")
                .setColor(0xfee75c)
                .addFields(
                    { name: "Subject", value: `**${thing}**`, inline: false },
                    { name: "Score", value: `**${score}/10**\n${stars}\n${comment}`, inline: false },
                )
                .setFooter({ text: "Rating is random. Vyrion's judgment is final. Sort of." });
            await interaction.editReply({ embeds: [emb] });
        },
    },
    {
        data: new SlashCommandBuilder()
            .setName("owoify").setDescription("OwO-ify any text.")
            .addStringOption((o) => o.setName("text").setDescription("Text to owoify").setRequired(true).setMaxLength(300)),
        async execute(interaction) {
            await loadingBar(interaction, "OwO-ing the text");
            const faces = ["(・`ω´・)", "owo", "uwu", "(´ hindsight)uwu", "ÒwÓ", ">w<", "(✿ ♡‿♡)", "◔w◔"];
            let text = interaction.options.getString("text");
            text = text
                .replace(/[rl]/g, "w")
                .replace(/[RL]/g, "W")
                .replace(/n([aeiou])/g, "ny$1")
                .replace(/N([aeiou])/g, "Ny$1")
                .replace(/[.,!?]+$/, "");
            await interaction.editReply({ content: `${text} ${pick(faces)}` });
        },
    },
];

export const commands = [...modCommands, ...funCommands];
