const mongoose = require('mongoose');

const distributionSchema = new mongoose.Schema({
  // Distribution details
  distributionId: {
    type: String,
    unique: true,
    required: true
  },
  title: {
    type: String,
    required: [true, 'Distribution title is required'],
    trim: true,
    maxlength: [200, 'Title cannot exceed 200 characters']
  },
  description: {
    type: String,
    trim: true,
    maxlength: [1000, 'Description cannot exceed 1000 characters']
  },
  distributionDate: {
    type: Date,
    required: [true, 'Distribution date is required'],
    default: Date.now
  },
  location: {
    address: {
      type: String,
      required: [true, 'Distribution address is required'],
      trim: true
    },
    branch: {
      type: String,
      required: [true, 'Branch is required'],
      trim: true
    },
    coordinates: {
      latitude: Number,
      longitude: Number
    }
  },
  // Products being distributed
  products: [{
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true
    },
    quantity: {
      type: Number,
      required: [true, 'Product quantity is required'],
      min: [1, 'Quantity must be at least 1']
    },
    unitPrice: {
      type: Number,
      required: true,
      min: [0, 'Unit price cannot be negative']
    },
    totalValue: {
      type: Number,
      required: true,
      min: [0, 'Total value cannot be negative']
    },
    distributedQuantity: {
      type: Number,
      default: 0,
      min: [0, 'Distributed quantity cannot be negative']
    },
    remainingQuantity: {
      type: Number,
      default: 0,
      min: [0, 'Remaining quantity cannot be negative']
    }
  }],
  // Members who received products
  recipients: [{
    member: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Member',
      required: true
    },
    receivedProducts: [{
      product: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Product',
        required: true
      },
      quantity: {
        type: Number,
        required: true,
        min: [1, 'Quantity must be at least 1']
      },
      unitPrice: {
        type: Number,
        required: true
      },
      totalValue: {
        type: Number,
        required: true
      }
    }],
    receivedAt: {
      type: Date,
      default: Date.now
    },
    signature: {
      type: String, // Base64 encoded signature
      default: null
    },
    notes: {
      type: String,
      trim: true,
      maxlength: [500, 'Notes cannot exceed 500 characters']
    }
  }],
  // Distribution management
  assignedCollector: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  status: {
    type: String,
    enum: ['Planned', 'In Progress', 'Completed', 'Cancelled'],
    default: 'Planned'
  },
  totalValue: {
    type: Number,
    default: 0,
    min: [0, 'Total value cannot be negative']
  },
  distributedValue: {
    type: Number,
    default: 0,
    min: [0, 'Distributed value cannot be negative']
  },
  totalRecipients: {
    type: Number,
    default: 0,
    min: [0, 'Total recipients cannot be negative']
  },
  // Tracking
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  completedAt: {
    type: Date,
    default: null
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Indexes for better performance
distributionSchema.index({ distributionId: 1 });
distributionSchema.index({ distributionDate: 1 });
distributionSchema.index({ status: 1 });
distributionSchema.index({ assignedCollector: 1 });
distributionSchema.index({ 'location.branch': 1 });

// Virtual for completion percentage
distributionSchema.virtual('completionPercentage').get(function() {
  if (this.totalValue === 0) return 0;
  return Math.round((this.distributedValue / this.totalValue) * 100);
});

// Virtual for remaining value
distributionSchema.virtual('remainingValue').get(function() {
  return this.totalValue - this.distributedValue;
});

// Pre-save middleware to generate distribution ID
distributionSchema.pre('save', function(next) {
  if (this.isNew && !this.distributionId) {
    const date = new Date();
    const year = date.getFullYear().toString().slice(-2);
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    this.distributionId = `DIST${year}${month}${day}${random}`;
  }
  
  // Calculate totals
  this.totalValue = this.products.reduce((sum, product) => sum + product.totalValue, 0);
  this.distributedValue = this.recipients.reduce((sum, recipient) => {
    return sum + recipient.receivedProducts.reduce((productSum, product) => {
      return productSum + product.totalValue;
    }, 0);
  }, 0);
  this.totalRecipients = this.recipients.length;
  
  // Update product remaining quantities
  this.products.forEach(product => {
    const distributed = this.recipients.reduce((sum, recipient) => {
      const receivedProduct = recipient.receivedProducts.find(rp => 
        rp.product.toString() === product.product.toString()
      );
      return sum + (receivedProduct ? receivedProduct.quantity : 0);
    }, 0);
    product.distributedQuantity = distributed;
    product.remainingQuantity = product.quantity - distributed;
  });
  
  // Update status based on completion
  if (this.distributedValue >= this.totalValue && this.status !== 'Cancelled') {
    this.status = 'Completed';
    if (!this.completedAt) {
      this.completedAt = new Date();
    }
  } else if (this.distributedValue > 0 && this.status === 'Planned') {
    this.status = 'In Progress';
  }
  
  next();
});

// Ensure virtuals are included in JSON output
distributionSchema.set('toJSON', { virtuals: true });
distributionSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Distribution', distributionSchema);
