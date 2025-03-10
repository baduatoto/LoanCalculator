// frontend/src/components/calculator/LoanCalculator.jsx
import React, { useState, useEffect } from 'react';

const LoanCalculator = () => {
  const [loanAmount, setLoanAmount] = useState(10000);
  const [interestRate, setInterestRate] = useState(5);
  const [loanTerm, setLoanTerm] = useState(5);
  const [paymentFrequency, setPaymentFrequency] = useState('monthly');
  const [monthlyPayment, setMonthlyPayment] = useState(0);
  const [totalPayment, setTotalPayment] = useState(0);
  const [totalInterest, setTotalInterest] = useState(0);

  useEffect(() => {
    calculateLoan();
  }, [loanAmount, interestRate, loanTerm, paymentFrequency]);

  const calculateLoan = () => {
    // Convert annual interest rate to monthly
    const monthlyRate = interestRate / 100 / 12;
    
    // Convert years to months
    const totalMonths = loanTerm * 12;
    
    // Calculate monthly payment using the formula: P = L[i(1+i)^n]/[(1+i)^n-1]
    // Where P = monthly payment, L = loan amount, i = monthly interest rate, n = total months
    const monthlyPaymentAmount = loanAmount * monthlyRate * Math.pow(1 + monthlyRate, totalMonths) / (Math.pow(1 + monthlyRate, totalMonths) - 1);
    
    // Calculate total payment
    const totalPaymentAmount = monthlyPaymentAmount * totalMonths;
    
    // Calculate total interest
    const totalInterestAmount = totalPaymentAmount - loanAmount;

    setMonthlyPayment(monthlyPaymentAmount.toFixed(2));
    setTotalPayment(totalPaymentAmount.toFixed(2));
    setTotalInterest(totalInterestAmount.toFixed(2));
  };

  return (
    <div className="loan-calculator p-6 bg-white rounded-lg shadow-lg">
      <h2 className="text-2xl font-bold mb-6">Loan Calculator</h2>
      
      <div className="form-group mb-4">
        <label className="block text-sm font-medium mb-2">Loan Amount ($)</label>
        <input
          type="number"
          value={loanAmount}
          onChange={(e) => setLoanAmount(Number(e.target.value))}
          className="w-full p-2 border rounded"
        />
      </div>
      
      <div className="form-group mb-4">
        <label className="block text-sm font-medium mb-2">Interest Rate (%)</label>
        <input
          type="number"
          step="0.1"
          value={interestRate}
          onChange={(e) => setInterestRate(Number(e.target.value))}
          className="w-full p-2 border rounded"
        />
      </div>
      
      <div className="form-group mb-4">
        <label className="block text-sm font-medium mb-2">Loan Term (years)</label>
        <input
          type="number"
          value={loanTerm}
          onChange={(e) => setLoanTerm(Number(e.target.value))}
          className="w-full p-2 border rounded"
        />
      </div>
      
      <div className="form-group mb-4">
        <label className="block text-sm font-medium mb-2">Payment Frequency</label>
        <select
          value={paymentFrequency}
          onChange={(e) => setPaymentFrequency(e.target.value)}
          className="w-full p-2 border rounded"
        >
          <option value="monthly">Monthly</option>
          <option value="biweekly">Bi-weekly</option>
          <option value="weekly">Weekly</option>
        </select>
      </div>
      
      <div className="results mt-6 p-4 bg-gray-50 rounded">
        <div className="result-item flex justify-between py-2">
          <span className="font-medium">Monthly Payment:</span>
          <span className="font-bold">${monthlyPayment}</span>
        </div>
        <div className="result-item flex justify-between py-2">
          <span className="font-medium">Total Payment:</span>
          <span className="font-bold">${totalPayment}</span>
        </div>
        <div className="result-item flex justify-between py-2">
          <span className="font-medium">Total Interest:</span>
          <span className="font-bold">${totalInterest}</span>
        </div>
      </div>
    </div>
  );
};

export default LoanCalculator;
