const SystemSetting = require('../models/SystemSetting');
const logger = require('./logger');

// Cache settings for 5 minutes
let settingsCache = {};
let lastCacheTime = null;

class SettingsHelper {
  // Get single setting value
  static async get(key) {
    try {
      // Check cache
      if (this.isCacheValid() && settingsCache[key] !== undefined) {
        return settingsCache[key];
      }

      // Fetch from DB
      const setting = await SystemSetting.findOne({ settingKey: key, isActive: true });
      
      if (!setting) {
        logger.warn(`Setting not found: ${key}`);
        return null;
      }

      // Update cache
      settingsCache[key] = setting.settingValue;
      lastCacheTime = Date.now();

      return setting.settingValue;
    } catch (error) {
      logger.error(`Error getting setting ${key}:`, error);
      return null;
    }
  }

  // Get multiple settings by prefix
  static async getByPrefix(prefix) {
    try {
      const settings = await SystemSetting.find({
        settingKey: { $regex: `^${prefix}`, $options: 'i' },
        isActive: true,
      });

      const result = {};
      settings.forEach(setting => {
        const key = setting.settingKey.replace(`${prefix}.`, '');
        result[key] = setting.settingValue;
      });

      return result;
    } catch (error) {
      logger.error(`Error getting settings with prefix ${prefix}:`, error);
      return {};
    }
  }

  // Get all settings
  static async getAll() {
    try {
      const settings = await SystemSetting.find({ isActive: true });
      
      const result = {};
      settings.forEach(setting => {
        result[setting.settingKey] = setting.settingValue;
      });

      return result;
    } catch (error) {
      logger.error('Error getting all settings:', error);
      return {};
    }
  }

  // Update setting
  static async update(key, value, updatedBy = null) {
    try {
      const setting = await SystemSetting.findOne({ settingKey: key });

      if (!setting) {
        throw new Error(`Setting ${key} not found`);
      }

      setting.settingValue = value;
      if (updatedBy) {
        setting.lastUpdatedBy = updatedBy;
      }

      await setting.save();

      // Clear cache
      this.clearCache();

      logger.info(`✅ Setting updated: ${key} = ${value}`);
      return setting;
    } catch (error) {
      logger.error(`Error updating setting ${key}:`, error);
      throw error;
    }
  }

  // Check if cache is valid
  static isCacheValid() {
    if (!lastCacheTime) return false;
    return Date.now() - lastCacheTime < 300000; // 5 minutes
  }

  // Clear cache
  static clearCache() {
    settingsCache = {};
    lastCacheTime = null;
  }
}

module.exports = SettingsHelper;
