const mongoose = require('mongoose');

/**
 * Wrapper for transaction-safe operations
 * Returns null session for local MongoDB, real session for Atlas
 */
exports.startSafeSession = async () => {
  // Check if running on replica set/Atlas
  const isReplicaSet = mongoose.connection.readyState === 1 && 
                       mongoose.connection.db.admin().serverStatus().repl;
  
  if (isReplicaSet) {
    const session = await mongoose.startSession();
    session.startTransaction();
    return session;
  }
  
  return null; // Local MongoDB - no session
};

exports.commitSafeSession = async (session) => {
  if (session) {
    await session.commitTransaction();
    session.endSession();
  }
};

exports.abortSafeSession = async (session) => {
  if (session) {
    await session.abortTransaction();
    session.endSession();
  }
};
