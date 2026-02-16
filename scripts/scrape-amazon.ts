import puppeteer, { type Page, type Browser } from "puppeteer";
import * as fs from "fs";
import * as path from "path";
import * as https from "https";
import * as http from "http";

// ==========================================
// CONFIGURATION
// ==========================================

interface CategoryConfig {
  category: string;
  queries: string[];
  difficulty: "easy" | "medium" | "hard";
}

const CATEGORIES: CategoryConfig[] = [
  {
    category: "tech",
    queries: [
      "smartphone Samsung",
      "iPhone",
      "casque audio sony",
      "tablette Android",
      "iPad",
      "Nintendo Switch",
      "PlayStation manette",
      "enceinte bluetooth JBL",
      "montre connectée Garmin",
      "Apple Watch",
      "clavier sans fil Logitech",
      "souris ergonomique",
      "webcam Logitech",
      "disque dur SSD",
      "clé USB 128Go",
      "écouteurs AirPods",
      "GoPro caméra",
      "liseuse Kindle",
      "routeur wifi",
      "imprimante laser",
      "chargeur sans fil",
      "hub USB-C",
      "carte microSD 256Go",
      "barre de son",
      "projecteur portable",
      "ring light",
      "micro podcast USB",
      "batterie externe 20000mAh",
      "câble HDMI 2.1",
      "station accueil PC",
    ],
    difficulty: "medium",
  },
  {
    category: "alimentaire",
    queries: [
      "tablette chocolat Lindt",
      "café moulu Lavazza",
      "thé matcha bio",
      "huile olive extra vierge",
      "miel de manuka",
      "sel de Guérande",
      "vinaigre balsamique Modène",
      "pâtes italiennes De Cecco",
      "sauce soja Kikkoman",
      "confiture Bonne Maman",
      "Nutella pot",
      "capsule Nespresso boîte",
      "beurre de cacahuète",
      "sirop d'érable pur",
      "pistaches grillées",
      "wasabi pâte",
      "truffe noire conserve",
      "protéine whey poudre",
      "granola bio",
      "chips Pringles",
      "bonbons Haribo sac",
      "eau gazeuse San Pellegrino pack",
      "vin rouge Bordeaux bouteille",
      "whisky single malt",
      "champagne bouteille",
    ],
    difficulty: "easy",
  },
  {
    category: "quotidien",
    queries: [
      "Nike Air Force 1",
      "parapluie pliant",
      "sac à dos Eastpak",
      "lampe de chevet LED",
      "cafetière Nespresso",
      "aspirateur Dyson",
      "couette 220x240",
      "valise Samsonite",
      "mixeur plongeant",
      "bouilloire électrique",
      "fer à lisser cheveux",
      "tondeuse barbe Philips",
      "brosse à dents électrique Oral-B",
      "oreiller mémoire de forme",
      "serviette de plage",
      "panier à linge",
      "miroir maquillage LED",
      "balance cuisine",
      "poêle Tefal",
      "cocotte en fonte",
      "couteau de chef japonais",
      "gourde isotherme",
      "lunch box inox",
      "tapis de yoga",
      "haltère réglable",
      "corde à sauter",
      "lunettes de soleil Ray-Ban",
      "portefeuille cuir",
      "panier pique-nique osier",
      "hamac jardin",
    ],
    difficulty: "easy",
  },
  {
    category: "transport",
    queries: [
      "trottinette électrique Xiaomi",
      "vélo électrique pliant",
      "casque moto intégral",
      "dashcam Viofo",
      "GPS TomTom",
      "siège auto bébé Cybex",
      "antivol vélo Kryptonite",
      "pompe à vélo",
      "gilet airbag moto",
      "porte-vélo voiture",
      "coffre de toit voiture",
      "compresseur air portable",
      "kit premiers secours auto",
      "chargeur voiture USB",
      "support téléphone voiture",
      "caméra recul voiture",
      "skateboard électrique",
      "roller en ligne adulte",
      "casque vélo adulte",
      "sacoche vélo",
    ],
    difficulty: "hard",
  },
  {
    category: "insolite",
    queries: [
      "montre Tissot homme",
      "drone DJI Mini",
      "télescope Celestron",
      "machine barbe à papa",
      "flipper de table",
      "réplique sabre laser",
      "globe terrestre lévitation",
      "machine à pop-corn",
      "appareil raclette",
      "fontaine chocolat",
      "kit brassage bière maison",
      "pierres à whisky coffret",
      "jumelles randonnée",
      "détecteur de métaux",
      "lampe lave vintage",
      "vinyle platine tourne-disque",
      "polaroid appareil photo instantané",
      "kit sushi maison",
      "terrarium plante",
      "piano numérique portable",
    ],
    difficulty: "hard",
  },
];

