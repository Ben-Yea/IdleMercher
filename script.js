
let itemData = []; // Stores item data for suggestions and pricing
let countdownValue = 30; // Initial countdown value in seconds

// Function to fetch and update table data
function formatNumber(value) {
    const num = value.replace(/,/g, ""); // Remove existing commas
    if (isNaN(num) || num === "") return ""; // Return empty string for invalid inputs
    return parseFloat(num).toLocaleString(); // Add commas for formatting
}

async function fetchAndUpdateTable() {
    const API_URL = "https://query.idleclans.com/api/PlayerMarket/items/prices/latest";
    const namesURL = "itemIdNames.json";

    try {
        // Fetch item prices
        const [pricesResponse, namesResponse] = await Promise.all([
            fetch(API_URL),
            fetch(namesURL),
        ]);
        const data = await pricesResponse.json();
        const itemIdArray = await namesResponse.json();

        // Create a mapping of internal IDs to formatted names
        const itemIdMap = {};
        itemIdArray.forEach((item) => {
            const formattedName = formatItemName(item.name_id); // Format the name
            itemIdMap[item.internal_id] = formattedName; // Map internal_id to formatted name
        });

        // Update the table
        const tableBody = document.querySelector("#market-table tbody");
        tableBody.innerHTML = ""; // Clear existing rows

        // Populate table rows
        data.forEach((item) => {
            const itemName = itemIdMap[item.itemId] || `Unknown (${item.itemId})`;
            const lowestSellPrice = item.lowestSellPrice || "N/A";
            const lowestPriceVolume = item.lowestPriceVolume || "N/A";
            const highestBuyPrice = item.highestBuyPrice || "N/A";
            const highestPriceVolume = item.highestPriceVolume || "N/A";

            const row = document.createElement("tr");
            row.innerHTML = `
                <td>${itemName}</td>
                <td>${lowestSellPrice.toLocaleString()}</td>
                <td>${lowestPriceVolume.toLocaleString()}</td>
                <td>${highestBuyPrice.toLocaleString()}</td>
                <td>${highestPriceVolume.toLocaleString()}</td>
            `;
            tableBody.appendChild(row);
        });

        // Update the global itemData array
        itemData = data.map((item) => ({
            name: itemIdMap[item.itemId] || `Unknown (${item.itemId})`,
            lowestSellPrice: item.lowestSellPrice || 0,
            highestBuyPrice: item.highestBuyPrice || 0,
        }));

        // Update pinned prices
        updatePinnedPrices();
    } catch (error) {
        console.error("Failed to fetch table data:", error);
    }
}

// Function to update pinned item prices
function updatePinnedPrices() {
    const pinnedCards = document.querySelectorAll(".card");

    pinnedCards.forEach((card) => {
        const itemName = card.dataset.name;
        const category = card.dataset.category;

        // Find the corresponding item in the itemData array
        const item = itemData.find((item) => item.name === itemName);
        if (!item) return; // Skip if the item is not found

        const newPrice =
            category === "buy-orders" ? item.highestBuyPrice : item.lowestSellPrice;

        // Update the card's current price
        const currentPriceElement = card.querySelector(".current-price");
        currentPriceElement.textContent = `${category === "buy-orders" ? "Highest Buy Price:" : "Lowest Sell Price:"} ${newPrice.toLocaleString()}`;

        // Update the card's dataset
        card.dataset.price = newPrice;

        // Re-check the flash condition immediately
        checkPrice(card);
    });
}

function savePinnedItems() {
    const pinnedData = [];

    document.querySelectorAll(".card").forEach((card) => {
        const name = card.dataset.name;
        const category = card.dataset.category;
        const price = card.dataset.price;
        const userPrice = card.querySelector("input").value || "";

        pinnedData.push({ name, category, price, userPrice });
    });

    localStorage.setItem("pinnedItems", JSON.stringify(pinnedData));
}

function restorePinnedItems() {
    const pinnedData = JSON.parse(localStorage.getItem("pinnedItems")) || [];

    pinnedData.forEach((item) => {
        pinItem(item.name, parseFloat(item.price), item.category);

        // Restore the user's price if it exists
        const lastCard = document.querySelector(`#${item.category} .cards .card:last-child`);
        if (lastCard) {
            lastCard.querySelector("input").value = formatNumber(item.userPrice);
        }
    });
}

// Countdown and refresh logic
function startCountdown() {
    const countdownElement = document.getElementById("countdown");

    setInterval(() => {
        if (countdownValue === 0) {
            fetchAndUpdateTable(); // Refresh table
            countdownValue = 30; // Reset countdown
        }

        countdownElement.textContent = countdownValue;
        countdownValue--;
    }, 1000); // Update every second
}

// Add event listener to the form
document.getElementById("search-form").addEventListener("submit", function (event) {
    event.preventDefault();

    const itemName = document.getElementById("item-name").value;
    const category = document.getElementById("pin-category").value;

    // Find matching item data
    const item = itemData.find((item) => item.name === itemName);
    if (!item) {
        alert("Item not found!");
        return;
    }

    // Get the appropriate price
    const price = category === "buy-orders" ? item.highestBuyPrice : item.lowestSellPrice;

    // Pin the item
    pinItem(itemName, price, category);

    // Reset the form
    document.getElementById("search-form").reset();
});

