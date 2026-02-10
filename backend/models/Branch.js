const mongoose = require('mongoose');

const branchSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Branch name is required'],
    unique: true,
    trim: true,
    minlength: [2, 'Branch name must be at least 2 characters'],
    maxlength: [100, 'Branch name cannot exceed 100 characters']
  },
  branchCode: {
    type: String,
    required: [true, 'Branch code is required'],
    unique: true,
    trim: true,
    match: [/^\d{4}$/, 'Branch code must be exactly 4 digits']
  },
  address: {
    type: String,
    trim: true,
    maxlength: [200, 'Address cannot exceed 200 characters']
  },
  description: {
    type: String,
    trim: true,
    maxlength: [500, 'Description cannot exceed 500 characters']
  },
  assignedCollector: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  memberCount: {
    type: Number,
    default: 0
  },
  totalSavings: {
    type: Number,
    default: 0
  },
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
  }
}, {
  timestamps: true
});

// Index for better query performance
branchSchema.index({ branchCode: 1 });
branchSchema.index({ assignedCollector: 1 });
branchSchema.index({ isActive: 1 });

// Virtual for member count (can be populated from Member model)
branchSchema.virtual('members', {
  ref: 'Member',
  localField: '_id',
  foreignField: 'branch',
  match: { isActive: true }
});

// Pre-save middleware to update memberCount
branchSchema.pre('save', async function(next) {
  if (this.isModified('memberCount')) {
    // Update total savings if needed
    const Member = mongoose.model('Member');
    const members = await Member.find({ branch: this._id, isActive: true });
    this.totalSavings = members.reduce((sum, member) => sum + (member.totalSavings || 0), 0);
  }
  next();
});

module.exports = mongoose.model('Branch', branchSchema);
