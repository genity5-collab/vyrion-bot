# 🐉 Vyrion

AI-powered Discord bot with Roblox integration, moderation, and safety features.

**Status:** v2 — 42 commands (24 moderation + 18 fun). AI & Roblox integration coming soon.
**Runtime:** Bun or Node — `bun index.js` / `node index.js`

## Commands

### 🛡️ Moderation (24)
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
| `/slowmode <seconds> [channel]` | Set/remove channel slowmode |
| `/lock [channel]` | Lock a channel |
| `/unlock [channel]` | Unlock a channel |
| `/nick <member> [nickname]` | Change a member's nickname (empty = reset) |
| `/warn <member> <reason>` | Warn a member via DM |
| `/softban <member> [reason]` | Ban + instant unban (deletes their last 7 days of messages) |
| `/tempban <member> <hours> [reason]` | Ban for a set time, auto-unban |
| `/purgeuser <member> <amount>` | Delete recent messages from one member |
| `/announce <message> [channel]` | Post an official announcement embed |
| `/roleadd <member> <role>` | Give a role |
| `/roleremove <member> <role>` | Remove a role |
| `/snipe [channel]` | Show the last deleted message |
| `/nuke <confirm> [channel]` | Recreate a channel from scratch (admin only, wipes everything) |
| `/dm <member> <message>` | DM a member as server staff |
| `/emojiadd <emoji> <name>` | Add an emoji (steal from another server or image URL) |

### 🎉 Fun (18)
| Command | What it does |
|---|---|
| `/ship <first> <second>` | Compatibility test + ship name 💘 |
| `/8ball <question>` | Magic 8-ball |
| `/coinflip` | Heads or tails |
| `/dice [sides] [count]` | Roll the dice |
| `/rps <choice>` | Rock paper scissors vs Vyrion |
| `/joke` | A random (mostly coder) joke |
| `/say <text>` | Make Vyrion say something |
| `/avatar [member]` | HD avatar |
| `/serverinfo` | Server stats |
| `/userinfo [member]` | Member info + strike count |
| `/ppsize [member]` | 📏 Scientifically measure pp size |
| `/hug <member>` | Big warm hug |
| `/kill <member>` | Dramatic fictional elimination |
| `/rate <thing>` | Vyrion rates anything out of 10 |
| `/owoify <text>` | OwO-ify text |
| `/gaymeter [member]` | 100% scientific* gay-o-meter (*not scientific) |
| `/fakenitro [member]` | Gift someone totally-real Nitro 🎁 |
| `/vyrion` | Bot info + ping |

### Anti-spam (always on with privileged intents)
5+ messages within 3 seconds → auto 10-minute mute + purge. Staff are exempt.

Every command runs a Replit-style animated loading bar (`▰▰▱▱...`) with random fun status lines before showing the result.

## Setup

1. Install [Bun](https://bun.sh) or Node 18+, then `bun install` (node_modules is committed, so usually not needed)
2. Set the `DISCORD_BOT_TOKEN` environment variable
3. **Discord Developer Portal → your app → Bot:** enable **MESSAGE CONTENT INTENT** and **SERVER MEMBERS INTENT** (needed for anti-spam; without them the bot auto-falls back to no-intents mode)
4. `bun index.js` (or `node index.js` / `npm start`)

## Storage

Strikes are stored in `data/vyrion.db` (bun:sqlite) under Bun, or `data/strikes.json` under plain Node — auto-created on first run.
