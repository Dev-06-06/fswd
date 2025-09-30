let portfolioChart = null;

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('buy-stock-form').addEventListener('submit', handleBuyStock);
    document.getElementById('sell-stock-form').addEventListener('submit', handleSellStock);
    fetchPortfolio();
});

// --- Modal Controls ---
function openSellModal(ticker, currentQuantity) {
    document.getElementById('sell-ticker').textContent = ticker;
    document.getElementById('current-quantity').textContent = currentQuantity;
    const quantityInput = document.getElementById('sell-quantity-input');
    quantityInput.value = '';
    quantityInput.max = currentQuantity;
    document.getElementById('sell-modal').style.display = 'flex';
}

function closeSellModal() {
    document.getElementById('sell-modal').style.display = 'none';
}

// --- API Handlers ---
async function handleBuyStock(event) {
    event.preventDefault();
    const tickerInput = document.getElementById('ticker-input');
    const quantityInput = document.getElementById('quantity-input');

    const ticker = tickerInput.value.toUpperCase();
    const quantity = parseInt(quantityInput.value);

    try {
        // STEP 1: Fetch the current market price for the stock
        const priceResponse = await fetch(`http://127.0.0.1:5000/api/stock/${ticker}`);
        const priceData = await priceResponse.json();

        if (!priceResponse.ok || priceData.error) {
            throw new Error(priceData.error || 'Could not fetch stock price.');
        }

        const currentPrice = priceData.price;

        const stockData = {
            ticker_symbol: ticker,
            quantity: quantity,
            price: currentPrice // Use the fetched price
        };
        
        // STEP 2: Send the buy request with the fetched price
        const buyResponse = await fetch('http://127.0.0.1:5000/api/portfolio/buy', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(stockData),
        });

        if (!buyResponse.ok) {
            const errorData = await buyResponse.json();
            throw new Error(errorData.error || 'Failed to buy stock');
        }
        
        tickerInput.value = '';
        quantityInput.value = '';
        
        fetchPortfolio();
    } catch (error) {
        console.error('Error buying stock:', error);
        alert(`Could not buy stock: ${error.message}`);
    }
}


async function handleSellStock(event) {
    event.preventDefault();
    const ticker = document.getElementById('sell-ticker').textContent;
    const quantity = parseInt(document.getElementById('sell-quantity-input').value);
    
    try {
        const response = await fetch('http://127.0.0.1:5000/api/portfolio/sell', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ticker_symbol: ticker, quantity: quantity }),
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'Failed to sell stock');
        
        closeSellModal();
        fetchPortfolio();
    } catch (error) {
        console.error('Error selling stock:', error);
        alert(`Could not sell stock: ${error.message}`);
    }
}

function renderPieChart(portfolioData) {
    const chartContainer = document.getElementById('chart-container');
    if (portfolioData.length === 0) {
        chartContainer.style.display = 'none';
        return;
    }
    chartContainer.style.display = 'block';

    const ctx = document.getElementById('portfolio-pie-chart').getContext('2d');
    const labels = portfolioData.map(holding => holding.ticker_symbol);
    const data = portfolioData.map(holding => holding.currentValue);

    if (portfolioChart) {
        portfolioChart.destroy();
    }

    portfolioChart = new Chart(ctx, {
        type: 'pie',
        data: {
            labels: labels,
            datasets: [{
                label: 'Portfolio Value',
                data: data,
                backgroundColor: ['#3498db', '#2ecc71', '#e74c3c', '#9b59b6', '#f1c40f', '#1abc9c', '#e67e22', '#34495e'],
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: { position: 'top' },
                title: { display: true, text: 'Portfolio Allocation by Value' }
            }
        }
    });
}

async function fetchPortfolio() {
    const container = document.getElementById('portfolio-container');
    const summaryContainer = document.getElementById('summary-container');
    
    try {
        const response = await fetch('http://127.0.0.1:5000/api/portfolio');
        const holdings = await response.json();
        container.innerHTML = ''; 

        if (holdings.length === 0) {
            container.innerHTML = '<p>Your portfolio is empty.</p>';
            summaryContainer.innerHTML = '';
            renderPieChart([]);
            return;
        }

        const portfolioWithValues = await Promise.all(
            holdings.map(async (holding) => {
                const priceResponse = await fetch(`http://127.0.0.1:5000/api/stock/${holding.ticker_symbol}`);
                const priceData = await priceResponse.json();
                const currentValue = (priceData.price || 0) * holding.quantity;
                return { ...holding, price: priceData.price || 0, currentValue: currentValue };
            })
        );
        
        let totalPortfolioValue = 0;

        portfolioWithValues.forEach(holding => {
            totalPortfolioValue += holding.currentValue;
            const avg_price = holding.total_cost / holding.quantity;

            const holdingDiv = document.createElement('div');
            holdingDiv.className = 'holding';
            holdingDiv.innerHTML = `
                <div class="ticker-info">
                    <div>
                        <span class="ticker">${holding.ticker_symbol}</span><br>
                        <span class="quantity">Shares: ${holding.quantity}</span>
                    </div>
                </div>
                <div class="holding-details">
                    <span class="current-value">₹${holding.currentValue.toFixed(2)}</span><br>
                    <span>Avg. Buy: ₹${avg_price.toFixed(2)}</span>
                </div>
                <button class="action-btn sell-btn" data-ticker="${holding.ticker_symbol}" data-quantity="${holding.quantity}">Sell</button>
            `;
            container.appendChild(holdingDiv);
        });

        summaryContainer.innerHTML = `<p id="total-value">Total Value: ₹${totalPortfolioValue.toFixed(2)}</p>`;
        
        document.querySelectorAll('.sell-btn').forEach(button => {
            button.addEventListener('click', (event) => {
                const ticker = event.target.dataset.ticker;
                const quantity = event.target.dataset.quantity;
                openSellModal(ticker, quantity);
            });
        });
        
        renderPieChart(portfolioWithValues);

    } catch (error) {
        console.error('Error fetching portfolio:', error);
        container.innerHTML = '<p>Could not load portfolio data. Make sure the backend server is running.</p>';
    }
}