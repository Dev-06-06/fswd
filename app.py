from flask import Flask, jsonify, request
from flask_cors import CORS
from data_fetcher import get_stock_price
from db_mongo import get_db_collection

app = Flask(__name__)
CORS(app)

holdings_collection = get_db_collection()

# --- API Endpoints ---

@app.route("/api/stock/<string:ticker_symbol>")
def api_get_stock_price(ticker_symbol):
    price = get_stock_price(ticker_symbol)
    if price is not None:
        return jsonify({"ticker": ticker_symbol, "price": price})
    else:
        return jsonify({"error": "Could not find data for the ticker."}), 404

@app.route("/api/portfolio", methods=['GET'])
def get_portfolio():
    holdings = []
    for holding in holdings_collection.find({}):
        holding['_id'] = str(holding['_id'])
        holdings.append(holding)
    return jsonify(holdings)

# NEW: Replaces the old 'add' endpoint
@app.route("/api/portfolio/buy", methods=['POST'])
def buy_stock():
    data = request.get_json()
    if not data or 'ticker_symbol' not in data or 'quantity' not in data or 'price' not in data:
        return jsonify({"error": "Invalid request body."}), 400

    ticker = data['ticker_symbol']
    buy_quantity = int(data['quantity'])
    buy_price = float(data['price'])

    if buy_quantity <= 0 or buy_price <= 0:
        return jsonify({"error": "Quantity and price must be positive."}), 400

    cost_of_purchase = buy_quantity * buy_price
    existing_holding = holdings_collection.find_one({"ticker_symbol": ticker})

    if existing_holding:
        new_quantity = existing_holding['quantity'] + buy_quantity
        new_total_cost = existing_holding['total_cost'] + cost_of_purchase
        holdings_collection.update_one(
            {"ticker_symbol": ticker},
            {"$set": {"quantity": new_quantity, "total_cost": new_total_cost}}
        )
        message = f"Bought {buy_quantity} more shares of {ticker}."
    else:
        holdings_collection.insert_one({
            "ticker_symbol": ticker,
            "quantity": buy_quantity,
            "total_cost": cost_of_purchase
        })
        message = f"Bought {buy_quantity} shares of {ticker}."
    
    return jsonify({"message": message}), 201

# UPDATED: The 'sell' endpoint now adjusts total_cost
@app.route("/api/portfolio/sell", methods=['POST'])
def sell_from_portfolio():
    data = request.get_json()
    # ... (initial data validation is the same) ...
    if not data or 'ticker_symbol' not in data or 'quantity' not in data:
        return jsonify({"error": "Invalid request body."}), 400

    ticker = data['ticker_symbol']
    sell_quantity = int(data['quantity'])

    if sell_quantity <= 0:
        return jsonify({"error": "Quantity to sell must be positive."}), 400

    holding = holdings_collection.find_one({"ticker_symbol": ticker})
    if not holding:
        return jsonify({"error": "Stock not found in portfolio."}), 404

    current_quantity = holding['quantity']
    if sell_quantity > current_quantity:
        return jsonify({"error": "Cannot sell more shares than you own."}), 400
    
    # Proportionally reduce the total cost
    current_total_cost = holding['total_cost']
    avg_price = current_total_cost / current_quantity
    cost_to_remove = sell_quantity * avg_price
    
    new_quantity = current_quantity - sell_quantity
    new_total_cost = current_total_cost - cost_to_remove

    if new_quantity == 0:
        holdings_collection.delete_one({"ticker_symbol": ticker})
        message = f"Sold all {current_quantity} shares of {ticker}."
    else:
        holdings_collection.update_one(
            {"ticker_symbol": ticker},
            {"$set": {"quantity": new_quantity, "total_cost": new_total_cost}}
        )
        message = f"Sold {sell_quantity} shares of {ticker}. {new_quantity} shares remaining."

    return jsonify({"message": message}), 200

if __name__ == "__main__":
    app.run(debug=True)