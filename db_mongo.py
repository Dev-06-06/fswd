from pymongo import MongoClient
from pymongo.errors import ConnectionFailure

def get_db_collection():
    """
    Establishes a connection to the MongoDB server and returns the 'holdings' collection object.
    """
    try:
        # Connect to the default MongoDB instance running on your machine
        client = MongoClient('mongodb://localhost:27017/')
        
        # Ping the server to confirm a successful connection
        client.admin.command('ping')
        
        # Select the database named 'portfolio_db'
        db = client['portfolio_db']
        
        # Select the collection named 'holdings'
        collection = db['holdings']
        
        return collection

    except ConnectionFailure as e:
        print(f"Could not connect to MongoDB: {e}")
        return None