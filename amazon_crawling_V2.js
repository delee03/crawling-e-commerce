import axios from "axios";
import { JSDOM, VirtualConsole } from "jsdom";
import UserAgent from "user-agents";
import fs from "fs";
import path from "path";
import cliProgress from "cli-progress";

const userAgent = new UserAgent({ deviceCategory: "desktop" });
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
let listProduct = [];

const virtualConsole = new VirtualConsole();
virtualConsole.on("jsdomError", (error) => {
  if (
    typeof error === "string" &&
    error.includes("Could not parse CSS stylesheet")
  ) {
    console.clear(); // Clear terminal whenever CSS errors appear
  } else {
    console.error(error);
  }
});

const getRandomDelay = (min, max) =>
  Math.floor(Math.random() * (max - min + 1)) + min;

const rotateUserAgent = () => {
  return new UserAgent({ deviceCategory: "desktop" }).toString();
};

// Function load categories from file .txt
const loadCategoriesFromFile = (filePath) => {
  const categories = {};
  const fileData = fs.readFileSync(filePath, "utf-8");

  fileData.split("\n").forEach((line) => {
    const [category, url] = line.trim().split(" ");
    if (category && url) {
      categories[category] = url;
    }
  });

  return categories;
};

// Progress bar
const progressBar = new cliProgress.SingleBar(
  {
    format:
      "Scraping Progress | {bar} | {percentage}% | {value}/{total} Products\n",
    barCompleteChar: "\u2588",
    barIncompleteChar: "\u2591",
    hideCursor: true,
  },
  cliProgress.Presets.shades_classic
);

// Function to extract ASINs from a search page
const getASINsFromSearchPage = async (searchUrl, retryCount = 3) => {
  try {
    const { data } = await axios.get(searchUrl, {
      headers: {
        "User-Agent": rotateUserAgent(),
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
        Host: "www.amazon.com",
      },
    });

    const dom = new JSDOM(data, { virtualConsole });
    const document = dom.window.document;
    const asinList = Array.from(document.querySelectorAll("[data-asin]"))
      .map((element) => element.getAttribute("data-asin"))
      .filter((asin) => asin && asin.length === 10);

    return [...new Set(asinList)];
  } catch (error) {
    if (retryCount > 0) {
      console.warn(`Retrying (${retryCount} attempts remaining)...`);
      await delay(getRandomDelay(60000, 180000));
      return getASINsFromSearchPage(searchUrl, retryCount - 1);
    } else {
      console.error("Error fetching ASINs:", error.message);
      return [];
    }
  }
};

