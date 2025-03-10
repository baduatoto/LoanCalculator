// backend/src/services/ai-analysis/index.js
const LoanProduct = require('../../models/LoanProduct');
const Institution = require('../../models/Institution');
const RateTrackerService = require('../rate-tracker');

class AIAnalysisService {
  /**
   * Analyze loan options and provide recommendations
   * @param {Object} params - Analysis parameters
   * @param {string} params.loanType - Type of loan (Mortgage, Auto, etc.)
   * @param {number} params.amount - Loan amount
   * @param {number} params.term - Loan term in months
   * @param {number} params.creditScore - User's credit score
   * @param {Object} params.preferences - User preferences
   */
  async analyzeLoanOptions(params) {
    const {
      loanType,
      amount,
      term,
      creditScore = 700,
      preferences = {}
    } = params;
    
    console.log(`Analyzing ${loanType} loan options for $${amount} over ${term} months...`);
    
    // Get eligible loan products
    const eligibleProducts = await this.getEligibleProducts(loanType, amount, term, creditScore);
    
    if (eligibleProducts.length === 0) {
      return {
        success: false,
        message: 'No eligible loan products found. Consider improving your credit score or adjusting loan parameters.',
        alternatives: await this.suggestAlternatives(loanType, amount, term, creditScore)
      };
    }
    
    // Calculate metrics for each product
    const analyzedProducts = await this.calculateMetrics(eligibleProducts, amount, term);
    
    // Score and rank the products
    const rankedProducts = this.rankProducts(analyzedProducts, preferences);
    
    // Generate recommendations
    const recommendations = this.generateRecommendations(rankedProducts, params);
    
    // Get educational content
    const educationalContent = this.getEducationalContent(loanType);
    
    return {
      success: true,
      recommendations,
      topOptions: rankedProducts.slice(0, 3),
      allOptions: rankedProducts,
      educationalContent,
      insights: this.generateInsights(rankedProducts, params)
    };
  }
  
  /**
   * Get eligible loan products based on user criteria
   */
  async getEligibleProducts(loanType, amount, term, creditScore) {
    const products = await LoanProduct.find({
      type: loanType,
      minAmount: { $lte: amount },
      maxAmount: { $gte: amount || Number.MAX_SAFE_INTEGER },
      minTerm: { $lte: term },
      maxTerm: { $gte: term || Number.MAX_SAFE_INTEGER },
      minCreditScore: { $lte: creditScore },
      active: true
    }).populate('institution');
    
    return products;
  }
  
  /**
   * Calculate loan metrics for each product
   */
  async calculateMetrics(products, amount, term) {
    const analyzedProducts = [];
    
    for (const product of products) {
      // Get the latest interest rate for this product
      const rateInfo = await RateTrackerService.getLatestRate(product._id);
      
      if (!rateInfo) continue;
      
      // Calculate monthly payment
      const monthlyRate = rateInfo.rate / 100 / 12;
      const monthlyPayment = amount * monthlyRate * Math.pow(1 + monthlyRate, term) / 
        (Math.pow(1 + monthlyRate, term) - 1);
      
      // Calculate total payment and interest
      const totalPayment = monthlyPayment * term;
      const totalInterest = totalPayment - amount;
      
      analyzedProducts.push({
        product,
        interestRate: rateInfo.rate,
        monthlyPayment,
        totalPayment,
        totalInterest,
        apr: this.calculateAPR(rateInfo.rate, product),
        flexibility: this.assessFlexibility(product),
        customerService: this.assessCustomerService(product.institution),
        approvalLikelihood: this.assessApprovalLikelihood(product, rateInfo.creditScoreRange)
      });
    }
    
    return analyzedProducts;
  }
  
