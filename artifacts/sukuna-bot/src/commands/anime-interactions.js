import { EmbedBuilder, PermissionFlagsBits } from "discord.js";
import { fetchAnimeGif } from "../anime-gifs.js";
import { sendBotErrorLog } from "../logging.js";
import {
  requireBotChannelPermission,
  requireTextChannel,
} from "../permissions.js";

const ACTIONS = {
  hug: {
    title: "Hug",
    text: (actorId, targetId) => `<@${actorId}> gives <@${targetId}> a warm hug!`,
    needsTarget: true,
  },
  kiss: {
    title: "Kiss",
    text: (actorId, targetId) =>
      `<@${actorId}> gives <@${targetId}> a sweet, cute kiss!`,
    needsTarget: true,
  },
  pat: {
    title: "Pat",
    text: (actorId, targetId) => `<@${actorId}> gives <@${targetId}> a gentle head pat!`,
    needsTarget: true,
  },
  cuddle: {
    title: "Cuddle",
    text: (actorId, targetId) => `<@${actorId}> cuddles up with <@${targetId}>!`,
    needsTarget: true,
  },
  punch: {
    title: "Playful punch",
    text: (actorId, targetId) =>
      `<@${actorId}> lands a playful anime punch on <@${targetId}>!`,
    needsTarget: true,
  },
  slap: {
    title: "Comedic slap",
    text: (actorId, targetId) =>
      `<@${actorId}> gives <@${targetId}> a silly, over-the-top anime slap!`,
    needsTarget: true,
  },
  poke: {
    title: "Poke",
    text: (actorId, targetId) => `<@${actorId}> pokes <@${targetId}>!`,
    needsTarget: true,
  },
  wave: {
    title: "Wave",
    text: (actorId, targetId) => `<@${actorId}> waves to <@${targetId}>!`,
    needsTarget: true,
  },
  highfive: {
    title: "High five",
    text: (actorId, targetId) => `<@${actorId}> high-fives <@${targetId}>!`,
    needsTarget: true,
  },
  bite: {
    title: "Playful bite",
    text: (actorId, targetId) =>
      `<@${actorId}> gives <@${targetId}> a playful anime bite!`,
    needsTarget: true,
  },
  dance: {
    title: "Dance",
    text: (actorId) => `<@${actorId}> breaks into an anime dance!`,
    needsTarget: false,
  },
};

export const ANIME_INTERACTION_COMMANDS = Object.freeze(Object.keys(ACTIONS));

function getTarget(message) {
  const targetMember = message.mentions.members.first();
  if (targetMember) return targetMember;

  if (message.mentions.users.first()) {
    return { invalid: true };
  }
  return null;
}

async function reply(message, content) {
  await message.reply({
    content,
    allowedMentions: { repliedUser: false, parse: [] },
  });
}

export async function handleAnimeInteraction(
  message,
  command,
  client,
  store,
  gifFetcher = fetchAnimeGif,
) {
  const action = ACTIONS[command];
  if (!action) return false;

  let target = null;
  if (action.needsTarget) {
    target = getTarget(message);
    if (!target) {
      await reply(message, `Usage: \`s ${command} @user\` — mention a server member.`);
      return true;
    }
    if (target.invalid) {
      await reply(message, "That person must be a member of this server.");
      return true;
    }
    if (target.id === client.user?.id) {
      await reply(message, "I can't target myself—mention another server member.");
      return true;
    }
    if (target.id === message.author.id) {
      await reply(message, "Mention another member for this interaction.");
      return true;
    }
  }

  try {
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
  } catch (error) {
    await reply(message, error.message);
    return true;
  }

  let image;
  try {
    image = await gifFetcher(command);
  } catch (error) {
    await sendBotErrorLog(message.guild, store, `Anime interaction: ${command}`, error);
    await reply(
      message,
      "I couldn't load that anime GIF right now. Please try again in a moment.",
    );
    return true;
  }

  const description = action.text(message.author.id, target?.id);
  const embed = new EmbedBuilder()
    .setColor(0x7c3aed)
    .setTitle(action.title)
    .setDescription(description)
    .setImage(image.url);

  if (image.anime) embed.setFooter({ text: `Anime: ${image.anime}` });

  await message.reply({
    embeds: [embed],
    allowedMentions: {
      repliedUser: false,
      parse: [],
      users: target ? [message.author.id, target.id] : [message.author.id],
    },
  });

  return true;
}
