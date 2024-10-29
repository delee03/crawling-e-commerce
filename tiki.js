import fetch from "node-fetch";
import fs from "fs";
import util from "util";
import cliProgress from "cli-progress";

const delay = util.promisify(setTimeout);

let listCategory = [
    1802, 8322, 1833, 1789, 2549, 1815, 1520, 8594, 931, 4384, 1975, 915, 17166,
    1846, 1866, 4221, 170,
];
let listProduct = [];

// Create a new progress bar
const progressBar = new cliProgress.SingleBar(
    {
        format: "Progress | {bar} | {percentage}% | {value}/{total} Pages",
        barCompleteChar: "\u2588",
        barIncompleteChar: "\u2591",
        hideCursor: true,
    },
    cliProgress.Presets.shades_classic
);

// Function to process a batch of fetch requests
const fetchBatch = async (batch, totalPages) => {
    const responses = await Promise.allSettled(batch);
    responses.forEach(async (response) => {
        if (response.status === "fulfilled" && response.value.ok) {
            const res = await response.value.json();
            if (res.data && res.data.length > 0) {
                res.data.forEach((data) => {
                    let newData = {
                        name: data.name,
                        discountRate: data.discount_rate,
                        thumbnail: data.thumbnail_url,
                        brand_name: data.brand_name,
                        price: data.price,
                        review_count: data.review_count,
                        rating_average: data.rating_average,
                        textSold: Number(data.quantity_sold?.value),
                        badgesNew: data.badges_new?.[1]?.icon,
                    };
                    listProduct.push(newData);
                });
            }
        } else {
            console.error(
                "Error or rejected request for batch item",
                response.reason
            );
        }
    });

    // Increment the progress bar after each batch is processed
    progressBar.increment(batch.length);
};

// Function to get the total number of pages for a category
const getTotalPages = async (catId) => {
    const url = `https://tiki.vn/api/personalish/v1/blocks/listings?limit=40&include=advertisement&aggregations=2&version=home-persionalized&trackity_id=c7095135-be1a-fd39-5608-0b1f03518c22&category=${catId}&page=1&urlKey=dien-thoai-may-tinh-bang`;

    try {
        const response = await fetch(url, {
            method: "GET",
            headers: {
                "Content-Type": "application/json",
                "User-Agent":
                    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/85.0.4183.121 Safari/537.36",
            },
        });

        if (!response.ok) {
            throw new Error(`Error fetching total pages for category ${catId}`);
        }

        const res = await response.json();
        const totalPages = res.paging?.last_page || 1; // Extract total pages, default to 1 if not available
        console.log(`Category ${catId} has ${totalPages} pages`);
        return totalPages;
    } catch (error) {
        console.error("Error fetching total pages:", error);
        return 1; // Default to 1 page if an error occurs
    }
};

// Main function to fetch data in batches with a progress bar
const fetchData = async () => {
    const BATCH_SIZE = 10; // Number of concurrent requests per batch
    const RATE_LIMIT_DELAY = 500; // 500ms delay between each request batch

    try {
        for (const catId of listCategory) {
            const totalPages = await getTotalPages(catId);
            progressBar.start(totalPages, 0);

            let fetchPromises = [];
            for (let page = 1; page <= totalPages; page++) {
                const url = `https://tiki.vn/api/personalish/v1/blocks/listings?limit=40&include=advertisement&aggregations=2&version=home-persionalized&trackity_id=c7095135-be1a-fd39-5608-0b1f03518c22&category=${catId}&page=${page}&urlKey=dien-thoai-may-tinh-bang`;

                fetchPromises.push(
                    fetch(url, {
                        method: "GET",
                        headers: {
                            "Content-Type": "application/json",
                            "User-Agent":
                                "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/85.0.4183.121 Safari/537.36",
                        },
                    })
                );

                // When we reach the batch size, process the batch
                if (fetchPromises.length >= BATCH_SIZE) {
                    await fetchBatch(fetchPromises, totalPages);
                    fetchPromises = []; // Clear the batch
                    await delay(RATE_LIMIT_DELAY); // Rate limit delay before starting next batch
                }
            }
            if (fetchPromises.length > 0) {
                await fetchBatch(fetchPromises, totalPages);
            }
            progressBar.stop();
        }
    } catch (error) {
        console.error("Error fetching data:", error);
    }

    // Save listProduct to a file once all data is processed
    try {
        fs.writeFileSync(
            process.cwd() + "/data/tiki.json",
            JSON.stringify(listProduct, null, 2),
            "utf-8"
        );
        console.log("Product data saved to productData.json");
    } catch (error) {
        console.error("Error writing to file:", error);
    }

    return listProduct;
};

// Run the scraper
fetchData().then((productList) => {
    console.log("Final product list:", productList.length, "products fetched.");
});
