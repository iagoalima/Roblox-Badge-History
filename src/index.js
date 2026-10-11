import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

// Cole sua chave Roblox Open Cloud aqui. NÃO publique nem envie sua chave ao GitHub.
const API_KEY = "COLE_SUA_CHAVE_AQUI";
const BASE_URL = "https://apis.roblox.com/cloud/v2";
const USERS_API = "https://users.roblox.com/v1";

async function ask(rl, question) {
  return (await rl.question(question)).trim();
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      Accept: "application/json",
      ...(options.headers ?? {}),
    },
  });

  const bodyText = await response.text();
  let body;
  try {
    body = bodyText ? JSON.parse(bodyText) : {};
  } catch {
    body = { raw: bodyText };
  }

  if (!response.ok) {
    const error = new Error(`HTTP ${response.status} ${response.statusText}`);
    error.status = response.status;
    error.body = body;
    throw error;
  }
  return body;
}

async function resolveUser(value) {
  let userId = value;

  if (!/^\d+$/.test(value)) {
    const result = await fetchJson(`${USERS_API}/usernames/users`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ usernames: [value], excludeBannedUsers: false }),
    });
    const match = result.data?.[0];
    if (!match) throw new Error(`Não encontrei uma conta Roblox chamada "${value}".`);
    userId = String(match.id);
  }

  const profile = await fetchJson(`${USERS_API}/users/${userId}`);
  return {
    userId: String(profile.id),
    username: profile.name ?? null,
    displayName: profile.displayName ?? null,
    createdAt: profile.created ?? null,
  };
}

async function fetchAllBadges(userId) {
  const items = [];
  let pageToken = "";
  const seenTokens = new Set();
  let page = 0;

  do {
    const url = new URL(`${BASE_URL}/users/${userId}/inventory-items`);
    url.searchParams.set("filter", "badges=true");
    url.searchParams.set("maxPageSize", "100");
    if (pageToken) url.searchParams.set("pageToken", pageToken);

    const result = await fetchJson(url, {
      headers: { "x-api-key": API_KEY },
    });
    const batch = result.inventoryItems ?? [];
    items.push(...batch);
    page += 1;
    console.log(`Página ${page}: ${batch.length} emblema(s) recebido(s). Total: ${items.length}`);

    const next = result.nextPageToken ?? "";
    if (!next || batch.length === 0) break;
    if (seenTokens.has(next)) {
      throw new Error("A API repetiu um token de paginação; interrompi para evitar um loop.");
    }
    seenTokens.add(next);
    pageToken = next;
  } while (true);

  return items;
}

function parseBadge(item) {
  const details = item.badgeDetails ?? {};
  const assetDetails = item.assetDetails ?? {};
  const id = details.badgeId ?? assetDetails.assetId ?? item.badgeId ?? null;
  const rawDate = item.addTime ?? item.awardedDate ?? item.awardedDateTime ?? null;
  const parsedDate = rawDate ? new Date(rawDate) : null;
  const validDate = Boolean(parsedDate && !Number.isNaN(parsedDate.getTime()));

  return {
    badgeId: id == null ? null : String(id),
    name: details.name ?? item.name ?? null,
    description: details.description ?? null,
    awardedAt: validDate ? parsedDate.toISOString() : null,
    year: validDate ? parsedDate.getUTCFullYear() : null,
    dateStatus: validDate ? "confirmed" : "unavailable",
    badgeUrl: id ? `https://www.roblox.com/badges/${id}` : null,
  };
}

function compareBadges(a, b, direction = "desc") {
  if (a.awardedAt && b.awardedAt) {
    const compared = a.awardedAt.localeCompare(b.awardedAt);
    if (compared !== 0) return direction === "asc" ? compared : -compared;
  }
  if (a.awardedAt) return -1;
  if (b.awardedAt) return 1;
  return (a.badgeId ?? "").localeCompare(b.badgeId ?? "", undefined, { numeric: true });
}

