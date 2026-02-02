const app = require('./app');
const connectDB = require('./config/database');
const config = require('./config/environment');
const logger = require('./utils/logger');

// ✅ Import Services
const roiService = require('./services/roiService');
const binaryIncomeService = require('./services/binaryIncomeService');

// Load environment variables
require('dotenv').config();

const PORT = config.PORT || 5000;

// ==================== DATABASE CONNECTION ====================

const startServer = async () => {
  try {
    // Connect to MongoDB
    await connectDB();
    
    // Start Express Server
    const server = app.listen(PORT, () => {
      logger.info(`🚀 Server running on port ${PORT}`);
      logger.info(`📝 Environment: ${config.NODE_ENV}`);
      logger.info(`🌐 API URL: http://localhost:${PORT}/api`);
      logger.info(`🏥 Health Check: http://localhost:${PORT}/health`);
      
      if (config.NODE_ENV === 'development') {
        logger.info(`📚 Base URL: http://localhost:${PORT}`);
      }

      // ==================== START CRON JOBS ====================

      logger.info('\n🔧 Initializing Cron Jobs...');

      // ✅ START ROI DISTRIBUTION CRON
      try {
        roiService.startCronJob();
        logger.info('✅ ROI Distribution Cron: Daily at 00:01 AM');
      } catch (error) {
        logger.error('❌ Failed to start ROI cron job:', error);
      }

      // ✅ START BINARY INCOME CRON
      try {
        binaryIncomeService.startCronJob();
        logger.info('✅ Binary Income Cron: Daily at 11:59 PM');
      } catch (error) {
        logger.error('❌ Failed to start Binary cron job:', error);
      }

      logger.info('🎉 All systems initialized successfully!\n');
    });

    // ==================== GRACEFUL SHUTDOWN ====================
    
    const gracefulShutdown = async (signal) => {
      logger.info(`\n⚠️  ${signal} signal received: closing HTTP server`);
      
      server.close(async () => {
        logger.info('✅ HTTP server closed');
        
        // Close database connection
        try {
          const mongoose = require('mongoose');
          await mongoose.connection.close();
          logger.info('✅ MongoDB connection closed');
          logger.info('👋 Goodbye!');
          process.exit(0);
        } catch (error) {
          logger.error('❌ Error closing MongoDB connection:', error);
          process.exit(1);
        }
      });
      
      // Force shutdown after 10 seconds
      setTimeout(() => {
        logger.error('❌ Could not close connections in time, forcefully shutting down');
        process.exit(1);
      }, 10000);
    };

    // Listen for termination signals
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));

    // Handle server errors
    server.on('error', (error) => {
      if (error.code === 'EADDRINUSE') {
        logger.error(`❌ Port ${PORT} is already in use`);
        process.exit(1);
      } else {
        logger.error('❌ Server error:', error);
        process.exit(1);
      }
    });

  } catch (error) {
    logger.error('❌ Failed to start server:', error);
    process.exit(1);
  }
};

// ==================== START SERVER ====================

startServer();

// ==================== PROCESS HANDLERS ====================

// Prevent app crash on unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  logger.error('❌ Unhandled Rejection at:', promise);
  logger.error('Reason:', reason);
  
  // In production, don't exit - let PM2/container orchestrator handle it
  if (config.NODE_ENV !== 'production') {
    process.exit(1);
  }
});

// Prevent app crash on uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('❌ Uncaught Exception:', error);
  
  // Always exit on uncaught exception
  process.exit(1);
});

// Log when process is about to exit
process.on('exit', (code) => {
  logger.info(`Process exiting with code: ${code}`);
});
