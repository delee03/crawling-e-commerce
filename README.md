# Data Crawling Script for Tiki and Amazon

This repository contains a set of scripts to crawl product data from Tiki and Amazon websites using Node.js, `axios` for HTTP requests, and `jsdom` for parsing HTML.

## Features

- **Scraping Multiple Products**: Supports scraping multiple product pages.
- **Progress Bar**: Displays the scraping progress in the terminal.
- **Batch Processing**: Allows fetching data in batches for faster performance.
- **Error Handling**: Handles request failures and missing DOM elements gracefully.

## Table of Contents

- [Requirements](#requirements)
- [Installation](#installation)
- [Usage](#usage)
- [Configuration](#configuration)
- [Crawling Data from Tiki](#crawling-data-from-tiki)
- [Crawling Data from Amazon](#crawling-data-from-amazon)
- [Progress Bar](#progress-bar)
- [File Structure](#file-structure)

## Requirements

Ensure you have the following installed on your machine:

- [Node.js](https://nodejs.org/en/) (v14 or higher)
- npm or yarn for managing dependencies

## Installation

Clone the repository and install the required dependencies:

```bash
git clone https://github.com/your-repo/crawling-scripts.git
cd crawling-data

yarn

yarn dev
```