  /**
   * Rank products based on user preferences
   */
  rankProducts(analyzedProducts, preferences) {
    // Default weights if no preferences are specified
    const weights = {
      interestRate: preferences.prioritizeRate ? 0.4 : 0.3,
      monthlyPayment: preferences.prioritizePayment ? 0.4 : 0.2,
      customerService: preferences.prioritizeService ? 0.3 : 0.1,
      flexibility: preferences.prioritizeFlexibility ? 0.3 : 0.1,
      approvalLikelihood: preferences.prioritizeApproval ? 0.3 : 0.2
    };
    
    // Normalize weights to sum to 1
    const totalWeight = Object.values(weights).reduce((sum, w) => sum + w, 0);
    Object.keys(weights).forEach(key => {
      weights[key] /= totalWeight;
    });
    
    // Find min and max values for normalization
    const ranges = {
      interestRate: { min: Infinity, max: -Infinity },
      monthlyPayment: { min: Infinity, max: -Infinity },
      totalInterest: { min: Infinity, max: -Infinity },
      apr: { min: Infinity, max: -Infinity }
    };
    
    analyzedProducts.forEach(product => {
      Object.keys(ranges).forEach(key => {
        ranges[key].min = Math.min(ranges[key].min, product[key]);
        ranges[key].max = Math.max(ranges[key].max, product[key]);
      });
    });
    
    // Calculate scores (lower is better for costs)
    const scoredProducts = analyzedProducts.map(product => {
      const scores = {};
      
      // Normalize and invert cost metrics (lower is better)
      scores.interestRate = 1 - this.normalize(product.interestRate, ranges.interestRate.min, ranges.interestRate.max);
      scores.monthlyPayment = 1 - this.normalize(product.monthlyPayment, ranges.monthlyPayment.min, ranges.monthlyPayment.max);
      
      // Other metrics (higher is better)
      scores.customerService = product.customerService;
      scores.flexibility = product.flexibility;
      scores.approvalLikelihood = product.approvalLikelihood;
      
      // Weighted total score
      const totalScore = Object.keys(scores).reduce((sum, key) => {
        return sum + (scores[key] * weights[key]);
      }, 0);
      
      return {
        ...product,
        scores,
        totalScore
      };
    });
    
    // Sort by total score descending
    return scoredProducts.sort((a, b) => b.totalScore - a.totalScore);
  }
  
  /**
   * Generate personalized recommendations
   */
  generateRecommendations(rankedProducts, params) {
    if (rankedProducts.length === 0) {
      return {
        bestOverall: null,
        lowestRate: null,
        lowestPayment: null,
        text: "Based on your criteria, we couldn't find suitable loan options. Consider adjusting your loan amount, term, or improving your credit score."
      };
    }
    
    // Best overall option
    const bestOverall = rankedProducts[0];
    
    // Lowest rate option
    const lowestRate = rankedProducts.slice().sort((a, b) => a.interestRate - b.interestRate)[0];
    
    // Lowest monthly payment
    const lowestPayment = rankedProducts.slice().sort((a, b) => a.monthlyPayment - b.monthlyPayment)[0];
    
    // Generate recommendation text
    let recommendationText = `Based on your ${params.loanType} loan request for $${params.amount} over ${params.term} months, we recommend ${bestOverall.product.institution.name}'s ${bestOverall.product.name}. `;
    
    recommendationText += `This option offers a competitive rate of ${bestOverall.interestRate.toFixed(2)}% with a monthly payment of $${bestOverall.monthlyPayment.toFixed(2)}. `;
    
    if (bestOverall !== lowestRate) {
      recommendationText += `For the absolute lowest interest rate of ${lowestRate.interestRate.toFixed(2)}%, consider ${lowestRate.product.institution.name}'s ${lowestRate.product.name}, though it may have other trade-offs. `;
    }
    
    if (bestOverall !== lowestPayment && lowestRate !== lowestPayment) {
      recommendationText += `If minimizing your monthly payment is most important, ${lowestPayment.product.institution.name}'s ${lowestPayment.product.name} offers the lowest payment at $${lowestPayment.monthlyPayment.toFixed(2)}, but you'll pay more in interest over time. `;
    }
    
    return {
      bestOverall,
      lowestRate,
      lowestPayment,
      text: recommendationText
    };
  }
  
  /**
   * Generate insights about the loan options
   */
  generateInsights(rankedProducts, params) {
    if (rankedProducts.length === 0) {
      return [];
    }
    
    const insights = [];
    
    // Calculate average rate
    const avgRate = rankedProducts.reduce((sum, p) => sum + p.interestRate, 0) / rankedProducts.length;
    
    // Rate trend insight
    insights.push({
      type: 'rate_trend',
      title: 'Interest Rate Trend',
      text: `The average ${params.loanType} loan rate is currently ${avgRate.toFixed(2)}%. This is ${this.getRateTrendText(params.loanType, avgRate)}`
    });
    
    // Credit score impact
    insights.push({
      type: 'credit_impact',
      title: 'Credit Score Impact',
      text: this.getCreditScoreImpactText(params.creditScore, rankedProducts)
    });
    
    // Term length impact
    insights.push({
      type: 'term_impact',
      title: 'Loan Term Consideration',
      text: this.getTermImpactText(params.term, rankedProducts[0])
    });
    
    // Special offers or features
    const specialOffers = this.findSpecialOffers(rankedProducts);
    if (specialOffers) {
      insights.push({
        type: 'special_offers',
        title: 'Special Offers',
        text: specialOffers
      });
    }
    
    return insights;
  }
  
