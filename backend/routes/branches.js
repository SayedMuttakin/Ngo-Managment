const express = require('express');
const { protect, authorize } = require('../middleware/auth');
const Branch = require('../models/Branch');
const Member = require('../models/Member');
const User = require('../models/User');

const router = express.Router();

// @desc    Get all unique branches from collection schedules
// @route   GET /api/branches/from-schedules
// @access  Private
router.get('/from-schedules', protect, async (req, res) => {
  try {
    const CollectionSchedule = require('../models/CollectionSchedule');

    console.log('📋 Fetching branches from collection schedules...');

    // Get all active schedules
    const schedules = await CollectionSchedule.find({ isActive: true })
      .populate('collector', 'name')
      .select('branches collector collectionDay');

    console.log(`📦 Found ${schedules.length} active schedules`);

    // Extract and consolidate all unique branches
    const branchesMap = new Map();

    schedules.forEach(schedule => {
      schedule.branches.forEach(branch => {
        const key = branch.branchCode;
        if (!branchesMap.has(key)) {
          branchesMap.set(key, {
            _id: branch._id,
            branchCode: branch.branchCode,
            name: branch.branchName,
            address: 'N/A',
            memberCount: branch.members?.length || 0,
            collector: schedule.collector?.name || 'N/A',
            collectionDay: schedule.collectionDay || 'N/A',
            isActive: true
          });
        } else {
          // Update member count if this branch appears in multiple schedules
          const existing = branchesMap.get(key);
          existing.memberCount += branch.members?.length || 0;
        }
      });
    });

    const branches = Array.from(branchesMap.values());

    console.log(`✅ Extracted ${branches.length} unique branches from ${schedules.length} schedules`);

    res.json({
      success: true,
      data: branches,
      pagination: {
        page: 1,
        limit: 1000,
        total: branches.length,
        pages: 1
      }
    });

  } catch (error) {
    console.error('❌ Error fetching branches from schedules:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching branches',
      error: error.message
    });
  }
});

// @desc    Update branch name in all collection schedules
// @route   PUT /api/branches/update-name/:branchCode
// @access  Private (Admin/Manager only)
router.put('/update-name/:branchCode', protect, authorize('admin', 'manager'), async (req, res) => {
  try {
    const { branchCode } = req.params;
    const { name } = req.body;

    if (!name || name.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Branch name is required'
      });
    }

    console.log(`📝 Updating branch name for code ${branchCode} to: ${name}`);

    const CollectionSchedule = require('../models/CollectionSchedule');

    // Find all schedules containing this branch
    const schedules = await CollectionSchedule.find({
      'branches.branchCode': branchCode,
      isActive: true
    });

    if (schedules.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Branch not found in any collection schedule'
      });
    }

    console.log(`📦 Found ${schedules.length} schedules with branch ${branchCode}`);

    // Update branch name in all schedules
    let updatedCount = 0;
    for (const schedule of schedules) {
      let updated = false;
      schedule.branches.forEach(branch => {
        if (branch.branchCode === branchCode) {
          branch.branchName = name;
          updated = true;
        }
      });

      if (updated) {
        schedule.updatedBy = req.user.id;
        await schedule.save();
        updatedCount++;
      }
    }

    console.log(`✅ Updated branch name in ${updatedCount} schedules`);

    res.json({
      success: true,
      message: `Branch name updated successfully in ${updatedCount} schedule(s)`,
      data: {
        branchCode,
        newName: name,
        schedulesUpdated: updatedCount
      }
    });

  } catch (error) {
    console.error('❌ Error updating branch name:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating branch name',
      error: error.message
    });
  }
});


