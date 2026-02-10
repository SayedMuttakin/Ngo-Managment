const express = require('express');
const CollectionSchedule = require('../models/CollectionSchedule');
const User = require('../models/User');
const Member = require('../models/Member');
const { protect, authorize } = require('../middleware/auth');
const { body, validationResult } = require('express-validator');

const router = express.Router();

// Validation middleware for schedule creation/update
const validateSchedule = [
  body('collectorId')
    .isMongoId()
    .withMessage('Valid collector ID is required'),
  
  body('collectionDay')
    .optional() // Make optional for daily collectors
    .isIn(['Saturday', 'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Daily'])
    .withMessage('Invalid collection day'),
  
  body('branches')
    .isArray({ min: 1 })
    .withMessage('At least one branch is required'),
  
  body('branches.*.branchCode')
    .matches(/^\d{4}$/)
    .withMessage('Branch code must be 4 digits'),
  
  body('branches.*.branchName')
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Branch name must be between 2 and 100 characters'),
  
  body('branches.*.members')
    .optional()
    .isArray()
    .withMessage('Members must be an array'),
  
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }
    next();
  }
];

// @desc    Create collection schedule
// @route   POST /api/schedules
// @access  Private (Admin/Manager only)
router.post('/', protect, authorize('admin', 'manager'), validateSchedule, async (req, res) => {
  try {
    const { collectorId, collectionDay, branches } = req.body;

    // Check if collector exists and has collector role
    const collector = await User.findById(collectorId);
    if (!collector || !collector.isActive) {
      return res.status(404).json({
        success: false,
        message: 'Collector not found'
      });
    }

    if (collector.role !== 'collector') {
      return res.status(400).json({
        success: false,
        message: 'User must have collector role'
      });
    }

    // Check if schedule already exists for this collector and day
    const existingSchedule = await CollectionSchedule.findOne({
      collector: collectorId,
      collectionDay,
      isActive: true
    });

    // 🎯 Check if branch codes are already assigned to other collectors
    const Branch = require('../models/Branch');
    for (const branch of branches) {
      // Check Branch model
      const branchInModel = await Branch.findOne({
        branchCode: branch.branchCode,
        assignedCollector: { $ne: null, $ne: collectorId },
        isActive: true
      });
      
      if (branchInModel) {
        return res.status(400).json({
          success: false,
          message: `Branch ${branch.branchCode} is already assigned to another collector`
        });
      }
      
      // Check other CollectionSchedules (including other days for same collector)
      const scheduleWithBranch = await CollectionSchedule.findOne({
        'branches.branchCode': branch.branchCode,
        collector: { $ne: collectorId },
        isActive: true
      });
      
      if (scheduleWithBranch) {
        return res.status(400).json({
          success: false,
          message: `Branch ${branch.branchCode} is already assigned to another collector`
        });
      }
      
      // Check same collector's other days
      const sameCollectorOtherDay = await CollectionSchedule.findOne({
        'branches.branchCode': branch.branchCode,
        collector: collectorId,
        collectionDay: { $ne: collectionDay },
        isActive: true
      });
      
      if (sameCollectorOtherDay) {
        return res.status(400).json({
          success: false,
          message: `Branch ${branch.branchCode} is already assigned to this collector on ${sameCollectorOtherDay.collectionDay}`
        });
      }
    }
    
    if (existingSchedule) {
      // 🎯 NEW: If schedule exists, add new branches to it
      console.log(`✅ Schedule exists for ${collector.name} on ${collectionDay} - Adding branches`);
      
      // Check for duplicate branch codes within this schedule
      for (const newBranch of branches) {
        const duplicate = existingSchedule.branches.find(
          b => b.branchCode === newBranch.branchCode
        );
        if (duplicate) {
          return res.status(400).json({
            success: false,
            message: `Branch code ${newBranch.branchCode} already exists in this schedule`
          });
        }
      }
      
      // Add new branches
      existingSchedule.branches.push(...branches);
      existingSchedule.updatedBy = req.user.id;
      await existingSchedule.save();
      
      console.log(`✅ Added ${branches.length} branch(es) to existing schedule`);
      
      return res.status(200).json({
        success: true,
        message: `Branch(es) added successfully to ${collectionDay} schedule`,
        data: existingSchedule
      });
    }

    // Validate member IDs if provided
    for (const branch of branches) {
      if (branch.members && branch.members.length > 0) {
        const validMembers = await Member.find({
          _id: { $in: branch.members },
          isActive: true
        });

        if (validMembers.length !== branch.members.length) {
          return res.status(400).json({
            success: false,
            message: `Some members in branch ${branch.branchName} are invalid or inactive`
          });
        }
      }
    }

    // Create schedule
    const scheduleData = {
      collector: collectorId,
      collectionDay,
      branches,
      createdBy: req.user.id
    };

    const schedule = await CollectionSchedule.create(scheduleData);

    // Populate the created schedule
    await schedule.populate('collector', 'name email phone');
    await schedule.populate('branches.members', 'name phone monthlyInstallment');

    res.status(201).json({
      success: true,
      message: 'Collection schedule created successfully',
      data: schedule
    });

  } catch (error) {
    console.error('Create schedule error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while creating schedule',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// @desc    Get collection dates for a day in current month
// @route   GET /api/schedules/dates/:day
// @access  Private
router.get('/dates/:day', protect, async (req, res) => {
  try {
    const { day } = req.params;
    const { month, year } = req.query;

    // Validate day
    const validDays = ['Saturday', 'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
    if (!validDays.includes(day)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid day. Must be one of: ' + validDays.join(', ')
      });
    }

    // Use provided month/year or current
    const now = new Date();
    const targetMonth = month ? parseInt(month) : now.getMonth();
    const targetYear = year ? parseInt(year) : now.getFullYear();

    // Calculate all dates for this day in the month
    const dates = [];
    const daysOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const targetDayIndex = daysOfWeek.indexOf(day);

    // Get first and last day of month
    const firstDay = new Date(targetYear, targetMonth, 1);
    const lastDay = new Date(targetYear, targetMonth + 1, 0);

    // Find all occurrences of the target day
    for (let date = new Date(firstDay); date <= lastDay; date.setDate(date.getDate() + 1)) {
      if (date.getDay() === targetDayIndex) {
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = date.getFullYear();
        dates.push(`${day}/${month}/${year}`);
      }
    }

    res.status(200).json({
      success: true,
      data: {
        day,
        month: targetMonth + 1,
        year: targetYear,
        dates
      }
    });

  } catch (error) {
    console.error('Get collection dates error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while calculating collection dates',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// @desc    Get all collection schedules
// @route   GET /api/schedules
// @access  Private
router.get('/', protect, async (req, res) => {
  try {
    const { collectorId, collectionDay, branchCode } = req.query;

    // Build filter object
    const filter = { isActive: true };
    
    if (collectorId) filter.collector = collectorId;
    if (collectionDay) filter.collectionDay = collectionDay;
    if (branchCode) filter['branches.branchCode'] = branchCode;

    // Role-based filtering
    if (req.user.role === 'collector') {
      filter.collector = req.user.id;
    }

    const schedules = await CollectionSchedule.find(filter)
      .populate('collector', 'name email phone')
      .populate('branches.members', 'name phone monthlyInstallment totalSavings status')
      .sort({ collectionDay: 1, 'collector.name': 1 });

    res.status(200).json({
      success: true,
      data: schedules
    });

  } catch (error) {
    console.error('Get schedules error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching schedules',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// @desc    Get single collection schedule
// @route   GET /api/schedules/:id
// @access  Private
router.get('/:id', protect, async (req, res) => {
  try {
    const schedule = await CollectionSchedule.findById(req.params.id)
      .populate('collector', 'name email phone')
      .populate('branches.members', 'name phone monthlyInstallment totalSavings status joinDate')
      .populate('createdBy', 'name email')
      .populate('updatedBy', 'name email');

    if (!schedule || !schedule.isActive) {
      return res.status(404).json({
        success: false,
        message: 'Schedule not found'
      });
    }

    // Role-based access control
    if (req.user.role === 'collector' && 
        schedule.collector._id.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You can only view your own schedule.'
      });
    }

    res.status(200).json({
      success: true,
      data: schedule
    });

  } catch (error) {
    console.error('Get schedule error:', error);
    
    if (error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        message: 'Invalid schedule ID'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Server error while fetching schedule',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// @desc    Update collection schedule
// @route   PUT /api/schedules/:id
// @access  Private (Admin/Manager only)
router.put('/:id', protect, authorize('admin', 'manager'), validateSchedule, async (req, res) => {
  try {
    const { collectorId, collectionDay, branches } = req.body;

    const schedule = await CollectionSchedule.findById(req.params.id);

    if (!schedule || !schedule.isActive) {
      return res.status(404).json({
        success: false,
        message: 'Schedule not found'
      });
    }

    // Check if collector exists and has collector role
    const collector = await User.findById(collectorId);
    if (!collector || !collector.isActive || collector.role !== 'collector') {
      return res.status(400).json({
        success: false,
        message: 'Invalid collector'
      });
    }

    // Check for conflicts (different schedule for same collector and day)
    const conflictSchedule = await CollectionSchedule.findOne({
      _id: { $ne: req.params.id },
      collector: collectorId,
      collectionDay,
      isActive: true
    });

    if (conflictSchedule) {
      return res.status(400).json({
        success: false,
        message: `Schedule already exists for ${collector.name} on ${collectionDay}`
      });
    }

    // Validate member IDs if provided
    for (const branch of branches) {
      if (branch.members && branch.members.length > 0) {
        const validMembers = await Member.find({
          _id: { $in: branch.members },
          isActive: true
        });

        if (validMembers.length !== branch.members.length) {
          return res.status(400).json({
            success: false,
            message: `Some members in branch ${branch.branchName} are invalid or inactive`
          });
        }
      }
    }

    // Update schedule
    const updatedSchedule = await CollectionSchedule.findByIdAndUpdate(
      req.params.id,
      {
        collector: collectorId,
        collectionDay,
        branches,
        updatedBy: req.user.id
      },
      { new: true, runValidators: true }
    ).populate('collector', 'name email phone')
     .populate('branches.members', 'name phone monthlyInstallment');

    res.status(200).json({
      success: true,
      message: 'Schedule updated successfully',
      data: updatedSchedule
    });

  } catch (error) {
    console.error('Update schedule error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while updating schedule',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// @desc    Add new branch to schedule
// @route   POST /api/schedules/:id/branches
// @access  Private (Admin/Manager only)
router.post('/:id/branches', protect, authorize('admin', 'manager'), async (req, res) => {
  try {
    const { branchCode, branchName, members = [] } = req.body;

    if (!branchCode || !branchName) {
      return res.status(400).json({
        success: false,
        message: 'Branch code and name are required'
      });
    }

    const schedule = await CollectionSchedule.findById(req.params.id);

    if (!schedule || !schedule.isActive) {
      return res.status(404).json({
        success: false,
        message: 'Schedule not found'
      });
    }

    // Check if branch already exists in this schedule
    const existingBranch = schedule.branches.find(b => b.branchCode === branchCode);
    if (existingBranch) {
      return res.status(400).json({
        success: false,
        message: 'Branch already exists in this schedule'
      });
    }
    
    // Check if branch is assigned to other collectors
    const Branch = require('../models/Branch');
    const branchInModel = await Branch.findOne({
      branchCode,
      assignedCollector: { $ne: null, $ne: schedule.collector },
      isActive: true
    });
    
    if (branchInModel) {
      return res.status(400).json({
        success: false,
        message: `Branch ${branchCode} is already assigned to another collector`
      });
    }
    
    // Check other CollectionSchedules
    const scheduleWithBranch = await CollectionSchedule.findOne({
      'branches.branchCode': branchCode,
      collector: { $ne: schedule.collector },
      isActive: true
    });
    
    if (scheduleWithBranch) {
      return res.status(400).json({
        success: false,
        message: `Branch ${branchCode} is already assigned to another collector`
      });
    }
    
    // Check same collector's other days
    const sameCollectorOtherDay = await CollectionSchedule.findOne({
      '_id': { $ne: req.params.id },
      'branches.branchCode': branchCode,
      collector: schedule.collector,
      isActive: true
    });
    
    if (sameCollectorOtherDay) {
      return res.status(400).json({
        success: false,
        message: `Branch ${branchCode} is already assigned to this collector on ${sameCollectorOtherDay.collectionDay}`
      });
    }

    // Validate member IDs if provided
    if (members.length > 0) {
      const validMembers = await Member.find({
        _id: { $in: members },
        isActive: true
      });

      if (validMembers.length !== members.length) {
        return res.status(400).json({
          success: false,
          message: 'Some member IDs are invalid or inactive'
        });
      }
    }

    // Add new branch to schedule
    schedule.branches.push({
      branchCode,
      branchName,
      members
    });
    
    schedule.updatedBy = req.user.id;
    await schedule.save();

    // Populate and return updated schedule
    await schedule.populate('collector', 'name email phone');
    await schedule.populate('branches.members', 'name phone monthlyInstallment');

    res.status(200).json({
      success: true,
      message: `Branch ${branchName} added to schedule successfully`,
      data: schedule
    });

  } catch (error) {
    console.error('Add branch to schedule error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while adding branch to schedule',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// @desc    Add members to branch in schedule
// @route   POST /api/schedules/:id/branches/:branchCode/members
// @access  Private (Admin/Manager only)
router.post('/:id/branches/:branchCode/members', protect, authorize('admin', 'manager'), async (req, res) => {
  try {
    const { memberIds } = req.body;

    if (!Array.isArray(memberIds) || memberIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Member IDs array is required'
      });
    }

    const schedule = await CollectionSchedule.findById(req.params.id);

    if (!schedule || !schedule.isActive) {
      return res.status(404).json({
        success: false,
        message: 'Schedule not found'
      });
    }

    // Find the branch
    const branch = schedule.branches.find(b => b.branchCode === req.params.branchCode);
    if (!branch) {
      return res.status(404).json({
        success: false,
        message: 'Branch not found in schedule'
      });
    }

    // Validate member IDs
    const validMembers = await Member.find({
      _id: { $in: memberIds },
      isActive: true
    });

    if (validMembers.length !== memberIds.length) {
      return res.status(400).json({
        success: false,
        message: 'Some member IDs are invalid or inactive'
      });
    }

    // Add members to branch (avoid duplicates)
    const existingMemberIds = branch.members.map(m => m.toString());
    const newMemberIds = memberIds.filter(id => !existingMemberIds.includes(id));
    
    branch.members.push(...newMemberIds);
    schedule.updatedBy = req.user.id;
    
    await schedule.save();

    // Populate and return updated schedule
    await schedule.populate('collector', 'name email phone');
    await schedule.populate('branches.members', 'name phone monthlyInstallment');

    res.status(200).json({
      success: true,
      message: `${newMemberIds.length} members added to branch successfully`,
      data: schedule
    });

  } catch (error) {
    console.error('Add members to branch error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while adding members to branch',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// @desc    Remove member from branch in schedule
// @route   DELETE /api/schedules/:id/branches/:branchCode/members/:memberId
// @access  Private (Admin/Manager only)
router.delete('/:id/branches/:branchCode/members/:memberId', protect, authorize('admin', 'manager'), async (req, res) => {
  try {
    const schedule = await CollectionSchedule.findById(req.params.id);

    if (!schedule || !schedule.isActive) {
      return res.status(404).json({
        success: false,
        message: 'Schedule not found'
      });
    }

    // Find the branch
    const branch = schedule.branches.find(b => b.branchCode === req.params.branchCode);
    if (!branch) {
      return res.status(404).json({
        success: false,
        message: 'Branch not found in schedule'
      });
    }

    // Remove member from branch
    const memberIndex = branch.members.findIndex(m => m.toString() === req.params.memberId);
    if (memberIndex === -1) {
      return res.status(404).json({
        success: false,
        message: 'Member not found in this branch'
      });
    }

    branch.members.splice(memberIndex, 1);
    schedule.updatedBy = req.user.id;
    
    await schedule.save();

    res.status(200).json({
      success: true,
      message: 'Member removed from branch successfully'
    });

  } catch (error) {
    console.error('Remove member from branch error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while removing member from branch',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// @desc    Delete collection schedule (soft delete)
// @route   DELETE /api/schedules/:id
// @access  Private (Admin/Manager only)
router.delete('/:id', protect, authorize('admin', 'manager'), async (req, res) => {
  try {
    const schedule = await CollectionSchedule.findById(req.params.id);

    if (!schedule || !schedule.isActive) {
      return res.status(404).json({
        success: false,
        message: 'Schedule not found'
      });
    }

    // Soft delete
    schedule.isActive = false;
    schedule.updatedBy = req.user.id;
    await schedule.save();

    res.status(200).json({
      success: true,
      message: 'Schedule deleted successfully'
    });

  } catch (error) {
    console.error('Delete schedule error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while deleting schedule',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// @desc    Get weekly schedule overview
// @route   GET /api/schedules/weekly-overview
// @access  Private
router.get('/weekly-overview', protect, async (req, res) => {
  try {
    const { collectorId } = req.query;

    // Build filter
    const filter = { isActive: true };
    if (req.user.role === 'collector') {
      filter.collector = req.user.id;
    } else if (collectorId) {
      filter.collector = collectorId;
    }

    const schedules = await CollectionSchedule.find(filter)
      .populate('collector', 'name email phone')
      .populate('branches.members', 'name phone monthlyInstallment')
      .sort({ collectionDay: 1 });

    // Group by day
    const weekDays = ['Saturday', 'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
    const weeklyOverview = weekDays.map(day => {
      const daySchedules = schedules.filter(s => s.collectionDay === day);
      const totalCollectors = daySchedules.length;
      const totalBranches = daySchedules.reduce((sum, s) => sum + s.branches.length, 0);
      const totalMembers = daySchedules.reduce((sum, s) => 
        sum + s.branches.reduce((branchSum, b) => branchSum + b.members.length, 0), 0
      );

      return {
        day,
        totalCollectors,
        totalBranches,
        totalMembers,
        collectors: daySchedules.map(s => ({
          id: s.collector._id,
          name: s.collector.name,
          branchCount: s.branches.length,
          memberCount: s.branches.reduce((sum, b) => sum + b.members.length, 0)
        }))
      };
    });

    res.status(200).json({
      success: true,
      data: weeklyOverview
    });

  } catch (error) {
    console.error('Get weekly overview error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching weekly overview',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

module.exports = router;