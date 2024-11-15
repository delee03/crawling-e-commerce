import axios from "axios";
import { JSDOM } from "jsdom";
import UserAgent from "user-agents";
import fs from "fs";
import path from "path";
import cliProgress from "cli-progress"; // Import the progress bar package

const userAgent = new UserAgent({ deviceCategory: "desktop" });
let listProduct = [];

// Initialize the progress bar
const progressBar = new cliProgress.SingleBar(
  {
    format:
      "Scraping Progress | {bar} | {percentage}% | {value}/{total} Products",
    barCompleteChar: "\u2588",
    barIncompleteChar: "\u2591",
    hideCursor: true,
  },
  cliProgress.Presets.shades_classic
);

// Function to extract ASINs from a search page
const getASINsFromSearchPage = async (searchUrl) => {
  try {
    const { data } = await axios.get(searchUrl, {
      headers: {
        "User-Agent": userAgent.toString(),
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
        Host: "www.amazon.com",
      },
    });

    const dom = new JSDOM(data);
    const document = dom.window.document;
    const asinList = Array.from(document.querySelectorAll("[data-asin]"))
      .map((element) => element.getAttribute("data-asin"))
      .filter((asin) => asin && asin.length === 10);

    return [...new Set(asinList)]; // Remove duplicates and return unique ASINs
  } catch (error) {
    console.error("Error fetching ASINs:", error.message);
    return [];
  }
};

const getProduct = async (productId) => {
  try {
    let url = `https://www.amazon.com/dp/${productId}`;

    let { data } = await axios.get(url, {
      headers: {
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
        Host: "www.amazon.com",
        "User-Agent": userAgent.toString(),
      },
    });

    const dom = new JSDOM(data);
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

    listProduct.push(object);

    return object;
  } catch (error) {
    console.error(`Error fetching product ${productId}:`, error.message);
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
const fetchProductsForCategory = async (
  category,
  searchUrl,
  batchSize = 10
) => {
  listProduct = []; // Reset the list for each category

  const asinList = await getASINsFromSearchPage(searchUrl);
  if (asinList.length === 0) {
    console.log(`No ASINs found for category: ${category}`);
    return;
  }

  console.log(`Found ${asinList.length} ASINs for category: ${category}`);
  progressBar.start(asinList.length, 0);

  for (let i = 0; i < asinList.length; i += batchSize) {
    const batch = asinList.slice(i, i + batchSize);

    await Promise.all(batch.map((productId) => getProduct(productId)));
    progressBar.update(i + batch.length);
  }

  progressBar.stop();
  saveProductListToFile(category);
};

// Define categories with their respective search URLs
const categories = {
  Mouse_1: "https://www.amazon.com/s?k=mouse",
};

// Main function to fetch products for multiple categories
const fetchAllCategories = async (categories) => {
  for (const [category, searchUrl] of Object.entries(categories)) {
    console.log(`Fetching products for category: ${category}`);
    await fetchProductsForCategory(category, searchUrl, 10); // Batch size set to 10
    console.log(`Finished fetching products for category: ${category}`);
  }
};

// Fetch all categories and save them to files
fetchAllCategories(categories).then(() => {
  console.log("All categories fetched and saved.");
});