// @desc    Get all branches
// @route   GET /api/branches
// @access  Private
router.get('/', protect, async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      search,
      collector,
      isActive = 'true'
    } = req.query;

    // Build query
    let query = {};

    // Only filter by isActive if it's not 'all'
    if (isActive !== 'all') {
      query.isActive = isActive === 'true';
    }

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { branchCode: { $regex: search, $options: 'i' } },
        { address: { $regex: search, $options: 'i' } }
      ];
    }

    if (collector) {
      query.assignedCollector = collector;
    }

    // Calculate pagination
    const skip = (page - 1) * limit;

    // Get branches
    const branches = await Branch.find(query)
      .populate('assignedCollector', 'name email')
      .populate('createdBy', 'name email')
      .sort({ branchCode: 1 })
      .skip(skip)
      .limit(parseInt(limit));

    // Get member count for each branch
    const branchesWithMemberCount = await Promise.all(
      branches.map(async (branch) => {
        const memberCount = await Member.countDocuments({
          branchCode: branch.branchCode,
          isActive: true
        });

        const totalSavings = await Member.aggregate([
          { $match: { branchCode: branch.branchCode, isActive: true } },
          { $group: { _id: null, total: { $sum: '$totalSavings' } } }
        ]);

        return {
          ...branch.toJSON(),
          memberCount,
          totalSavings: totalSavings[0]?.total || 0
        };
      })
    );

    const total = await Branch.countDocuments(query);

    res.json({
      success: true,
      data: branchesWithMemberCount,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching branches:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching branches',
      error: error.message
    });
  }
});

// @desc    Get single branch
// @route   GET /api/branches/:id
// @access  Private
router.get('/:id', protect, async (req, res) => {
  try {
    const branch = await Branch.findById(req.params.id)
      .populate('assignedCollector', 'name email phone')
      .populate('createdBy', 'name email')
      .populate('updatedBy', 'name email');

    if (!branch || !branch.isActive) {
      return res.status(404).json({
        success: false,
        message: 'Branch not found'
      });
    }

    // Get members for this branch
    const members = await Member.find({
      branchCode: branch.branchCode,
      isActive: true
    }).select('name phone totalSavings');

    const branchData = {
      ...branch.toJSON(),
      members,
      memberCount: members.length,
      totalSavings: members.reduce((sum, member) => sum + (member.totalSavings || 0), 0)
    };

    res.json({
      success: true,
      data: branchData
    });
  } catch (error) {
    console.error('Error fetching branch:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching branch',
      error: error.message
    });
  }
});

// @desc    Create new branch
// @route   POST /api/branches
// @access  Private (Manager/Admin only)
router.post('/', protect, authorize('manager', 'admin'), async (req, res) => {
  try {
    const { name, branchCode, address, description, assignedCollector } = req.body;

    // Validate required fields
    if (!name || !branchCode) {
      return res.status(400).json({
        success: false,
        message: 'Branch name and branch code are required'
      });
    }

    // Validate branch code format
    if (!/^\d{4}$/.test(branchCode)) {
      return res.status(400).json({
        success: false,
        message: 'Branch code must be exactly 4 digits'
      });
    }

    // Check if branch code already exists
    const existingBranch = await Branch.findOne({ branchCode });
    if (existingBranch) {
      return res.status(400).json({
        success: false,
        message: 'Branch code already exists'
      });
    }

    // Validate collector if provided
    if (assignedCollector) {
      const collector = await User.findOne({
        _id: assignedCollector,
        role: 'collector',
        isActive: true
      });

      if (!collector) {
        return res.status(400).json({
          success: false,
          message: 'Invalid collector selected'
        });
      }

      // Check if this branch code is already assigned to another collector
      const existingAssignment = await Branch.findOne({
        branchCode: branchCode,
        assignedCollector: { $ne: null },
        isActive: true
      });

      if (existingAssignment) {
        return res.status(400).json({
          success: false,
          message: `Branch code ${branchCode} is already assigned to another collector`
        });
      }
    }

    // Create branch
    const branchData = {
      name: name.trim(),
      branchCode: branchCode.trim(),
      address: address?.trim(),
      description: description?.trim(),
      assignedCollector: assignedCollector || null,
      createdBy: req.user.id
    };

    const branch = await Branch.create(branchData);

    // Populate the created branch
    const populatedBranch = await Branch.findById(branch._id)
      .populate('assignedCollector', 'name email')
      .populate('createdBy', 'name email');

    res.status(201).json({
      success: true,
      message: 'Branch created successfully',
      data: {
        ...populatedBranch.toJSON(),
        memberCount: 0,
        totalSavings: 0
      }
    });
  } catch (error) {
    console.error('Error creating branch:', error);

    // Handle duplicate key error
    if (error.code === 11000) {
      const field = Object.keys(error.keyValue)[0];
      let message = 'Branch already exists';

      if (field === 'branchCode') {
        message = 'Branch code already exists. Each branch must have a unique branch code.';
      } else if (field === 'name') {
        message = 'Branch name already exists. Each branch must have a unique branch name.';
      }

      return res.status(400).json({
        success: false,
        message
      });
    }

    res.status(500).json({
      success: false,
      message: 'Error creating branch',
      error: error.message
    });
  }
});

