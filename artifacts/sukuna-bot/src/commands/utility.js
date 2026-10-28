
import { EmbedBuilder, PermissionFlagsBits } from "discord.js";
import {
  requireBotChannelPermission,
  requirePermission,
  requireTextChannel,
  UserFacingError,
} from "../permissions.js";

const HELP_GROUPS = [
  {
    name: "Moderation",
    commands: [
      "`s kick @user [reason]` — kick a member",
      "`s ban @user [reason]` — ban a member",
      "`s timeout @user duration [reason]` — timeout for up to 28 days",
      "`s untimeout @user` — remove a timeout",
      "`s warn @user [reason]` — save a warning",
      "`s warnings @user` — view saved warnings",
      "`s clearwarnings @user` — clear saved warnings",
      "`s purge amount` — delete 1–100 recent messages",
    ],
  },
  {
    name: "Roles and setup (staff)",
    commands: [
      "`s role @user @role` — assign a role",
      "`s removerole @user @role` — remove a role",
      "`s rolepanel` — post the self-assignable role buttons",
      "`s addselfrole @role` / `s removeselfrole @role` — manage approved roles",
      "`s setwelcome #channel` / `s disablewelcome` — set welcome messages",
      "`s setmodlog #channel` / `s disablemodlog` — set action/error logging",
      "`s setautorole @role` / `s disableautorole` — set new-member role",
      "`s setcounting #channel` / `s disablecounting` — configure the counting game",
      "`s config` — view this server's bot settings",
    ],
  },
  {
    name: "Server utilities",
    commands: [
      "`s ping` — show response latency",
      "`s userinfo [@user]` — show account and member details",
      "`s serverinfo` — show server details",
      "`s av [@user]` — show an avatar (no mention shows your own)",
      "`s poll question` — create a yes/no reaction poll",
      "`s announce message` — post a staff-only announcement",
      "`s say message` — send a staff-only message in the current channel",
      "`s say #channel message` — send a staff-only message to another channel",
    ],
  },
  {
    name: "Anime interactions",
    commands: [
      "`s hug @user` · `s kiss @user` · `s pat @user` · `s cuddle @user`",
      "`s punch @user` · `s slap @user` · `s poke @user` · `s bite @user`",
      "`s wave @user` · `s highfive @user` · `s dance`",
    ],
  },
  {
    name: "Relationships",
    commands: [
      "`s marry @user` — propose with Accept and Decline buttons",
      "`s married` — show your spouse",
      "`s divorce` — request confirmation before ending a marriage",
      "`s couple @user` — check your relationship",
      "`s ship @user` — show a playful compatibility score",
      "`s proposals` — list your pending proposals",
      "`s marriage` — show marriage commands and your status",
    ],
  },
];

async function reply(message, content) {
  return message.reply({
    content,
    allowedMentions: { repliedUser: false, parse: [] },
  });
}

function requireMessageContent(args, command) {
  const content = args.join(" ").trim();

  if (!content) {
    throw new UserFacingError(
      `Add some text: \`s ${command} your message\`.`,
    );
  }

  if (content.length > 2_000) {
    throw new UserFacingError("Keep the message under 2,000 characters.");
  }

  return content;
}

async function handleHelp(message) {
  const embed = new EmbedBuilder()
    .setColor(0x7c3aed)
    .setTitle("Sukuna commands")
    .setDescription("Commands start with `s` or `S`.");

  for (const group of HELP_GROUPS) {
    embed.addFields({
      name: group.name,
      value: group.commands.join("\n"),
    });
  }

  await message.reply({
    embeds: [embed],
    allowedMentions: { parse: [] },
  });
}

async function handleUserInfo(message) {
  const user = message.mentions.users.first() ?? message.author;

  const member =
    message.guild.members.cache.get(user.id) ??
    (await message.guild.members.fetch(user.id).catch(() => null));

  const joinedAt = member?.joinedTimestamp
    ? `<t:${Math.floor(member.joinedTimestamp / 1_000)}:F>`
    : "Not a current server member";

  const createdAt = `<t:${Math.floor(user.createdTimestamp / 1_000)}:F>`;

  const roles = member
    ? member.roles.cache
        .filter((role) => role.id !== message.guild.id)
        .map((role) => `<@&${role.id}>`)
        .slice(0, 20)
        .join(", ") || "No roles"
    : "Not a current server member";

  const embed = new EmbedBuilder()
    .setColor(0x7c3aed)
    .setTitle(`User information: ${user.tag}`)
    .setThumbnail(user.displayAvatarURL({ size: 256 }))
    .addFields(
      { name: "User ID", value: user.id, inline: true },
      { name: "Account created", value: createdAt, inline: true },
      { name: "Joined server", value: joinedAt, inline: true },
      { name: "Roles", value: roles.slice(0, 1_024) },
    );

  await message.reply({
    embeds: [embed],
    allowedMentions: { parse: [] },
  });
}

