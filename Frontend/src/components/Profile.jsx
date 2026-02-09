import React, { useState } from 'react';
import { User, Lock, Mail, Phone, Save, Eye, EyeOff, Settings as SettingsIcon, Clock, Camera } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { authAPI } from '../utils/api';

const Profile = () => {
  const { user, updateUser } = useAuth();
  const [activeTab, setActiveTab] = useState('info');
  const [loading, setLoading] = useState(false);
  const [pendingUsers, setPendingUsers] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(false);

  // Profile info state
  const [profileData, setProfileData] = useState({
    name: user?.name || '',
    email: user?.email || '',
    phone: user?.phone || '',
    branch: user?.branch || '',
    branchCode: user?.branchCode || '',
    role: user?.role || '',
    profileImage: user?.profileImage || null
  });
  const [selectedFile, setSelectedFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);

  // Password change state
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });

  const [showPasswords, setShowPasswords] = useState({
    current: false,
    new: false,
    confirm: false
  });

  // System settings state
  const [systemSettings, setSystemSettings] = useState({
    loginTimeRestriction: {
      enabled: false,
      startTime: '00:00',
      endTime: '23:59'
    }
  });
  const [loadingSettings, setLoadingSettings] = useState(false);

  // Check if current user is super admin
  const isSuperAdmin = user?.email === 'anarul258011@gmail.com';

  const handleProfileChange = (e) => {
    setProfileData({ ...profileData, [e.target.name]: e.target.value });
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setSelectedFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handlePasswordChange = (e) => {
    setPasswordData({ ...passwordData, [e.target.name]: e.target.value });
  };

  const handleProfileUpdate = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {

      const formData = new FormData();
      formData.append('name', profileData.name);
      formData.append('phone', profileData.phone);
      if (selectedFile) {
        formData.append('profileImage', selectedFile);
      }

      const response = await authAPI.updateProfile(formData);

      if (response.success) {
        updateUser(response.user);
        toast.success('Profile updated successfully!');
      }
    } catch (error) {
      console.error('Profile update error:', error);
      toast.error(error.message || 'Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordUpdate = async (e) => {
    e.preventDefault();

    // Validation
    if (!passwordData.currentPassword) {
      toast.error('Please enter your current password');
      return;
    }

    if (passwordData.newPassword.length < 6) {
      toast.error('New password must be at least 6 characters');
      return;
    }

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      toast.error('New passwords do not match');
      return;
    }

    setLoading(true);

    try {
      const response = await authAPI.changePassword({
        currentPassword: passwordData.currentPassword,
        newPassword: passwordData.newPassword,
        confirmPassword: passwordData.confirmPassword
      });

      if (response.success) {
        toast.success('Password changed successfully!');
        setPasswordData({
          currentPassword: '',
          newPassword: '',
          confirmPassword: ''
        });
      }
    } catch (error) {
      console.error('Password change error:', error);
      toast.error(error.message || 'Failed to change password');
    } finally {
      setLoading(false);
    }
  };

  const togglePasswordVisibility = (field) => {
    setShowPasswords({ ...showPasswords, [field]: !showPasswords[field] });
  };

  // Fetch pending users if super admin
  const fetchPendingUsers = async () => {
    if (user?.role !== 'admin') return;

    setLoadingUsers(true);
    try {
      const response = await authAPI.getPendingUsers();
      if (response.success) {
        setPendingUsers(response.users);
      }
    } catch (error) {
      console.error('Error fetching pending users:', error);
      toast.error('Failed to load pending users');
    } finally {
      setLoadingUsers(false);
    }
  };

  // Fetch all users if super admin
  const fetchAllUsers = async () => {
    if (user?.role !== 'admin') return;

    setLoadingUsers(true);
    try {
      const response = await authAPI.getAllUsers();
      if (response.success) {
        setAllUsers(response.users);
      }
    } catch (error) {
      console.error('Error fetching all users:', error);
      toast.error('Failed to load users');
    } finally {
      setLoadingUsers(false);
    }
  };

  // Approve user
  const handleApproveUser = async (userId, userName) => {
    if (!window.confirm(`Are you sure you want to approve ${userName}?`)) return;

    try {
      const response = await authAPI.approveUser(userId);
      if (response.success) {
        toast.success(response.message);
        // Refresh both lists
        await fetchPendingUsers();
        await fetchAllUsers();
      }
    } catch (error) {
      console.error('Error approving user:', error);
      toast.error(error.message || 'Failed to approve user');
    }
  };

  // Reject user
  const handleRejectUser = async (userId, userName) => {
    if (!window.confirm(`Are you sure you want to reject and delete ${userName}'s account? This action cannot be undone.`)) return;

    try {
      const response = await authAPI.rejectUser(userId);
      if (response.success) {
        toast.success(response.message);
        fetchPendingUsers();
        fetchAllUsers();
      }
    } catch (error) {
      console.error('Error rejecting user:', error);
      toast.error(error.message || 'Failed to reject user');
    }
  };

  // Activate user
  const handleActivateUser = async (userId, userName) => {
    if (!window.confirm(`Are you sure you want to activate ${userName}?`)) return;

    try {
      const response = await authAPI.activateUser(userId);
      if (response.success) {
        toast.success(response.message);
        fetchAllUsers();
      }
    } catch (error) {
      console.error('Error activating user:', error);
      toast.error(error.message || 'Failed to activate user');
    }
  };

  // Deactivate user
  const handleDeactivateUser = async (userId, userName) => {
    if (!window.confirm(`Are you sure you want to deactivate ${userName}? They will not be able to login.`)) return;

    try {
      const response = await authAPI.deactivateUser(userId);
      if (response.success) {
        toast.success(response.message);
        fetchAllUsers();
      }
    } catch (error) {
      console.error('Error deactivating user:', error);
      toast.error(error.message || 'Failed to deactivate user');
    }
  };

  // Delete user permanently
  const handleDeleteUser = async (userId, userName) => {
    if (!window.confirm(`⚠️ WARNING: Are you sure you want to PERMANENTLY DELETE ${userName}'s account? This action CANNOT be undone!`)) return;

    try {
      const response = await authAPI.deleteUser(userId);
      if (response.success) {
        toast.success(response.message);
        fetchAllUsers();
      }
    } catch (error) {
      console.error('Error deleting user:', error);
      toast.error(error.message || 'Failed to delete user');
    }
  };

  // Fetch system settings
  const fetchSystemSettings = async () => {
    if (!isSuperAdmin) return;

    setLoadingSettings(true);
    try {
      const response = await authAPI.getSystemSettings();
      if (response.success) {
        setSystemSettings(response.settings);
      }
    } catch (error) {
      console.error('Error fetching system settings:', error);
      toast.error('Failed to load system settings');
    } finally {
      setLoadingSettings(false);
    }
  };

  // Update system settings
  const handleSystemSettingsUpdate = async (e) => {
    e.preventDefault();
    setLoadingSettings(true);

    try {
      const response = await authAPI.updateSystemSettings(systemSettings);
      if (response.success) {
        toast.success('System settings updated successfully!');
        setSystemSettings(response.settings);
      }
    } catch (error) {
      console.error('Error updating system settings:', error);
      toast.error(error.message || 'Failed to update system settings');
    } finally {
      setLoadingSettings(false);
    }
  };

  // Handle system settings changes
  const handleSystemSettingsChange = (field, value) => {
    setSystemSettings(prev => ({
      ...prev,
      loginTimeRestriction: {
        ...prev.loginTimeRestriction,
        [field]: value
      }
    }));
  };

  // Load users when admin management tab is opened
  React.useEffect(() => {
    if (activeTab === 'admin' && user?.role === 'admin') {
      fetchPendingUsers();
      fetchAllUsers();
    }
  }, [activeTab]);

  // Load system settings when system tab is opened
  React.useEffect(() => {
    if (activeTab === 'system' && isSuperAdmin) {
      fetchSystemSettings();
    }
  }, [activeTab]);

  return (
    <div className="max-w-4xl mx-auto">
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-indigo-900 via-purple-800 to-indigo-900 px-6 py-8">
          <div className="flex items-center space-x-4">
            <div className="relative group">
              <div className="bg-gradient-to-br from-purple-600 to-indigo-600 p-1 rounded-full border-4 border-purple-500 shadow-lg shadow-purple-500/30 w-24 h-24 flex items-center justify-center overflow-hidden">
                {imagePreview || profileData.profileImage ? (
                  <img
                    src={imagePreview || `${import.meta.env.VITE_API_URL?.replace('/api', '')}${profileData.profileImage}`}
                    alt="Profile"
                    className="w-full h-full object-cover rounded-full"
                    onError={(e) => {
                      e.target.onerror = null;
                      e.target.style.display = 'none';
                      e.target.parentElement.classList.add('flex', 'items-center', 'justify-center');
                      // We can insert a fallback icon here if needed via JS or just show the parent background
                    }}
                  />
                ) : (
                  <User className="h-12 w-12 text-white" />
                )}

                {/* Fallback icon if image fails to load or none exists (simplification for layout) */}
                {(!imagePreview && !profileData.profileImage) && <User className="h-12 w-12 text-white absolute" />}
              </div>

              <label htmlFor="profile-upload" className="absolute bottom-0 right-0 bg-white text-purple-600 p-2 rounded-full shadow-lg cursor-pointer hover:bg-gray-100 transition-colors">
                <Camera className="w-4 h-4" />
                <input
                  type="file"
                  id="profile-upload"
                  className="hidden"
                  accept="image/*"
                  onChange={handleImageChange}
                />
              </label>
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">{user?.name}</h1>
              <p className="text-purple-200">{user?.email}</p>
              <span className="inline-block mt-2 px-3 py-1 bg-gradient-to-r from-purple-500 to-indigo-500 text-white text-sm font-medium rounded-full shadow-md">
                {user?.role === 'admin' ? 'Admin' :
                  user?.role === 'manager' ? 'Manager' :
                    user?.role === 'collector' ? 'Collector' : 'Staff'}
              </span>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200 overflow-x-auto">
          <nav className="flex -mb-px whitespace-nowrap">
            <button
              onClick={() => setActiveTab('info')}
              className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors ${activeTab === 'info'
                ? 'border-purple-600 text-purple-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
            >
              <User className="inline-block w-5 h-5 mr-2" />
              Profile Information
            </button>
            <button
              onClick={() => setActiveTab('password')}
              className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors ${activeTab === 'password'
                ? 'border-purple-600 text-purple-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
            >
              <Lock className="inline-block w-5 h-5 mr-2" />
              Change Password
            </button>
            {user?.role === 'admin' && (
              <button
                onClick={() => setActiveTab('admin')}
                className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors ${activeTab === 'admin'
                  ? 'border-purple-600 text-purple-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
              >
                <User className="inline-block w-5 h-5 mr-2" />
                Admin Management
              </button>
            )}
            {isSuperAdmin && (
              <button
                onClick={() => setActiveTab('system')}
                className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors ${activeTab === 'system'
                  ? 'border-purple-600 text-purple-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
              >
                <SettingsIcon className="inline-block w-5 h-5 mr-2" />
                System Management
              </button>
            )}
          </nav>
        </div>

        {/* Tab Content */}
        <div className="p-6">
          {activeTab === 'info' && (
            <form onSubmit={handleProfileUpdate} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Name */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <User className="inline-block w-4 h-4 mr-1" />
                    Full Name
                  </label>
                  <input
                    type="text"
                    name="name"
                    value={profileData.name}
                    onChange={handleProfileChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    required
                  />
                </div>

                {/* Email */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <Mail className="inline-block w-4 h-4 mr-1" />
                    Email
                    {user?.role !== 'admin' && <span className="text-xs text-gray-500 ml-2">(Read-only)</span>}
                  </label>
                  <input
                    type="email"
                    name="email"
                    value={profileData.email}
                    onChange={handleProfileChange}
                    className={`w-full px-4 py-2 border border-gray-300 rounded-lg ${user?.role === 'admin'
                      ? 'focus:ring-2 focus:ring-purple-500 focus:border-transparent'
                      : 'bg-gray-100 cursor-not-allowed'
                      }`}
                    disabled={user?.role !== 'admin'}
                  />
                </div>

                {/* Phone */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <Phone className="inline-block w-4 h-4 mr-1" />
                    Phone Number
                  </label>
                  <input
                    type="text"
                    name="phone"
                    value={profileData.phone}
                    onChange={handleProfileChange}
                    placeholder="01XXXXXXXXX"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  />
                </div>

                {/* Role (Read-only) */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <User className="inline-block w-4 h-4 mr-1" />
                    Role
                  </label>
                  <input
                    type="text"
                    value={profileData.role.charAt(0).toUpperCase() + profileData.role.slice(1)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-100 cursor-not-allowed"
                    disabled
                  />
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={loading}
                  className="flex items-center px-6 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-lg hover:from-purple-700 hover:to-indigo-700 transition-all shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Save className="w-5 h-5 mr-2" />
                  {loading ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          )}

          {activeTab === 'password' && (
            <form onSubmit={handlePasswordUpdate} className="space-y-6 max-w-md">
              {/* Current Password */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <Lock className="inline-block w-4 h-4 mr-1" />
                  Current Password
                </label>
                <div className="relative">
                  <input
                    type={showPasswords.current ? 'text' : 'password'}
                    name="currentPassword"
                    value={passwordData.currentPassword}
                    onChange={handlePasswordChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent pr-10"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => togglePasswordVisibility('current')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showPasswords.current ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              {/* New Password */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <Lock className="inline-block w-4 h-4 mr-1" />
                  New Password
                </label>
                <div className="relative">
                  <input
                    type={showPasswords.new ? 'text' : 'password'}
                    name="newPassword"
                    value={passwordData.newPassword}
                    onChange={handlePasswordChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-transparent pr-10"
                    required
                    minLength="6"
                  />
                  <button
                    type="button"
                    onClick={() => togglePasswordVisibility('new')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showPasswords.new ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
                <p className="mt-1 text-sm text-gray-500">Password must be at least 6 characters</p>
              </div>

              {/* Confirm Password */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <Lock className="inline-block w-4 h-4 mr-1" />
                  Confirm New Password
                </label>
                <div className="relative">
                  <input
                    type={showPasswords.confirm ? 'text' : 'password'}
                    name="confirmPassword"
                    value={passwordData.confirmPassword}
                    onChange={handlePasswordChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-transparent pr-10"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => togglePasswordVisibility('confirm')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showPasswords.confirm ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                <div className="text-sm text-purple-900">
                  <strong>Security Tips:</strong>
                  <ul className="list-disc list-inside mt-2 space-y-1">
                    <li>Use a strong password with letters, numbers, and symbols</li>
                    <li>Don't share your password with anyone</li>
                    <li>Change your password regularly</li>
                  </ul>
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={loading}
                  className="flex items-center px-6 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-lg hover:from-purple-700 hover:to-indigo-700 transition-all shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Lock className="w-5 h-5 mr-2" />
                  {loading ? 'Changing...' : 'Change Password'}
                </button>
              </div>
            </form>
          )}

          {activeTab === 'admin' && user?.role === 'admin' && (
            <div className="space-y-6">
              {/* Pending Users Section */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                  <User className="w-5 h-5 mr-2" />
                  Pending Approvals ({pendingUsers.length})
                </h3>
                {loadingUsers ? (
                  <div className="text-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto"></div>
                    <p className="mt-2 text-gray-600">Loading users...</p>
                  </div>
                ) : pendingUsers.length === 0 ? (
                  <div className="bg-gray-50 rounded-lg p-6 text-center">
                    <p className="text-gray-600">No pending user approvals</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {pendingUsers.map((pendingUser) => (
                      <div key={pendingUser._id} className="bg-white border border-gray-200 rounded-lg p-4 flex items-center justify-between">
                        <div className="flex-1">
                          <h4 className="font-medium text-gray-900">{pendingUser.name}</h4>
                          <p className="text-sm text-gray-600">{pendingUser.email}</p>
                          <div className="flex items-center gap-3 mt-2">
                            <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                              {pendingUser.role}
                            </span>
                            {pendingUser.phone && (
                              <span className="text-xs text-gray-500 flex items-center">
                                <Phone className="w-3 h-3 mr-1" />
                                {pendingUser.phone}
                              </span>
                            )}
                            <span className="text-xs text-gray-500">
                              {new Date(pendingUser.createdAt).toLocaleDateString()}
                            </span>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleApproveUser(pendingUser._id, pendingUser.name)}
                            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm"
                          >
                            Approve
                          </button>
                          <button
                            onClick={() => handleRejectUser(pendingUser._id, pendingUser.name)}
                            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm"
                          >
                            Reject
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* All Users Section */}
              <div className="mt-8">
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                  <User className="w-5 h-5 mr-2" />
                  All Users ({allUsers.length})
                </h3>
                {loadingUsers ? (
                  <div className="text-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-yellow-600 mx-auto"></div>
                    <p className="mt-2 text-gray-600">Loading users...</p>
                  </div>
                ) : (
                  <div className="bg-white border border-gray-200 rounded-lg overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Role</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Joined</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {allUsers.map((listUser) => {
                          const isCurrentUser = listUser._id === user._id;
                          const isSuperAdmin = listUser.role === 'admin';
                          const canModify = !isCurrentUser && !isSuperAdmin;

                          return (
                            <tr key={listUser._id}>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="flex items-center">
                                  <div className="text-sm font-medium text-gray-900">{listUser.name}</div>
                                  {listUser.role === 'admin' && (
                                    <span className="ml-2 text-xs bg-purple-100 text-purple-800 px-2 py-1 rounded">Super Admin</span>
                                  )}
                                </div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{listUser.email}</td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                                  {listUser.role}
                                </span>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="flex flex-col gap-1">
                                  {listUser.isApproved ? (
                                    <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">Approved</span>
                                  ) : (
                                    <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded">Pending</span>
                                  )}
                                  {listUser.isActive ? (
                                    <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">Active</span>
                                  ) : (
                                    <span className="text-xs bg-red-100 text-red-800 px-2 py-1 rounded">Inactive</span>
                                  )}
                                </div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                                {new Date(listUser.createdAt).toLocaleDateString()}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm">
                                {canModify ? (
                                  <div className="flex gap-1 items-center">
                                    {/* Show Approve button if user is pending */}
                                    {!listUser.isApproved && (
                                      <button
                                        onClick={() => handleApproveUser(listUser._id, listUser.name)}
                                        className="px-2 py-1 bg-green-600 text-white rounded hover:bg-green-700 transition-colors text-xs font-medium"
                                        title="Approve user"
                                      >
                                        ✓
                                      </button>
                                    )}
                                    {/* Show Activate/Deactivate button */}
                                    {listUser.isActive ? (
                                      <button
                                        onClick={() => handleDeactivateUser(listUser._id, listUser.name)}
                                        className="px-2 py-1 bg-orange-600 text-white rounded hover:bg-orange-700 transition-colors text-xs font-medium"
                                        title="Deactivate user"
                                      >
                                        ⏸
                                      </button>
                                    ) : (
                                      <button
                                        onClick={() => handleActivateUser(listUser._id, listUser.name)}
                                        className="px-2 py-1 bg-green-600 text-white rounded hover:bg-green-700 transition-colors text-xs font-medium"
                                        title="Activate user"
                                      >
                                        ▶
                                      </button>
                                    )}
                                    {/* Show Delete button */}
                                    <button
                                      onClick={() => handleDeleteUser(listUser._id, listUser.name)}
                                      className="px-2 py-1 bg-red-600 text-white rounded hover:bg-red-700 transition-colors text-xs font-medium"
                                      title="Delete user permanently"
                                    >
                                      🗑
                                    </button>
                                  </div>
                                ) : (
                                  <span className="text-xs text-gray-400">
                                    {isCurrentUser ? '(You)' : '(Protected)'}
                                  </span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* System Management Tab - Only for Super Admin */}
          {activeTab === 'system' && isSuperAdmin && (
            <div className="space-y-6">
              <div className="bg-gradient-to-r from-purple-50 to-indigo-50 border border-purple-200 rounded-lg p-6">
                <div className="flex items-center space-x-3 mb-4">
                  <Clock className="w-6 h-6 text-purple-600" />
                  <h3 className="text-lg font-semibold text-gray-900">Login Time Restriction</h3>
                </div>
                <p className="text-sm text-gray-600 mb-6">
                  নিয়ন্ত্রণ করুন কখন users login করতে পারবে। Enable করলে নির্ধারিত সময়ের বাইরে অন্য admins login করতে পারবে না।
                </p>

                <form onSubmit={handleSystemSettingsUpdate} className="space-y-6">
                  {/* Enable/Disable Toggle */}
                  <div className="flex items-center justify-between p-4 bg-white rounded-lg border border-purple-200">
                    <div>
                      <label className="text-sm font-medium text-gray-900">Enable Time Restriction</label>
                      <p className="text-xs text-gray-500 mt-1">সময় নিয়ন্ত্রণ চালু/বন্ধ করুন</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleSystemSettingsChange('enabled', !systemSettings.loginTimeRestriction.enabled)}
                      className={`relative inline-flex h-8 w-14 items-center rounded-full transition-colors ${systemSettings.loginTimeRestriction.enabled
                        ? 'bg-purple-600'
                        : 'bg-gray-300'
                        }`}
                    >
                      <span
                        className={`inline-block h-6 w-6 transform rounded-full bg-white transition-transform ${systemSettings.loginTimeRestriction.enabled
                          ? 'translate-x-7'
                          : 'translate-x-1'
                          }`}
                      />
                    </button>
                  </div>

                  {/* Time Range Inputs */}
                  {systemSettings.loginTimeRestriction.enabled && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {/* Start Time */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          <Clock className="inline-block w-4 h-4 mr-1" />
                          Login Start Time (শুরু সময়)
                        </label>
                        <input
                          type="time"
                          value={systemSettings.loginTimeRestriction.startTime}
                          onChange={(e) => handleSystemSettingsChange('startTime', e.target.value)}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                          required
                        />
                        <p className="mt-1 text-xs text-gray-500">Login করা শুরু হবে এই সময় থেকে</p>
                      </div>

                      {/* End Time */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          <Clock className="inline-block w-4 h-4 mr-1" />
                          Login End Time (শেষ সময়)
                        </label>
                        <input
                          type="time"
                          value={systemSettings.loginTimeRestriction.endTime}
                          onChange={(e) => handleSystemSettingsChange('endTime', e.target.value)}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                          required
                        />
                        <p className="mt-1 text-xs text-gray-500">Login করা শেষ হবে এই সময়ে</p>
                      </div>
                    </div>
                  )}

                  {/* Info Box */}
                  <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                    <div className="text-sm text-purple-900">
                      <strong>⚠️ Important:</strong>
                      <ul className="list-disc list-inside mt-2 space-y-1">
                        <li>শুধুমাত্র আপনার account (anarul258011@gmail.com) সবসময় login করতে পারবে</li>
                        <li>অন্য সব admins নির্ধারিত সময়ের মধ্যেই login করতে পারবে</li>
                        <li>Login page এ একটা message দেখাবে কখন login করা যাবে</li>
                      </ul>
                    </div>
                  </div>

                  {/* Save Button */}
                  <div className="flex justify-end">
                    <button
                      type="submit"
                      disabled={loadingSettings}
                      className="flex items-center px-6 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-lg hover:from-purple-700 hover:to-indigo-700 transition-all shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Save className="w-5 h-5 mr-2" />
                      {loadingSettings ? 'Saving...' : 'Save Settings'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Profile;
