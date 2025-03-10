// frontend/src/components/comparison/LoanComparison.jsx
import React, { useState, useEffect } from 'react';

const LoanComparison = () => {
  // In a real app, this would come from an API
  const [institutions, setInstitutions] = useState([
    {
      id: 1,
      name: "First National Bank",
      loanTypes: ["Mortgage", "Personal", "Auto"],
      rates: { "Mortgage": 4.5, "Personal": 7.2, "Auto": 3.8 },
      minCreditScore: 680,
      processingTime: "2-3 business days",
      perks: ["No origination fee", "0.25% rate discount with autopay"]
    },
    {
      id: 2,
      name: "Community Credit Union",
      loanTypes: ["Mortgage", "Personal", "Auto", "Student"],
      rates: { "Mortgage": 4.35, "Personal": 6.9, "Auto": 3.5, "Student": 5.1 },
      minCreditScore: 650,
      processingTime: "1-2 business days",
      perks: ["No prepayment penalty", "Financial education resources"]
    },
    {
      id: 3,
      name: "Global Financial",
      loanTypes: ["Mortgage", "Personal", "Business"],
      rates: { "Mortgage": 4.6, "Personal": 7.8, "Business": 6.2 },
      minCreditScore: 720,
      processingTime: "3-5 business days",
      perks: ["Rate lock guarantee", "Relationship discounts"]
    }
  ]);

  const [selectedLoanType, setSelectedLoanType] = useState("Mortgage");
  const [loanAmount, setLoanAmount] = useState(250000);
  const [loanTerm, setLoanTerm] = useState(30);
  
  const [comparisons, setComparisons] = useState([]);

  useEffect(() => {
    const filteredInstitutions = institutions.filter(
      inst => inst.loanTypes.includes(selectedLoanType)
    );
    
    const comparisonResults = filteredInstitutions.map(inst => {
      const rate = inst.rates[selectedLoanType];
      const monthlyRate = rate / 100 / 12;
      const totalMonths = loanTerm * 12;
      
      const monthlyPayment = loanAmount * monthlyRate * Math.pow(1 + monthlyRate, totalMonths) / 
        (Math.pow(1 + monthlyRate, totalMonths) - 1);
      
      const totalPayment = monthlyPayment * totalMonths;
      const totalInterest = totalPayment - loanAmount;
      
      return {
        ...inst,
        rate,
        monthlyPayment,
        totalPayment,
        totalInterest
      };
    });
    
    // Sort by monthly payment (lowest first)
    comparisonResults.sort((a, b) => a.monthlyPayment - b.monthlyPayment);
    
    setComparisons(comparisonResults);
  }, [selectedLoanType, loanAmount, loanTerm, institutions]);

  return (
    <div className="loan-comparison p-6 bg-white rounded-lg shadow-lg">
      <h2 className="text-2xl font-bold mb-6">Compare Loan Offers</h2>
      
      <div className="flex flex-col md:flex-row gap-4 mb-6">
        <div className="form-group flex-1">
          <label className="block text-sm font-medium mb-2">Loan Type</label>
          <select
            value={selectedLoanType}
            onChange={(e) => setSelectedLoanType(e.target.value)}
            className="w-full p-2 border rounded"
          >
            <option value="Mortgage">Mortgage</option>
            <option value="Personal">Personal Loan</option>
            <option value="Auto">Auto Loan</option>
            <option value="Student">Student Loan</option>
            <option value="Business">Business Loan</option>
          </select>
        </div>
        
        <div className="form-group flex-1">
          <label className="block text-sm font-medium mb-2">Loan Amount ($)</label>
          <input
            type="number"
            value={loanAmount}
            onChange={(e) => setLoanAmount(Number(e.target.value))}
            className="w-full p-2 border rounded"
          />
        </div>
        
        <div className="form-group flex-1">
          <label className="block text-sm font-medium mb-2">Loan Term (years)</label>
          <input
            type="number"
            value={loanTerm}
            onChange={(e) => setLoanTerm(Number(e.target.value))}
            className="w-full p-2 border rounded"
          />
        </div>
      </div>
      
      <div className="comparison-results overflow-x-auto">
        <table className="min-w-full bg-white border">
          <thead>
            <tr className="bg-gray-100">
              <th className="py-3 px-4 text-left">Institution</th>
              <th className="py-3 px-4 text-left">Interest Rate</th>
              <th className="py-3 px-4 text-left">Monthly Payment</th>
              <th className="py-3 px-4 text-left">Total Interest</th>
              <th className="py-3 px-4 text-left">Min Credit Score</th>
              <th className="py-3 px-4 text-left">Perks</th>
              <th className="py-3 px-4 text-left">Action</th>
            </tr>
          </thead>
          <tbody>
            {comparisons.map((item) => (
              <tr key={item.id} className="border-t hover:bg-gray-50">
                <td className="py-3 px-4">{item.name}</td>
                <td className="py-3 px-4">{item.rate.toFixed(2)}%</td>
                <td className="py-3 px-4">${item.monthlyPayment.toFixed(2)}</td>
                <td className="py-3 px-4">${item.totalInterest.toFixed(2)}</td>
                <td className="py-3 px-4">{item.minCreditScore}</td>
                <td className="py-3 px-4">
                  <ul className="list-disc pl-4">
                    {item.perks.map((perk, index) => (
                      <li key={index} className="text-sm">{perk}</li>
                    ))}
                  </ul>
                </td>
                <td className="py-3 px-4">
                  <button className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 text-sm">
                    Apply Now
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      
      <div className="mt-4 text-sm text-gray-500">
        <p>* Rates and offers are for illustration purposes only. Actual rates may vary based on credit score, location, and other factors.</p>
      </div>
    </div>
  );
};

export default LoanComparison;
