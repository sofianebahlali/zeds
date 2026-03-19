import puppeteer, { type Page, type Browser } from "puppeteer";
import * as fs from "fs";
import * as path from "path";

// ==========================================
// CONFIGURATION
// ==========================================

interface FutCardData {
  id: string;
  type: "futcard";
  playerName: string;
  acceptedAnswers: string[];
  cardType: string;
  fifaEdition: string;
  rating: number;
  position: string;
  nationality: string;
  club: string;
  stats: {
    pac: number;
    sho: number;
    pas: number;
    dri: number;
    def: number;
    phy: number;
  };
  difficulty: "easy" | "medium" | "hard";
  timeLimit: number;
  points: number;
}

// FIFA editions to scrape (version number -> display name)
const EDITIONS: Record<string, string> = {
  "17": "FIFA 17",
  "18": "FIFA 18",
  "19": "FIFA 19",
  "20": "FIFA 20",
  "21": "FIFA 21",
  "22": "FIFA 22",
  "23": "FIFA 23",
  "24": "FC 24",
};

// How many pages to scrape per edition (each page has ~30 players)
const PAGES_PER_EDITION = 3;

// Minimum rating filter
const MIN_RATING = 75;

// Cards per edition target
const CARDS_PER_EDITION = 35;

const OUTPUT_PATH = path.resolve(__dirname, "../data/questions/futcard.json");

// Map Futbin card revision names to our cardType enum
function mapCardType(revision: string): string {
  const rev = revision.toLowerCase().trim();
  if (rev.includes("toty")) return "toty";
  if (rev.includes("tots")) return "tots";
  if (rev.includes("totw") || rev.includes("if") || rev === "inform") return "totw";
  if (rev.includes("icon") || rev.includes("prime") || rev.includes("mid icon") || rev.includes("baby icon")) return "icon";
  if (rev.includes("hero")) return "hero";
  if (rev.includes("headliner")) return "headliners";
  if (rev.includes("future star")) return "future_stars";
  if (rev.includes("sbc")) return "sbc";
  if (rev.includes("flashback")) return "flashback";
  if (rev.includes("end of an era") || rev.includes("eoae")) return "eoae";
  if (rev.includes("potm")) return "potm";
  if (rev.includes("birthday")) return "fut_birthday";
  if (rev.includes("futties")) return "futties";
  if (rev.includes("rulebreaker")) return "rulebreakers";
  if (rev.includes("record breaker")) return "record_breaker";
  if (rev.includes("wildcard") || rev.includes("winter")) return "winter_wildcards";
  if (rev.includes("showdown")) return "showdown";
  if (rev.includes("objective") || rev.includes("obj")) return "objetivos";
  if (rev.includes("otw") || rev.includes("ones to watch")) return "otw";
  if (rev.includes("gold") && rev.includes("rare")) return "gold_rare";
  if (rev.includes("gold")) return "gold_rare";
  return "gold_rare";
}

// Generate accepted answers for a player name
function generateAcceptedAnswers(playerName: string): string[] {
  const answers = new Set<string>();
  answers.add(playerName);

  // Add last name only
  const parts = playerName.trim().split(/\s+/);
  if (parts.length > 1) {
    answers.add(parts[parts.length - 1]); // last name
  }

  // Handle accented versions
  const normalized = playerName.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  if (normalized !== playerName) {
    answers.add(normalized);
    const normParts = normalized.trim().split(/\s+/);
    if (normParts.length > 1) {
      answers.add(normParts[normParts.length - 1]);
    }
  }

  return Array.from(answers);
}

// Determine difficulty based on rating and card notoriety
function getDifficulty(rating: number, cardType: string): "easy" | "medium" | "hard" {
  if (rating >= 90) return "easy";
  if (rating >= 85 || ["toty", "tots", "icon"].includes(cardType)) return "medium";
  return "hard";
}