function csvEscape(value) {
  const text = value == null ? "" : String(value);
  return `"${text.replaceAll('"', '""')}"`;
}

function toCsv(badges) {
  const headers = ["badgeId", "name", "awardedAtUTC", "dateStatus", "badgeUrl"];
  return [
    headers.join(","),
    ...badges.map((badge) => [
      badge.badgeId, badge.name, badge.awardedAt, badge.dateStatus, badge.badgeUrl,
    ].map(csvEscape).join(",")),
  ].join("\r\n");
}

function printBadge(badge, index) {
  const date = badge.awardedAt ?? "DATA INDISPONÍVEL";
  console.log(`${index + 1}. [${date}] ${badge.name ?? "(nome indisponível)"} — ID ${badge.badgeId ?? "(ID indisponível)"}`);
  if (badge.badgeUrl) console.log(`   ${badge.badgeUrl}`);
}

async function browseBadges(rl, badges) {
  while (true) {
    console.log("\n========== CONSULTA DE EMBLEMAS ==========");
    console.log("1. Ver todos por ordem cronológica (mais recentes primeiro)");
    console.log("2. Ver emblemas de um ano específico");
    console.log("3. Listar do mais recente ao mais antigo");
    console.log("4. Listar do mais antigo ao mais recente");
    console.log("5. Encerrar");

    const choice = await ask(rl, "Escolha uma opção: ");
    if (choice === "5") return;

    if (choice === "1" || choice === "3" || choice === "4") {
      const direction = choice === "4" ? "asc" : "desc";
      const sorted = [...badges].sort((a, b) => compareBadges(a, b, direction));
      const label = direction === "asc" ? "do mais antigo para o mais recente" : "do mais recente para o mais antigo";
      console.log(`\nTodos os emblemas (${sorted.length}), ${label}:`);
      sorted.forEach(printBadge);
    } else if (choice === "2") {
      const yearInput = await ask(rl, "Digite o ano (ex.: 2021): ");
      if (!/^\d{4}$/.test(yearInput)) {
        console.log("Ano inválido. Digite um ano com quatro algarismos.");
        continue;
      }
      const year = Number(yearInput);
      const matches = badges
        .filter((badge) => badge.year === year)
        .sort((a, b) => compareBadges(a, b, "desc"));
      console.log(`\nEmblemas com data confirmada em ${year}: ${matches.length}`);
      if (matches.length) matches.forEach(printBadge);
      else console.log("Nenhum emblema com data acessível foi encontrado para esse ano.");
      const undated = badges.filter((badge) => badge.year === null).length;
      if (undated) console.log(`Observação: ${undated} emblema(s) sem data acessível não podem ser atribuídos a um ano.`);
    } else {
      console.log("Opção inválida. Escolha de 1 a 5.");
    }
  }
}

