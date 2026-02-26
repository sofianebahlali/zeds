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
}

const CATEGORIES: CategoryConfig[] = [
  {
    category: "tech",
    queries: [
      // --- Existants (30) ---
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
      // --- Nouveaux (+50) ---
      "TV 4K 55 pouces Samsung",
      "TV OLED LG 65 pouces",
      "TV TCL 43 pouces",
      "casque réduction bruit Bose",
      "Marshall enceinte bluetooth",
      "platine vinyle Audio-Technica",
      "Samsung Galaxy S25",
      "Google Pixel 9",
      "Xiaomi 14T",
      "OnePlus 12",
      "iPad Air M2",
      "Samsung Galaxy Tab S9",
      "MacBook Air M3",
      "PC portable Lenovo IdeaPad",
      "PC portable HP Pavilion",
      "Chromebook ASUS",
      "souris gaming Logitech G Pro",
      "clavier mécanique Corsair",
      "SSD NVMe Samsung 990 Pro 2To",
      "disque dur externe Seagate 2To",
      "SSD externe Samsung T7 1To",
      "écran PC 27 pouces BenQ",
      "écran gaming LG UltraGear 27",
      "écran 4K Dell UltraSharp",
      "GoPro HERO 13",
      "drone DJI Mini 4 Pro",
      "Canon EOS R50",
      "Fujifilm Instax Mini 12",
      "Sony ZV-1 caméra vlog",
      "DJI Osmo Pocket 3",
      "PlayStation 5 console",
      "Xbox Series X console",
      "manette Xbox Elite",
      "casque gaming SteelSeries",
      "Steam Deck OLED",
      "Meta Quest 3 casque VR",
      "Apple AirTag lot 4",
      "Ring sonnette vidéo",
      "Amazon Echo Dot",
      "Google Nest Hub",
      "TP-Link Deco WiFi 6 mesh",
      "imprimante jet encre HP Envy",
      "imprimante Brother laser",
      "Epson EcoTank imprimante",
      "NAS Synology 2 baies",
      "onduleur APC 700VA",
      "Raspberry Pi 5",
      "Arduino Mega carte",
      "tablette graphique Wacom Intuos",
      "Carte graphique RTX 4060",
    ],
  },
  {
    category: "alimentaire",
    queries: [
      // --- Existants (25) ---
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
      // --- Nouveaux (+40) ---
      "pack Coca-Cola 24 canettes",
      "pack Evian 6 bouteilles",
      "Red Bull pack 12 canettes",
      "champagne Moët Chandon",
      "champagne Veuve Clicquot",
      "whisky Jack Daniel's",
      "rhum Diplomatico Reserva",
      "gin Hendrick's",
      "vodka Grey Goose",
      "bière Leffe fût 6L",
      "café grain Lavazza 1kg",
      "thé Kusmi Tea boîte métal",
      "Nutella 1kg pot",
      "pâtes Barilla spaghetti 1kg",
      "riz Basmati 5kg",
      "Kellogg's céréales 750g",
      "beurre Président 250g",
      "Milka chocolat tablette lot",
      "moutarde Dijon Maille",
      "Pringles chips tuiles",
      "M&M's Peanut sachet",
      "Kinder Bueno lot 12",
      "Ferrero Rocher boîte 30",
      "Toblerone barre 360g",
      "Ben Jerry's Cookie Dough glace",
      "Häagen-Dazs glace pot",
      "saumon fumé Labeyrie tranches",
      "fromage raclette RichesMonts",
      "Comté AOP 12 mois",
      "Roquefort Société",
      "foie gras canard entier",
      "caviar Petrossian",
      "safran pistils pur",
      "vanille Madagascar gousses",
      "jambon ibérique bellota",
      "macarons Ladurée coffret",
      "spiruline bio comprimés",
      "graines chia bio 1kg",
      "amandes entières bio 500g",
      "huile coco vierge bio",
      "sirop Monin vanille",
    ],
  },
  {
    category: "quotidien",
    queries: [
      // --- Existants (30) ---
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
      // --- Nouveaux (+50) ---
      "fer à repasser vapeur Philips",
      "fer à repasser Rowenta",
      "centrale vapeur Calor",
      "Moulinex Cookeo multicuiseur",
      "autocuiseur SEB Clipso",
      "aspirateur robot iRobot Roomba",
      "aspirateur sans sac Rowenta",
      "Kärcher nettoyeur vitres",
      "Kärcher nettoyeur vapeur",
      "purificateur air Dyson",
      "ventilateur Rowenta Turbo Silence",
      "machine café automatique DeLonghi",
      "machine café Senseo",
      "blender chauffant Moulinex",
      "robot pâtissier KitchenAid",
      "grill électrique Tefal OptiGrill",
      "friteuse sans huile SEB Actifry",
      "Airfryer Philips XXL",
      "Ninja Foodi multicuiseur air fryer",
      "Thermomix TM6 robot cuiseur",
      "réfrigérateur combiné Samsung",
      "lave-vaisselle Beko",
      "lave-linge Bosch frontal",
      "sèche-linge pompe chaleur Whirlpool",
      "batterie cuisine Tefal Ingenio",
      "cocotte Le Creuset fonte",
      "plat four Pyrex verre lot",
      "couteau Opinel n°8",
      "carafe filtrante Brita",
      "SodaStream machine eau gazeuse",
      "brosse dents Philips Sonicare",
      "rasoir électrique Braun Series 9",
      "sèche cheveux Rowenta",
      "lisseur cheveux GHD Gold",
      "balance connectée Withings",
      "bureau gaming 140cm",
      "canapé angle convertible",
      "matelas Emma Original 140x190",
      "fauteuil bureau ergonomique",
      "table chevet style industriel",
      "lampe bureau LED TaoTronics",
      "bibliothèque scandinave étagères",
      "Levi's 501 jean homme",
      "Adidas Samba baskets",
      "Nike Air Pegasus running",
      "doudoune North Face Thermoball",
      "Birkenstock Arizona sandales",
      "perceuse visseuse Bosch 18V",
      "barbecue gaz Weber Spirit",
      "nettoyeur haute pression Kärcher",
    ],
  },
  {
    category: "transport",
    queries: [
      // --- Existants (20) ---
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
      // --- Nouveaux (+40) ---
      "vélo VTC Nakamura électrique",
      "vélo VTC Riverside 500",
      "trottinette Ninebot Segway",
      "vélo enfant 16 pouces",
      "vélo route Specialized",
      "pneu Michelin CrossClimate 205/55",
      "pneu hiver Michelin Alpin lot 4",
      "batterie voiture Varta 12V",
      "chargeur batterie Bosch",
      "barres de toit Thule WingBar",
      "coffre toit Thule Motion 500L",
      "siège auto groupe 2/3",
      "dashcam Nextbase 4K",
      "GPS poids lourds TomTom Expert",
      "chaînes neige Michelin Easy Grip",
      "housse siège auto universelle",
      "casque moto Shoei NXR2",
      "gants moto Alpinestars cuir",
      "blouson moto Dainese cuir",
      "antivol moto Abus Granit",
      "valise cabine American Tourister",
      "sac à dos voyage Osprey 40L",
      "organisateurs valise lot 6",
      "adaptateur voyage universel",
      "oreiller voyage mémoire forme",
      "hoverboard Bluewheel",
      "gyroroue InMotion",
      "skateboard Element complet",
      "GPS vélo Garmin Edge",
      "compteur vélo Sigma GPS",
      "siège vélo enfant Thule",
      "remorque vélo enfant Thule",
      "porte vélo attelage Thule 2 vélos",
      "kit réparation pneu vélo tubeless",
      "éclairage vélo LED rechargeable",
      "garde-boue vélo route",
      "sacoche guidon vélo étanche",
      "pompe vélo haute pression",
      "béquille vélo universelle",
    ],
  },
  {
    category: "insolite",
    queries: [
      // --- Existants (20) ---
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
      // --- Nouveaux (+40) ---
      "montre Rolex Submariner",
      "montre Omega Speedmaster",
      "sac Louis Vuitton Neverfull",
      "parfum Chanel N°5 100ml",
      "parfum Dior Sauvage homme",
      "Cartier lunettes de soleil",
      "bracelet Pandora argent",
      "collier Swarovski cristal",
      "bague fiançailles diamant or blanc",
      "carte Pokémon rare Dracaufeu",
      "Funko Pop Marvel exclusif",
      "sabre laser Hasbro Force FX",
      "vinyle Pink Floyd Dark Side Moon",
      "neon LED personnalisé décoration",
      "machine pop-corn rétro cinéma",
      "kit apiculture débutant ruche",
      "jumelles Nikon ornithologie",
      "drone sous-marin caméra",
      "flipper arcade rétro machine",
      "jukebox vintage bluetooth",
      "globe bar terrestre vintage",
      "machine à écrire vintage",
      "guitare Fender Stratocaster",
      "piano Yamaha Clavinova",
      "violon étude Stentor",
      "accordéon Hohner",
      "aquarium complet 240L",
      "arbre à chat haut de gamme",
      "cage lapin Ferplast",
      "croquettes Royal Canin 15kg chien",
      "Dyson Airwrap multi-styler",
      "Bang Olufsen casque luxe",
      "Apple Mac Pro station travail",
      "Apple Pro Display XDR écran",
      "TV Samsung The Frame 75 pouces",
      "appareil photo Hasselblad moyen format",
      "coffret Pokémon display booster",
      "figurine collection Star Wars",
      "set Lego adulte complexe",
      "coffret Harry Potter intégrale collector",
    ],
  },
  {
    category: "loisirs",
    queries: [
      // --- Tout nouveau (60) ---
      // Sport - Équipement
      "raquette tennis Wilson",
      "raquette padel Head",
      "ballon football Adidas officiel",
      "ballon basketball Molten",
      "gants boxe Venum",
      "kimono judo Adidas",
      "masque tuba snorkeling Cressi",
      "combinaison néoprène surf",
      "planche surf funboard",
      "stand up paddle gonflable",
      "ski Rossignol Experience",
      "snowboard Burton Custom",
      "roller inline Rollerblade",
      "skateboard complet Element",
      "haltère réglable Bowflex",
      "tapis yoga Manduka PRO",
      "bandes résistance élastiques fitness",
      "sac frappe boxe Everlast",
      // Sport - Chaussures
      "Nike Pegasus chaussures running",
      "Adidas Ultraboost running",
      "Salomon Speedcross trail",
      "crampons football Nike Mercurial",
      "chaussons escalade La Sportiva",
      // Montagne & Randonnée
      "tente randonnée MSR 2 places",
      "sac couchage Mammut -7",
      "sac à dos randonnée Deuter 50L",
      "chaussures randonnée Salomon GTX",
      "bâtons marche téléscopiques",
      "réchaud camping Jetboil",
      "lampe frontale Petzl rechargeable",
      // Jeux de société
      "Monopoly classique",
      "Catan jeu de société",
      "Pandemic jeu coopératif",
      "Dixit jeu société",
      "Azul jeu société stratégique",
      "7 Wonders Duel",
      "Ticket to Ride Europe",
      "Dobble jeu rapidité",
      "puzzle Ravensburger 1000 pièces",
      "jeu échecs bois deluxe",
      // Jeux vidéo
      "Zelda Tears of the Kingdom Switch",
      "EA Sports FC PS5",
      "Mario Kart 8 Deluxe Switch",
      "Minecraft PC Java",
      // Lego & Construction
      "Lego Technic Bugatti Chiron",
      "Lego Star Wars Millennium Falcon",
      "Lego Architecture Paris",
      "Lego Icons Bouquet Fleurs",
      "Playmobil maison traditionnelle",
      // Instruments de musique
      "guitare classique Yamaha C40",
      "guitare électrique Squier Stratocaster",
      "ukulélé soprano Kala",
      "clavier Casio 61 touches",
      "cajon Meinl percussion",
      "harmonica Hohner",
      // Livres & Loisirs créatifs
      "liseuse Kobo Libra Colour",
      "crayons couleur Faber-Castell 72",
      "stylo plume Lamy Safari",
      // Plein air
      "table ping-pong Cornilleau extérieur",
      "trampoline jardin 366cm",
      "Nerf Elite pistolet fléchettes",
    ],
  },
];