  /**
   * Get educational content about the loan type
   */
  getEducationalContent(loanType) {
    const contentMap = {
      'Mortgage': {
        title: 'Understanding Mortgage Loans',
        description: 'A mortgage is a loan used to purchase real estate, typically a home. The property serves as collateral for the loan, which means it can be seized by the lender if you fail to make payments.',
        keyPoints: [
          'Fixed-rate mortgages keep the same interest rate for the entire term',
          'Adjustable-rate mortgages (ARMs) have rates that can change over time',
          'Conventional loans require a higher credit score but often have better rates',
          'FHA loans are insured by the Federal Housing Administration and are easier to qualify for',
          'VA loans are available to eligible veterans and active military members'
        ],
        videoLinks: [
          {
            title: 'Mortgage Basics Explained',
            url: 'https://example.com/videos/mortgage-basics'
          },
          {
            title: 'How to Choose the Right Mortgage',
            url: 'https://example.com/videos/choose-mortgage'
          }
        ],
        commonTerms: [
          { term: 'Principal', definition: 'The original loan amount' },
          { term: 'Down Payment', definition: 'The initial up-front payment for the property, typically 3-20% of the purchase price' },
          { term: 'Escrow', definition: 'An account where funds are held for taxes and insurance' },
          { term: 'Private Mortgage Insurance (PMI)', definition: 'Insurance required for conventional loans with less than 20% down payment' }
        ]
      },
      'Personal': {
        title: 'Understanding Personal Loans',
        description: 'Personal loans are unsecured loans that can be used for almost any purpose, from debt consolidation to funding major purchases or expenses.',
        keyPoints: [
          'Unsecured loans don\'t require collateral but typically have higher interest rates',
          'Fixed terms and predictable monthly payments make budgeting easier',
          'No restrictions on how funds can be used in most cases',
          'Can be a good option for consolidating high-interest debt'
        ],
        videoLinks: [
          {
            title: 'Personal Loan Basics',
            url: 'https://example.com/videos/personal-loan-basics'
          },
          {
            title: 'When to Use a Personal Loan',
            url: 'https://example.com/videos/when-to-use-personal-loan'
          }
        ],
        commonTerms: [
          { term: 'Origination Fee', definition: 'A fee charged for processing the loan, typically 1-8% of the loan amount' },
          { term: 'Prepayment Penalty', definition: 'A fee charged if you pay off the loan early' },
          { term: 'Unsecured Loan', definition: 'A loan that doesn\'t require collateral' },
          { term: 'Debt-to-Income Ratio', definition: 'Your monthly debt payments divided by your gross monthly income' }
        ]
      },
      // Add other loan types...
    };
    
    return contentMap[loanType] || {
      title: `Understanding ${loanType} Loans`,
      description: `Learn about ${loanType} loans and how they work.`,
      keyPoints: ['Research interest rates', 'Compare loan terms', 'Understand loan requirements'],
      videoLinks: [],
      commonTerms: []
    };
  }
  
  // Helper methods
  
  calculateAPR(interestRate, product) {
    // In a real system, this would include fees and other costs
    // For now, we'll add a simple estimation
    return interestRate + (product.fees ? 0.5 : 0);
  }
  
  assessFlexibility(product) {
    // Score 0-1 based on prepayment penalties, payment options, etc.
    let score = 0.5; // Default middle score
    
    if (product.perks.some(perk => perk.includes('No prepayment'))) {
      score += 0.2;
    }
    
    if (product.perks.some(perk => perk.includes('payment options'))) {
      score += 0.2;
    }
    
    return Math.min(score, 1); // Cap at 1
  }
  
  assessCustomerService(institution) {
    // In a real system, this would use customer reviews and ratings
    // For now, we'll use a random value between 0.6 and 0.95
    return 0.6 + Math.random() * 0.35;
  }
  
  assessApprovalLikelihood(product, creditScoreRange) {
    // Higher score means more likely to be approved
    return Math.min(1, (creditScoreRange.max - creditScoreRange.min) / 200);
  }
  
  normalize(value, min, max) {
    if (min === max) return 0.5;
    return (value - min) / (max - min);
  }
  
