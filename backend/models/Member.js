const mongoose = require('mongoose');

const memberSchema = new mongoose.Schema({
  name: {
    type: String,
    required: false, // Made optional
    trim: true,
    maxlength: [100, 'Name cannot be more than 100 characters']
  },
  memberCode: {
    type: String,
    required: true, // ✅ Make required
    unique: true, // ✅ GLOBALLY UNIQUE - no duplicates across any branch
    trim: true,
    match: [/^\d{3}$/, 'Member code must be exactly 3 digits (e.g., 001, 002)']
  },
  sponsorName: {
    type: String,
    trim: true,
    maxlength: [100, 'Sponsor name cannot be more than 100 characters']
  },
  age: {
    type: Number,
    required: false, // Made optional
    // Removed min/max validation
  },
  phone: {
    type: String,
    required: false, // Made optional
    // Removed phone number pattern validation
  },
  joinDate: {
    type: Date,
    required: false, // Made optional
    default: Date.now
  },
  nidNumber: {
    type: String,
    required: false, // Made optional
    // Removed unique constraint and length validation to allow any input
    trim: true
  },
  branch: {
    type: String,
    required: false, // Made optional
    trim: true
  },
  branchCode: {
    type: String,
    required: false, // Made optional
    // Removed branch code pattern validation
  },
  status: {
    type: String,
    enum: ['Active', 'Inactive', 'Pending'],
    default: 'Active'
  },
  totalSavings: {
    type: Number,
    default: 0
    // Removed min validation
  },
  profileImage: {
    type: String,
    default: null
  },
  // Collector who manages this member
  assignedCollector: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: false
  },
  // Financial information
  monthlyInstallment: {
    type: Number,
    default: 0,
    min: [0, 'Monthly installment cannot be negative']
  },
  totalPaid: {
    type: Number,
    default: 0,
    min: [0, 'Total paid cannot be negative']
  },
  lastPaymentDate: {
    type: Date,
    default: null
  },
  // Additional information
  address: {
    type: String,
    trim: true,
    maxlength: [200, 'Address cannot be more than 200 characters']
  },
  emergencyContact: {
    name: {
      type: String,
      trim: true,
      maxlength: [100, 'Emergency contact name cannot be more than 100 characters']
    },
    phone: {
      type: String,
      match: [/^01[3-9]\d{8}$/, 'Please enter a valid Bangladeshi phone number']
    },
    relation: {
      type: String,
      trim: true,
      maxlength: [50, 'Relation cannot be more than 50 characters']
    }
  },
  // Tracking fields
  isActive: {
    type: Boolean,
    default: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Indexes for better performance
memberSchema.index({ nidNumber: 1 });
memberSchema.index({ branchCode: 1 });
memberSchema.index({ status: 1 });
memberSchema.index({ assignedCollector: 1 });
memberSchema.index({ createdAt: -1 });
// ✅ memberCode is globally unique (defined in schema above)
// Removed compound index - memberCode is now unique across ALL branches

// Update updatedAt field before saving
memberSchema.pre('save', function (next) {
  this.updatedAt = Date.now();
  next();
});

// Virtual for member's full info
memberSchema.virtual('fullInfo').get(function () {
  return {
    id: this._id,
    name: this.name,
    phone: this.phone,
    branch: this.branch,
    status: this.status,
    totalSavings: this.totalSavings
  };
});

// Static method to get members by branch
memberSchema.statics.findByBranch = function (branchCode) {
  return this.find({ branchCode, isActive: true });
};

// Static method to get members by collector
memberSchema.statics.findByCollector = function (collectorId) {
  return this.find({ assignedCollector: collectorId, isActive: true });
};

// Static method to get members by status
memberSchema.statics.findByStatus = function (status) {
  return this.find({ status, isActive: true });
};

// Instance method to calculate total due
memberSchema.methods.calculateTotalDue = function () {
  // This will be implemented when we add installments
  return 0;
};

// Instance method to get member summary
memberSchema.methods.getSummary = function () {
  return {
    id: this._id,
    name: this.name,
    phone: this.phone,
    branch: this.branch,
    branchCode: this.branchCode,
    status: this.status,
    totalSavings: this.totalSavings,
    monthlyInstallment: this.monthlyInstallment,
    totalPaid: this.totalPaid,
    joinDate: this.joinDate,
    lastPaymentDate: this.lastPaymentDate
  };
};

module.exports = mongoose.model('Member', memberSchema);
