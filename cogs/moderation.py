import time
from collections import defaultdict, deque
from datetime import timedelta

import discord
from discord import app_commands
from discord.ext import commands

from utils.loading import loading_bar

MOD_ACTIONS = {
    "Muted": "🔇",
    "Banned": "🔨",
    "Kicked": "👢",
    "Struck": "⚠️",
    "Cleared": "🧹",
    "Unmuted": "🔊",
    "Unbanned": "🕊️",
}


async def mod_embed(action: str, target, moderator, reason: str, extra: str = None) -> discord.Embed:
    emb = discord.Embed(
        title=f"{MOD_ACTIONS.get(action, '⚙️')} {action}",
        color=discord.Color.red() if action not in ("Unmuted", "Unbanned") else discord.Color.green(),
        timestamp=discord.utils.utcnow(),
    )
    emb.add_field(name="User", value=str(target), inline=True)
    emb.add_field(name="Moderator", value=str(moderator), inline=True)
    emb.add_field(name="Reason", value=reason or "No reason given", inline=False)
    if extra:
        emb.add_field(name="Info", value=extra, inline=False)
    return emb


class AntiSpam:
    """Rate-limits users: too many messages too fast = auto-timeout + purge."""

    def __init__(self, bot):
        self.bot = bot
        self.recent: dict[tuple, deque] = defaultdict(lambda: deque(maxlen=5))
        self.punished: set[tuple] = set()

    async def check(self, message: discord.Message):
        if message.guild is None or message.author.bot:
            return
        # staff are exempt
        if message.author.guild_permissions.manage_messages:
            return
        key = (message.guild.id, message.author.id)
        now = time.monotonic()
        bucket = self.recent[key]
        bucket.append(now)
        # 5+ messages within 3 seconds = spam
        if len(bucket) == 5 and now - bucket[0] <= 3 and key not in self.punished:
            self.punished.add(key)
            bucket.clear()
            try:
                await message.author.timeout(discord.utils.utcnow() + timedelta(minutes=10), reason="Vyrion anti-spam: message flood")
                cutoff = discord.utils.utcnow() - timedelta(seconds=5)
                await message.channel.purge(
                    limit=10,
                    check=lambda m: m.author.id == message.author.id and m.created_at >= cutoff,
                )
                await message.channel.send(
                    f"🛡️ {message.author.mention} got auto-muted for 10 minutes by Vyrion anti-spam.",
                    delete_after=10,
                )
            except discord.Forbidden:
                pass  # missing perms, stay silent
            self.punished.discard(key)