const OUTPUT_DIR = path.resolve(__dirname, "../data/questions");
const IMAGES_DIR = path.resolve(__dirname, "../public/images/questions");
const OUTPUT_FILE = path.join(OUTPUT_DIR, "estimation.json");

const DELAY_BETWEEN_SEARCHES_MS = 4000;
const DELAY_BETWEEN_PAGES_MS = 1500;
const MAX_PRODUCTS_PER_QUERY = 3;
const TARGET_TOTAL = 800;

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

  // Hide webdriver flag to avoid bot detection
  await page.evaluateOnNewDocument(() => {
    Object.defineProperty(navigator, "webdriver", { get: () => false });
  });

  await page.setUserAgent(
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
  );

  await page.setViewport({ width: 1920, height: 1080 });

  await page.setExtraHTTPHeaders({
    "Accept-Language": "fr-FR,fr;q=0.9",
    "Sec-Ch-Ua":
      '"Google Chrome";v="131", "Chromium";v="131", "Not_A Brand";v="24"',
    "Sec-Ch-Ua-Mobile": "?0",
    "Sec-Ch-Ua-Platform": '"Windows"',
    "Upgrade-Insecure-Requests": "1",
  });

  return page;
}

async function initAmazonSession(page: Page): Promise<void> {
  console.log("🌐 Initialisation session Amazon.fr...");

  // Visit homepage first to establish cookies/session
  await page.goto("https://www.amazon.fr", {
    waitUntil: "networkidle2",
    timeout: 30000,
  });

  // Accept cookies consent
  try {
    const acceptBtn = await page.$("#sp-cc-accept");
    if (acceptBtn) {
      await acceptBtn.click();
      console.log("  ✓ Cookies acceptés");
      await delay(1500);
    }
  } catch {
    /* ignore */
  }

  // Wait for search box to be ready
  try {
    await page.waitForSelector("#twotabsearchtextbox", { timeout: 10000 });
    console.log("  ✓ Search box prêt");
  } catch {
    console.log("  ⚠ Search box non trouvé");
  }

  await delay(1000);
  console.log("  ✓ Session établie\n");
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function detectBlocked(page: Page): Promise<boolean> {
  try {
    const title = await page.title();
    // The Amazon block page has title "Toutes nos excuses"
    if (title === "Toutes nos excuses") return true;

    // Check for CAPTCHA specifically in a small portion of the page
    const bodyText = await page.evaluate(() => {
      // Only check the body's direct text, not product descriptions
      const h4 = document.querySelector("h4");
      const p = document.querySelector("p.a-last");
      return (h4?.textContent || "") + " " + (p?.textContent || "");
    });

    return (
      bodyText.includes("captcha") ||
      bodyText.includes("Type the characters") ||
      bodyText.includes("Saisissez les caractères")
    );
  } catch {
    return false;
  }
}

async function searchViaSearchBox(page: Page, query: string): Promise<boolean> {
  // Find search box on current page (homepage or results page)
  let searchBox = await page.$("#twotabsearchtextbox");

  if (!searchBox) {
    // No search box — go back to homepage
    await page.goto("https://www.amazon.fr", {
      waitUntil: "networkidle2",
      timeout: 30000,
    });
    await delay(2000);
    searchBox = await page.$("#twotabsearchtextbox");
    if (!searchBox) return false;
  }

  // Clear and type query
  await searchBox.click({ clickCount: 3 });
  await delay(100);
  await searchBox.type(query, { delay: 30 });
  await delay(300);

  // Submit and wait for navigation
  await Promise.all([
    page
      .waitForNavigation({ waitUntil: "networkidle2", timeout: 15000 })
      .catch(() => {}),
    page.keyboard.press("Enter"),
  ]);

  await delay(DELAY_BETWEEN_PAGES_MS);
  return true;
}

async function scrapeSearchResults(
  page: Page,
  query: string
): Promise<ScrapedProduct[]> {
  console.log(`  Recherche: "${query}" ...`);

  try {
    // Search using the search box (like a real user)
    const searched = await searchViaSearchBox(page, query);
    if (!searched) {
      console.log(`  ⚠ Impossible de trouver le search box, skip`);
      return [];
    }

    // Check for error page
    if (await detectBlocked(page)) {
      console.log(`  ⛔ Erreur détectée ! Pause de 30s + re-init session...`);
      await delay(30000);
      await initAmazonSession(page);
      // Retry search
      const retried = await searchViaSearchBox(page, query);
      if (!retried || (await detectBlocked(page))) {
        console.log(`  ⛔ Erreur persistante, on skip cette requête`);
        return [];
      }
    }

    // Wait for results to load
    await page
      .waitForSelector('[data-component-type="s-search-result"]', {
        timeout: 10000,
      })
      .catch(() => {
        console.log(`  ⚠ Pas de résultats trouvés pour "${query}"`);
      });

    const products = await page.evaluate((maxProducts: number) => {
      const results: {
        name: string;
        price: number;
        imageUrl: string;
        amazonUrl: string;
      }[] = [];
      const items = document.querySelectorAll(
        '[data-component-type="s-search-result"]'
      );

      for (const item of Array.from(items)) {
        if (results.length >= maxProducts) break;

        try {
          // Skip sponsored results
          if (item.querySelector('[data-component-type="sp-sponsored-result"]'))
            continue;

          // Get product name (try multiple selectors)
          const titleEl =
            item.querySelector("h2 a span") ||
            item.querySelector("h2 span") ||
            item.querySelector(
              ".a-size-medium.a-color-base.a-text-normal, .a-size-base-plus.a-color-base.a-text-normal"
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

function getDifficulty(price: number): "easy" | "medium" | "hard" {
  if (price < 30) return "easy";
  if (price <= 200) return "medium";
  return "hard";
}

function getPoints(difficulty: string): number {
  switch (difficulty) {
    case "easy":
      return 75;
    case "medium":
      return 100;
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
  category: string
): EstimationQuestion {
  const id = generateQuestionId(index);
  const productName = truncateProductName(product.name);
  const difficulty = getDifficulty(product.price);

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

function normalizeForDedup(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .substring(0, 30);
}

function deduplicateProducts(
  products: { product: ScrapedProduct; category: string }[],
  existingNames: Set<string>
): typeof products {
  const seen = new Set<string>(existingNames);
  return products.filter(({ product }) => {
    const key = normalizeForDedup(product.name);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// ==========================================
// APPEND MODE: LOAD EXISTING
// ==========================================

function loadExistingQuestions(): EstimationQuestion[] {
  try {
    if (fs.existsSync(OUTPUT_FILE)) {
      const raw = fs.readFileSync(OUTPUT_FILE, "utf-8");
      const questions = JSON.parse(raw) as EstimationQuestion[];
      console.log(`📂 ${questions.length} produits existants chargés\n`);
      return questions;
    }
  } catch (err) {
    console.warn("⚠ Impossible de lire les questions existantes:", err);
  }
  return [];
}

// ==========================================
// MAIN
// ==========================================

async function main() {
  console.log("🛒 Scraping Amazon.fr pour Le Juste Prix (mode append)\n");

  // Load existing products
  const existingQuestions = loadExistingQuestions();
  const existingNames = new Set(
    existingQuestions.map((q) => normalizeForDedup(q.productName))
  );
  const nextId = existingQuestions.length + 1;
  const needed = TARGET_TOTAL - existingQuestions.length;

  console.log(`Cible totale: ${TARGET_TOTAL} questions`);
  console.log(`Existantes: ${existingQuestions.length}`);
  console.log(`À scraper: ~${needed}`);

  const totalQueries = CATEGORIES.reduce(
    (acc, c) => acc + c.queries.length,
    0
  );
  console.log(
    `Catégories: ${CATEGORIES.map((c) => `${c.category}(${c.queries.length})`).join(", ")}`
  );
  console.log(`Total requêtes: ${totalQueries}\n`);

  if (needed <= 0) {
    console.log("✅ Objectif déjà atteint, rien à scraper.");
    return;
  }

  // Ensure directories exist
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  fs.mkdirSync(IMAGES_DIR, { recursive: true });

  const browser = await launchBrowser();
  const page = await setupPage(browser);

  // Establish Amazon session (homepage + cookies)
  await initAmazonSession(page);

  const allProducts: {
    product: ScrapedProduct;
    category: string;
  }[] = [];

  let captchaCount = 0;

  // Scrape each category
  for (const config of CATEGORIES) {
    console.log(`\n📦 Catégorie: ${config.category.toUpperCase()}`);
    console.log(`   ${config.queries.length} recherches prévues\n`);

    for (const query of config.queries) {
      const products = await scrapeSearchResults(page, query);

      if (products.length === 0) {
        // Could be captcha, track it
        if (await detectBlocked(page)) {
          captchaCount++;
          if (captchaCount >= 3) {
            console.log(
              `\n⛔ Trop de CAPTCHAs (${captchaCount}), pause longue de 60s...`
            );
            await delay(60000);
            captchaCount = 0;
          }
        }
      } else {
        captchaCount = 0; // Reset on success
      }

      for (const product of products) {
        allProducts.push({
          product,
          category: config.category,
        });
      }

      await delay(DELAY_BETWEEN_SEARCHES_MS);
    }
  }

  await browser.close();

  // Deduplicate against existing + self
  const uniqueProducts = deduplicateProducts(allProducts, existingNames);
  console.log(
    `\n📊 ${uniqueProducts.length} nouveaux produits uniques (sur ${allProducts.length} scrapés)`
  );

  // Shuffle to ensure all categories are represented before capping
  for (let i = uniqueProducts.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [uniqueProducts[i], uniqueProducts[j]] = [uniqueProducts[j], uniqueProducts[i]];
  }

  // Cap to what we need
  const finalProducts = uniqueProducts.slice(0, needed);
  console.log(`📊 ${finalProducts.length} produits retenus\n`);

  // Generate questions and download images
  const newQuestions: EstimationQuestion[] = [];
  let downloadErrors = 0;

  for (let i = 0; i < finalProducts.length; i++) {
    const { product, category } = finalProducts[i];
    const question = toQuestion(product, nextId + i, category);
    newQuestions.push(question);

    // Download image
    const imagePath = path.join(IMAGES_DIR, `${question.id}.jpg`);
    try {
      await downloadImage(product.imageUrl, imagePath);
      process.stdout.write(
        `\r  📷 Images: ${i + 1}/${finalProducts.length}`
      );
    } catch {
      downloadErrors++;
      // Set a placeholder if download fails
      question.imageUrl = "";
    }
  }

  console.log(`\n  ✓ Images téléchargées (${downloadErrors} erreurs)\n`);

  // Merge existing + new and write
  const allQuestions = [...existingQuestions, ...newQuestions];
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(allQuestions, null, 2), "utf-8");

  // Summary
  console.log("✅ Terminé !\n");
  console.log(`📁 ${OUTPUT_FILE}`);
  console.log(`📷 ${IMAGES_DIR}/`);
  console.log(
    `📊 ${allQuestions.length} questions au total (${existingQuestions.length} existantes + ${newQuestions.length} nouvelles)\n`
  );

  const byCat = allQuestions.reduce(
    (acc, q) => {
      acc[q.category] = (acc[q.category] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );
  console.log("Par catégorie:");
  for (const [cat, count] of Object.entries(byCat).sort(
    (a, b) => b[1] - a[1]
  )) {
    console.log(`  ${cat}: ${count}`);
  }

  const byDiff = allQuestions.reduce(
    (acc, q) => {
      acc[q.difficulty] = (acc[q.difficulty] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );
  console.log("\nPar difficulté:");
  for (const [diff, count] of Object.entries(byDiff)) {
    console.log(`  ${diff}: ${count}`);
  }

  const priceRanges = {
    "< 20€": allQuestions.filter((q) => q.correctValue < 20).length,
    "20-100€": allQuestions.filter(
      (q) => q.correctValue >= 20 && q.correctValue < 100
    ).length,
    "100-500€": allQuestions.filter(
      (q) => q.correctValue >= 100 && q.correctValue < 500
    ).length,
    "> 500€": allQuestions.filter((q) => q.correctValue >= 500).length,
  };
  console.log("\nPar fourchette de prix:");
  for (const [range, count] of Object.entries(priceRanges)) {
    console.log(`  ${range}: ${count}`);
  }
}

main().catch(console.error);
