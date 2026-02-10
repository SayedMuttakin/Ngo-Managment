import React, { useState, useEffect } from 'react';
import { Wallet, User, Calendar, DollarSign, Users, Clock, RefreshCw, Download, AlertCircle, PiggyBank } from 'lucide-react';
import { dashboardAPI } from '../utils/api';
import { getCurrentBDDate, formatBDDateLong } from '../utils/dateUtils';
import toast from 'react-hot-toast';

const DailySavings = () => {
  const [selectedDate, setSelectedDate] = useState(getCurrentBDDate()); // Bangladesh date
  const [savingsData, setSavingsData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Fetch daily savings data from API
  const fetchDailySavings = async (date = selectedDate) => {
    try {
      setLoading(true);
      console.log(`📅 Fetching daily savings for date: ${date}`);

      const apiResponse = await dashboardAPI.getDailySavings(date);
      if (apiResponse.success && apiResponse.data) {
        const { summary, collectors } = apiResponse.data;

        // Format data for frontend
        const formattedData = {
          date: date,
          totalSavings: summary.totalSavings || 0,
          activeCollectors: collectors.length,
          collectorsWithSavings: summary.collectorsWithSavings || 0,
          collectors: collectors.map(c => ({
            id: c.id,
            name: c.name,
            totalSavings: c.totalSavings || 0,
            membersSavedToday: c.membersSavedToday || 0,
            totalMembers: c.totalMembers || 0,
            branches: c.branches || [],
            branchCount: c.branchCount || 0,
            lastUpdated: c.lastUpdated,
            savingsTransactions: c.savingsTransactions || 0
          })),
          lastUpdated: apiResponse.data.lastUpdated
        };

        setSavingsData(formattedData);
        console.log('✅ Savings data loaded:', formattedData);
      }

      setLoading(false);
    } catch (error) {
      console.error('Error fetching daily savings:', error);
      toast.error('Failed to load savings data');
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDailySavings(selectedDate);
  }, [selectedDate]);

  // Handle date change
  const handleDateChange = (e) => {
    setSelectedDate(e.target.value);
  };

  // Handle refresh
  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchDailySavings(selectedDate);
    setRefreshing(false);
    toast.success('Savings data refreshed!');
  };

  // Display data
  const displayData = savingsData || {
    date: selectedDate,
    totalSavings: 0,
    activeCollectors: 0,
    collectorsWithSavings: 0,
    collectors: []
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50">
      <div className="max-w-7xl mx-auto px-2 sm:px-4 lg:px-8 py-4 sm:py-8">
        <div className="mb-6 sm:mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-2 sm:gap-4">
              {/* Date Picker */}
              <div className="flex items-center bg-white rounded-lg shadow-sm border px-2 sm:px-4 py-2">
                <Calendar className="h-4 w-4 sm:h-5 sm:w-5 text-gray-500 mr-1 sm:mr-2" />
                <input
                  type="date"
                  value={selectedDate}
                  onChange={handleDateChange}
                  className="border-none focus:outline-none focus:ring-0 text-gray-700 font-medium text-sm sm:text-base w-32 sm:w-auto"
                />
              </div>

              {/* Refresh Button */}
              <button
                onClick={handleRefresh}
                disabled={refreshing}
                className="bg-blue-600 hover:bg-blue-700 text-white px-3 sm:px-6 py-2 rounded-lg font-medium transition-all flex items-center space-x-1 sm:space-x-2 disabled:opacity-50 text-sm sm:text-base"
              >
                <RefreshCw className={`h-4 w-4 sm:h-5 sm:w-5 ${refreshing ? 'animate-spin' : ''}`} />
                <span className="hidden sm:inline">{refreshing ? 'Refreshing...' : 'Refresh'}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="flex items-center justify-center py-20">
            <div className="text-center">
              <RefreshCw className="h-12 w-12 text-blue-600 animate-spin mx-auto mb-4" />
              <p className="text-gray-600 text-lg">Loading savings data...</p>
            </div>
          </div>
        )}

        {/* Summary Card */}
        {!loading && (
          <div className="bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 rounded-2xl shadow-2xl p-8 mb-8 text-white">
            <div className="mb-4">
              <div className="flex items-center space-x-2 mb-2">
                <Calendar className="h-5 w-5" />
                <p className="text-lg opacity-90">
                  {new Date(displayData.date).toLocaleDateString('en-US', {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  })}
                </p>
              </div>
              <div className="flex items-center justify-center">
                <div className="text-center">
                  <p className="text-lg opacity-90 mb-2">Total Savings Collected</p>
                  <p className="text-6xl font-bold">৳{displayData.totalSavings.toLocaleString()}</p>
                  <p className="text-sm opacity-80 mt-3">
                    {displayData.collectorsWithSavings} of {displayData.activeCollectors} collectors collected savings today
                  </p>
                </div>
                <div className="bg-white bg-opacity-20 p-4 rounded-full ml-6">
                  <PiggyBank className="h-12 w-12" />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Collectors Performance */}
        {!loading && (
          <div className="bg-white rounded-xl shadow-sm border p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-gray-900">Collectors Savings Performance</h2>
              <div className="text-sm text-gray-500">
                {displayData.activeCollectors} Active Collectors
              </div>
            </div>

            {displayData.collectors.length === 0 ? (
              <div className="text-center py-12">
                <AlertCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500">No savings data available for {selectedDate}</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {displayData.collectors.map((collector) => {
                  const hasSavings = (collector.totalSavings || 0) > 0;

                  return (
                    <div
                      key={collector.id}
                      className={`rounded-xl p-5 border-2 transition-all ${hasSavings
                        ? 'bg-gradient-to-br from-blue-50 to-purple-100 border-blue-300 shadow-md'
                        : 'bg-gray-50 border-gray-200'
                        }`}
                    >
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center space-x-3">
                          <div className={`p-2 rounded-full ${hasSavings ? 'bg-blue-500' : 'bg-gray-400'
                            }`}>
                            <User className="h-5 w-5 text-white" />
                          </div>
                          <div>
                            <h3 className="font-bold text-gray-900 text-lg">{collector.name}</h3>
                          </div>
                        </div>
                      </div>

                      <div className="mt-4">
                        <div className="text-center">
                          <p className="text-sm text-gray-600 mb-1">Today's Savings</p>
                          <p className={`text-3xl font-bold ${hasSavings ? 'text-blue-600' : 'text-gray-400'
                            }`}>
                            ৳{(collector.totalSavings || 0).toLocaleString()}
                          </p>

                          {hasSavings && collector.lastUpdated && (
                            <p className="text-xs text-gray-500 mt-2">
                              Last updated: {new Date(collector.lastUpdated).toLocaleTimeString('en-US', {
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}


      </div>
    </div>
  );
};

export default DailySavings;
