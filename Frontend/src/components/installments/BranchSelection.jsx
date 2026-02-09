import React, { useState, useEffect } from 'react';
import { ArrowLeft, Plus, MapPin, Building } from 'lucide-react';
import { branchesAPI } from '../../utils/api';
import toast from 'react-hot-toast';

const BranchSelection = ({ selectedDay, selectedCollector, onBranchSelect, onGoBack, onShowCollectionSheet }) => {
  const [showAddForm, setShowAddForm] = useState(false);
  const [addingBranch, setAddingBranch] = useState(false);
  const [loading, setLoading] = useState(true);
  const [branches, setBranches] = useState([]);
  const [newBranch, setNewBranch] = useState({
    branchName: '',
    branchCode: ''
  });

  // Load branches for the selected collector
  useEffect(() => {
    loadBranches();
  }, [selectedCollector]);

  // Mock branches for fallback (empty - will show "no branches found")
  const mockBranches = [];

  const loadBranches = async () => {
    try {
      setLoading(true);
      console.log('🔍 Loading branches for collector:', selectedCollector.id);
      
      const response = await branchesAPI.getByCollector(selectedCollector.id);
      console.log('📡 Branches API response:', response);
      
      if (response.success && response.data && response.data.length > 0) {
        // Debug: Log each branch with member count
        response.data.forEach(branch => {
          console.log(`📍 Branch: ${branch.name} (${branch.branchCode}) - Members: ${branch.memberCount || 0}`);
        });
        setBranches(response.data);
        console.log(`✅ Loaded ${response.data.length} branches for collector`);
      } else {
        console.log('⚠️ No branches found from API');
        setBranches([]);
      }
    } catch (error) {
      console.error('❌ Error loading branches:', error);
      setBranches([]);
      toast.error('Error loading branches');
    } finally {
      setLoading(false);
    }
  };

  const handleAddBranch = async () => {
    if (!newBranch.branchName.trim() || !newBranch.branchCode.trim()) {
      toast.error('Please fill in all required fields');
      return;
    }

    // Validate branch code format (4 digits)
    if (!/^\d{4}$/.test(newBranch.branchCode.trim())) {
      toast.error('Branch code must be exactly 4 digits');
      return;
    }

    // Check if branch code already exists
    const existingBranch = branches.find(branch => branch.branchCode === newBranch.branchCode.trim());
    if (existingBranch) {
      toast.error('Branch code already exists');
      return;
    }

    try {
      setAddingBranch(true);
      console.log('➕ Adding new branch:', newBranch);

      // Create branch data
      const branchData = {
        name: newBranch.branchName.trim(),
        branchCode: newBranch.branchCode.trim(),
        assignedCollector: selectedCollector.id
      };

      console.log('📤 Sending branch data to API:', branchData);

      // Call API to create branch in database
      const response = await branchesAPI.create(branchData);
      console.log('✅ Branch created successfully:', response);

      toast.success(`Branch ${newBranch.branchName} added successfully!`);

      // Reset form
      setNewBranch({
        branchName: '',
        branchCode: ''
      });
      setShowAddForm(false);

      // Reload branches from database
      console.log('🔄 Reloading branches from database...');
      await loadBranches();

    } catch (error) {
      console.error('❌ Error adding branch:', error);
      toast.error(error.message || 'Failed to add branch');
    } finally {
      setAddingBranch(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-3xl shadow-2xl border p-8">
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          <span className="ml-3 text-gray-600">Loading branches...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-3xl shadow-2xl border p-8">
      <div className="flex items-center justify-between mb-8">
        <h2 className="text-3xl font-bold text-gray-900">Select Branch</h2>
        <div className="flex space-x-3">
          {branches.length > 0 && (
            <button
              onClick={() => onShowCollectionSheet(branches[0])}
              className="flex items-center px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-xl font-semibold transition-all"
            >
              📋 Collection Sheet
            </button>
          )}
          <button
            onClick={onGoBack}
            className="flex items-center px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-xl font-semibold transition-all"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Go Back
          </button>
        </div>
      </div>
      
      <div className="text-center mb-6">
        <p className="text-lg text-gray-600">
          Day: <span className="font-bold text-blue-600">{selectedDay.name}</span> | 
          Collector: <span className="font-bold text-green-600">{selectedCollector.name}</span>
        </p>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        {branches.map((branch) => (
          <button
            key={branch.branchCode}
            onClick={() => onBranchSelect({ 
              code: branch.branchCode, 
              name: branch.name, 
              members: branch.members || [],
              collectorName: selectedCollector.name 
            })}
            className="flex items-center justify-between p-6 bg-gray-50 hover:bg-blue-50 border-2 border-gray-200 hover:border-blue-300 rounded-2xl transition-all transform hover:scale-105"
          >
            <div className="flex items-center space-x-4">
              <div className="bg-blue-600 text-white px-4 py-3 rounded-xl font-bold text-xl">
                {branch.branchCode}
              </div>
              <div className="text-left">
                <h4 className="font-semibold text-gray-900 text-lg">{branch.name}</h4>
                <p className="text-gray-600">
                  {branch.memberCount !== undefined ? branch.memberCount : 0} members
                </p>
              </div>
            </div>
            <div className="text-blue-600 text-2xl">
              →
            </div>
          </button>
        ))}

        {/* Add New Branch Button */}
        <button
          onClick={() => setShowAddForm(true)}
          className="border-2 border-dashed border-gray-300 hover:border-green-400 hover:bg-green-50 p-6 rounded-2xl font-bold text-xl text-gray-600 hover:text-green-600 transition-all duration-300 flex flex-col items-center justify-center"
        >
          <Plus className="h-8 w-8 mb-3" />
          Add New Branch
        </button>
      </div>

      {/* Add Branch Form */}
      {showAddForm && (
        <div className="bg-gray-50 p-6 rounded-2xl border-2 border-dashed border-gray-300">
          <h4 className="text-lg font-semibold text-gray-900 mb-4">Add New Branch</h4>
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <Building className="h-4 w-4 inline mr-1" />
                  Branch Name *
                </label>
                <input
                  type="text"
                  placeholder="Enter branch name"
                  value={newBranch.branchName}
                  onChange={(e) => setNewBranch({ ...newBranch, branchName: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-green-500"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <MapPin className="h-4 w-4 inline mr-1" />
                  Branch Code *
                </label>
                <input
                  type="text"
                  placeholder="B001"
                  maxLength={4}
                  value={newBranch.branchCode}
                  onChange={(e) => setNewBranch({ ...newBranch, branchCode: e.target.value.toUpperCase() })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-green-500"
                />
              </div>
            </div>

            <div className="text-xs text-gray-500 bg-green-50 p-3 rounded-lg">
              <strong>Note:</strong> The branch will be added to {selectedCollector.name}'s collection schedule for {selectedDay.name}.
            </div>
            
            <div className="flex space-x-3 pt-4">
              <button
                onClick={handleAddBranch}
                disabled={!newBranch.branchName.trim() || !newBranch.branchCode.trim() || addingBranch}
                className="flex-1 bg-green-600 hover:bg-green-700 disabled:bg-gray-300 text-white py-3 rounded-xl font-semibold transition-all disabled:cursor-not-allowed flex items-center justify-center"
              >
                {addingBranch ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Adding...
                  </>
                ) : (
                  'Add Branch'
                )}
              </button>
              <button
                onClick={() => {
                  setShowAddForm(false);
                  setNewBranch({
                    branchName: '',
                    branchCode: ''
                  });
                }}
                disabled={addingBranch}
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

export default BranchSelection;
