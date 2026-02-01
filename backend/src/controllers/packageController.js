const Package = require('../models/Package');
const logger = require('../utils/logger');

// Get all active packages
exports.getAllPackages = async (req, res) => {
  try {
    const packages = await Package.find({ isActive: true }).sort({ minAmount: 1 });

    res.status(200).json({
      status: 'success',
      data: {
        count: packages.length,
        packages,
      },
    });
  } catch (error) {
    logger.error('Get packages error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch packages',
      error: error.message,
    });
  }
};

// Get single package by ID
exports.getPackageById = async (req, res) => {
  try {
    const package = await Package.findById(req.params.id);

    if (!package) {
      return res.status(404).json({
        status: 'error',
        message: 'Package not found',
      });
    }

    res.status(200).json({
      status: 'success',
      data: { package },
    });
  } catch (error) {
    logger.error('Get package error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch package',
      error: error.message,
    });
  }
};

// Create package (Admin only)
exports.createPackage = async (req, res) => {
  try {
    const {
      name,
      type,
      minAmount,
      maxAmount,
      roiRate,
      roiType,
      duration,
      description,
    } = req.body;

    // Validation
    if (!name || !type || !minAmount || !roiRate || !duration) {
      return res.status(400).json({
        status: 'error',
        message: 'Please provide all required fields',
      });
    }

    const package = await Package.create({
      name,
      type,
      minAmount,
      maxAmount,
      roiRate,
      roiType,
      duration,
      description,
      benefits: req.body.benefits || [],
    });

    logger.info(`Package created: ${package.name}`);

    res.status(201).json({
      status: 'success',
      message: 'Package created successfully',
      data: { package },
    });
  } catch (error) {
    logger.error('Create package error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to create package',
      error: error.message,
    });
  }
};

// Update package (Admin only)
exports.updatePackage = async (req, res) => {
  try {
    const package = await Package.findByIdAndUpdate(
      req.params.id,
      { $set: req.body },
      { new: true, runValidators: true }
    );

    if (!package) {
      return res.status(404).json({
        status: 'error',
        message: 'Package not found',
      });
    }

    logger.info(`Package updated: ${package.name}`);

    res.status(200).json({
      status: 'success',
      message: 'Package updated successfully',
      data: { package },
    });
  } catch (error) {
    logger.error('Update package error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to update package',
      error: error.message,
    });
  }
};

// Delete package (Admin only - soft delete)
exports.deletePackage = async (req, res) => {
  try {
    const package = await Package.findByIdAndUpdate(
      req.params.id,
      { isActive: false },
      { new: true }
    );

    if (!package) {
      return res.status(404).json({
        status: 'error',
        message: 'Package not found',
      });
    }

    logger.info(`Package deleted: ${package.name}`);

    res.status(200).json({
      status: 'success',
      message: 'Package deleted successfully',
    });
  } catch (error) {
    logger.error('Delete package error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to delete package',
      error: error.message,
    });
  }
};