  getRateTrendText(loanType, currentRate) {
    // In a real system, this would compare to historical data
    // For demonstration, we'll use fixed comparisons
    const trendMap = {
      'Mortgage': { avg: 5.5, trend: 'rising' },
      'Personal': { avg: 8.0, trend: 'stable' },
      'Auto': { avg: 4.0, trend: 'rising' },
      'Student': { avg: 5.5, trend: 'falling' },
      'Business': { avg: 7.0, trend: 'rising' }
    };
    
    const trend = trendMap[loanType] || { avg: 6.0, trend: 'stable' };
    
    if (currentRate < trend.avg - 0.5) {
      return `below the average rate and is currently ${trend.trend}.`;
    } else if (currentRate > trend.avg + 0.5) {
      return `above the average rate and is currently ${trend.trend}.`;
    } else {
      return `around the average rate and is currently ${trend.trend}.`;
    }
  }
  
  getCreditScoreImpactText(creditScore, products) {
    if (creditScore >= 750) {
      return "Your excellent credit score qualifies you for the most competitive rates. You're in a strong position to negotiate terms.";
    } else if (creditScore >= 700) {
      return "Your good credit score qualifies you for competitive rates, though you might not get the absolute lowest rates available.";
    } else if (creditScore >= 650) {
      return "Your fair credit score limits some options. Improving your score by 50+ points could save you significantly on interest.";
    } else {
      return "Your credit score is limiting your options and increasing costs. Consider credit improvement strategies or secured loan options.";
    }
  }
  
  getTermImpactText(term, topProduct) {
    const termYears = term / 12;
    
    if (term <= 36) {
      return `Your ${termYears}-year term means higher monthly payments but less total interest. You'll pay approximately $${topProduct.totalInterest.toFixed(2)} in interest over the loan life.`;
    } else if (term <= 60) {
      return `Your ${termYears}-year term balances monthly payments with total interest cost. You'll pay approximately $${topProduct.totalInterest.toFixed(2)} in interest over the loan life.`;
    } else {
      return `Your ${termYears}-year term gives you lower monthly payments but increases total interest. You'll pay approximately $${topProduct.totalInterest.toFixed(2)} in interest over the loan life.`;
    }
  }
  
  findSpecialOffers(products) {
    // Look for unique perks and offers
    const uniquePerks = new Set();
    
    products.forEach(product => {
      product.product.perks.forEach(perk => uniquePerks.add(perk));
    });
    
    if (uniquePerks.size === 0) return null;
    
    const perksList = Array.from(uniquePerks).slice(0, 3);
    return `Some institutions offer special benefits including: ${perksList.join(', ')}. Consider these perks when making your decision.`;
  }
  
  async suggestAlternatives(loanType, amount, term, creditScore) {
    const alternatives = [];
    
    // Try finding products with lower credit requirement
    const lowerCreditOptions = await LoanProduct.find({
      type: loanType,
      minAmount: { $lte: amount },
      maxAmount: { $gte: amount || Number.MAX_SAFE_INTEGER },
      minTerm: { $lte: term },
      maxTerm: { $gte: term || Number.MAX_SAFE_INTEGER },
      minCreditScore: { $lt: creditScore - 30 },
      active: true
    }).limit(2);
    
    if (lowerCreditOptions.length > 0) {
      alternatives.push({
        type: 'lower_credit_options',
        title: 'Options for Lower Credit Scores',
        products: lowerCreditOptions
      });
    }
    
    // Try finding products with different terms
    const differentTermOptions = await LoanProduct.find({
      type: loanType,
      minAmount: { $lte: amount },
      maxAmount: { $gte: amount || Number.MAX_SAFE_INTEGER },
      minCreditScore: { $lte: creditScore },
      active: true,
      $or: [
        { minTerm: { $lte: term - 12 } },
        { maxTerm: { $gte: term + 12 } }
      ]
    }).limit(2);
    
    if (differentTermOptions.length > 0) {
      alternatives.push({
        type: 'different_term_options',
        title: 'Options with Different Loan Terms',
        products: differentTermOptions
      });
    }
    
    // Suggest different loan types if appropriate
    if (loanType === 'Personal' && amount >= 25000) {
      alternatives.push({
        type: 'different_loan_type',
        title: 'Consider a Home Equity Loan',
        description: 'For larger amounts, a home equity loan might offer lower interest rates if you own a home with sufficient equity.'
      });
    }
    
    return alternatives;
  }
}

module.exports = new AIAnalysisService();
