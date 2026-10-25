import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))


def ensure_dependencies():
    """Runtime bootstrap for hosts without pip: install requirements ourselves."""
    try:
        import discord  # noqa: F401
        return
    except ImportError:
        pass

    import subprocess

    def run(cmd):
        try:
            r = subprocess.run(cmd, check=False)
            return r.returncode == 0
        except Exception:
            return False

    req = os.path.join(HERE, "requirements.txt")

    def attempt(extra):
        return run([sys.executable, "-m", "pip", "install", "--no-cache-dir", *extra, "-r", req])

    print("[vyrion] discord.py missing — auto-installing requirements...", flush=True)
    if not attempt([]):
        attempt(["--break-system-packages"])  # Debian/PEP 668 managed environments
    try:
        import discord  # noqa: F401
    except ImportError:
        print("[vyrion] pip module unavailable — trying ensurepip...", flush=True)
        run([sys.executable, "-m", "ensurepip", "--upgrade"])
        if not attempt([]):
            attempt(["--break-system-packages"])
        try:
            import discord  # noqa: F401
        except ImportError:
            print(
                "[vyrion] FATAL: could not install discord.py automatically. "
                "This host has no pip at all — ask the host to install requirements.txt.",
                flush=True,
            )
            raise SystemExit(1)
    print("[vyrion] dependencies ready", flush=True)


ensure_dependencies()

import logging  # noqa: E402

import discord  # noqa: E402
from discord.ext import commands  # noqa: E402

logging.basicConfig(level=logging.INFO)
log = logging.getLogger("vyrion")

TOKEN = os.environ.get("DISCORD_BOT_TOKEN")
if not TOKEN:
    raise SystemExit("DISCORD_BOT_TOKEN environment variable is not set.")

DB_PATH = os.environ.get("VYRION_DB", os.path.join(HERE, "data", "vyrion.db"))
os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)


def init_db() -> "sqlite3.Connection":
    import sqlite3
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
        super().__init__(command_prefix="!", intents=intents, help_command=None)
        self.privileged = privileged
        self.db = init_db()

    async def setup_hook(self):
        for ext in ("cogs.moderation", "cogs.fun"):
            await self.load_extension(ext)
        log.info("loaded cogs")

    async def on_ready(self):
        log.info("logged in as %s (id=%s)", self.user, self.user.id)
        if not self.privileged:
            log.warning("VYRION_PRIVILEGED=0 — anti-spam is DISABLED")
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
