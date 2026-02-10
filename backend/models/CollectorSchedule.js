const mongoose = require('mongoose');

const collectorScheduleSchema = new mongoose.Schema({
  collectorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true
  },
  schedules: [{
    date: {
      type: Date,
      required: true
    },
    weekNumber: {
      type: Number,
      required: true
    },
    type: {
      type: String,
      enum: ['Loan & Savings', 'Loan Only', 'Savings Only'],
      default: 'Loan & Savings'
    },
    isActive: {
      type: Boolean,
      default: true
    }
  }],
  month: {
    type: String,
    required: true
  },
  year: {
    type: Number,
    required: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  lastModifiedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

// Index for faster queries
collectorScheduleSchema.index({ collectorId: 1, year: 1, month: 1 });
collectorScheduleSchema.index({ 'schedules.date': 1 });

// Method to get next collection date from a given date
collectorScheduleSchema.methods.getNextCollectionDate = function(fromDate) {
  const scheduleDate = new Date(fromDate);
  scheduleDate.setHours(0, 0, 0, 0);
  
  const futureDates = this.schedules
    .filter(schedule => {
      const sDate = new Date(schedule.date);
      sDate.setHours(0, 0, 0, 0);
      return schedule.isActive && sDate > scheduleDate;
    })
    .sort((a, b) => new Date(a.date) - new Date(b.date));
  
  return futureDates.length > 0 ? futureDates[0].date : null;
};

// Method to get all future collection dates from a given date
collectorScheduleSchema.methods.getFutureCollectionDates = function(fromDate, limit = null) {
  const scheduleDate = new Date(fromDate);
  scheduleDate.setHours(0, 0, 0, 0);
  
  let futureDates = this.schedules
    .filter(schedule => {
      const sDate = new Date(schedule.date);
      sDate.setHours(0, 0, 0, 0);
      return schedule.isActive && sDate > scheduleDate;
    })
    .sort((a, b) => new Date(a.date) - new Date(b.date))
    .map(schedule => schedule.date);
  
  if (limit && limit > 0) {
    futureDates = futureDates.slice(0, limit);
  }
  
  return futureDates;
};

// Static method to get collector's active schedule
collectorScheduleSchema.statics.getActiveSchedule = async function(collectorId) {
  const currentDate = new Date();
  const currentMonth = currentDate.toLocaleString('default', { month: 'long' });
  const currentYear = currentDate.getFullYear();
  
  return await this.findOne({
    collectorId,
    month: currentMonth,
    year: currentYear
  });
};

const CollectorSchedule = mongoose.model('CollectorSchedule', collectorScheduleSchema);

module.exports = CollectorSchedule;