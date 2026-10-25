# Sukuna Discord Bot

Sukuna is a JavaScript bot for server moderation, safe role self-assignment, welcome messages, and basic server utilities. It uses a lowercase `s` prefix and discord.js v14.

## Run the bot

1. Add the Discord bot token as a Replit Secret named `DISCORD_TOKEN`. Never put it in a file or message.
2. In Discord's Developer Portal, open the bot's **Bot** settings and enable **Server Members Intent** and **Message Content Intent**. Sukuna needs these to welcome new members and read `s` prefix commands.
3. Invite the bot to your server with the `bot` scope. Grant only the needed permissions: View Channels, Send Messages, Read Message History, Embed Links, Add Reactions, Manage Messages, Kick Members, Ban Members, Moderate Members, and Manage Roles. Do not grant Administrator.
4. In your server's role settings, move Sukuna's bot role above the roles it must assign and the members it must moderate. Keep it below server administrators.
5. Start the **Sukuna Discord Bot** workflow, or run `pnpm --filter @workspace/sukuna-bot run dev` in the project shell. A successful startup prints the bot name and number of servers connected. Stop it with Ctrl+C in a shell or stop the workflow.
6. In a server channel, run `s help`.

## Commands

### Moderation

- `s kick @user [reason]`
- `s ban @user [reason]`
- `s timeout @user duration [reason]` — duration examples: `30s`, `10m`, `2h`, `1d`, `1w`; maximum 28 days
- `s untimeout @user`
- `s warn @user [reason]`
- `s warnings @user`
- `s clearwarnings @user`
- `s purge amount` — 1–100 messages; Discord skips messages older than 14 days

Members need the matching Discord permission. The bot checks its own permission and role order separately. The server owner, the command author, and targets at or above the bot/staff role cannot be moderated.

### Roles and configuration

- `s role @user @role` / `s removerole @user @role`
- `s addselfrole @role` / `s removeselfrole @role` — configure up to 25 button roles
- `s rolepanel` — post a new panel using the current approved-role list
- `s setwelcome #channel` / `s disablewelcome`
- `s setmodlog #channel` / `s disablemodlog`
- `s setautorole @role` / `s disableautorole`
- `s config` — show the current settings

Role assignment and self-role setup require Manage Roles. Channel settings require Manage Server. Roles with administrator or moderation powers, integration-managed roles, and `@everyone` cannot be self-assigned or used as the autorole.

### Utilities

- `s help`
- `s ping`
- `s userinfo [@user]`
- `s serverinfo`
- `s av [@user]` — `s av` shows your own avatar. There is no `s avatar` command.
- `s poll [question]` — add reactions to vote yes/no
- `s announce message` — requires Manage Server
- `s say message` — requires Manage Messages

### Anime interactions

- `s hug @user`, `s kiss @user`, `s pat @user`, `s cuddle @user`
- `s punch @user`, `s slap @user`, `s poke @user`, `s bite @user`
- `s wave @user`, `s highfive @user`
- `s dance` — no target required

These commands use the no-key [Gifukai anime GIF API](https://gifukai.com/docs); the GIF URL is retrieved when the command runs, checked, then displayed in Discord. If the service is unavailable, Sukuna sends an error instead of a broken or made-up image.

The source can be changed with the non-secret `ANIME_GIF_API_BASE_URL` environment variable (default: `https://api.gifukai.com/v1`). The default source serves images from `cdn.gifukai.com`. If you change providers and its image CDN is on another host, set `ANIME_GIF_MEDIA_HOSTS` to a comma-separated allow-list of image hostnames.

## Saved data

Sukuna writes server settings and warnings to `data/sukuna-data.json` in the project directory. Writes use a temporary file and rename so an interrupted write is less likely to damage saved data. The data file is excluded from Git. A malformed file is left untouched and reported instead of being silently replaced.

The Replit workspace file remains available after restarting the bot workflow. If you move the bot to a host with temporary storage, set the non-secret `BOT_DATA_DIR` environment variable to that host's persistent mounted directory. Do not run multiple Sukuna instances against the same JSON file; use a shared database if you need multiple instances.

## Checks

From the project shell:

```sh
pnpm --filter @workspace/sukuna-bot run check
pnpm --filter @workspace/sukuna-bot test
```

These checks do not require a Discord token. Testing real moderation and role changes requires inviting Sukuna to a test server with the permissions above.
