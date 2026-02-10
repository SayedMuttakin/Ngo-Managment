import React, { useState, useEffect } from 'react';
import { membersAPI } from '../utils/api';
import toast from 'react-hot-toast';
import {
  UserX,
  UserPlus,
  Activity,
  User,
  Phone,
  Building,
  Calendar,
  RefreshCw
} from 'lucide-react';

const ActivityLog = () => {
  const [deletedMembers, setDeletedMembers] = useState([]);
  const [joinedMembers, setJoinedMembers] = useState([]);
  const [loading, setLoading] = useState(true);

  // Get Bangladesh date (UTC+6)
  const getBangladeshDate = () => {
    return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Dhaka' });
  };

  const [selectedDate, setSelectedDate] = useState(getBangladeshDate());

  useEffect(() => {
    fetchActivityByDate();
  }, [selectedDate]);

  const fetchActivityByDate = async () => {
    try {
      setLoading(true);
      const response = await membersAPI.getAll({
        limit: 1000,
        includeDeleted: true
      });

      if (response.success) {
        // Parse selected date to compare strictly by string YYYY-MM-DD
        const targetDateStr = selectedDate;

        console.log('🔍 Total members from API:', response.data.length);
        console.log('🔍 Filter date (BD):', targetDateStr);

        // Helper to check if a date string matches the target date in BD time
        const isDateMatch = (dateString) => {
          if (!dateString) return false;
          // Convert the UTC date string from DB to BD date string (YYYY-MM-DD)
          const bdDateStr = new Date(dateString).toLocaleDateString('en-CA', {
            timeZone: 'Asia/Dhaka'
          });
          return bdDateStr === targetDateStr;
        };

        // Filter deleted members (selected date)
        const deleted = response.data.filter(member => {
          if (member.isActive === false && member.updatedAt) {
            return isDateMatch(member.updatedAt);
          }
          return false;
        });

        // Filter joined members (selected date)
        const joined = response.data.filter(member => {
          if (member.isActive !== false && member.createdAt) {
            return isDateMatch(member.createdAt);
          }
          return false;
        });

        console.log('📊 Date:', selectedDate, 'Deleted:', deleted.length, 'Joined:', joined.length);

        setDeletedMembers(deleted);
        setJoinedMembers(joined);
      } else {
        toast.error('Failed to load activity');
      }
    } catch (error) {
      console.error('Error fetching activity:', error);
      toast.error('Error loading activity');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading activity...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-xl shadow-sm border p-6">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center space-x-3">
            <div className="p-3 bg-gradient-to-br from-blue-100 to-purple-100 rounded-lg">
              <Activity className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Member Activity Log</h1>
              <p className="text-sm text-gray-600">Track member additions and deletions by date</p>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <div className="flex items-center space-x-2">
              <Calendar className="h-5 w-5 text-gray-500" />
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                max={getBangladeshDate()}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
              />
            </div>
            <button
              onClick={fetchActivityByDate}
              className="inline-flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </button>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow-sm border p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Members Deleted</p>
              <p className="text-3xl font-bold text-red-600">{deletedMembers.length}</p>
              <p className="text-xs text-gray-500 mt-1">{new Date(selectedDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</p>
            </div>
            <div className="p-3 bg-red-100 rounded-lg">
              <UserX className="h-8 w-8 text-red-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Members Joined</p>
              <p className="text-3xl font-bold text-green-600">{joinedMembers.length}</p>
              <p className="text-xs text-gray-500 mt-1">{new Date(selectedDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</p>
            </div>
            <div className="p-3 bg-green-100 rounded-lg">
              <UserPlus className="h-8 w-8 text-green-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Deleted Members Section */}
      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        <div className="bg-red-50 border-b border-red-200 px-6 py-4">
          <div className="flex items-center space-x-2">
            <UserX className="h-5 w-5 text-red-600" />
            <h2 className="text-lg font-semibold text-red-900">Members Deleted ({deletedMembers.length})</h2>
          </div>
        </div>
        {deletedMembers.length === 0 ? (
          <div className="text-center py-12">
            <UserX className="h-12 w-12 text-gray-400 mx-auto mb-3" />
            <p className="text-gray-600">No members deleted on this date</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Member Info
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Contact
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Branch
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Collector
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Deleted Time
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {deletedMembers.map((member) => (
                  <tr key={member._id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="flex-shrink-0 h-10 w-10 bg-red-100 rounded-full flex items-center justify-center">
                          <User className="h-5 w-5 text-red-600" />
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-medium text-gray-900">{member.name}</div>
                          <div className="text-sm text-gray-500">Code: {member.memberCode || 'N/A'}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center text-sm text-gray-900">
                        <Phone className="h-4 w-4 mr-2 text-gray-400" />
                        {member.phone || 'N/A'}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center text-sm text-gray-900">
                        <Building className="h-4 w-4 mr-2 text-gray-400" />
                        {member.branchCode && member.branch ? `${member.branchCode} - ${member.branch}` : member.branch || 'N/A'}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {member.assignedCollector?.name || 'Not Assigned'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {member.updatedAt ? new Date(member.updatedAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : 'N/A'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Joined Members Section */}
      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        <div className="bg-green-50 border-b border-green-200 px-6 py-4">
          <div className="flex items-center space-x-2">
            <UserPlus className="h-5 w-5 text-green-600" />
            <h2 className="text-lg font-semibold text-green-900">Members Joined ({joinedMembers.length})</h2>
          </div>
        </div>
        {joinedMembers.length === 0 ? (
          <div className="text-center py-12">
            <UserPlus className="h-12 w-12 text-gray-400 mx-auto mb-3" />
            <p className="text-gray-600">No new members joined on this date</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Member Info
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Contact
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Branch
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Collector
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Join Time
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {joinedMembers.map((member) => (
                  <tr key={member._id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="flex-shrink-0 h-10 w-10 bg-green-100 rounded-full flex items-center justify-center">
                          <User className="h-5 w-5 text-green-600" />
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-medium text-gray-900">{member.name}</div>
                          <div className="text-sm text-gray-500">Code: {member.memberCode || 'N/A'}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center text-sm text-gray-900">
                        <Phone className="h-4 w-4 mr-2 text-gray-400" />
                        {member.phone || 'N/A'}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center text-sm text-gray-900">
                        <Building className="h-4 w-4 mr-2 text-gray-400" />
                        {member.branchCode && member.branch ? `${member.branchCode} - ${member.branch}` : member.branch || 'N/A'}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {member.assignedCollector?.name || 'Not Assigned'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {member.createdAt ? new Date(member.createdAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : 'N/A'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default ActivityLog;
