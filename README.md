# 🐉 Vyrion

AI-powered Discord bot with Roblox integration, moderation, and safety features.

**Status:** v1 — moderation + fun commands + anti-spam. (AI & Roblox integration coming soon.)
**Runtime:** Bun (JavaScript) — `bun index.js`

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

### Anti-spam (always on with privileged intents)
5+ messages within 3 seconds → auto 10-minute mute + purge. Staff are exempt.

### Fun
| Command | What it does |
|---|---|
| `/gaymeter [member]` | 100% scientific* gay-o-meter (*not scientific) |
| `/fakenitro [member]` | Gift someone totally-real Nitro 🎁 |
| `/vyrion` | Bot info + ping |

Every command runs a Replit-style animated loading bar (`▰▰▱▱...`) with random fun status lines before showing the result.

## Setup

1. Install [Bun](https://bun.sh), then `bun install` (node_modules is committed, so usually not needed)
2. Set the `DISCORD_BOT_TOKEN` environment variable
3. **Discord Developer Portal → your app → Bot:** enable **MESSAGE CONTENT INTENT** and **SERVER MEMBERS INTENT** (needed for anti-spam; without them the bot auto-falls back to no-intents mode)
4. `bun index.js` (or `bun start`)

## Storage

Strikes are stored in `data/vyrion.db` (bun:sqlite), auto-created on first run.
