import yfinance as yf

def get_stock_price(ticker_symbol):
    """
    Fetches the current market price of a given stock ticker.
    """
    try:
        stock = yf.Ticker(ticker_symbol)
        price = stock.info.get('regularMarketPrice')
        
        if price:
            return price
        else:
            hist = stock.history(period="1d")
            return hist['Close'].iloc[-1]
            
    except Exception as e:
        print(f"Could not fetch price for {ticker_symbol}. Error: {e}")
        return None