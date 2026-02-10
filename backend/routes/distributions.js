const express = require('express');
const { protect, authorize } = require('../middleware/auth');
const Distribution = require('../models/Distribution');
const Product = require('../models/Product');
const Member = require('../models/Member');

const router = express.Router();

// @desc    Get all distributions
// @route   GET /api/distributions
// @access  Private
router.get('/', protect, async (req, res) => {
  try {
    const {
      status,
      collector,
      branch,
      dateFrom,
      dateTo,
      search,
      page = 1,
      limit = 20
    } = req.query;

    // Build query
    let query = { isActive: true };

    if (status && status !== 'all') {
      query.status = status;
    }

    if (collector) {
      query.assignedCollector = collector;
    }

    if (branch && branch !== 'all') {
      query['location.branch'] = branch;
    }

    if (dateFrom || dateTo) {
      query.distributionDate = {};
      if (dateFrom) query.distributionDate.$gte = new Date(dateFrom);
      if (dateTo) query.distributionDate.$lte = new Date(dateTo);
    }

    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { distributionId: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }

    // Apply role-based filtering
    if (req.user.role === 'collector') {
      query.assignedCollector = req.user.id;
    }

    // Get distributions
    const skip = (page - 1) * limit;
    const distributions = await Distribution.find(query)
      .populate('assignedCollector', 'name email')
      .populate('products.product', 'name unit unitPrice')
      .populate('recipients.member', 'name phone')
      .populate('createdBy', 'name email')
      .sort({ distributionDate: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Distribution.countDocuments(query);

    res.json({
      success: true,
      data: distributions,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching distributions:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching distributions',
      error: error.message
    });
  }
});

// @desc    Get single distribution
// @route   GET /api/distributions/:id
// @access  Private
router.get('/:id', protect, async (req, res) => {
  try {
    const distribution = await Distribution.findById(req.params.id)
      .populate('assignedCollector', 'name email phone')
      .populate('products.product', 'name unit unitPrice category')
      .populate('recipients.member', 'name phone branch nidNumber')
      .populate('recipients.receivedProducts.product', 'name unit')
      .populate('createdBy', 'name email')
      .populate('updatedBy', 'name email');

    if (!distribution || !distribution.isActive) {
      return res.status(404).json({
        success: false,
        message: 'Distribution not found'
      });
    }

    // Check access rights
    if (req.user.role === 'collector' && distribution.assignedCollector._id.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    res.json({
      success: true,
      data: distribution
    });
  } catch (error) {
    console.error('Error fetching distribution:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching distribution',
      error: error.message
    });
  }
});

// @desc    Create new distribution
// @route   POST /api/distributions
// @access  Private (Manager/Admin only)
router.post('/', protect, authorize('manager', 'admin'), async (req, res) => {
  try {
    const {
      title,
      description,
      distributionDate,
      location,
      products,
      assignedCollector
    } = req.body;

    // Validate required fields
    if (!title || !location || !products || !assignedCollector) {
      return res.status(400).json({
        success: false,
        message: 'Title, location, products, and assigned collector are required'
      });
    }

    // Validate products and check stock
    const productValidation = [];
    for (const productItem of products) {
      const product = await Product.findById(productItem.product);
      if (!product || !product.isActive) {
        return res.status(400).json({
          success: false,
          message: `Product not found: ${productItem.product}`
        });
      }

      if (product.availableStock < productItem.quantity) {
        return res.status(400).json({
          success: false,
          message: `Insufficient stock for ${product.name}. Available: ${product.availableStock}, Requested: ${productItem.quantity}`
        });
      }

      productValidation.push({
        ...productItem,
        unitPrice: product.unitPrice,
        totalValue: product.unitPrice * productItem.quantity,
        remainingQuantity: productItem.quantity
      });
    }

    // Create distribution
    const distributionData = {
      title,
      description,
      distributionDate: distributionDate || new Date(),
      location,
      products: productValidation,
      assignedCollector,
      createdBy: req.user.id
    };

    const distribution = await Distribution.create(distributionData);

    // Update product stocks
    for (const productItem of products) {
      await Product.findByIdAndUpdate(
        productItem.product,
        { 
          $inc: { availableStock: -productItem.quantity },
          updatedBy: req.user.id
        }
      );
    }

    // Populate the created distribution
    const populatedDistribution = await Distribution.findById(distribution._id)
      .populate('assignedCollector', 'name email')
      .populate('products.product', 'name unit unitPrice')
      .populate('createdBy', 'name email');

    res.status(201).json({
      success: true,
      message: 'Distribution created successfully',
      data: populatedDistribution
    });
  } catch (error) {
    console.error('Error creating distribution:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating distribution',
      error: error.message
    });
  }
});

// @desc    Update distribution
// @route   PUT /api/distributions/:id
// @access  Private (Manager/Admin only)
router.put('/:id', protect, authorize('manager', 'admin'), async (req, res) => {
  try {
    const distribution = await Distribution.findById(req.params.id);

    if (!distribution || !distribution.isActive) {
      return res.status(404).json({
        success: false,
        message: 'Distribution not found'
      });
    }

    // Don't allow updates if distribution is completed
    if (distribution.status === 'Completed') {
      return res.status(400).json({
        success: false,
        message: 'Cannot update completed distribution'
      });
    }

    // Update allowed fields
    const allowedFields = ['title', 'description', 'distributionDate', 'location', 'assignedCollector'];
    allowedFields.forEach(field => {
      if (req.body[field] !== undefined) {
        distribution[field] = req.body[field];
      }
    });

    distribution.updatedBy = req.user.id;
    await distribution.save();

    const populatedDistribution = await Distribution.findById(distribution._id)
      .populate('assignedCollector', 'name email')
      .populate('products.product', 'name unit unitPrice')
      .populate('createdBy', 'name email');

    res.json({
      success: true,
      message: 'Distribution updated successfully',
      data: populatedDistribution
    });
  } catch (error) {
    console.error('Error updating distribution:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating distribution',
      error: error.message
    });
  }
});

