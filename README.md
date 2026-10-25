# 🐉 Vyrion

AI-powered Discord bot with Roblox integration, moderation, and safety features.

**Status:** v1 — moderation + fun commands + anti-spam. (AI & Roblox integration coming soon.)

## Commands

### Moderation (require the matching Discord permission)
| Command | What it does |
|---|---|
| `/mute <member> [minutes] [reason]` | Timeout a member (default 10 min) |
| `/unmute <member>` | Remove a timeout |
| `/kick <member> [reason]` | Kick a member |
| `/ban <member> [reason]` | Ban a member |
| `/unban <user_id>` | Unban by user ID |
| `/clear <amount>` | Bulk-delete up to 100 messages |
| `/strike <member> [reason]` | Warn a member — **3 strikes = auto 1h mute, 5 = auto-kick** |
| `/strikes <member>` | View a member's strike history |
| `/clearstrikes <member>` | Wipe a member's strikes |

### Anti-spam (always on)
5+ messages within 3 seconds → auto 10-minute mute + purge of the spam. Staff are exempt.

### Fun
| Command | What it does |
|---|---|
| `/gaymeter [member]` | 100% scientific* gay-o-meter (*not scientific) |
| `/fakenitro [member]` | Gift someone totally-real Nitro 🎁 |
| `/vyrion` | Bot info + ping |

Every command runs a Replit-style animated loading bar (`▰▰▱▱...`) with random fun status lines before showing the result.

## Setup

1. Python 3.10+
2. `pip install -r requirements.txt`
3. Set `DISCORD_BOT_TOKEN` env var
4. **Discord Developer Portal → your app → Bot:**
   - enable **MESSAGE CONTENT INTENT** and **SERVER MEMBERS INTENT** (privileged intents)
   - if you can't, run with `VYRION_PRIVILEGED=0` (anti-spam will be disabled)
5. `python main.py`

## Storage

Strikes are stored in `data/vyrion.db` (SQLite), auto-created on first run.
