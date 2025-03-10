// backend/src/services/rate-tracker/index.js
const axios = require('axios');
const InterestRate = require('../../models/InterestRate');
const LoanProduct = require('../../models/LoanProduct');
const Institution = require('../../models/Institution');

class RateTrackerService {
  constructor() {
    // Configuration for external rate APIs
    this.dataSources = [
      {
        name: 'Federal Reserve',
        url: 'https://api.example.com/federal-reserve',
        apiKey: process.env.FEDERAL_RESERVE_API_KEY,
        enabled: true
      },
      {
        name: 'Bank Rate API',
        url: 'https://api.example.com/bankrate',
        apiKey: process.env.BANKRATE_API_KEY,
        enabled: true
      }
      // Add more data sources as needed
    ];
  }

  /**
   * Fetch the latest rates from all configured data sources
   */
  async fetchLatestRates() {
    console.log('Fetching latest interest rates...');
    const results = [];
    const errors = [];

    for (const source of this.dataSources) {
      if (!source.enabled) continue;

      try {
        console.log(`Fetching rates from ${source.name}...`);
        // In a real application, you would make actual API calls
        // const response = await axios.get(source.url, {
        //   headers: { 'Authorization': `Bearer ${source.apiKey}` }
        // });
        
        // Simulated response for development
        const response = {
          data: this.getMockRates(source.name)
        };
        
        results.push({
          source: source.name,
          data: response.data,
          timestamp: new Date()
        });
        
      } catch (error) {
        console.error(`Error fetching rates from ${source.name}:`, error);
        errors.push({
          source: source.name,
          error: error.message
        });
      }
    }

    return {
      results,
      errors,
      timestamp: new Date()
    };
  }

  /**
   * Process and store the fetched rates
   */
  async processRates(fetchedRates) {
    console.log('Processing fetched rates...');
    const processed = [];
    
    for (const result of fetchedRates.results) {
      const { source, data, timestamp } = result;
      
      for (const rateInfo of data) {
        try {
          // Find the matching loan product in the database
          const loanProduct = await LoanProduct.findOne({
            name: rateInfo.productName,
            type: rateInfo.loanType
          });
          
          if (!loanProduct) {
            console.log(`No matching loan product found for ${rateInfo.productName}`);
            continue;
          }
          
          // Create new interest rate record
          const newRate = new InterestRate({
            loanProduct: loanProduct._id,
            date: timestamp,
            rate: rateInfo.interestRate,
            termLength: rateInfo.termMonths,
            creditScoreRange: {
              min: rateInfo.minCreditScore || 0,
              max: rateInfo.maxCreditScore || 850
            },
            conditions: rateInfo.conditions || {}
          });
          
          await newRate.save();
          processed.push(newRate);
          
        } catch (error) {
          console.error(`Error processing rate for ${rateInfo.productName}:`, error);
        }
      }
    }
    
    console.log(`Processed ${processed.length} rates`);
    return processed;
  }

  /**
   * Get the latest rate for a specific loan product
   */
  async getLatestRate(loanProductId, creditScore = 720) {
    return InterestRate.findOne({
      loanProduct: loanProductId,
      'creditScoreRange.min': { $lte: creditScore },
      'creditScoreRange.max': { $gte: creditScore }
    }).sort({ date: -1 });
  }

  /**
   * Get historical rates for a specific loan product
   */
  async getHistoricalRates(loanProductId, days = 30) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    
    return InterestRate.find({
      loanProduct: loanProductId,
      date: { $gte: startDate }
    }).sort({ date: 1 });
  }

  /**
   * Get rate trends by loan type
   */
  async getRateTrendsByType(loanType, days = 90) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    
    // Find all loan products of this type
    const loanProducts = await LoanProduct.find({ type: loanType });
    const loanProductIds = loanProducts.map(product => product._id);
    
    // Get average rates by date
    return InterestRate.aggregate([
      {
        $match: {
          loanProduct: { $in: loanProductIds },
          date: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: {
            $dateToString: { format: "%Y-%m-%d", date: "$date" }
          },
          averageRate: { $avg: "$rate" },
          minRate: { $min: "$rate" },
          maxRate: { $max: "$rate" },
          count: { $sum: 1 }
        }
      },
      {
        $sort: { _id: 1 }
      }
    ]);
  }

  /**
   * Generate mock rates for development
   */
  getMockRates(sourceName) {
    const loanTypes = ['Mortgage', 'Personal', 'Auto', 'Student', 'Business'];
    const productSuffixes = ['Premium', 'Standard', 'Basic', 'Plus', 'Select'];
    const rates = [];
    
    for (const loanType of loanTypes) {
      const baseRate = this.getBaseRateForType(loanType);
      
      for (const suffix of productSuffixes) {
        // Skip some combinations to simulate different institutions offering different products
        if (Math.random() > 0.7) continue;
        
        const productName = `${sourceName} ${loanType} ${suffix}`;
        
        // Vary the rate slightly for different products
        const variationFactor = suffix === 'Premium' ? -0.3 : 
                               suffix === 'Plus' ? -0.15 : 
                               suffix === 'Select' ? -0.1 : 
                               suffix === 'Standard' ? 0 : 0.2;
        
        const interestRate = baseRate + variationFactor + (Math.random() * 0.2 - 0.1);
        
        rates.push({
          productName,
          loanType,
          interestRate: parseFloat(interestRate.toFixed(2)),
          termMonths: this.getDefaultTermForType(loanType),
          minCreditScore: this.getMinCreditScoreForProduct(suffix),
          conditions: {}
        });
      }
    }
    
    return rates;
  }
  
  getBaseRateForType(type) {
    switch(type) {
      case 'Mortgage': return 5.75;
      case 'Personal': return 8.5;
      case 'Auto': return 4.25;
      case 'Student': return 6.0;
      case 'Business': return 7.25;
      default: return 6.0;
    }
  }
  
  getDefaultTermForType(type) {
    switch(type) {
      case 'Mortgage': return 360; // 30 years
      case 'Personal': return 60; // 5 years
      case 'Auto': return 72; // 6 years
      case 'Student': return 120; // 10 years
      case 'Business': return 84; // 7 years
      default: return 60;
    }
  }
  
  getMinCreditScoreForProduct(suffix) {
    switch(suffix) {
      case 'Premium': return 740;
      case 'Plus': return 700;
      case 'Select': return 680;
      case 'Standard': return 650;
      case 'Basic': return 620;
      default: return 650;
    }
  }
}

module.exports = new RateTrackerService();
