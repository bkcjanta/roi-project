const express = require('express');
const router = express.Router();
const packageController = require('../controllers/packageController');
const { protect, restrictTo } = require('../middleware/authMiddleware');

// Public routes
router.get('/', packageController.getAllPackages);
router.get('/:id', packageController.getPackageById);

// Admin only routes
router.use(protect, restrictTo('admin', 'superadmin'));

router.post('/', packageController.createPackage);
router.put('/:id', packageController.updatePackage);
router.delete('/:id', packageController.deletePackage);

module.exports = router;
