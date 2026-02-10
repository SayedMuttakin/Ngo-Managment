/**
 * Collection Events Utility
 * 
 * This file contains utility functions to trigger real-time updates
 * across different components when collections are made.
 */

/**
 * Trigger collection sheet update when an installment is collected
 * @param {Object} collectionData - Details about the collected installment
 */
export const triggerCollectionUpdate = (collectionData = {}) => {
  try {
    // Create custom event with collection details
    const event = new CustomEvent('installmentCollected', {
      detail: {
        timestamp: new Date().toISOString(),
        memberId: collectionData.memberId,
        memberName: collectionData.memberName,
        amount: collectionData.amount,
        installmentId: collectionData.installmentId,
        status: collectionData.status,
        collectionDate: collectionData.collectionDate,
        note: collectionData.note || 'Collection updated'
      }
    });
    
    // Dispatch event globally
    window.dispatchEvent(event);
    
    console.log('🔄 Collection update event triggered:', event.detail);
    
    // Also trigger dashboard reload event for backward compatibility
    const dashboardEvent = new CustomEvent('dashboardReload', {
      detail: event.detail
    });
    window.dispatchEvent(dashboardEvent);
    
  } catch (error) {
    console.error('❌ Failed to trigger collection update:', error);
  }
};

/**
 * Trigger a general refresh of collection-related data
 */
export const triggerCollectionRefresh = () => {
  try {
    const event = new CustomEvent('collectionDataRefresh', {
      detail: {
        timestamp: new Date().toISOString(),
        source: 'manual_refresh'
      }
    });
    
    window.dispatchEvent(event);
    
    // Also trigger the main collection event
    triggerCollectionUpdate({
      note: 'Manual refresh triggered'
    });
    
  } catch (error) {
    console.error('❌ Failed to trigger collection refresh:', error);
  }
};

/**
 * Listen for collection updates and execute callback
 * @param {Function} callback - Function to call when collection is updated
 * @returns {Function} - Cleanup function to remove event listeners
 */
export const listenForCollectionUpdates = (callback) => {
  const handleUpdate = (event) => {
    if (typeof callback === 'function') {
      callback(event.detail);
    }
  };
  
  // Listen to both events
  window.addEventListener('installmentCollected', handleUpdate);
  window.addEventListener('collectionDataRefresh', handleUpdate);
  
  // Return cleanup function
  return () => {
    window.removeEventListener('installmentCollected', handleUpdate);
    window.removeEventListener('collectionDataRefresh', handleUpdate);
  };
};

/**
 * Debounced version of collection update to prevent spam
 */
let updateTimeout = null;
export const triggerCollectionUpdateDebounced = (collectionData = {}, delay = 1000) => {
  // Clear previous timeout
  if (updateTimeout) {
    clearTimeout(updateTimeout);
  }
  
  // Set new timeout
  updateTimeout = setTimeout(() => {
    triggerCollectionUpdate(collectionData);
  }, delay);
};