// @desc    Update branch
// @route   PUT /api/branches/:id
// @access  Private (Manager/Admin only)
router.put('/:id', protect, authorize('manager', 'admin'), async (req, res) => {
  try {
    const branch = await Branch.findById(req.params.id);

    if (!branch || !branch.isActive) {
      return res.status(404).json({
        success: false,
        message: 'Branch not found'
      });
    }

    const { name, address, description, assignedCollector } = req.body;

    // Validate collector if provided
    if (assignedCollector) {
      const collector = await User.findOne({
        _id: assignedCollector,
        role: 'collector',
        isActive: true
      });

      if (!collector) {
        return res.status(400).json({
          success: false,
          message: 'Invalid collector selected'
        });
      }

      // Check if this branch code is already assigned to another collector
      const existingAssignment = await Branch.findOne({
        branchCode: branch.branchCode,
        assignedCollector: { $ne: null, $ne: assignedCollector },
        isActive: true,
        _id: { $ne: req.params.id }
      });

      if (existingAssignment) {
        return res.status(400).json({
          success: false,
          message: `Branch code ${branch.branchCode} is already assigned to another collector`
        });
      }
    }

    // Update allowed fields
    if (name) branch.name = name.trim();
    if (address !== undefined) branch.address = address?.trim();
    if (description !== undefined) branch.description = description?.trim();
    if (assignedCollector !== undefined) branch.assignedCollector = assignedCollector || null;

    branch.updatedBy = req.user.id;
    await branch.save();

    const populatedBranch = await Branch.findById(branch._id)
      .populate('assignedCollector', 'name email')
      .populate('createdBy', 'name email');

    res.json({
      success: true,
      message: 'Branch updated successfully',
      data: populatedBranch
    });
  } catch (error) {
    console.error('Error updating branch:', error);

    // Handle duplicate key error
    if (error.code === 11000) {
      const field = Object.keys(error.keyValue)[0];
      let message = 'Branch already exists';

      if (field === 'branchCode') {
        message = 'Branch code already exists. Each branch must have a unique branch code.';
      } else if (field === 'name') {
        message = 'Branch name already exists. Each branch must have a unique branch name.';
      }

      return res.status(400).json({
        success: false,
        message
      });
    }

    res.status(500).json({
      success: false,
      message: 'Error updating branch',
      error: error.message
    });
  }
});

