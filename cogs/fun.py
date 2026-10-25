import random

import discord
from discord import app_commands
from discord.ext import commands

from utils.loading import loading_bar

GAY_TIERS = [
    (0, "Straight as a ruler 📏... suspiciously straight."),
    (10, "Just vibing, nothing to see here 😐"),
    (20, "A single gay thought has been detected 👀"),
    (35, "Casually curious 🤨"),
    (45, "Equal opportunity flirter 😏"),
    (55, "The vibes are... fabulously ambiguous 💅"),
    (65, "Definitely owns at least one rainbow item 🌈"),
    (75, "Certified fruit fly magnet 🍇"),
    (85, "Slaying on a daily basis ✨"),
    (95, "The math is mathing WAY too hard 🌈"),
]

NITRO_COLORS = [0xFF73FA, 0x7289DA, 0x57F287, 0xFEE75C, 0xEB459E]


class Fun(commands.Cog):
    def __init__(self, bot):
        self.bot = bot

    @app_commands.command(name="gaymeter", description="Measure how gay someone is. 100% scientific.*")
    @app_commands.describe(member="Who to measure (defaults to you)")
    async def gaymeter(self, interaction, member: discord.Member = None):
        member = member or interaction.user
        if member.bot:
            await interaction.response.send_message("🤖 Robots are immune to the gay meter. Blame physics.")
            return
        await loading_bar(interaction)
        score = random.randint(0, 100)
        tier = next((text for threshold, text in reversed(GAY_TIERS) if score >= threshold), GAY_TIERS[0][1])
        filled = round(score / 10)
        bar = "🌈" * filled + "⬛" * (10 - filled)

        emb = discord.Embed(title="🏳️‍🌈 Gay Meter 3000", color=0xFF73FA)
        emb.add_field(name="Target", value=member.mention, inline=True)
        emb.add_field(name="Result", value=f"**{score}%** gay", inline=True)
        emb.add_field(name="Reading", value=f"{bar}\n{tier}", inline=False)
        emb.set_footer(text="Results are randomly generated. Definitely. Probably.*")
        await interaction.edit_original_response(embed=emb)

    @app_commands.command(name="fakenitro", description="Gift someone 100% real, totally legit Nitro. 🎁")
    @app_commands.describe(member="Who gets the 'gift'")
    async def fakenitro(self, interaction, member: discord.Member = None):
        member = member or interaction.user
        await loading_bar(interaction)
        plans = ["Nitro Basic", "Nitro Full", "Nitro Ultra Deluxe™", "Nitro but better", "Nitro Plus Max Pro"]
        plan = random.choice(plans)

        emb = discord.Embed(
            title=f"🎉 You've been gifted Discord {plan}!",
            description=(
                f"{member.mention}, someone REALLY likes you.\n\n"
                "Click below to claim your absolutely genuine, not-at-all-suspicious gift!\n\n"
                "[🎉 CLAIM YOUR NITRO](https://www.youtube.com/watch?v=dQw4w9WgXcQ)"
            ),
            color=random.choice(NITRO_COLORS),
        )
        emb.set_footer(text="Vyrion is not responsible for broken friendships or trust issues.")
        emb.set_thumbnail(url="https://cdn.discordapp.com/emojis/831233414468206634.png")
        await interaction.edit_original_response(embed=emb)

    @app_commands.command(name="vyrion", description="What even is this bot?")
    async def vyrion(self, interaction):
        await loading_bar(interaction)
        latency = round(self.bot.latency * 1000)
        emb = discord.Embed(
            title="🐉 Vyrion",
            description="AI-powered Discord bot with Roblox integration, moderation and safety features.\n*(AI + Roblox coming soon — currently just vibes and ban hammers)*",
            color=discord.Color.purple(),
        )
        emb.add_field(name="🏓 Ping", value=f"`{latency} ms`", inline=True)
        emb.add_field(name="🛡️ Anti-spam", value="Online", inline=True)
        emb.add_field(name="Servers", value=str(len(self.bot.guilds)), inline=True)
        emb.add_field(
            name="Commands",
            value="`/mute` `/unmute` `/kick` `/ban` `/unban` `/clear` `/strike` `/strikes` `/clearstrikes` `/gaymeter` `/fakenitro` `/vyrion`",
            inline=False,
        )
        await interaction.edit_original_response(embed=emb)


async def setup(bot):
    await bot.add_cog(Fun(bot))
