import puppeteer from "puppeteer";
import fs from "fs";
import path from "path";

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Hàm trích xuất dữ liệu sản phẩm từ HTML của trang hiện tại
const getProductsFromHTML = async (page) => {
    return await page.evaluate(() => {
        const products = [];
        const items = document.querySelectorAll(".Bm3ON"); // Thay thế .Bm3ON bằng class hoặc selector của phần tử sản phẩm

        items.forEach((item) => {
            const name =
                item.querySelector(".pdp-mod-product-badge-title")?.innerText ||
                "N/A"; // Thay selector
            const price =
                item.querySelector(".pdp-product-price span")?.innerText ||
                "N/A"; // Thay selector
            const rating =
                item.querySelector(".a-icon-alt")?.innerText || "N/A"; // Thay selector
            const image = item.querySelector("img")?.src || "N/A"; // Thay selector
            const link = item.querySelector("a")?.href || "#";

            products.push({
                name,
                price,
                rating,
                image,
                link: `https://www.lazada.vn${link}`,
            });
        });

        return products;
    });
};

// Hàm duyệt qua các trang của một danh mục để lấy sản phẩm
const scrapeCategory = async (browser, categoryName, searchQuery) => {
    const page = await browser.newPage();
    let allProducts = [];
    let currentPage = 1;

    while (true) {
        console.log(
            `Fetching page ${currentPage} for category "${categoryName}"...`
        );
        const url = `https://www.lazada.vn/catalog/?q=${encodeURIComponent(
            searchQuery
        )}&page=${currentPage}`;
        await page.goto(url, { waitUntil: "networkidle2" });

        // Lấy các sản phẩm từ trang hiện tại bằng HTML selector
        const products = await getProductsFromHTML(page);

        if (products.length === 0) {
            console.log(
                `No more products found for category "${categoryName}" on page ${currentPage}.`
            );
            break;
        }

        allProducts.push(...products);
        console.log(
            `Fetched ${products.length} products on page ${currentPage}`
        );

        currentPage++;
        await delay(1000); // Delay giữa các trang để tránh bị chặn
    }

    await page.close();
    return allProducts;
};

// Hàm lưu sản phẩm vào file JSON theo tên danh mục
const saveProductsToFile = (categoryName, products) => {
    const filePath = path.join(
        process.cwd(),
        `/data/${categoryName.replace(/\s+/g, "_")}_products.json`
    );
    fs.writeFileSync(
        filePath,
        JSON.stringify({ totalProducts: products.length, products }, null, 2),
        "utf-8"
    );
    console.log(
        `Saved ${products.length} products for category "${categoryName}" to ${filePath}`
    );
};

// Hàm chính để duyệt qua các danh mục
const scrapeLazadaCategories = async () => {
    const browser = await puppeteer.launch({
        headless: true,
        args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });
    const categories = [
        { name: "Men T-Shirts", searchQuery: "áo thun nam" },
        { name: "Women T-Shirts", searchQuery: "áo thun nữ" },
    ];

    for (const category of categories) {
        const products = await scrapeCategory(
            browser,
            category.name,
            category.searchQuery
        );
        saveProductsToFile(category.name, products);
    }

    await browser.close();
};

scrapeLazadaCategories().then(() => console.log("Scraping completed!"));
