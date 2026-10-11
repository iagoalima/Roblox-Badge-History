import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const DEFAULT_USERNAME = "impactoreal_lindo";
const DEFAULT_USER_ID = "1224165215";
const BASE_URL = "https://apis.roblox.com/cloud/v2";
const API_KEY = process.env.ROBLOX_API_KEY;

function usage() {
  console.log(`
Verificador de histórico de emblemas do Roblox

Uso:
  npm start
  npm start -- impactoreal_lindo
  npm start -- 1224165215

Configuração:
  Defina ROBLOX_API_KEY como variável de ambiente.
  Consulte README.md para instruções.
`);
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      "Accept": "application/json",
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

async function resolveUser(input) {
  if (/^\d+$/.test(input)) {
    return { userId: input, username: null, displayName: null };
  }

  const result = await fetchJson("https://users.roblox.com/v1/usernames/users", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      usernames: [input],
      excludeBannedUsers: false,
    }),
  });

  const user = result.data?.[0];
  if (!user) {
    throw new Error(`Não encontrei uma conta Roblox com o nome "${input}".`);
  }

  return {
    userId: String(user.id),
    username: user.name,
    displayName: user.displayName,
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
  const validDate = parsedDate && !Number.isNaN(parsedDate.getTime());

  return {
    badgeId: id == null ? null : String(id),
    name: details.name ?? item.name ?? null,
    description: details.description ?? null,
    awardedAt: validDate ? parsedDate.toISOString() : null,
    dateStatus: validDate ? "confirmed" : "unavailable",
    badgeUrl: id ? `https://www.roblox.com/badges/${id}` : null,
    rawPath: item.path ?? null,
  };
}

function csvEscape(value) {
  const s = value == null ? "" : String(value);
  return `"${s.replaceAll('"', '""')}"`;
}

function toCsv(badges) {
  const headers = ["badgeId", "name", "awardedAtUTC", "dateStatus", "badgeUrl"];
  return [
    headers.join(","),
    ...badges.map((b) => [
      b.badgeId, b.name, b.awardedAt, b.dateStatus, b.badgeUrl,
    ].map(csvEscape).join(",")),
  ].join("\r\n");
}

async function main() {
  if (!API_KEY || API_KEY === "COLE_SUA_CHAVE_AQUI") {
    console.error("ERRO: configure a variável ROBLOX_API_KEY antes de executar.");
    console.error("Veja o README.md para criar uma chave Open Cloud com permissão Inventory: Read.");
    process.exitCode = 1;
    return;
  }

  const input = process.argv[2] ?? DEFAULT_USERNAME;
  usage();

  let user;
  if (input === DEFAULT_USERNAME) {
    // O ID informado previamente evita depender da resolução do nome.
    user = { userId: DEFAULT_USER_ID, username: DEFAULT_USERNAME, displayName: null };
  } else {
    user = await resolveUser(input);
  }

  console.log(`\nConsultando usuário ID ${user.userId}${user.username ? ` (@${user.username})` : ""}...`);

  let rawItems;
  try {
    rawItems = await fetchAllBadges(user.userId);
  } catch (error) {
    if (error.status === 403) {
      console.error("\nACESSO NEGADO (403): a API não permitiu ler este inventário.");
      console.error("Verifique se a chave tem Inventory: Read e se o inventário é acessível.");
      console.error("O script não tenta contornar privacidade nem usa cookies de sessão.");
      process.exitCode = 2;
      return;
    }
    if (error.status === 401) {
      console.error("\nCHAVE INVÁLIDA OU NÃO AUTORIZADA (401). Confira sua ROBLOX_API_KEY.");
      process.exitCode = 2;
      return;
    }
    throw error;
  }

  const badges = rawItems
    .map(parseBadge)
    .sort((a, b) => {
      if (a.awardedAt && b.awardedAt) return b.awardedAt.localeCompare(a.awardedAt);
      if (a.awardedAt) return -1;
      if (b.awardedAt) return 1;
      return (a.badgeId ?? "").localeCompare(b.badgeId ?? "", undefined, { numeric: true });
    });

  const outDir = path.resolve("output");
  await fs.mkdir(outDir, { recursive: true });

  const safeName = (user.username ?? `user-${user.userId}`).replace(/[^a-zA-Z0-9_-]/g, "_");
  const jsonPath = path.join(outDir, `${safeName}-badges.json`);
  const csvPath = path.join(outDir, `${safeName}-badges.csv`);

  const report = {
    generatedAt: new Date().toISOString(),
    user: {
      userId: user.userId,
      username: user.username,
      displayName: user.displayName,
      profileUrl: `https://www.roblox.com/users/${user.userId}/profile`,
    },
    source: "Roblox Open Cloud Inventory API",
    totalBadgesReturned: badges.length,
    badgesWithConfirmedAwardDate: badges.filter((b) => b.dateStatus === "confirmed").length,
    badgesWithoutAccessibleAwardDate: badges.filter((b) => b.dateStatus !== "confirmed").length,
    note: "A data é a addTime retornada pela API, que representa quando o emblema foi adicionado ao inventário/concedido. Datas indisponíveis não foram inferidas.",
    badges,
  };

  await fs.writeFile(jsonPath, JSON.stringify(report, null, 2), "utf8");
  await fs.writeFile(csvPath, toCsv(badges), "utf8");

  const recentAfter2021 = badges.filter((b) => b.awardedAt && new Date(b.awardedAt) >= new Date("2022-01-01T00:00:00.000Z"));

  console.log("\n========== RESULTADO ==========");
  console.log(`Perfil: ${report.user.profileUrl}`);
  console.log(`Emblemas retornados: ${report.totalBadgesReturned}`);
  console.log(`Com data de concessão acessível: ${report.badgesWithConfirmedAwardDate}`);
  console.log(`Sem data acessível: ${report.badgesWithoutAccessibleAwardDate}`);
  console.log(`Com data a partir de 01/01/2022 (UTC): ${recentAfter2021.length}`);

  if (recentAfter2021.length) {
    console.log("\nEmblemas a partir de 2022 (mais recente primeiro):");
    for (const b of recentAfter2021) {
      console.log(`- ${b.awardedAt} | ${b.name ?? "(nome indisponível)"} | ID ${b.badgeId ?? "(ID indisponível)"}`);
      if (b.badgeUrl) console.log(`  ${b.badgeUrl}`);
    }
  } else {
    console.log("\nNenhum emblema com data acessível a partir de 2022 foi retornado.");
    console.log("Isso não prova que a conta não teve atividade; pode haver limitações de acesso ou dados.");
  }

  console.log(`\nArquivos gerados:\n- ${jsonPath}\n- ${csvPath}`);
  console.log("Observação: datas em UTC; confirme o contexto antes de tirar conclusões sobre atividade da conta.");
}

main().catch((error) => {
  console.error("\nFalha ao consultar a API:", error.message);
  if (error.body) console.error(JSON.stringify(error.body, null, 2));
  process.exitCode = 1;
});