const OUTPUT_DIR = path.resolve(__dirname, "../data/questions");
const IMAGES_DIR = path.resolve(__dirname, "../public/images/questions");
const OUTPUT_FILE = path.join(OUTPUT_DIR, "estimation.json");

const DELAY_BETWEEN_SEARCHES_MS = 3000;
const DELAY_BETWEEN_PAGES_MS = 1500;
const MAX_PRODUCTS_PER_QUERY = 2;
const TARGET_TOTAL = 300;

// ==========================================
// TYPES
// ==========================================

interface ScrapedProduct {
  name: string;
  price: number;
  imageUrl: string;
  amazonUrl: string;
}

interface EstimationQuestion {
  id: string;
  type: "estimation";
  question: string;
  productName: string;
  imageUrl: string;
  correctValue: number;
  unit: string;
  category: string;
  difficulty: "easy" | "medium" | "hard";
  timeLimit: number;
  points: number;
  source: string;
}

// ==========================================
// SCRAPING
// ==========================================

async function launchBrowser(): Promise<Browser> {
  return puppeteer.launch({
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu",
      "--window-size=1920,1080",
    ],
  });
}

async function setupPage(browser: Browser): Promise<Page> {
  const page = await browser.newPage();

  await page.setUserAgent(
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
  );

  await page.setViewport({ width: 1920, height: 1080 });

  await page.setExtraHTTPHeaders({
    "Accept-Language": "fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7",
    Accept:
      "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
  });

  return page;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function scrapeSearchResults(
  page: Page,
  query: string
): Promise<ScrapedProduct[]> {
  const url = `https://www.amazon.fr/s?k=${encodeURIComponent(query)}&__mk_fr_FR=%C3%85M%C3%85%C5%BD%C3%95%C3%91`;

  console.log(`  Recherche: "${query}" ...`);

  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
    await delay(DELAY_BETWEEN_PAGES_MS);

    // Wait for results to load
    await page.waitForSelector('[data-component-type="s-search-result"]', {
      timeout: 10000,
    }).catch(() => {
      console.log(`  ⚠ Pas de résultats trouvés pour "${query}"`);
    });

    const products = await page.evaluate((maxProducts: number) => {
      const results: ScrapedProduct[] = [];
      const items = document.querySelectorAll(
        '[data-component-type="s-search-result"]'
      );

      for (const item of Array.from(items).slice(0, maxProducts)) {
        try {
          // Skip sponsored results
          if (item.querySelector('[data-component-type="sp-sponsored-result"]'))
            continue;

          // Get product name
          const titleEl = item.querySelector(
            "h2 a span, .a-size-medium.a-color-base.a-text-normal, .a-size-base-plus.a-color-base.a-text-normal"
          );
          const name = titleEl?.textContent?.trim();
          if (!name || name.length < 5) continue;

          // Get price - look for whole price
          const priceWholeEl = item.querySelector(".a-price .a-offscreen");
          const priceText = priceWholeEl?.textContent?.trim();
          if (!priceText) continue;

          // Parse price: "1 229,99 €" or "29,99 €"
          const cleanPrice = priceText
            .replace(/[^\d,.\s]/g, "")
            .replace(/\s/g, "")
            .replace(",", ".");
          const price = parseFloat(cleanPrice);
          if (isNaN(price) || price <= 0 || price > 100000) continue;

          // Get image
          const imgEl = item.querySelector(".s-image") as HTMLImageElement;
          const imageUrl = imgEl?.src;
          if (!imageUrl) continue;

          // Get link
          const linkEl = item.querySelector("h2 a") as HTMLAnchorElement;
          const amazonUrl = linkEl?.href || "";

          results.push({ name, price, imageUrl, amazonUrl });
        } catch {
          // Skip malformed items
        }
      }

      return results;
    }, MAX_PRODUCTS_PER_QUERY);

    console.log(`  ✓ ${products.length} produits trouvés`);
    return products;
  } catch (error) {
    console.error(
      `  ✗ Erreur pour "${query}":`,
      error instanceof Error ? error.message : error
    );
    return [];
  }
}