// Function to pin an item to the selected category
function pinItem(name, price, category) {
    const parentContainer = document.querySelector(`#${category} .cards`);
    const placeholder = parentContainer.querySelector('.placeholder');

    // Hide the placeholder when adding the first real card
    if (placeholder) {
        placeholder.style.display = 'none';
    }

    const card = document.createElement("div");
    card.classList.add("card");
    card.dataset.name = name; // Store item name for updates
    card.dataset.category = category; // Store category for updates
    card.dataset.price = price; // Store original price for comparison

    card.innerHTML = `
        <p><strong>${name}</strong></p>
        <p class="current-price">${category === "buy-orders" ? "Highest Buy Price:" : "Lowest Sell Price:"} ${price.toLocaleString()}</p>
        <label>Your Price: <input type="text" placeholder="Enter Price"></label>
        <div class="card-actions">
            <button class="move-btn">Move</button>
            <button class="delete-btn">Delete</button>
        </div>
    `;

    parentContainer.appendChild(card);

    // Add event listeners
    const priceInput = card.querySelector("input");
    priceInput.addEventListener("input", function () {
        this.value = formatNumber(this.value); // Format input dynamically
        savePinnedItems(); // Save changes to localStorage
    });

    // Move button functionality
    card.querySelector(".move-btn").addEventListener("click", () => {
        const newCategory = category === "buy-orders" ? "sell-offers" : "buy-orders";
        parentContainer.removeChild(card); // Remove from current category
        pinItem(name, price, newCategory); // Add to the other category
    });

    // Delete button functionality
    card.querySelector(".delete-btn").addEventListener("click", () => {
        parentContainer.removeChild(card);

        // Show placeholder if no cards remain
        if (!parentContainer.querySelector('.card:not(.placeholder)')) {
            placeholder.style.display = 'block';
        }

        savePinnedItems(); // Update localStorage when a pin is removed
    });

    // Save pinned items to localStorage after adding
    savePinnedItems();
}


// Function to check price and flash if conditions are met
function checkPrice(card) {
    const category = card.dataset.category;
    const userPriceInput = card.querySelector("input").value.replace(/,/g, "");
    const userPrice = parseFloat(userPriceInput);

    if (isNaN(userPrice) || userPrice === 0) {
        return;
    }

    const currentPriceElement = card.querySelector(".current-price");
    const currentPriceText = currentPriceElement.textContent.match(/\d+/g);
    const currentPrice = parseFloat(currentPriceText?.join("") || "0");

    const flashCondition =
        (category === "buy-orders" && userPrice < currentPrice) ||
        (category === "sell-offers" && userPrice > currentPrice);

    if (flashCondition) {
        card.classList.add("flash");

        // Remove and re-add flash to repeat animation
        setTimeout(() => card.classList.remove("flash"), 1000); // Matches 1s animation
    }

    // Re-check condition every 2 seconds if needed
    setTimeout(() => checkPrice(card), 2000);
}



// Utility function to format item names
function formatItemName(name) {
    if (typeof name !== "string") {
        return "Unknown"; // Return a default value for invalid inputs
    }

    return name
        .split("_")
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" ");
}

// Populate suggestions and map table data
async function populateTable() {
    try {
        const apiResponse = await fetch("https://query.idleclans.com/api/PlayerMarket/items/prices/latest");
        const apiData = await apiResponse.json();

        const namesResponse = await fetch("itemIdNames.json");
        const itemIdArray = await namesResponse.json();

        const itemIdMap = {};
        itemIdArray.forEach((item) => {
            const formattedName = formatItemName(item.name_id); // Format the name
            itemIdMap[item.internal_id] = formattedName; // Map internal_id to formatted name
        });

        // Reference to the table body
        const tableBody = document.querySelector("#market-table tbody");
        const suggestionList = document.getElementById("item-suggestions");
        tableBody.innerHTML = ""; // Clear existing content
        suggestionList.innerHTML = ""; // Clear existing suggestions

        // Populate table rows and suggestions
        apiData.forEach((item) => {
            const itemName = itemIdMap[item.itemId] || `Unknown (${item.itemId})`;
            const lowestSellPrice = item.lowestSellPrice || "N/A";
            const lowestPriceVolume = item.lowestPriceVolume || "N/A";
            const highestBuyPrice = item.highestBuyPrice || "N/A";
            const highestPriceVolume = item.highestPriceVolume || "N/A";

            itemData.push({ name: itemName, lowestSellPrice, highestBuyPrice }); // Store item data

            // Populate table
            const row = document.createElement("tr");
            row.innerHTML = `
                <td>${itemName}</td>
                <td>${lowestSellPrice.toLocaleString()}</td>
                <td>${lowestPriceVolume.toLocaleString()}</td>
                <td>${highestBuyPrice.toLocaleString()}</td>
                <td>${highestPriceVolume.toLocaleString()}</td>
            `;
            tableBody.appendChild(row);

            // Add suggestion
            const option = document.createElement("option");
            option.value = itemName;
            suggestionList.appendChild(option);
        });
    } catch (error) {
        console.error("Error fetching data:", error);
    }
}

document.addEventListener("DOMContentLoaded", () => {
    const themeToggle = document.getElementById("theme-toggle");
    const currentTheme = localStorage.getItem("theme") || "light";

    // Apply the current theme
    document.documentElement.setAttribute("data-theme", currentTheme);

    themeToggle.addEventListener("click", () => {
        const newTheme = document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark";
        document.documentElement.setAttribute("data-theme", newTheme);
        localStorage.setItem("theme", newTheme);
    });

    // Restore pinned items
    restorePinnedItems();
    fetchAndUpdateTable();
    startCountdown();
    populateTable();
});
