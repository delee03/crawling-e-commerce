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
        format: "Scraping Progress | {bar} | {percentage}% | {value}/{total} Products",
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
                Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
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

// Function to get product details using ASIN
const getProduct = async (productId) => {
    try {
        let url = `https://www.amazon.com/gp/product/ajax/?asin=${productId}&m=&qid=&smid=&sourcecustomeerrorglistid=&sourcecustomeerrorglistitemid=&s=&r=pc&dP&experienceId=aodAjaxMain`;

        let { data } = await axios.get(url, {
            headers: {
                Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
                Host: "www.amazon.com",
                "User-Agent": userAgent.toString(),
            },
        });

        const dom = new JSDOM(data);

        let name = dom.window.document.querySelector(
            "#aod-asin-title #aod-asin-title-text"
        );
        let ratings = dom.window.document
            .querySelector("#pinned-de-id #aod-asin-reviews-count-title")
            ?.textContent.trim()
            .split(" ")[0];
        let discount_percent = dom.window.document
            .querySelector("#pinned-offer-top-id .a-section .aok-offscreen")
            ?.textContent.trim()
            .split(" ")[2];
        let price = dom.window.document.querySelector(
            ".a-section .aok-relative .a-size-small .a-price span"
        )?.textContent;
        let image = dom.window.document
            .querySelector("#aod-pinned-offer #pinned-image-id img")
            ?.getAttribute("src");
        let discount_price = dom.window.document
            .querySelector("#pinned-offer-top-id .a-section .aok-offscreen")
            ?.textContent.trim()
            .split(" ")[0];
        let description = dom.window.document
            .querySelector(".a-size-small .a-popover-preload .a-size-base")
            ?.textContent.trim();

        let object = {
            id: productId,
            name: name?.textContent || "Unknown Product",
            ratings: ratings ? +ratings.replace(",", ".") : null,
            price: price ? Number(price.slice(1)) : "N/A",
            discount: discount_percent ? Number(discount_percent) : null,
            discount_price: discount_price
                ? Number(discount_price.slice(1))
                : "N/A",
            image: image || "N/A",
            description: description || "",
        };

        listProduct.push(object);

        return object;
    } catch (error) {
        console.error(`Error fetching product ${productId}:`, error.message);
    }
};

// Function to save the product list to a file
const saveProductListToFile = (category) => {
    const filePath = path.join(
        process.cwd(),
        `/data/${category}_products.json`
    );

    try {
        fs.writeFileSync(
            filePath,
            JSON.stringify(listProduct, null, 2),
            "utf-8"
        );
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
    Men_TShirtAndShoes:
        "https://www.amazon.com/s?k=men+clothing&i=fashion&rh=n%3A7141123011&dc&page=10&crid=ZH0E0QU9PLBW&qid=1730477771&sprefix=men+clothi%2Cfashion-mens-shoes%2C811&ref=sr_pg_10",
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