// ==========================================
// IMAGE DOWNLOAD
// ==========================================

function downloadImage(imageUrl: string, destPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const protocol = imageUrl.startsWith("https") ? https : http;
    const file = fs.createWriteStream(destPath);

    protocol
      .get(imageUrl, (response) => {
        if (response.statusCode === 301 || response.statusCode === 302) {
          const redirectUrl = response.headers.location;
          if (redirectUrl) {
            downloadImage(redirectUrl, destPath).then(resolve).catch(reject);
            return;
          }
        }
        response.pipe(file);
        file.on("finish", () => {
          file.close();
          resolve();
        });
      })
      .on("error", (err) => {
        fs.unlink(destPath, () => {});
        reject(err);
      });
  });
}

// ==========================================
// QUESTION GENERATION
// ==========================================

function generateQuestionId(index: number): string {
  return `est-${String(index).padStart(3, "0")}`;
}

function getTimeLimit(price: number): number {
  if (price < 20) return 15;
  if (price < 100) return 20;
  if (price < 1000) return 25;
  return 30;
}

function getPoints(difficulty: string): number {
  switch (difficulty) {
    case "easy":
      return 100;
    case "medium":
      return 125;
    case "hard":
      return 150;
    default:
      return 100;
  }
}

function truncateProductName(name: string): string {
  // Shorten overly verbose Amazon names
  // Cut at first comma, parenthesis, or dash that's followed by specs
  const cutPatterns = [
    /\s*,\s*(?:compatible|pour|avec|noir|blanc|gris|rouge|bleu).*/i,
    /\s*\((?!\d{4}\))[^)]{20,}\)/, // Remove long parenthetical specs
    /\s*-\s*(?:compatible|version|modèle|edition|pack).*/i,
    /\s*\|\s*.*/,
  ];

  let result = name;
  for (const pattern of cutPatterns) {
    result = result.replace(pattern, "");
  }

  // Max 80 chars
  if (result.length > 80) {
    result = result.substring(0, 77) + "...";
  }

  return result.trim();
}

function toQuestion(
  product: ScrapedProduct,
  index: number,
  category: string,
  difficulty: "easy" | "medium" | "hard"
): EstimationQuestion {
  const id = generateQuestionId(index);
  const productName = truncateProductName(product.name);

  return {
    id,
    type: "estimation",
    question: `Combien coûte ce produit ?`,
    productName,
    imageUrl: `/images/questions/${id}.jpg`,
    correctValue: Math.round(product.price * 100) / 100,
    unit: "€",
    category,
    difficulty,
    timeLimit: getTimeLimit(product.price),
    points: getPoints(difficulty),
    source: `Amazon.fr, ${new Date().toLocaleDateString("fr-FR", { month: "long", year: "numeric" })}`,
  };
}

// ==========================================
// DEDUPLICATION
// ==========================================