async function main() {
  if (!API_KEY || API_KEY === "COLE_SUA_CHAVE_AQUI") {
    console.error("ERRO: abra src/index.js e substitua COLE_SUA_CHAVE_AQUI pela sua chave Roblox Open Cloud.");
    console.error("Nunca publique sua chave nem faça commit dela no GitHub.");
    process.exitCode = 1;
    return;
  }

  const rl = readline.createInterface({ input, output });
  try {
    console.log("\n============================================");
    console.log("   ROBLOX BADGE HISTORY — HISTÓRICO DE EMBLEMAS");
    console.log("============================================");
    console.log("Você pode informar o nome de usuário ou o ID numérico da conta.");
    const accountInput = await ask(rl, "Nome de usuário ou ID Roblox: ");
    if (!accountInput) {
      console.error("Você precisa informar um nome de usuário ou ID.");
      process.exitCode = 1;
      return;
    }

    const user = await resolveUser(accountInput);
    console.log(`\nConta: ${user.displayName ? `${user.displayName} (@${user.username})` : `@${user.username}`}`);
    console.log(`ID: ${user.userId}`);
    console.log(`Perfil: https://www.roblox.com/users/${user.userId}/profile`);
    console.log(`Data de criação: ${user.createdAt ? new Date(user.createdAt).toLocaleString("pt-BR", { timeZone: "UTC", dateStyle: "long", timeStyle: "short" }) + " (UTC)" : "indisponível"}`);

    let rawItems;
    try {
      console.log("\nConsultando inventário de emblemas...");
      rawItems = await fetchAllBadges(user.userId);
    } catch (error) {
      if (error.status === 403) {
        console.error("\nACESSO NEGADO (403): a API não permitiu ler este inventário.");
        console.error("Confira a permissão Inventory: Read e a acessibilidade do inventário.");
        console.error("O script não tenta contornar bloqueios de privacidade.");
        process.exitCode = 2;
        return;
      }
      if (error.status === 401) {
        console.error("\nCHAVE INVÁLIDA OU NÃO AUTORIZADA (401). Confira a chave em src/index.js.");
        process.exitCode = 2;
        return;
      }
      throw error;
    }

    const badges = rawItems.map(parseBadge).sort((a, b) => compareBadges(a, b, "desc"));
    const byYear = new Map();
    for (const badge of badges) {
      if (badge.year !== null) byYear.set(badge.year, (byYear.get(badge.year) ?? 0) + 1);
    }

    console.log("\n=============== RESUMO ===============");
    console.log(`Emblemas retornados pela API: ${badges.length}`);
    console.log(`Emblemas com data acessível: ${badges.filter((badge) => badge.year !== null).length}`);
    console.log(`Emblemas sem data acessível: ${badges.filter((badge) => badge.year === null).length}`);
    console.log("\nQuantidade de emblemas por ano (somente datas confirmadas):");
    if (byYear.size === 0) console.log("Não há datas de concessão acessíveis para agrupar por ano.");
    else {
      for (const year of [...byYear.keys()].sort((a, b) => a - b)) {
        console.log(`Emblemas em ${year}: ${byYear.get(year)}`);
      }
    }

    const outDir = path.resolve("output");
    await fs.mkdir(outDir, { recursive: true });
    const safeName = (user.username ?? `user-${user.userId}`).replace(/[^a-zA-Z0-9_-]/g, "_");
    const report = {
      generatedAt: new Date().toISOString(),
      user: {
        userId: user.userId,
        username: user.username,
        displayName: user.displayName,
        createdAt: user.createdAt,
        profileUrl: `https://www.roblox.com/users/${user.userId}/profile`,
      },
      source: "Roblox Open Cloud Inventory API + Roblox Users API",
      totalBadgesReturned: badges.length,
      badgesWithConfirmedAwardDate: badges.filter((badge) => badge.dateStatus === "confirmed").length,
      badgesWithoutAccessibleAwardDate: badges.filter((badge) => badge.dateStatus !== "confirmed").length,
      countByYear: Object.fromEntries([...byYear.entries()].sort((a, b) => a[0] - b[0])),
      note: "Somente datas retornadas e interpretadas pela API são usadas para agrupar por ano. Datas indisponíveis não são inferidas.",
      badges,
    };
    await fs.writeFile(path.join(outDir, `${safeName}-badges.json`), JSON.stringify(report, null, 2), "utf8");
    await fs.writeFile(path.join(outDir, `${safeName}-badges.csv`), toCsv(badges), "utf8");
    console.log(`\nRelatórios salvos em output/${safeName}-badges.json e output/${safeName}-badges.csv`);
    console.log("As contagens por ano incluem apenas emblemas com data acessível. Dados indisponíveis não significam ausência de atividade.");

    await browseBadges(rl, badges);
  } finally {
    rl.close();
  }
}

main().catch((error) => {
  console.error("\nFalha ao consultar a API:", error.message);
  if (error.body) console.error(JSON.stringify(error.body, null, 2));
  process.exitCode = 1;
});
