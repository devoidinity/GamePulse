/**
 * Seed: generates a demo org/user/project plus ~45 days of synthetic idle-game
 * telemetry so every dashboard (overview, retention, funnels, progression,
 * economy, idle, insights) has realistic data without running the worker.
 *
 *   npm run db:seed -w @gamepulse/shared
 *
 * Login: demo@gamepulse.dev / password123
 * API key is printed at the end.
 */
import { createHash, randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { PrismaClient, Prisma } from "@prisma/client";
import { API_KEY_PREFIX } from "../src/constants.js";

const prisma = new PrismaClient();

const DAYS = 45;
const NEW_PLAYERS_PER_DAY = 40;

function sha256(s: string) {
  return createHash("sha256").update(s).digest("hex");
}

function dayStart(offsetDaysAgo: number): Date {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() - offsetDaysAgo);
  return d;
}

// Deterministic-ish RNG so reseeding is comparable.
let seed = 1337;
function rnd() {
  seed = (seed * 1103515245 + 12345) & 0x7fffffff;
  return seed / 0x7fffffff;
}
const pick = <T>(arr: T[]): T => arr[Math.floor(rnd() * arr.length)]!;

async function main() {
  console.log("Resetting demo data…");
  await prisma.event.deleteMany({});
  await prisma.session.deleteMany({});
  await prisma.playerDay.deleteMany({});
  await prisma.dailyRollup.deleteMany({});
  await prisma.player.deleteMany({});
  await prisma.insight.deleteMany({});
  await prisma.apiKey.deleteMany({});
  await prisma.project.deleteMany({});
  await prisma.membership.deleteMany({});
  await prisma.refreshToken.deleteMany({});
  await prisma.user.deleteMany({});
  await prisma.organization.deleteMany({});

  const org = await prisma.organization.create({
    data: { name: "Demo Studio" },
  });

  const user = await prisma.user.create({
    data: {
      email: "demo@gamepulse.dev",
      passwordHash: await bcrypt.hash("password123", 10),
      name: "Demo Dev",
      memberships: { create: { organizationId: org.id, role: "OWNER" } },
    },
  });

  const rawKey = `${API_KEY_PREFIX}${randomBytes(18).toString("hex")}`;
  const prefix = rawKey.slice(0, API_KEY_PREFIX.length + 4);
  const project = await prisma.project.create({
    data: {
      organizationId: org.id,
      name: "Mine & Craft (demo)",
      apiKeyPrefix: prefix,
      apiKeys: {
        create: { name: "default", prefix, hashedKey: sha256(rawKey) },
      },
    },
  });

  console.log("Generating players, sessions, and events…");

  const generators = ["drill_mk1", "drill_mk2", "drill_mk3", "drill_mk4"];
  const upgrades = [
    "drill_speed",
    "ore_value",
    "auto_collect",
    "lucky_strike",
    "drill_mk5_legendary", // intentionally rare -> dead upgrade insight
  ];
  const items = ["dynamite", "magnet", "lantern", "cursed_pickaxe"];
  const eventRows: Prisma.EventCreateManyInput[] = [];
  const playerDayRows: Prisma.PlayerDayCreateManyInput[] = [];
  const rollups = new Map<
    string,
    { newPlayers: number; active: Set<string>; sessions: number; events: number; secs: number }
  >();

  function rollup(date: Date) {
    const k = date.toISOString().slice(0, 10);
    let r = rollups.get(k);
    if (!r) {
      r = { newPlayers: 0, active: new Set(), sessions: 0, events: 0, secs: 0 };
      rollups.set(k, r);
    }
    return r;
  }

  let totalPlayers = 0;
  for (let d = DAYS; d >= 0; d--) {
    const signupDay = dayStart(d);
    for (let i = 0; i < NEW_PLAYERS_PER_DAY; i++) {
      const externalPlayerId = `player-${totalPlayers++}`;
      const player = await prisma.player.create({
        data: {
          projectId: project.id,
          externalPlayerId,
          firstSeenAt: signupDay,
          lastSeenAt: signupDay,
        },
      });
      rollup(signupDay).newPlayers++;

      // How many days this player keeps coming back (geometric-ish decay).
      const stickiness = rnd();
      const lifespan = Math.min(
        DAYS - d,
        Math.floor(-Math.log(1 - Math.min(stickiness, 0.97)) * 9),
      );

      let goldBalance = 0;
      for (let life = 0; life <= lifespan; life++) {
        // Retention gaps: skip some days.
        if (life > 0 && rnd() < 0.35) continue;
        const day = dayStart(d - life);
        if (day.getTime() > Date.now()) break;

        playerDayRows.push({ projectId: project.id, playerId: player.id, date: day });
        const r = rollup(day);
        r.active.add(player.id);

        const sessionStart = new Date(day.getTime() + Math.floor(rnd() * 8.64e7));
        const durationSec = 120 + Math.floor(rnd() * 1500);
        const session = await prisma.session.create({
          data: {
            projectId: project.id,
            playerId: player.id,
            startedAt: sessionStart,
            endedAt: new Date(sessionStart.getTime() + durationSec * 1000),
            durationSeconds: durationSec,
          },
        });
        r.sessions++;
        r.secs += durationSec;

        const push = (eventName: string, properties: Prisma.InputJsonValue) => {
          eventRows.push({
            projectId: project.id,
            playerId: player.id,
            sessionId: session.id,
            eventName,
            properties,
            timestamp: new Date(sessionStart.getTime() + Math.floor(rnd() * durationSec * 1000)),
          });
          r.events++;
        };

        // Progression: the further you are in life, the higher the level,
        // with a deliberate wall at level 8.
        const maxLevel = 1 + life + Math.floor(rnd() * 3);
        for (let lvl = 1; lvl <= maxLevel; lvl++) {
          push("level_started", { level: lvl });
          // Level 8 is a brutal wall -> drop-off + problematic-level insight.
          const passChance = lvl === 8 ? 0.42 : 0.9 - lvl * 0.03;
          if (rnd() < passChance) push("level_completed", { level: lvl });
          else break;
        }

        // Economy.
        const earned = 50 + Math.floor(rnd() * 200) * (1 + life * 0.15);
        goldBalance += earned;
        push("currency_earned", {
          currency: "gold",
          amount: Math.round(earned),
          source: pick(["quest", "ore_sold", "idle", "boss"]),
        });
        if (rnd() < 0.7) {
          const spent = Math.min(goldBalance, Math.floor(rnd() * 250));
          goldBalance -= spent;
          push("currency_spent", {
            currency: "gold",
            amount: spent,
            sink: pick(["upgrade", "generator", "repair"]),
          });
        }
        // Gems: earned, almost never spent -> unspent-currency insight.
        if (rnd() < 0.4) push("currency_earned", { currency: "gems", amount: 1 + Math.floor(rnd() * 5), source: "achievement" });

        // Idle generators + upgrades (adoption skewed to early tiers).
        if (rnd() < 0.6) push("generator_bought", { generator: generators[Math.min(life, 3)]! });
        if (rnd() < 0.5) push("upgrade_bought", { upgrade: pick(upgrades.slice(0, 4)) });
        if (rnd() < 0.004) push("upgrade_bought", { upgrade: "drill_mk5_legendary" });
        if (rnd() < 0.3) push("item_used", { item: pick(items.slice(0, 3)) }); // cursed_pickaxe never used
      }

      await prisma.player.update({
        where: { id: player.id },
        data: { lastSeenAt: dayStart(Math.max(0, d - lifespan)) },
      });
    }
    if (d % 10 === 0) console.log(`  …day -${d}`);
  }

  console.log(`Inserting ${eventRows.length} events…`);
  for (let i = 0; i < eventRows.length; i += 5000) {
    await prisma.event.createMany({ data: eventRows.slice(i, i + 5000) });
  }
  for (let i = 0; i < playerDayRows.length; i += 5000) {
    await prisma.playerDay.createMany({ data: playerDayRows.slice(i, i + 5000), skipDuplicates: true });
  }

  await prisma.dailyRollup.createMany({
    data: [...rollups.entries()].map(([date, r]) => ({
      projectId: project.id,
      date: new Date(date),
      newPlayers: r.newPlayers,
      activePlayers: r.active.size,
      sessions: r.sessions,
      events: r.events,
      sessionSeconds: BigInt(r.secs),
    })),
  });

  console.log("\n✅ Seed complete");
  console.log("   Login:   demo@gamepulse.dev / password123");
  console.log(`   Project: ${project.id}`);
  console.log(`   API key: ${rawKey}`);
  console.log("   (store the API key now — only its hash is kept)\n");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