function deduplicateProducts(
  products: { product: ScrapedProduct; category: string; difficulty: "easy" | "medium" | "hard" }[]
): typeof products {
  const seen = new Set<string>();
  return products.filter(({ product }) => {
    // Normalize name for dedup
    const key = product.name
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "")
      .substring(0, 30);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// ==========================================
// MAIN
// ==========================================

async function main() {
  console.log("🛒 Scraping Amazon.fr pour Le Juste Prix\n");
  console.log(`Cible: ~${TARGET_TOTAL} questions`);
  console.log(`Catégories: ${CATEGORIES.map((c) => c.category).join(", ")}\n`);

  // Ensure directories exist
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  fs.mkdirSync(IMAGES_DIR, { recursive: true });

  const browser = await launchBrowser();
  const page = await setupPage(browser);

  const allProducts: {
    product: ScrapedProduct;
    category: string;
    difficulty: "easy" | "medium" | "hard";
  }[] = [];

  // Scrape each category
  for (const config of CATEGORIES) {
    console.log(`\n📦 Catégorie: ${config.category.toUpperCase()}`);
    console.log(`   ${config.queries.length} recherches prévues\n`);

    for (const query of config.queries) {
      const products = await scrapeSearchResults(page, query);

      for (const product of products) {
        allProducts.push({
          product,
          category: config.category,
          difficulty: config.difficulty,
        });
      }

      await delay(DELAY_BETWEEN_SEARCHES_MS);
    }
  }

  await browser.close();

  // Deduplicate
  const uniqueProducts = deduplicateProducts(allProducts);
  console.log(
    `\n📊 ${uniqueProducts.length} produits uniques (sur ${allProducts.length} scrapés)`
  );

  // Cap to target
  const finalProducts = uniqueProducts.slice(0, TARGET_TOTAL);
  console.log(`📊 ${finalProducts.length} produits retenus\n`);

  // Generate questions and download images
  const questions: EstimationQuestion[] = [];
  let downloadErrors = 0;

  for (let i = 0; i < finalProducts.length; i++) {
    const { product, category, difficulty } = finalProducts[i];
    const question = toQuestion(product, i + 1, category, difficulty);
    questions.push(question);

    // Download image
    const imagePath = path.join(IMAGES_DIR, `${question.id}.jpg`);
    try {
      await downloadImage(product.imageUrl, imagePath);
      process.stdout.write(`\r  📷 Images: ${i + 1}/${finalProducts.length}`);
    } catch {
      downloadErrors++;
      // Set a placeholder if download fails
      question.imageUrl = "";
    }
  }

  console.log(
    `\n  ✓ Images téléchargées (${downloadErrors} erreurs)\n`
  );

  // Write JSON
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(questions, null, 2), "utf-8");

  // Summary
  console.log("✅ Terminé !\n");
  console.log(`📁 ${OUTPUT_FILE}`);
  console.log(`📷 ${IMAGES_DIR}/`);
  console.log(`📊 ${questions.length} questions générées\n`);

  const byCat = questions.reduce(
    (acc, q) => {
      acc[q.category] = (acc[q.category] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );
  console.log("Par catégorie:");
  for (const [cat, count] of Object.entries(byCat)) {
    console.log(`  ${cat}: ${count}`);
  }

  const priceRanges = {
    "< 20€": questions.filter((q) => q.correctValue < 20).length,
    "20-100€": questions.filter(
      (q) => q.correctValue >= 20 && q.correctValue < 100
    ).length,
    "100-500€": questions.filter(
      (q) => q.correctValue >= 100 && q.correctValue < 500
    ).length,
    "> 500€": questions.filter((q) => q.correctValue >= 500).length,
  };
  console.log("\nPar fourchette de prix:");
  for (const [range, count] of Object.entries(priceRanges)) {
    console.log(`  ${range}: ${count}`);
  }
}

main().catch(console.error);