class Moderation(commands.Cog):
    def __init__(self, bot):
        self.bot = bot
        self.spam = AntiSpam(bot)
        self.db = bot.db

    @commands.Cog.listener("on_message")
    async def spam_watch(self, message: discord.Message):
        await self.spam.check(message)

    # ---------- helpers ----------
    async def better(self, interaction, target: discord.Member) -> bool:
        if target.top_role >= interaction.user.top_role and interaction.user != interaction.guild.owner:
            await interaction.edit_original_response(content="❌ You can't moderate someone with an equal or higher role.")
            return False
        if target.top_role >= interaction.guild.me.top_role:
            await interaction.edit_original_response(content="❌ Vyrion's role is below that user's role. Move Vyrion's role higher.")
            return False
        return True

    # ---------- top-level commands ----------
    @app_commands.command(name="mute", description="Timeout a member (mutes them).")
    @app_commands.checks.has_permissions(moderate_members=True)
    @app_commands.checks.bot_has_permissions(moderate_members=True)
    @app_commands.guild_only()
    @app_commands.describe(member="Who to mute", minutes="How long (minutes, max 40320)", reason="Why")
    async def mute(self, interaction, member: discord.Member, minutes: app_commands.Range[int, 1, 40320] = 10, reason: str = None):
        await loading_bar(interaction)
        if member.bot or member == interaction.user or not await self.better(interaction, member):
            return
        await member.timeout(discord.utils.utcnow() + timedelta(minutes=minutes), reason=reason)
        await interaction.edit_original_response(
            embed=await mod_embed("Muted", member, interaction.user, reason, extra=f"Duration: **{minutes} min**")
        )

    @app_commands.command(name="unmute", description="Remove a member's timeout.")
    @app_commands.checks.has_permissions(moderate_members=True)
    @app_commands.checks.bot_has_permissions(moderate_members=True)
    @app_commands.guild_only()
    async def unmute(self, interaction, member: discord.Member):
        await loading_bar(interaction)
        if not member.is_timed_out():
            await interaction.edit_original_response(content=f"✅ {member.mention} isn't muted.")
            return
        await member.timeout(None, reason=f"Unmuted by {interaction.user}")
        await interaction.edit_original_response(embed=await mod_embed("Unmuted", member, interaction.user, "Timeout removed"))

    @app_commands.command(name="kick", description="Kick a member.")
    @app_commands.checks.has_permissions(kick_members=True)
    @app_commands.checks.bot_has_permissions(kick_members=True)
    @app_commands.guild_only()
    @app_commands.describe(member="Who to kick", reason="Why")
    async def kick(self, interaction, member: discord.Member, reason: str = None):
        await loading_bar(interaction)
        if member == interaction.user or not await self.better(interaction, member):
            return
        await member.kick(reason=reason)
        await interaction.edit_original_response(embed=await mod_embed("Kicked", member, interaction.user, reason))

    @app_commands.command(name="ban", description="Ban a member.")
    @app_commands.checks.has_permissions(ban_members=True)
    @app_commands.checks.bot_has_permissions(ban_members=True)
    @app_commands.guild_only()
    @app_commands.describe(member="Who to ban", reason="Why")
    async def ban(self, interaction, member: discord.Member, reason: str = None):
        await loading_bar(interaction)
        if member == interaction.user or not await self.better(interaction, member):
            return
        await interaction.guild.ban(member, reason=reason, delete_message_days=0)
        await interaction.edit_original_response(embed=await mod_embed("Banned", member, interaction.user, reason))

    @app_commands.command(name="unban", description="Unban a user by their ID.")
    @app_commands.checks.has_permissions(ban_members=True)
    @app_commands.guild_only()
    @app_commands.describe(user_id="The user's ID to unban", reason="Why")
    async def unban(self, interaction, user_id: str, reason: str = None):
        await loading_bar(interaction)
        try:
            user = await self.bot.fetch_user(int(user_id))
        except (ValueError, discord.NotFound):
            await interaction.edit_original_response(content="❌ That's not a valid user ID.")
            return
        try:
            await interaction.guild.unban(discord.Object(id=int(user_id)), reason=reason)
        except discord.NotFound:
            await interaction.edit_original_response(content=f"❌ {user} isn't banned.")
            return
        await interaction.edit_original_response(embed=await mod_embed("Unbanned", user, interaction.user, reason))

    @app_commands.command(name="clear", description="Bulk-delete recent messages in this channel.")
    @app_commands.checks.has_permissions(manage_messages=True)
    @app_commands.checks.bot_has_permissions(manage_messages=True, read_message_history=True)
    @app_commands.guild_only()
    @app_commands.describe(amount="How many messages to delete (1-100)")
    async def clear(self, interaction, amount: app_commands.Range[int, 1, 100]):
        await loading_bar(interaction)
        deleted = await interaction.channel.purge(limit=amount)
        await interaction.edit_original_response(content=f"🧹 Deleted **{len(deleted)}** messages. Squeaky clean!")

    @app_commands.command(name="strike", description="Give a member a strike (warning). Auto-punishes at 3.")
    @app_commands.checks.has_permissions(moderate_members=True)
    @app_commands.guild_only()
    @app_commands.describe(member="Who to strike", reason="Why")
    async def strike(self, interaction, member: discord.Member, reason: str = None):
        await loading_bar(interaction)
        if member.bot or member == interaction.user or not await self.better(interaction, member):
            return
        cur = self.db.execute(
            "INSERT INTO strikes (guild_id, user_id, moderator_id, reason) VALUES (?, ?, ?, ?)",
            (interaction.guild.id, member.id, interaction.user.id, reason or "No reason given"),
        )
        self.db.commit()
        count = self.db.execute(
            "SELECT COUNT(*) FROM strikes WHERE guild_id = ? AND user_id = ?",
            (interaction.guild.id, member.id),
        ).fetchone()[0]

        extra = f"Total strikes: **{count}**"
        if count == 3:
            await member.timeout(discord.utils.utcnow() + timedelta(minutes=60), reason="Vyrion: 3 strikes")
            extra += "\n🤖 3 strikes — auto-muted for 1 hour."
        elif count >= 5:
            try:
                await member.kick(reason="Vyrion: 5 strikes")
                extra += "\n🤖 5 strikes — auto-kicked."
            except discord.Forbidden:
                extra += "\n🤖 5 strikes — kick failed (missing perms)."

        emb = await mod_embed("Struck", member, interaction.user, reason, extra=extra)
        emb.set_footer(text=f"Strike #{cur.lastrowid} • /strikes to view")
        await interaction.edit_original_response(embed=emb)
        try:
            await member.send(f"⚠️ You received strike #{count} in **{interaction.guild.name}** for: {reason or 'No reason given'}")
        except discord.HTTPException:
            pass

    @app_commands.command(name="strikes", description="Show a member's strikes.")
    @app_commands.checks.has_permissions(moderate_members=True)
    @app_commands.guild_only()
    async def strikes(self, interaction, member: discord.Member):
        await loading_bar(interaction)
        rows = self.db.execute(
            "SELECT reason, created_at FROM strikes WHERE guild_id = ? AND user_id = ? ORDER BY id DESC",
            (interaction.guild.id, member.id),
        ).fetchall()
        if not rows:
            await interaction.edit_original_response(content=f"✨ {member.mention} has a clean record.")
            return
        emb = discord.Embed(title=f"⚠️ Strikes for {member}", color=discord.Color.orange())
        for i, (reason, created) in enumerate(rows[:10], 1):
            emb.add_field(name=f"#{i} • {created[:16]}", value=reason, inline=False)
        emb.set_footer(text=f"Total: {len(rows)}")
        await interaction.edit_original_response(embed=emb)

    @app_commands.command(name="clearstrikes", description="Clear all strikes for a member.")
    @app_commands.checks.has_permissions(moderate_members=True)
    @app_commands.guild_only()
    async def clearstrikes(self, interaction, member: discord.Member):
        await loading_bar(interaction)
        self.db.execute("DELETE FROM strikes WHERE guild_id = ? AND user_id = ?", (interaction.guild.id, member.id))
        self.db.commit()
        await interaction.edit_original_response(content=f"🧽 Cleared all strikes for {member.mention}.")


async def setup(bot):
    await bot.add_cog(Moderation(bot))