// Fuction get product from ASIN
const getProduct = async (productId, retryCount = 3) => {
  try {
    let url = `https://www.amazon.com/dp/${productId}`;
    let { data } = await axios.get(url, {
      headers: {
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
        Host: "www.amazon.com",
        "User-Agent": rotateUserAgent(),
      },
    });

    const dom = new JSDOM(data, { virtualConsole });
    const document = dom.window.document;

    // Basic product details
    let name = document.querySelector("#productTitle")?.textContent.trim();
    let ratings = document
      .querySelector("#acrCustomerReviewText")
      ?.textContent.trim()
      .split(" ")[0];
    let price = document.querySelector(".a-price .a-offscreen")?.textContent;
    let image = document
      .querySelector("#imgTagWrapperId img")
      ?.getAttribute("src");

    // New fields for detailed product information
    let description = document
      .querySelector("#feature-bullets ul")
      ?.textContent.trim();

    // Access detailed specifications using the appropriate classes
    let brand = document
      .querySelector(".po-brand .a-size-base.po-break-word")
      ?.textContent.trim();
    let os = document
      .querySelector(".po-operating_system .a-size-base.po-break-word")
      ?.textContent.trim();

    let resolution = document
      .querySelector(".po-resolution .a-size-base.po-break-word")
      ?.textContent.trim();
    let model = document
      .querySelector(".po-model_name .a-size-base.po-break-word")
      ?.textContent.trim();
    // RAM
    let ram =
      document
        .querySelector("[class*='ram_memory'] .a-size-base.po-break-word")
        ?.textContent.trim() ||
      document
        .querySelector("[class*='RAM'] .a-size-base.po-break-word")
        ?.textContent.trim() ||
      "N/A";

    // Hard Disk
    let hard_disk =
      document
        .querySelector("[class*='hard_disk'] .a-size-base.po-break-word")
        ?.textContent.trim() ||
      document
        .querySelector("[class*='Hard_Disk'] .a-size-base.po-break-word")
        ?.textContent.trim() ||
      "N/A";

    // Screen Size
    let screenSize =
      document
        .querySelector("[class*='display_size'] .a-size-base.po-break-word")
        ?.textContent.trim() ||
      document
        .querySelector("[class*='Display_Size'] .a-size-base.po-break-word")
        ?.textContent.trim() ||
      "N/A";
    let special_feature = document
      .querySelector(".po-special_feature .a-span9 .a-truncate-cut")
      ?.textContent.trim();
    let cellularTech = document
      .querySelector(".po-cellular_technology .a-size-base.po-break-word")
      ?.textContent.trim();
    let connectivity = document
      .querySelector(".po-connectivity_technology .a-size-base.po-break-word")
      ?.textContent.trim();
    let color = document
      .querySelector(".po-color .a-span9 .a-size-base.po-break-word")
      ?.textContent.trim();
    let detail_item = document
      .querySelector("#feature-bullets ul.a-unordered-list li span.a-list-item")
      ?.textContent.trim();

    let object = {
      id: productId,
      name: name || "Unknown Product",
      ratings: ratings ? +ratings.replace(",", ".") : null,
      price: price || "N/A",
      image: image || "N/A",
      description: description || "",
      details: {
        brand: brand || "N/A",
        operatingSystem: os || "N/A",
        hard_disk: hard_disk || "N/A",
        screenSize: screenSize || "N/A",
        resolution: resolution || "N/A",
        modelName: model || "N/A",
        special_feature: special_feature || "N/A",
        cellularTechnology: cellularTech || "N/A",
        connectivity: connectivity || "N/A",
        color: color || "N/A",
        ram: ram || "N/A",
        detail_item: detail_item || "N/A",
      },
    };

    if (object.name !== "Unknown Product") {
      listProduct.push(object);
    }

    return object;
  } catch (error) {
    if (retryCount > 0) {
      console.warn(`Retrying for product ${productId}...`);
      await delay(getRandomDelay(10000, 20000));
      return getProduct(productId, retryCount - 1);
    } else {
      console.error(`Error fetching product ${productId}:`, error.message);
    }
  }
};

// Function to save the product list to a file
const saveProductListToFile = (category) => {
  const filePath = path.join(process.cwd(), `/data/${category}_products.json`);

  const dataToSave = {
    totalProducts: listProduct.length,
    products: listProduct,
  };

  try {
    fs.writeFileSync(filePath, JSON.stringify(dataToSave, null, 2), "utf-8");
    console.log(`Product data saved to ${category}_products.json`);
  } catch (error) {
    console.error("Error writing to file:", error.message);
  }
};

// Function to fetch products in batches for a specific category
const fetchProductsForCategory = async (category, baseSearchUrl) => {
  listProduct = [];

  let pageNum = 1;
  let morePages = true;

  let requestCount = 0;

  while (morePages) {
    const pageUrl = `${baseSearchUrl}&page=${pageNum}`;
    const asinList = await getASINsFromSearchPage(pageUrl);

    if (asinList.length === 0) {
      console.log(`Không tìm thấy sản phẩm nào trên trang ${pageNum}.`);
      morePages = false;
    } else {
      console.log(
        `Tìm thấy ${asinList.length} ASINs trên trang ${pageNum} cho danh mục: ${category}`
      );
      progressBar.start(asinList.length, 0);

      for (let i = 0; i < asinList.length; i++) {
        await getProduct(asinList[i]);
        await delay(getRandomDelay(5000, 10000));

        requestCount++;
        progressBar.update(i + 1);

        if (requestCount > 30) {
          console.log("Pausing for a while to avoid detection...");
          await delay(getRandomDelay(60000, 180000)); // Pause 1 to 3 minutes
          requestCount = 0;
        }
      }

      progressBar.stop();
      saveProductListToFile(category);
      pageNum++;
    }
  }

  console.log(`Hoàn tất việc lấy sản phẩm cho danh mục: ${category}`);
};

// Path to file categories.txt
const filePath = path.join(process.cwd(), "categories.txt");
const categories = loadCategoriesFromFile(filePath);

// Fetch all categories and save them to files
const fetchAllCategories = async (categories) => {
  for (const [category, searchUrl] of Object.entries(categories)) {
    console.log(`Begin fetching: ${category}`);
    await fetchProductsForCategory(category, searchUrl);
    console.log(`Finish fetching category: ${category}`);
    await delay(10000); // Pause for 10s between categories to avoid Amazon detection
  }
};

fetchAllCategories(categories).then(() => {
  console.log("All categories've been fetched and saved into file");
});
