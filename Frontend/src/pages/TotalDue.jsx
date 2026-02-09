import React, { useState, useEffect, useRef } from 'react';
import { AlertCircle, User, Calendar, DollarSign, Package, Clock, RefreshCw, Download, Loader, ChevronDown, ChevronUp } from 'lucide-react';
import { getCurrentBDDate, toBDTime, formatBDDateLong } from '../utils/dateUtils';
import { toast } from 'react-hot-toast';
import { collectorsAPI, dashboardAPI, branchesAPI } from '../utils/api';

const TotalDue = () => {
  const [collectorsData, setCollectorsData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [expandedCollector, setExpandedCollector] = useState(null);
  const hasFetchedRef = useRef(false);

  // Get actual due balance from localStorage (same logic as Collectors Dashboard)
  const getActualDueBalance = (collectorId) => {
    const cumulativeDueKey = `collector_cumulative_due_${collectorId}`;
    const savedDue = localStorage.getItem(cumulativeDueKey);
    return savedDue ? parseFloat(savedDue) || 0 : 0;
  };

  // Fetch collectors and get their actual due balance from API
  const fetchDueAmounts = async (showToast = true) => {
    setLoading(true);
    try {
      console.log('📈 Fetching collectors and calculating actual due balances...');

      // Get all collectors first
      const response = await collectorsAPI.getAll({ limit: 100, isActive: true });

      if (!response.success || !response.data) {
        throw new Error('Failed to fetch collectors');
      }

      const allCollectors = response.data.filter(c => c.role === 'collector');
      console.log(`👥 Found ${allCollectors.length} collectors`);

      // Get branches data
      const branchesResponse = await branchesAPI.getAll();
      const allBranches = branchesResponse.success ? branchesResponse.data : [];

      // Get today's date in Bangladesh
      const today = getCurrentBDDate();

      // Get due balance for each collector from API
      const collectorsWithDue = await Promise.all(allCollectors.map(async (collector) => {
        const collectorId = collector._id || collector.id;

        try {
          // Get collector dashboard data from API
          const dashboardResponse = await dashboardAPI.getCollectorDashboard(collectorId, today);

          if (dashboardResponse.success && dashboardResponse.data) {
            const dueBalance = dashboardResponse.data.dueBalance || 0;

            // Get collector's branches
            const collectorBranches = allBranches.filter(b =>
              b.assignedCollector === collectorId ||
              b.collectorId === collectorId
            );

            console.log(`👤 ${collector.name}: Due Balance = ৳${dueBalance}, Branches: ${collectorBranches.length}`);

            return {
              id: collectorId,
              name: collector.name,
              email: collector.email || '',
              branches: collectorBranches.map(b => ({
                name: b.name,
                code: b.branchCode
              })),
              branchCount: collectorBranches.length,
              totalDue: dueBalance,
              products: [],
              lastPayment: null,
              lastUpdated: new Date()
            };
          }
        } catch (error) {
          console.error(`Error fetching data for ${collector.name}:`, error);
        }

        // Fallback if API fails
        return {
          id: collectorId,
          name: collector.name,
          email: collector.email || '',
          branches: [],
          branchCount: 0,
          totalDue: 0,
          products: [],
          lastPayment: null,
          lastUpdated: new Date()
        };
      }));

      // Only show collectors with due balance > 0
      const collectorsWithOutstandingDue = collectorsWithDue.filter(collector => collector.totalDue > 0);

      // Sort by due amount (highest first)
      collectorsWithOutstandingDue.sort((a, b) => b.totalDue - a.totalDue);

      setCollectorsData(collectorsWithOutstandingDue);
      setLastUpdated(new Date());

      // Only show toast if requested (to avoid duplicate toasts in StrictMode)
      if (showToast) {
        toast.success(`Due balances loaded! ${collectorsWithOutstandingDue.length} collectors have outstanding dues.`);
      }

    } catch (error) {
      console.error('Error fetching due amounts:', error);
      if (showToast) {
        toast.error(error.message || 'Failed to load due amounts');
      }
    } finally {
      setLoading(false);
    }
  };

  // Load data on component mount (prevent duplicate calls in StrictMode)
  useEffect(() => {
    if (!hasFetchedRef.current) {
      hasFetchedRef.current = true;
      fetchDueAmounts(false); // Don't show toast on initial load
    }
  }, []);

  // Calculate total due amount
  const totalDueAmount = collectorsData.reduce((sum, collector) => sum + collector.totalDue, 0);
  const totalCollectors = collectorsData.length;

  const getStatusColor = (dueAmount) => {
    if (dueAmount > 20000) return 'text-red-600 bg-red-100';
    if (dueAmount > 10000) return 'text-yellow-600 bg-yellow-100';
    return 'text-green-600 bg-green-100';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 to-orange-100 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Actions Bar */}
        <div className="bg-white rounded-xl shadow-sm border p-6 mb-8">
          <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="text-sm text-gray-600">
                <Clock className="h-4 w-4 inline mr-1" />
                Last updated: {lastUpdated ? toBDTime(lastUpdated).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : 'Not updated yet'}
              </div>
            </div>

            <div className="flex items-center space-x-3">
              <button
                onClick={fetchDueAmounts}
                disabled={loading}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-3 rounded-lg font-medium transition-all flex items-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? <Loader className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                <span>{loading ? 'Loading...' : 'Refresh'}</span>
              </button>

              <button className="bg-red-600 hover:bg-red-700 text-white px-4 py-3 rounded-lg font-medium transition-all flex items-center space-x-2">
                <Download className="h-4 w-4" />
                <span>Export Report</span>
              </button>
            </div>
          </div>
        </div>

        {/* Total Due Summary */}
        <div className="flex justify-center mb-8">
          <div className="bg-gradient-to-r from-red-500 to-red-600 rounded-xl shadow-lg p-8 text-white max-w-md w-full">
            <div className="flex items-center justify-between">
              <div className="text-center w-full">
                <p className="text-lg opacity-90 mb-2">Total Due Amount</p>
                <p className="text-5xl font-bold">৳{totalDueAmount.toLocaleString()}</p>
                <p className="text-sm opacity-80 mt-2">{totalCollectors} Collectors</p>
              </div>
              <div className="bg-white bg-opacity-20 p-4 rounded-full ml-4">
                <AlertCircle className="h-10 w-10" />
              </div>
            </div>
          </div>
        </div>

        {/* Collectors Due Details */}
        <div className="bg-white rounded-xl shadow-sm border p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-gray-900">Collectors Due Details</h2>
            <div className="text-sm text-gray-500">
              {totalCollectors} Collectors with Outstanding Dues
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader className="h-8 w-8 animate-spin text-blue-600" />
              <span className="ml-3 text-gray-600">Loading due amounts...</span>
            </div>
          ) : collectorsData.length === 0 ? (
            <div className="text-center py-12">
              <AlertCircle className="h-12 w-12 text-gray-400 mx-auto mb-3" />
              <p className="text-gray-600">No collectors with outstanding dues found.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {collectorsData.map((collector) => {
                const hasDue = collector.totalDue > 0;

                return (
                  <div
                    key={collector.id}
                    className={`rounded-xl p-6 border-2 transition-all ${hasDue
                      ? 'bg-gradient-to-br from-red-50 to-orange-50 border-red-300 shadow-md'
                      : 'bg-gray-50 border-gray-200'
                      }`}
                  >
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center space-x-3">
                        <div className={`p-2 rounded-full ${hasDue ? 'bg-red-500' : 'bg-gray-400'
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
                        <p className="text-sm text-gray-600 mb-1">Total Due Amount</p>
                        <p className={`text-4xl font-bold ${hasDue ? 'text-red-600' : 'text-gray-400'
                          }`}>
                          ৳{collector.totalDue.toLocaleString()}
                        </p>
                      </div>
                    </div>

                    {/* Show branches if has due */}
                    {hasDue && collector.branches.length > 0 && (
                      <div className="mt-4 pt-4 border-t border-red-200">
                        <p className="text-xs text-gray-600 mb-1">Branches:</p>
                        <p className="text-sm text-gray-700">
                          {collector.branches.map(b => b.name).join(', ')}
                        </p>
                      </div>
                    )}

                    {/* View Details Button - for future date-wise breakdown */}
                    {hasDue && (
                      <div className="mt-4">
                        <button
                          onClick={() => {
                            setExpandedCollector(expandedCollector === collector.id ? null : collector.id);
                            toast.info('Date-wise breakdown coming soon!');
                          }}
                          className="w-full bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center justify-center space-x-2"
                        >
                          <span>View Details</span>
                          {expandedCollector === collector.id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

      </div>
    </div>
  );
};

export default TotalDue;
