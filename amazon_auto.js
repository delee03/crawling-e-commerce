import puppeteer from "puppeteer";
import fs from "fs";
import path from "path";
import cliProgress from "cli-progress";

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
let listProduct = [];

const MAX_RETRIES = 3; // Số lần thử lại tối đa nếu không tìm thấy ASIN
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

const getASINsFromAllPages = async (page, searchUrl) => {
  let allAsins = [];
  let currentPage = 1;

  while (true) {
    console.log(`Fetching ASINs from page ${currentPage}...`);
    await page.goto(`${searchUrl}&page=${currentPage}`, {
      waitUntil: "networkidle2",
    });

    const asinList = await page.evaluate(() => {
      return Array.from(document.querySelectorAll("[data-asin]"))
        .map((element) => element.getAttribute("data-asin"))
        .filter((asin) => asin && asin.length === 10);
    });

    // Thêm ASINs từ trang hiện tại vào danh sách chung
    allAsins.push(...asinList);

    // Kiểm tra xem có trang tiếp theo không
    const hasNextPage = await page.evaluate(() => {
      const nextButton = document.querySelector("li.a-last a");
      return nextButton !== null && !nextButton.classList.contains("disabled");
    });

    if (!hasNextPage) {
      break; // Dừng lại nếu không có trang kế tiếp
    }

    currentPage++;
    await delay(1000); // Thời gian chờ giữa các trang
  }

  return [...new Set(allAsins)]; // Loại bỏ các ASIN trùng lặp
};

const getProduct = async (page, productId) => {
  try {
    const url = `https://www.amazon.com/dp/${productId}`;
    await page.goto(url, { waitUntil: "networkidle2" });

    // Chờ phần tử tiêu đề xuất hiện, giúp đảm bảo nội dung trang đã tải
    await page.waitForSelector("#productTitle", { timeout: 10000 });

    const productData = await page.evaluate(() => {
      const getText = (selector) => {
        const element = document.querySelector(selector);
        return element ? element.textContent.trim() : "N/A";
      };

      const getAttribute = (selector, attr) => {
        const element = document.querySelector(selector);
        return element ? element.getAttribute(attr) : "N/A";
      };

      // Trích xuất thông tin sản phẩm
      return {
        id: document.querySelector("[name='ASIN']")?.value || "Unknown",
        name: getText("#productTitle"),
        ratings:
          parseFloat(getText("#acrCustomerReviewText").replace(",", ".")) ||
          null,
        price: getText(".a-price .a-offscreen") || "N/A",
        image: getAttribute("#imgTagWrapperId img", "src") || "N/A",
        description:
          getText("#feature-bullets ul") || "No description available",
        details: {
          brand:
            document
              .querySelector(".po-brand .a-size-base.po-break-word")
              ?.textContent.trim() || "N/A",
          color:
            document
              .querySelector(".po-color .a-span9 .a-size-base.po-break-word")
              ?.textContent.trim() || "N/A",
          size:
            document
              .querySelector(".po-size_name .a-size-base.po-break-word")
              ?.textContent.trim() || "N/A",
          material:
            document
              .querySelector(".po-fabric_type .a-size-base.po-break-word")
              ?.textContent.trim() || "N/A",
          fitType:
            document
              .querySelector(".po-fit_type .a-size-base.po-break-word")
              ?.textContent.trim() || "N/A",
          careInstructions:
            document
              .querySelector(".po-care_instructions .a-size-base.po-break-word")
              ?.textContent.trim() || "N/A",
        },
      };
    });

    // Kiểm tra và log nếu không có thông tin
    if (!productData.name || productData.name === "N/A") {
      console.log(`Warning: Product data for ${productId} is incomplete.`);
    }

    listProduct.push(productData);
    return productData;
  } catch (error) {
    console.error(`Error fetching product ${productId}:`, error.message);
  }
};

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

const fetchProductsForCategory = async (page, category, searchUrl) => {
  const filePath = path.join(process.cwd(), `/data/${category}_products.json`);
  if (fs.existsSync(filePath)) {
    console.log(`Data for category ${category} already exists. Skipping...`);
    return;
  }

  listProduct = [];
  const asinList = await getASINsFromAllPages(page, searchUrl);
  if (asinList.length === 0) {
    console.log(`No ASINs found for category: ${category}`);
    return;
  }

  console.log(`Found ${asinList.length} ASINs for category: ${category}`);
  progressBar.start(asinList.length, 0);

  for (let i = 0; i < asinList.length; i++) {
    await getProduct(page, asinList[i]);
    progressBar.update(i + 1);
    //  await delay(); // Thêm thời gian chờ .2 giây giữa các yêu cầu sản phẩm
  }

  progressBar.stop();
  saveProductListToFile(category);
};

const fetchAllCategories = async () => {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  await page.setUserAgent(
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/92.0.4515.107 Safari/537.36"
  );

  for (const { name, searchUrl } of categories) {
    console.log(`Fetching products for category: ${name}`);
    await fetchProductsForCategory(page, name, searchUrl);
    console.log(`Finished fetching products for category: ${name}`);
  }

  await browser.close();
};

// Danh sách các danh mục với URL tìm kiếm tương ứng
const categories = [
  {
    name: "mouse_4",
    searchUrl:
      "https://www.amazon.com/s?k=mouse&page=4&qid=1731428003&ref=sr_pg_4",
  },
];

// Chạy chương trình
fetchAllCategories().then(() => {
  console.log("All categories fetched and saved.");
});
