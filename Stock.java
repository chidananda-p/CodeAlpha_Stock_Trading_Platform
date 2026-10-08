import java.util.ArrayList;
import java.util.List;
import java.util.Random;

public class Stock {

    private String symbol;
    private String companyName;
    private double currentPrice;
    private double previousPrice;
    private double openPrice;
    private List<Double> priceHistory;

    private static final Random RANDOM = new Random();

    public Stock(String symbol, String companyName, double initialPrice) {
        this.symbol = symbol;
        this.companyName = companyName;
        this.currentPrice = initialPrice;
        this.previousPrice = initialPrice;
        this.openPrice = initialPrice;
        this.priceHistory = new ArrayList<>();
        this.priceHistory.add(initialPrice);
    }

    public void updatePrice() {
        previousPrice = currentPrice;
        double changePercent = RANDOM.nextGaussian() * 1.5;
        currentPrice += currentPrice * (changePercent / 100.0);
        currentPrice = Math.max(0.01, Math.round(currentPrice * 100.0) / 100.0);
        priceHistory.add(currentPrice);
    }

    public double getChangeFromOpen() {
        return currentPrice - openPrice;
    }

    public double getChangePercentFromOpen() {
        if (openPrice == 0) return 0;
        return ((currentPrice - openPrice) / openPrice) * 100.0;
    }

    public void resetDay() {
        openPrice = currentPrice;
        previousPrice = currentPrice;
    }

    public String getSymbol()       { return symbol; }
    public String getCompanyName()  { return companyName; }
    public double getCurrentPrice() { return currentPrice; }
    public double getOpenPrice()    { return openPrice; }

    public List<Double> getPriceHistory() {
        return new ArrayList<>(priceHistory);
    }
}