// @desc    Add recipient to distribution
// @route   POST /api/distributions/:id/recipients
// @access  Private
router.post('/:id/recipients', protect, async (req, res) => {
  try {
    const { memberId, receivedProducts, signature, notes } = req.body;

    const distribution = await Distribution.findById(req.params.id);

    if (!distribution || !distribution.isActive) {
      return res.status(404).json({
        success: false,
        message: 'Distribution not found'
      });
    }

    // Check access rights
    if (req.user.role === 'collector' && distribution.assignedCollector.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // Validate member
    const member = await Member.findById(memberId);
    if (!member || !member.isActive) {
      return res.status(400).json({
        success: false,
        message: 'Member not found'
      });
    }

    // Check if member already received products
    const existingRecipient = distribution.recipients.find(
      r => r.member.toString() === memberId
    );

    if (existingRecipient) {
      return res.status(400).json({
        success: false,
        message: 'Member has already received products from this distribution'
      });
    }

    // Validate received products
    const validatedProducts = [];
    for (const productItem of receivedProducts) {
      const distributionProduct = distribution.products.find(
        p => p.product.toString() === productItem.product
      );

      if (!distributionProduct) {
        return res.status(400).json({
          success: false,
          message: 'Product not available in this distribution'
        });
      }

      if (distributionProduct.remainingQuantity < productItem.quantity) {
        return res.status(400).json({
          success: false,
          message: `Insufficient quantity available for product. Remaining: ${distributionProduct.remainingQuantity}`
        });
      }

      validatedProducts.push({
        product: productItem.product,
        quantity: productItem.quantity,
        unitPrice: distributionProduct.unitPrice,
        totalValue: distributionProduct.unitPrice * productItem.quantity
      });
    }

    // Add recipient
    distribution.recipients.push({
      member: memberId,
      receivedProducts: validatedProducts,
      signature,
      notes
    });

    await distribution.save();

    const populatedDistribution = await Distribution.findById(distribution._id)
      .populate('recipients.member', 'name phone')
      .populate('recipients.receivedProducts.product', 'name unit');

    res.json({
      success: true,
      message: 'Recipient added successfully',
      data: populatedDistribution
    });
  } catch (error) {
    console.error('Error adding recipient:', error);
    res.status(500).json({
      success: false,
      message: 'Error adding recipient',
      error: error.message
    });
  }
});

// @desc    Cancel distribution
// @route   PATCH /api/distributions/:id/cancel
// @access  Private (Manager/Admin only)
router.patch('/:id/cancel', protect, authorize('manager', 'admin'), async (req, res) => {
  try {
    const distribution = await Distribution.findById(req.params.id);

    if (!distribution || !distribution.isActive) {
      return res.status(404).json({
        success: false,
        message: 'Distribution not found'
      });
    }

    if (distribution.status === 'Completed') {
      return res.status(400).json({
        success: false,
        message: 'Cannot cancel completed distribution'
      });
    }

    // Return products to stock
    for (const productItem of distribution.products) {
      const remainingQty = productItem.quantity - productItem.distributedQuantity;
      if (remainingQty > 0) {
        await Product.findByIdAndUpdate(
          productItem.product,
          { 
            $inc: { availableStock: remainingQty },
            updatedBy: req.user.id
          }
        );
      }
    }

    distribution.status = 'Cancelled';
    distribution.updatedBy = req.user.id;
    await distribution.save();

    res.json({
      success: true,
      message: 'Distribution cancelled successfully',
      data: distribution
    });
  } catch (error) {
    console.error('Error cancelling distribution:', error);
    res.status(500).json({
      success: false,
      message: 'Error cancelling distribution',
      error: error.message
    });
  }
});

// @desc    Get distribution statistics
// @route   GET /api/distributions/stats/overview
// @access  Private
router.get('/stats/overview', protect, async (req, res) => {
  try {
    const totalDistributions = await Distribution.countDocuments({ isActive: true });
    const plannedDistributions = await Distribution.countDocuments({ status: 'Planned', isActive: true });
    const inProgressDistributions = await Distribution.countDocuments({ status: 'In Progress', isActive: true });
    const completedDistributions = await Distribution.countDocuments({ status: 'Completed', isActive: true });

    // This month's distributions
    const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const thisMonthDistributions = await Distribution.countDocuments({
      distributionDate: { $gte: startOfMonth },
      isActive: true
    });

    // Total value distributed
    const distributions = await Distribution.find({ isActive: true });
    const totalValueDistributed = distributions.reduce((sum, dist) => sum + dist.distributedValue, 0);
    const totalValuePlanned = distributions.reduce((sum, dist) => sum + dist.totalValue, 0);

    // Branch-wise distribution
    const branchStats = await Distribution.aggregate([
      { $match: { isActive: true } },
      { $group: { _id: '$location.branch', count: { $sum: 1 }, totalValue: { $sum: '$distributedValue' } } },
      { $sort: { count: -1 } }
    ]);

    res.json({
      success: true,
      data: {
        totalDistributions,
        plannedDistributions,
        inProgressDistributions,
        completedDistributions,
        thisMonthDistributions,
        totalValueDistributed,
        totalValuePlanned,
        branchStats
      }
    });
  } catch (error) {
    console.error('Error fetching distribution stats:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching distribution statistics',
      error: error.message
    });
  }
});

module.exports = router;
