// backend/src/models/Institution.js
const mongoose = require('mongoose');

const InstitutionSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  logoUrl: {
    type: String
  },
  website: {
    type: String
  },
  contactInfo: {
    phone: String,
    email: String,
    address: String
  },
  types: {
    type: [String],
    enum: ['Bank', 'Credit Union', 'Online Lender', 'Mortgage Company', 'Other'],
    default: ['Other']
  },
  active: {
    type: Boolean,
    default: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

const Institution = mongoose.model('Institution', InstitutionSchema);

module.exports = Institution;

// backend/src/models/LoanProduct.js
const mongoose = require('mongoose');

const LoanProductSchema = new mongoose.Schema({
  institution: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Institution',
    required: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  type: {
    type: String,
    required: true,
    enum: ['Mortgage', 'Personal', 'Auto', 'Student', 'Business', 'Home Equity', 'Credit Card', 'Other']
  },
  description: {
    type: String,
    trim: true
  },
  minAmount: {
    type: Number,
    default: 0
  },
  maxAmount: {
    type: Number
  },
  minTerm: {
    type: Number, // in months
    default: 1
  },
  maxTerm: {
    type: Number // in months
  },
  baseRate: {
    type: Number,
    required: true
  },
  variableRate: {
    type: Boolean,
    default: false
  },
  minCreditScore: {
    type: Number
  },
  perks: {
    type: [String]
  },
  requirements: {
    type: [String]
  },
  processingTime: {
    type: String
  },
  active: {
    type: Boolean,
    default: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

const LoanProduct = mongoose.model('LoanProduct', LoanProductSchema);

module.exports = LoanProduct;

// backend/src/models/InterestRate.js
const mongoose = require('mongoose');

const InterestRateSchema = new mongoose.Schema({
  loanProduct: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'LoanProduct',
    required: true
  },
  date: {
    type: Date,
    default: Date.now,
    required: true
  },
  rate: {
    type: Number,
    required: true
  },
  termLength: {
    type: Number, // in months
    required: true
  },
  creditScoreRange: {
    min: Number,
    max: Number
  },
  // Additional conditions that might affect the rate
  conditions: {
    type: Map,
    of: String
  }
});

// Create a compound index to quickly find rates for a specific product and date
InterestRateSchema.index({ loanProduct: 1, date: -1 });

const InterestRate = mongoose.model('InterestRate', InterestRateSchema);

module.exports = InterestRate;

// backend/src/models/User.js
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const UserSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true
  },
  password: {
    type: String,
    required: true
  },
  firstName: {
    type: String,
    trim: true
  },
  lastName: {
    type: String,
    trim: true
  },
  profilePicture: {
    type: String
  },
  role: {
    type: String,
    enum: ['user', 'admin'],
    default: 'user'
  },
  preferences: {
    loanTypes: [String],
    notifications: {
      email: {
        type: Boolean,
        default: true
      },
      rateAlerts: {
        type: Boolean,
        default: false
      }
    }
  },
  savedComparisons: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Comparison'
  }],
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Pre-save hook to hash password
UserSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Method to compare passwords
UserSchema.methods.comparePassword = async function(candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

const User = mongoose.model('User', UserSchema);

module.exports = User;
