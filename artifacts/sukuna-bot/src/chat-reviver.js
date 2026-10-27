
import { PermissionFlagsBits } from "discord.js";

const CHANNEL_NAME = "💬・general-chat";
const MONKEYS_ROLE_ID = "1564520432416067665";
const INTERVAL_MS = 3 * 60 * 60 * 1000;

const questions = [
  "What's something that made you laugh recently?",
  "If you could instantly master one skill, what would it be?",
  "What's a game you could play for hours?",
  "What's an unpopular opinion you stand by?",
  "What's one movie or show you'd recommend to everyone?",
  "If you could travel anywhere right now, where would you go?",
  "What's the weirdest fact you know?",
  "What's something everyone should try at least once?",
  "What song have you had on repeat lately?",
  "What's your most random talent?",
  "Would you rather explore space or the deep ocean?",
  "What's a fictional world you'd want to visit?",
  "What's the funniest thing you've seen this week?",
  "What topic could you talk about for hours?",
  "What's one thing you'd change about your favorite game?",
  "What's your current favorite game?",
  "If you could have any fictional character as a teammate, who would you pick?",
  "What's a small thing that instantly improves your day?",
  "What game deserves more attention?",
  "What's the most interesting rabbit hole you've gone down online?"
];

export function startChatReviver(client) {
  let lastQuestionIndex = -1;

  async function postQuestion() {
    for (const guild of client.guilds.cache.values()) {
      try {
        const channel = guild.channels.cache.find(
          (item) =>
            item.name === CHANNEL_NAME &&
            item.isTextBased() &&
            item.guildId === guild.id
        );

        if (!channel || !channel.isTextBased()) {
          console.warn(
            `[Sukuna] Chat reviver could not find #${CHANNEL_NAME} in ${guild.name}.`
          );
          continue;
        }

        const me = guild.members.me;
        if (!me) continue;

        const permissions = channel.permissionsFor(me);

        if (
          !permissions?.has(PermissionFlagsBits.ViewChannel) ||
          !permissions.has(PermissionFlagsBits.SendMessages)
        ) {
          console.warn(
            `[Sukuna] Missing permissions to post in #${CHANNEL_NAME} in ${guild.name}.`
          );
          continue;
        }

        let questionIndex;

        do {
          questionIndex = Math.floor(Math.random() * questions.length);
        } while (
          questions.length > 1 &&
          questionIndex === lastQuestionIndex
        );

        lastQuestionIndex = questionIndex;

        await channel.send({
          content: `<@&${MONKEYS_ROLE_ID}> ${questions[questionIndex]}`,
          allowedMentions: {
            parse: [],
            roles: [MONKEYS_ROLE_ID],
            users: [],
            repliedUser: false
          }
        });

        console.info(
          `[Sukuna] Chat reviver posted in #${CHANNEL_NAME} in ${guild.name}.`
        );
      } catch (error) {
        console.error(
          `[Sukuna] Chat reviver failed in ${guild.name}:`,
          error
        );
      }
    }
  }

  const timer = setInterval(() => {
    void postQuestion();
  }, INTERVAL_MS);

  timer.unref?.();

  console.info("[Sukuna] Chat reviver scheduled to post every 3 hours.");
}
