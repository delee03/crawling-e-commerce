import puppeteer from "puppeteer";
import fs from "fs";
import path from "path";

const categories = [
    {
        name: "men_clothes",
        searchUrl:
            "https://www.amazon.com/s?k=men+clothing&crid=L5SHDGAAAR7C&sprefix=men+clot%2Caps%2C446&ref=nb_sb_noss_2",
    },
    {
        name: "women_clothes",
        searchUrl:
            "https://www.amazon.com/s?k=women+clothing&crid=1B4JWNSEW1CW2&sprefix=women+clothi%2Caps%2C341&ref=nb_sb_noss_2",
    },
];

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const getProductDetails = async (browser, asin, retries = 3) => {
    const page = await browser.newPage();
    const url = `https://www.amazon.com/dp/${asin}`;
    let details = { description: "N/A" };

    try {
        console.log(`Fetching details for ASIN ${asin}...`);
        await page.goto(url, { waitUntil: "domcontentloaded" });

        // Tăng thời gian chờ cho hàm waitForSelector
        await page.waitForSelector("#productTitle", { timeout: 20000 });

        details = await page.evaluate(() => {
            const getText = (selector) => {
                const element = document.querySelector(selector);
                return element ? element.textContent.trim() : "N/A";
            };

            const description =
                getText("#feature-bullets ul") || "No description available";

            return { description };
        });
    } catch (error) {
        console.error(
            `Error fetching details for ASIN ${asin}: ${error.message}`
        );

        if (retries > 0) {
            console.log(`Retrying... (${3 - retries + 1}/3)`);
            await delay(3000); // Chờ 3 giây trước khi thử lại
            return getProductDetails(browser, asin, retries - 1);
        }
    } finally {
        await page.close();
    }

    return details;
};

const scrapeCategory = async (browser, category) => {
    const page = await browser.newPage();
    let allProducts = [];
    let currentPage = 1;

    while (true) {
        console.log(
            `Fetching page ${currentPage} of category ${category.name}`
        );
        await page.goto(`${category.searchUrl}&page=${currentPage}`, {
            waitUntil: "domcontentloaded",
        });

        const products = await page.evaluate(() => {
            const items = Array.from(document.querySelectorAll("[data-asin]"));
            return items
                .map((item) => {
                    const asin = item.getAttribute("data-asin");
                    const title =
                        item.querySelector("h2 .a-text-normal")?.textContent ||
                        "N/A";
                    const price =
                        item.querySelector(".a-price .a-offscreen")
                            ?.textContent || "N/A";
                    const rating =
                        item.querySelector(".a-icon-alt")?.textContent || "N/A";
                    const image = item.querySelector(".s-image")?.src || "N/A";

                    return { asin, title, price, rating, image };
                })
                .filter((product) => product.asin);
        });

        for (let product of products) {
            const details = await getProductDetails(browser, product.asin);
            product.description = details.description;
            allProducts.push(product);
        }

        console.log(`Found ${products.length} products on page ${currentPage}`);

        const hasNextPage = await page.evaluate(() => {
            const nextButton = document.querySelector("li.a-last a");
            return nextButton !== null;
        });

        if (!hasNextPage || currentPage >= 10) break; // Dừng sau 10 trang để tránh quá tải

        currentPage++;
        await delay(1000); // Delay giữa các lần tải trang
    }

    await page.close();
    return allProducts;
};

const saveProductsToFile = (category, products) => {
    const filePath = path.join(
        process.cwd(),
        `/data/${category}_products.json`
    );
    fs.writeFileSync(
        filePath,
        JSON.stringify({ totalProducts: products.length, products }, null, 2),
        "utf-8"
    );
    console.log(`Saved ${products.length} products for category ${category}`);
};

const scrapeAmazonCategories = async () => {
    const browser = await puppeteer.launch({
        headless: true,
        args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });
    for (const category of categories) {
        const products = await scrapeCategory(browser, category);
        saveProductsToFile(category.name, products);
    }
    await browser.close();
};

scrapeAmazonCategories().then(() => console.log("Scraping completed!"));
