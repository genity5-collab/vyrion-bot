import logging
import os
import sqlite3

import discord
from discord.ext import commands

logging.basicConfig(level=logging.INFO)
log = logging.getLogger("vyrion")

TOKEN = os.environ.get("DISCORD_BOT_TOKEN")
if not TOKEN:
    raise SystemExit("DISCORD_BOT_TOKEN environment variable is not set.")

DB_PATH = os.environ.get("VYRION_DB", "data/vyrion.db")
os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)


def init_db() -> sqlite3.Connection:
    db = sqlite3.connect(DB_PATH)
    db.execute(
        """CREATE TABLE IF NOT EXISTS strikes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            guild_id INTEGER NOT NULL,
            user_id INTEGER NOT NULL,
            moderator_id INTEGER NOT NULL,
            reason TEXT,
            created_at TEXT DEFAULT (datetime('now'))
        )"""
    )
    db.execute("CREATE INDEX IF NOT EXISTS idx_strikes_lookup ON strikes (guild_id, user_id)")
    db.commit()
    return db


class Vyrion(commands.Bot):
    def __init__(self):
        intents = discord.Intents.default()
        privileged = os.environ.get("VYRION_PRIVILEGED", "1") == "1"
        if privileged:
            intents.message_content = True  # for anti-spam — enable in the Dev Portal!
            intents.members = True          # enable in the Dev Portal!
        self.privileged = privileged
        super().__init__(command_prefix="!", intents=intents, help_command=None)
        self.db = init_db()

    async def setup_hook(self):
        for ext in ("cogs.moderation", "cogs.fun"):
            await self.load_extension(ext)
        log.info("loaded cogs")

    async def on_ready(self):
        log.info("logged in as %s (id=%s)", self.user, self.user.id)
        try:
            synced = await self.tree.sync()
            log.info("synced %d slash commands", len(synced))
            names = ", ".join(sorted(c.name for c in synced))
            log.info("commands: %s", names)
        except Exception:
            log.exception("command sync failed")
        perms = discord.Permissions(
            moderate_members=True,
            ban_members=True,
            kick_members=True,
            manage_messages=True,
            read_message_history=True,
        )
        log.info(
            "invite url: https://discord.com/oauth2/authorize?client_id=%s&permissions=%s&scope=bot%%20applications.commands",
            self.user.id,
            perms.value,
        )


bot = Vyrion()

if __name__ == "__main__":
    bot.run(TOKEN)