// @desc    Delete branch (soft delete)
// @route   DELETE /api/branches/:id
// @access  Private (Manager/Admin only)
router.delete('/:id', protect, authorize('manager', 'admin'), async (req, res) => {
  try {
    const branch = await Branch.findById(req.params.id);

    if (!branch || !branch.isActive) {
      return res.status(404).json({
        success: false,
        message: 'Branch not found'
      });
    }

    // Check if branch has active members
    const memberCount = await Member.countDocuments({
      branchCode: branch.branchCode,
      isActive: true
    });

    if (memberCount > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete branch with ${memberCount} active members. Please transfer members first.`
      });
    }

    // Soft delete
    branch.isActive = false;
    branch.updatedBy = req.user.id;
    await branch.save();

    res.json({
      success: true,
      message: 'Branch deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting branch:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting branch',
      error: error.message
    });
  }
});

// @desc    Assign collector to branch
// @route   PATCH /api/branches/:id/assign-collector
// @access  Private (Manager/Admin only)
router.patch('/:id/assign-collector', protect, authorize('manager', 'admin'), async (req, res) => {
  try {
    const { collectorId } = req.body;

    const branch = await Branch.findById(req.params.id);
    if (!branch || !branch.isActive) {
      return res.status(404).json({
        success: false,
        message: 'Branch not found'
      });
    }

    // Validate collector
    if (collectorId) {
      const collector = await User.findOne({
        _id: collectorId,
        role: 'collector',
        isActive: true
      });

      if (!collector) {
        return res.status(400).json({
          success: false,
          message: 'Invalid collector selected'
        });
      }

      // Check if this branch is already assigned to another collector
      const existingAssignment = await Branch.findOne({
        branchCode: branch.branchCode,
        assignedCollector: { $ne: null, $ne: collectorId },
        isActive: true,
        _id: { $ne: branch._id }
      });

      if (existingAssignment) {
        return res.status(400).json({
          success: false,
          message: `Branch ${branch.branchCode} is already assigned to another collector`
        });
      }
    }

    branch.assignedCollector = collectorId || null;
    branch.updatedBy = req.user.id;
    await branch.save();

    const populatedBranch = await Branch.findById(branch._id)
      .populate('assignedCollector', 'name email');

    res.json({
      success: true,
      message: collectorId ? 'Collector assigned successfully' : 'Collector removed successfully',
      data: populatedBranch
    });
  } catch (error) {
    console.error('Error assigning collector:', error);
    res.status(500).json({
      success: false,
      message: 'Error assigning collector',
      error: error.message
    });
  }
});

// @desc    Get branches by collector
// @route   GET /api/branches/collector/:collectorId
// @access  Private
router.get('/collector/:collectorId', protect, async (req, res) => {
  try {
    const CollectionSchedule = require('../models/CollectionSchedule');

    // Get branches from both Branch model (weekly collectors) and CollectionSchedule (daily collectors)
    const branches = await Branch.find({
      assignedCollector: req.params.collectorId,
      isActive: true
    }).select('name branchCode memberCount totalSavings');

    // Also get branches from CollectionSchedule for daily collectors
    const schedules = await CollectionSchedule.find({
      collector: req.params.collectorId,
      isActive: true
    });

    // Extract branches from schedules
    const scheduleBranches = [];
    schedules.forEach(schedule => {
      if (schedule.branches && schedule.branches.length > 0) {
        schedule.branches.forEach(branch => {
          // Check if branch already exists in branches array
          const exists = branches.find(b => b.branchCode === branch.branchCode);
          if (!exists) {
            scheduleBranches.push({
              name: branch.branchName,
              branchCode: branch.branchCode,
              memberCount: branch.members ? branch.members.length : 0,
              totalSavings: 0,
              _id: branch._id || `schedule-${branch.branchCode}`
            });
          }
        });
      }
    });

    // Combine both sources
    const allBranches = [...branches, ...scheduleBranches];

    // Get member count for each branch
    const branchesWithMemberCount = await Promise.all(
      allBranches.map(async (branch) => {
        // Try multiple ways to find members - branchCode might be stored differently
        const memberCount = await Member.countDocuments({
          $or: [
            { branchCode: branch.branchCode },
            { branchCode: branch.branchCode.toString() },
            { branch: branch.name },
            { branch: new RegExp(branch.name, 'i') }
          ],
          isActive: true
        });

        // Debug: Log branch and member count
        console.log(`📊 Branch ${branch.branchCode} (${branch.name}): ${memberCount} members`);

        // Also log some sample members for debugging
        const sampleMembers = await Member.find({
          $or: [
            { branchCode: branch.branchCode },
            { branch: branch.name }
          ],
          isActive: true
        }).limit(3).select('name branchCode branch');

        if (sampleMembers.length > 0) {
          console.log(`👥 Sample members:`, sampleMembers.map(m => ({
            name: m.name,
            branchCode: m.branchCode,
            branch: m.branch
          })));
        }

        return {
          ...branch.toJSON(),
          memberCount,
          members: [] // Empty array for compatibility
        };
      })
    );

    res.json({
      success: true,
      data: branchesWithMemberCount
    });
  } catch (error) {
    console.error('Error fetching collector branches:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching collector branches',
      error: error.message
    });
  }
});

module.exports = router;
