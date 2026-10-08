import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

public class StockMarket {

    private Map<String, Stock> stocks;

    public StockMarket() {
        stocks = new LinkedHashMap<>();
        initializeStocks();
    }

    private void initializeStocks() {
        addStock(new Stock("AAPL",  "Apple Inc.",            189.84));
        addStock(new Stock("GOOGL", "Alphabet Inc.",         141.80));
        addStock(new Stock("MSFT",  "Microsoft Corp.",       378.91));
        addStock(new Stock("AMZN",  "Amazon.com Inc.",       178.25));
        addStock(new Stock("TSLA",  "Tesla Inc.",            248.42));
        addStock(new Stock("META",  "Meta Platforms Inc.",   505.75));
        addStock(new Stock("NFLX",  "Netflix Inc.",          628.30));
        addStock(new Stock("NVDA",  "NVIDIA Corp.",          875.28));
        addStock(new Stock("JPM",   "JPMorgan Chase & Co.", 198.47));
        addStock(new Stock("DIS",   "Walt Disney Co.",       112.56));
    }

    private void addStock(Stock stock) {
        stocks.put(stock.getSymbol(), stock);
    }

    public void simulateMarketTick() {
        for (Stock stock : stocks.values()) {
            stock.updatePrice();
        }
    }

    public Stock getStock(String symbol) {
        return stocks.get(symbol.toUpperCase());
    }

    public List<Stock> getAllStocks() {
        return new ArrayList<>(stocks.values());
    }

    public boolean stockExists(String symbol) {
        return stocks.containsKey(symbol.toUpperCase());
    }
}
