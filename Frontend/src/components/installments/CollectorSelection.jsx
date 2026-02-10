import React, { useState, useEffect } from 'react';
import { Users, ArrowLeft, Plus, Trash2, Edit2, Save, X } from 'lucide-react';
import { collectorsAPI, branchesAPI } from '../../utils/api';
import toast from 'react-hot-toast';

const CollectorSelection = ({ selectedDay, onCollectorSelect, onGoBack }) => {
  const [collectors, setCollectors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [addingCollector, setAddingCollector] = useState(false);
  const [newCollector, setNewCollector] = useState({
    name: ''
  });
  const [editingCollector, setEditingCollector] = useState(null);
  const [editedName, setEditedName] = useState('');
  const [updatingCollector, setUpdatingCollector] = useState(false);

  // Available colors for automatic assignment
  const availableColors = [
    'from-blue-500 to-blue-600',
    'from-green-500 to-green-600',
    'from-purple-500 to-purple-600',
    'from-yellow-500 to-yellow-600',
    'from-red-500 to-red-600',
    'from-indigo-500 to-indigo-600',
    'from-orange-500 to-orange-600',
    'from-pink-500 to-pink-600',
    'from-teal-500 to-teal-600',
    'from-cyan-500 to-cyan-600'
  ];

  // Load collectors for the selected day
  useEffect(() => {
    loadCollectors();
  }, [selectedDay]);

  const loadCollectors = async () => {
    try {
      setLoading(true);

      // ✅ FIXED: Don't filter by isActive in API call - do it in frontend to catch all collectors
      const response = await collectorsAPI.getAll({ limit: 100, role: 'collector' });

      if (response.success && response.data) {
        const allCollectors = response.data;

        console.log('📋 Total collectors from API:', allCollectors.length);
        console.log('🔍 All collectors:', allCollectors.map(c => ({ name: c.name, role: c.role, isActive: c.isActive, email: c.email })));

        // ✅ IMPROVED: More flexible filtering - show collectors even if isActive is undefined
        const filteredCollectors = allCollectors.filter(collector => {
          // Must have collector role
          const hasCollectorRole = collector.role === 'collector';

          // Must have email (indicating they are actual users, not members)
          const hasEmail = !!collector.email;

          // Active status check - accept if isActive is true OR undefined (newly created)
          // Only exclude if explicitly set to false
          const isNotDeactivated = collector.isActive !== false;

          // ✅ NEW: Filter by collection type based on selected day
          const collectionType = collector.collectionType || 'weekly'; // Default to weekly for old collectors
          const matchesCollectionType = selectedDay?.isDaily
            ? collectionType === 'daily'
            : collectionType === 'weekly';

          const shouldInclude = hasCollectorRole && hasEmail && isNotDeactivated && matchesCollectionType;

          if (!shouldInclude) {
            console.log(`❌ Excluding collector: ${collector.name} - Role: ${collector.role}, Email: ${!!collector.email}, IsActive: ${collector.isActive}, CollectionType: ${collectionType}, SelectedDay: ${selectedDay?.name}`);
          }

          return shouldInclude;
        });

        console.log('✅ Filtered collectors:', filteredCollectors.length);

        // Load branches to get collector-branch mapping
        let branchesData = [];
        try {
          const branchesResponse = await branchesAPI.getAll();
          if (branchesResponse.success && branchesResponse.data) {
            branchesData = branchesResponse.data;
            console.log('🏢 Total branches loaded:', branchesData.length);
            console.log('🔍 Sample branches (first 3):', branchesData.slice(0, 3).map(b => ({
              name: b.name,
              code: b.branchCode,
              assignedCollector: b.assignedCollector
            })));
          }
        } catch (error) {
          console.error('❌ Error loading branches:', error);
        }

        // Convert all collectors to display format with branch data
        const collectorsForDisplay = filteredCollectors.map(collector => {
          const collectorId = collector.id || collector._id;

          // Find branches assigned to this collector from branchesData
          const collectorBranches = branchesData.filter(branch => {
            // Handle both ObjectId and string comparison
            const branchCollectorId = branch.assignedCollector?._id || branch.assignedCollector;
            const matches = branchCollectorId && branchCollectorId.toString() === collectorId.toString();

            if (branchCollectorId) {
              console.log(`🔍 Comparing: Branch "${branch.name}" collector (${branchCollectorId}) vs Collector ${collector.name} (${collectorId}) = ${matches}`);
            }

            return matches;
          });

          const branchCount = collectorBranches.length;

          console.log(`👤 Collector: ${collector.name} (${collectorId}) - Branches: ${branchCount}`);

          return {
            id: collectorId,
            name: collector.name,
            email: collector.email,
            branches: collectorBranches,
            branchCount: branchCount
          };
        });

        // Add colors to collectors
        const collectorsWithColors = collectorsForDisplay.map((collector, index) => ({
          ...collector,
          color: availableColors[index % availableColors.length]
        }));

        setCollectors(collectorsWithColors);
        return;
      }

      // If API returns success but no data, show empty state
      if (response.success && (!response.data || response.data.length === 0)) {
        setCollectors([]);
        return;
      }

      // If API fails, show error and empty state
      toast.error('Failed to load collectors from database');
      setCollectors([]);

    } catch (error) {
      toast.error('Failed to load collectors');
      setCollectors([]);
    } finally {
      setLoading(false);
    }
  };
  // Function to get next available color
  const getNextColor = () => {
    const usedColors = collectors.map(collector => collector.color);
    const availableColor = availableColors.find(color => !usedColors.includes(color));
    return availableColor || availableColors[collectors.length % availableColors.length];
  };

  const handleAddCollector = async () => {
    if (!newCollector.name.trim()) {
      toast.error('Please enter collector name');
      return;
    }

    try {
      setAddingCollector(true);
      console.log('➡️ Adding new collector:', newCollector.name);

      // ✅ SIMPLIFIED: Only send name - backend auto-generates email/password
      // Collectors don't login, admin/manager handles everything
      const collectorData = {
        name: newCollector.name.trim(),
        collectionType: selectedDay?.isDaily ? 'daily' : 'weekly'
      };

      console.log('📤 Sending collector data to API:', collectorData);

      // Call API to create collector in database
      const response = await collectorsAPI.create(collectorData);
      console.log('✅ Collector created successfully:', response);
      console.log('✅ Response success:', response.success);
      console.log('✅ Response data:', response.data);
      console.log('✅ Response message:', response.message);

      toast.success(`Collector ${newCollector.name} created successfully!`);

      console.log('✅ Created collector ID:', response.data?.id || response.data?._id);
      console.log('✅ Created collector data:', response.data);

      // Reset form
      setNewCollector({
        name: ''
      });
      setShowAddForm(false);

      // Reload collectors from database to ensure persistence
      console.log('🔄 Reloading collectors from database...');

      // Add small delay to ensure backend has processed the creation
      await new Promise(resolve => setTimeout(resolve, 500));

      await loadCollectors();

      console.log('👍 Collectors reloaded. Current count:', collectors.length);

    } catch (error) {
      console.error('❌ Error creating collector:', error);
      toast.error(error.message || 'Failed to create collector');
    } finally {
      setAddingCollector(false);
    }
  };

  const handleDeleteCollector = async (collector) => {
    // Show confirmation dialog
    const confirmDelete = window.confirm(
      `Are you sure you want to delete collector "${collector.name}"?\n\n` +
      `This will:\n` +
      `• Remove the collector from the database\n` +
      `• Unassign all branches (${collector.branchCount} branches)\n` +
      `• This action cannot be undone\n\n` +
      `Type "DELETE" to confirm deletion.`
    );

    if (!confirmDelete) {
      return;
    }

    // Additional confirmation with typing "DELETE"
    const confirmText = window.prompt(
      `To permanently delete collector "${collector.name}", please type "DELETE" (in capital letters):`
    );

    if (confirmText !== 'DELETE') {
      toast.error('Deletion cancelled. You must type "DELETE" exactly to confirm.');
      return;
    }

    try {
      toast.loading(`Deleting collector ${collector.name}...`);

      // Call API to delete/deactivate collector
      const response = await collectorsAPI.deactivate(collector.id);

      toast.dismiss();
      toast.success(`Collector ${collector.name} has been deleted successfully!`);

      // Reload collectors to reflect changes
      await loadCollectors();

    } catch (error) {
      toast.dismiss();
      console.error('❌ Error deleting collector:', error);
      toast.error(error.message || `Failed to delete collector ${collector.name}`);
    }
  };

  const startEditing = (collector, e) => {
    e.stopPropagation();
    setEditingCollector(collector.id);
    setEditedName(collector.name);
  };

  const handleUpdateCollector = async (collectorId) => {
    if (!editedName.trim()) {
      toast.error('Please enter a name');
      return;
    }

    try {
      setUpdatingCollector(true);
      const response = await collectorsAPI.update(collectorId, { name: editedName.trim() });

      if (response.success) {
        toast.success('Collector updated successfully!');
        setEditingCollector(null);
        await loadCollectors();
      } else {
        throw new Error(response.message || 'Failed to update collector');
      }
    } catch (error) {
      console.error('❌ Error updating collector:', error);
      toast.error(error.message || 'Failed to update collector');
    } finally {
      setUpdatingCollector(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-3xl shadow-2xl border p-8">
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          <span className="ml-3 text-gray-600">Loading collectors...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-3xl shadow-2xl border p-4 md:p-8">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6 md:mb-8 gap-4">
        <div>
          <h2 className="text-2xl md:text-3xl font-bold text-gray-900">
            {selectedDay?.isDaily ? 'Daily Kisti Collectors' : 'Select Collector'}
          </h2>
        </div>
        <div className="flex flex-wrap gap-2 md:space-x-3">
          <button
            onClick={loadCollectors}
            className="flex items-center px-3 py-2 md:px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold transition-all text-sm md:text-base"
          >
            <span className="text-base">🔄</span>
            <span className="ml-1 md:ml-2 hidden sm:inline">Refresh</span>
          </button>
          <button
            onClick={onGoBack}
            className="flex items-center px-3 py-2 md:px-4 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-xl font-semibold transition-all text-sm md:text-base"
          >
            <ArrowLeft className="h-4 w-4 mr-1 md:mr-2" />
            <span className="hidden sm:inline">Go Back</span>
            <span className="sm:hidden">Back</span>
          </button>
        </div>
      </div>

      <div className="text-center mb-4 md:mb-6">
        <p className="text-base md:text-lg text-gray-600">
          Selected Day: <span className="font-bold text-blue-600">{selectedDay.name}</span>
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        {collectors.map((collector) => (
          <div key={collector.id} className="relative group">
            <div
              className={`w-full bg-gradient-to-r ${collector.color} text-white p-6 rounded-2xl font-bold shadow-lg transform transition-all duration-300 ${editingCollector === collector.id ? 'scale-105 shadow-2xl ring-4 ring-blue-300' : 'hover:scale-105 hover:shadow-2xl'
                }`}
            >
              <div onClick={() => !editingCollector && onCollectorSelect(collector)} className={!editingCollector ? 'cursor-pointer' : ''}>
                <Users className="h-8 w-8 mx-auto mb-3" />

                {editingCollector === collector.id ? (
                  <div className="space-y-3" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="text"
                      value={editedName}
                      onChange={(e) => setEditedName(e.target.value)}
                      className="w-full px-3 py-2 bg-white/20 border border-white/30 rounded-lg text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-white/50 text-center text-lg"
                      autoFocus
                      placeholder="Enter name"
                    />
                    <div className="flex space-x-2">
                      <button
                        onClick={() => handleUpdateCollector(collector.id)}
                        disabled={updatingCollector}
                        className="flex-1 bg-white/20 hover:bg-white/30 py-2 rounded-lg flex items-center justify-center transition-all"
                      >
                        {updatingCollector ? (
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                        ) : (
                          <><Save className="h-4 w-4 mr-1" /> Save</>
                        )}
                      </button>
                      <button
                        onClick={() => setEditingCollector(null)}
                        disabled={updatingCollector}
                        className="flex-1 bg-white/10 hover:bg-white/20 py-2 rounded-lg flex items-center justify-center transition-all"
                      >
                        <X className="h-4 w-4 mr-1" /> Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="text-xl text-center break-words">
                    {collector.name}
                  </div>
                )}
              </div>
            </div>

            {/* Edit/Delete managed in Admin Control Panel */}
          </div>
        ))}

        {/* Add New Collector Button */}
        <button
          onClick={() => setShowAddForm(true)}
          className="border-2 border-dashed border-gray-300 hover:border-blue-400 hover:bg-blue-50 p-6 rounded-2xl font-bold text-xl text-gray-600 hover:text-blue-600 transition-all duration-300 flex flex-col items-center justify-center"
        >
          <Plus className="h-8 w-8 mb-3" />
          Add New Collector
        </button>
      </div>

      {/* Add Collector Form */}
      {showAddForm && (
        <div className="bg-gray-50 p-6 rounded-2xl border-2 border-dashed border-gray-300">
          <h4 className="text-lg font-semibold text-gray-900 mb-4">
            Add New {selectedDay?.isDaily ? 'Daily Kisti' : ''} Collector
          </h4>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Users className="h-4 w-4 inline mr-1" />
                Collector Name *
              </label>
              <input
                type="text"
                placeholder="Enter collector name"
                value={newCollector.name}
                onChange={(e) => setNewCollector({ ...newCollector, name: e.target.value })}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                autoFocus
              />
            </div>

            {selectedDay?.isDaily && (
              <div className="text-xs text-gray-700 bg-orange-50 p-3 rounded-lg border border-orange-200">
                <strong>📅 Daily Kisti Collector:</strong> This collector will collect installments every day
              </div>
            )}

            <div className="text-xs text-gray-500 bg-blue-50 p-3 rounded-lg">
              <strong>Note:</strong> Collectors are for organizational purposes only. Admin/Manager will handle all collection operations through the system.
            </div>

            <div className="flex space-x-3 pt-4">
              <button
                onClick={handleAddCollector}
                disabled={!newCollector.name.trim() || addingCollector}
                className="flex-1 bg-green-600 hover:bg-green-700 disabled:bg-gray-300 text-white py-3 rounded-xl font-semibold transition-all disabled:cursor-not-allowed flex items-center justify-center"
              >
                {addingCollector ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Adding...
                  </>
                ) : (
                  'Add Collector'
                )}
              </button>
              <button
                onClick={() => {
                  setShowAddForm(false);
                  setNewCollector({
                    name: ''
                  });
                }}
                disabled={addingCollector}
                className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-700 py-3 rounded-xl font-semibold transition-all disabled:cursor-not-allowed"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CollectorSelection;