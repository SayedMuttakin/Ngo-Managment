const mongoose = require('mongoose');

const collectionScheduleSchema = new mongoose.Schema({
  collector: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Collector is required']
  },
  collectionDay: {
    type: String,
    enum: ['Saturday', 'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Daily'],
    required: false, // Optional for daily collectors
    default: null
  },
  branches: [{
    branchCode: {
      type: String,
      required: [true, 'Branch code is required']
    },
    branchName: {
      type: String,
      required: [true, 'Branch name is required']
    },
    members: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Member'
    }]
  }],
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

// Indexes
collectionScheduleSchema.index({ collector: 1, collectionDay: 1 });
collectionScheduleSchema.index({ 'branches.branchCode': 1 });

// Update updatedAt field before saving
collectionScheduleSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Static method to get collector schedule by day
collectionScheduleSchema.statics.findByCollectorAndDay = function(collectorId, day) {
  return this.findOne({
    collector: collectorId,
    collectionDay: day,
    isActive: true
  }).populate('collector', 'name email')
    .populate('branches.members', 'name phone monthlyInstallment totalSavings status');
};

// Static method to get all collectors for a specific day
collectionScheduleSchema.statics.findCollectorsByDay = function(day) {
  return this.find({
    collectionDay: day,
    isActive: true
  }).populate('collector', 'name email phone')
    .populate('branches.members', 'name phone monthlyInstallment totalSavings status');
};

module.exports = mongoose.model('CollectionSchedule', collectionScheduleSchema);