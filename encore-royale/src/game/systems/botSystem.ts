import type { Fighter } from '../../types/game';

function nearestOpponent(source: Fighter, fighters: Fighter[]): Fighter | null {
  let best: Fighter | null = null;
  let bestDistance = Infinity;
  for (const fighter of fighters) {
    if (fighter === source || !fighter.alive || fighter.invulnerableTime > .2) continue;
    const distance = Math.hypot(fighter.x - source.x, fighter.y - source.y);
    if (distance < bestDistance) { best = fighter; bestDistance = distance; }
  }
  return best;
}

export function updateBotIntent(bot: Fighter, fighters: Fighter[], dt: number): void {
  bot.decisionTime -= dt;
  if (bot.decisionTime > 0) return;
  bot.decisionTime = .1 + Math.random() * .22;
  const target = nearestOpponent(bot, fighters);
  if (!target) {
    bot.moveIntent = Math.random() < .5 ? -1 : 1;
    return;
  }
  const dx = target.x - bot.x;
  const dy = target.y - bot.y;
  bot.moveIntent = Math.abs(dx) < 54 ? 0 : dx < 0 ? -1 : 1;
  if ((dy < -38 || (bot.grounded && Math.random() < .18)) && Math.random() < .7) bot.jumpIntent = true;
  if (bot.grounded && (bot.x < 46 || bot.x > 892)) bot.jumpIntent = true;
  if (Math.abs(dx) < 390 && Math.abs(dy) < 90 && Math.random() < .46) bot.shootIntent = true;
  if (Math.abs(dx) < 82 && Math.random() < .12) bot.dodgeIntent = true;
}