async function handleServerInfo(message) {
  const guild = message.guild;

  const embed = new EmbedBuilder()
    .setColor(0x7c3aed)
    .setTitle(guild.name)
    .setThumbnail(guild.iconURL({ size: 256 }))
    .addFields(
      { name: "Server ID", value: guild.id, inline: true },
      { name: "Owner ID", value: guild.ownerId ?? "Unavailable", inline: true },
      { name: "Members", value: String(guild.memberCount), inline: true },
      { name: "Channels", value: String(guild.channels.cache.size), inline: true },
      { name: "Roles", value: String(guild.roles.cache.size), inline: true },
      {
        name: "Created",
        value: `<t:${Math.floor(guild.createdTimestamp / 1_000)}:F>`,
        inline: true,
      },
    );

  await message.reply({
    embeds: [embed],
    allowedMentions: { parse: [] },
  });
}

async function handleAvatar(message) {
  const user = message.mentions.users.first() ?? message.author;
  const url = user.displayAvatarURL({ size: 1_024 });

  const embed = new EmbedBuilder()
    .setColor(0x7c3aed)
    .setTitle(`${user.tag}'s avatar`)
    .setImage(url);

  await message.reply({
    embeds: [embed],
    allowedMentions: { parse: [] },
  });
}

async function handlePoll(message, args) {
  requireTextChannel(message.channel);

  requireBotChannelPermission(
    message.guild,
    message.channel,
    PermissionFlagsBits.SendMessages,
    "Send Messages",
  );

  requireBotChannelPermission(
    message.guild,
    message.channel,
    PermissionFlagsBits.EmbedLinks,
    "Embed Links",
  );

  requireBotChannelPermission(
    message.guild,
    message.channel,
    PermissionFlagsBits.AddReactions,
    "Add Reactions",
  );

  const question = args.join(" ").trim() || "Vote on the options below.";

  if (question.length > 2_000) {
    throw new UserFacingError("Keep the poll question under 2,000 characters.");
  }

  const poll = await message.channel.send({
    embeds: [
      new EmbedBuilder()
        .setColor(0x7c3aed)
        .setTitle("Poll")
        .setDescription(question)
        .setFooter({ text: `Poll by ${message.author.tag}` })
        .setTimestamp(),
    ],
  });

  await poll.react("👍");
  await poll.react("👎");
}

async function handleAnnounce(message, args) {
  requirePermission(message, PermissionFlagsBits.ManageGuild, "Manage Server");
  requireTextChannel(message.channel);

  requireBotChannelPermission(
    message.guild,
    message.channel,
    PermissionFlagsBits.SendMessages,
    "Send Messages",
  );

  const content = requireMessageContent(args, "announce");

  await message.channel.send({
    content,
    allowedMentions: { parse: [] },
  });
}

async function handleSay(message, args) {
  requirePermission(message, PermissionFlagsBits.ManageMessages, "Manage Messages");

  if (!message.guild) {
    throw new UserFacingError("This command can only be used in a server.");
  }

  requireTextChannel(message.channel);

  const targetChannel = message.mentions.channels.find(
    (channel) => channel.guildId === message.guild.id,
  );

  const destination = targetChannel ?? message.channel;

  requireTextChannel(destination);

  const contentArgs = targetChannel
    ? args.filter((arg) => arg !== `<#${targetChannel.id}>`)
    : args;

  const content = requireMessageContent(contentArgs, "say");

  requireBotChannelPermission(
    message.guild,
    destination,
    PermissionFlagsBits.SendMessages,
    "Send Messages",
  );

  requireBotChannelPermission(
    message.guild,
    message.channel,
    PermissionFlagsBits.ManageMessages,
    "Manage Messages",
  );

  await destination.send({
    content,
    allowedMentions: {
      parse: [],
      users: message.mentions.users.map((user) => user.id),
      roles: message.mentions.roles.map((role) => role.id),
    },
  });

  await message.delete();
}

export async function handleUtility(message, command, args, client) {
  switch (command) {
    case "help":
      await handleHelp(message);
      return true;

    case "ping":
      await reply(
        message,
        `Pong! WebSocket latency: ${Math.round(client.ws.ping)} ms.`,
      );
      return true;

    case "userinfo":
      await handleUserInfo(message);
      return true;

    case "serverinfo":
      await handleServerInfo(message);
      return true;

    case "av":
      await handleAvatar(message);
      return true;

    case "poll":
      await handlePoll(message, args);
      return true;

    case "announce":
      await handleAnnounce(message, args);
      return true;

    case "say":
      await handleSay(message, args);
      return true;

    default:
      return false;
  }
}
