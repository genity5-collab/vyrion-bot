import asyncio
import random

# Fun status lines shown while the loading bar animates
STATUS_LINES = [
    "Booting up Vyrion core...",
    "Warming up the moderation hammer 🔨",
    "Downloading more RAM... 💾",
    "Consulting the vibe crystal 🔮",
    "Sharpening the ban hammer... 🔨",
    "Feeding the Vyrion dragon 🐉",
    "Untangling the cables 🧶",
    "Polishing the pixels... ✨",
    "Counting to infinity (twice)... 🔢",
    "Greasing the command gears ⚙️",
    "Bribing the Discord servers... 🤝",
    "Reticulating splines... 📐",
]

FRAMES = 8
DELAY = 0.35  # total animation ~2.8s


async def loading_bar(interaction, status: str = None):
    """
    Defer the response and run a fun Replit-style loading animation.
    Call this FIRST in a command, then edit the response with the real result.
    """
    if not interaction.response.is_done():
        await interaction.response.defer()
    last = None
    for i in range(1, FRAMES + 1):
        # pick a random status line, but never the same twice in a row
        line = random.choice(STATUS_LINES)
        while line == last and len(STATUS_LINES) > 1:
            line = random.choice(STATUS_LINES)
        last = line
        bar = "▰" * i + "▱" * (FRAMES - i)
        await interaction.edit_original_response(
            content=f"{status or '⏳ Vyrion is working'}\n`{bar}` {line}"
        )
        await asyncio.sleep(DELAY)