async function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function scrapeEdition(
  browser: Browser,
  version: string,
  editionName: string
): Promise<FutCardData[]> {
  const page = await browser.newPage();
  await page.setUserAgent(
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
  );

  const cards: FutCardData[] = [];
  let idCounter = 0;

  for (let pageNum = 1; pageNum <= PAGES_PER_EDITION; pageNum++) {
    // Use popularity sort to get the most-viewed/used cards
    const url = `https://www.futbin.com/${version}/players?page=${pageNum}&sort=games&order=desc&version=all&minrating=${MIN_RATING}`;
    console.log(`  Fetching ${url}...`);

    try {
      await page.goto(url, { waitUntil: "networkidle2", timeout: 30000 });
      await delay(2000 + Math.random() * 3000); // Random delay to avoid rate limiting

      // Extract player data from the table
      const players = await page.evaluate(() => {
        const rows = document.querySelectorAll("tr.player_tr_1, tr.player_tr_2, [class*='player_tr']");
        const results: Array<{
          name: string;
          rating: number;
          position: string;
          club: string;
          nationality: string;
          revision: string;
          pace: number;
          shooting: number;
          passing: number;
          dribbling: number;
          defending: number;
          physicality: number;
        }> = [];

        rows.forEach((row) => {
          try {
            const nameEl = row.querySelector(".player_name_players_table a, td:nth-child(2) a");
            const ratingEl = row.querySelector(".rating, .pcdisplay-rat, td:nth-child(1)");

            if (!nameEl || !ratingEl) return;

            const name = nameEl.textContent?.trim() || "";
            const rating = parseInt(ratingEl.textContent?.trim() || "0", 10);

            if (!name || rating < 75) return;

            // Try to extract stats from the row
            const tds = row.querySelectorAll("td");
            const statsArray: number[] = [];
            tds.forEach((td) => {
              const val = parseInt(td.textContent?.trim() || "", 10);
              if (!isNaN(val) && val >= 1 && val <= 99) {
                statsArray.push(val);
              }
            });

            // Extract other fields
            const posEl = row.querySelector(".pcdisplay-pos, .position");
            const position = posEl?.textContent?.trim() || "ST";

            const clubEl = row.querySelector('[data-original-title], img[title]');
            const club = (clubEl as HTMLElement)?.title || (clubEl as HTMLElement)?.getAttribute("data-original-title") || "";

            const nationEl = row.querySelector('.nation img, img[class*="nation"]');
            const nationality = (nationEl as HTMLElement)?.title || (nationEl as HTMLElement)?.getAttribute("data-original-title") || "";

            const revEl = row.querySelector(".revision, .pcdisplay-rev");
            const revision = revEl?.textContent?.trim() || "Gold Rare";

            // Stats are typically in order: PAC, SHO, PAS, DRI, DEF, PHY
            // They appear as the last 6 numeric values in the row
            const statValues = statsArray.slice(-6);

            results.push({
              name,
              rating: isNaN(rating) ? 80 : rating,
              position,
              club,
              nationality,
              revision,
              pace: statValues[0] || 80,
              shooting: statValues[1] || 75,
              passing: statValues[2] || 70,
              dribbling: statValues[3] || 75,
              defending: statValues[4] || 50,
              physicality: statValues[5] || 70,
            });
          } catch {
            // Skip malformed rows
          }
        });

        return results;
      });

      console.log(`    Found ${players.length} players on page ${pageNum}`);

      for (const p of players) {
        if (cards.length >= CARDS_PER_EDITION) break;

        idCounter++;
        const cardType = mapCardType(p.revision);

        cards.push({
          id: `fut-${version}-${String(idCounter).padStart(3, "0")}`,
          type: "futcard",
          playerName: p.name,
          acceptedAnswers: generateAcceptedAnswers(p.name),
          cardType,
          fifaEdition: editionName,
          rating: p.rating,
          position: p.position,
          nationality: p.nationality,
          club: p.club,
          stats: {
            pac: p.pace,
            sho: p.shooting,
            pas: p.passing,
            dri: p.dribbling,
            def: p.defending,
            phy: p.physicality,
          },
          difficulty: getDifficulty(p.rating, cardType),
          timeLimit: 20,
          points: 100,
        });
      }
    } catch (err) {
      console.warn(`    Error on page ${pageNum}:`, (err as Error).message);
    }

    if (cards.length >= CARDS_PER_EDITION) break;
  }

  await page.close();
  return cards;
}

async function main() {
  console.log("🃏 Scraping Futbin for FUT card data...\n");

  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  const allCards: FutCardData[] = [];

  for (const [version, editionName] of Object.entries(EDITIONS)) {
    console.log(`\n📦 ${editionName} (version ${version}):`);
    const cards = await scrapeEdition(browser, version, editionName);
    console.log(`  ✅ Got ${cards.length} cards for ${editionName}`);
    allCards.push(...cards);

    // Delay between editions
    await delay(3000 + Math.random() * 5000);
  }

  await browser.close();

  // Deduplicate by player name + edition
  const seen = new Set<string>();
  const uniqueCards = allCards.filter((card) => {
    const key = `${card.playerName}-${card.fifaEdition}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  // Re-number IDs
  uniqueCards.forEach((card, i) => {
    card.id = `fut-${String(i + 1).padStart(3, "0")}`;
  });

  console.log(`\n📊 Total unique cards: ${uniqueCards.length}`);

  // Write output
  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(uniqueCards, null, 2), "utf-8");
  console.log(`✅ Written to ${OUTPUT_PATH}`);
}

main().catch(console.error);
