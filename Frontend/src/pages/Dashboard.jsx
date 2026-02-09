import React, { useState, useEffect } from 'react';
import { 
  Users, 
  PiggyBank, 
  Package, 
  DollarSign,
  TrendingUp,
  TrendingDown,
  Eye,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Landmark,
  Wallet
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { dashboardAPI } from '../utils/api';
import { formatBDDateShort } from '../utils/dateUtils';
import toast from 'react-hot-toast';

const Dashboard = () => {
  const [loading, setLoading] = useState(true);
  const [dashboardData, setDashboardData] = useState(null);
  
  // ✅ Month/Year selection state
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1); // 1-indexed
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [monthlyHistory, setMonthlyHistory] = useState({});

  // Load dashboard data when month/year changes
  useEffect(() => {
    loadDashboardData();
  }, [selectedMonth, selectedYear]);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      
      // ✅ Send month and year as query params
      const response = await dashboardAPI.getOverview({
        month: selectedMonth,
        year: selectedYear
      });
      
      if (response.success) {
        // ✅ Use backend's calculated totals directly
        // Backend already aggregates all collectors' data for the selected month
        console.log(`📊 Dashboard Data for ${selectedMonth}/${selectedYear}:`);
        console.log(`   - Monthly Savings: ৳${response.data.stats?.totalSavings || 0}`);
        console.log(`   - Monthly Collection: ৳${response.data.stats?.totalCollection || 0}`);
        
        setDashboardData(response.data);
        
        // ✅ Store monthly data in history
        const monthKey = `${selectedYear}-${selectedMonth.toString().padStart(2, '0')}`;
        setMonthlyHistory(prev => ({
          ...prev,
          [monthKey]: response.data.stats
        }));
      }
    } catch (error) {
      console.error('Error loading dashboard:', error);
      toast.error('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };
  
  // ✅ Handle month navigation
  const handlePreviousMonth = () => {
    if (selectedMonth === 1) {
      setSelectedMonth(12);
      setSelectedYear(selectedYear - 1);
    } else {
      setSelectedMonth(selectedMonth - 1);
    }
  };
  
  const handleNextMonth = () => {
    if (selectedMonth === 12) {
      setSelectedMonth(1);
      setSelectedYear(selectedYear + 1);
    } else {
      setSelectedMonth(selectedMonth + 1);
    }
  };
  
  const handleCurrentMonth = () => {
    const now = new Date();
    setSelectedMonth(now.getMonth() + 1);
    setSelectedYear(now.getFullYear());
  };
  
  // Get month name
  const getMonthName = () => {
    const date = new Date(selectedYear, selectedMonth - 1);
    return date.toLocaleString('default', { month: 'long', year: 'numeric' });
  };
  
  // Check if selected month is current month
  const isCurrentMonth = () => {
    const now = new Date();
    return selectedMonth === (now.getMonth() + 1) && selectedYear === now.getFullYear();
  };

  // Use real data if available, otherwise use defaults
  // ✅ FIX: Separate monthly savings from installment collections
  const stats = {
    totalMembers: dashboardData?.stats?.totalMembers || 0,
    totalSavings: dashboardData?.stats?.totalSavings || 0, // 👉 This is monthly savings (from backend)
    totalCollection: dashboardData?.stats?.totalCollection || 0, // 👉 This is monthly installments (from backend)
    todayCollection: dashboardData?.stats?.todayCollection || 0,
    productsDistributed: dashboardData?.stats?.productsDistributed || 0,
    totalOutstandingLoans: dashboardData?.stats?.totalOutstandingLoans || 0, // 👉 Total outstanding loans
    totalAllTimeSavings: dashboardData?.stats?.totalAllTimeSavings || 0 // 👉 Total savings all time
  };

  // Get data from API response
  const recentActivities = (dashboardData?.recentActivities || []).map(activity => {
    const iconMap = {
      member: Users,
      installment: DollarSign,
      product: Package,
      savings: PiggyBank
    };
    const colorMap = {
      member: 'text-blue-600 bg-blue-100',
      installment: 'text-green-600 bg-green-100',
      product: 'text-yellow-600 bg-yellow-100',
      savings: 'text-purple-600 bg-purple-100'
    };
    return {
      ...activity,
      icon: iconMap[activity.type] || DollarSign,
      color: colorMap[activity.type] || 'text-gray-600 bg-gray-100'
    };
  });

  const monthlyData = dashboardData?.monthlyTrend || [];
  const productDistribution = dashboardData?.productBreakdown || [];

  const StatCard = ({ title, value, icon: Icon, color, trend, trendValue, bgColor, gradientBg, onClick, clickable = false }) => (
    <div 
      className={`${gradientBg || 'bg-white'} rounded-xl shadow-lg p-4 border-2 border-white hover:shadow-xl transition-all transform hover:scale-105 ${
        clickable ? 'cursor-pointer' : ''
      }`}
      onClick={clickable ? onClick : undefined}
    >
      <div className="flex flex-col items-center text-center">
        <div className="mb-3">
          <Icon className="h-10 w-10 text-white drop-shadow-lg" />
        </div>
        <div>
          <p className="text-xs font-semibold text-white mb-1 opacity-95 drop-shadow-sm">{title}</p>
          <p className="text-2xl font-bold text-white mb-1 drop-shadow-sm">{value}</p>
          {trend && (
            <div className={`flex items-center justify-center text-xs font-medium ${
              trend === 'up' ? 'text-green-100' : 'text-red-100'
            } drop-shadow-sm`}>
              {trend === 'up' ? (
                <TrendingUp className="h-3 w-3 mr-1" />
              ) : (
                <TrendingDown className="h-3 w-3 mr-1" />
              )}
              {trendValue}%
            </div>
          )}
        </div>
      </div>
    </div>
  );


  // Show loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 text-lg">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Welcome Section with Month Selector */}
      <div className="bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 rounded-xl lg:rounded-2xl text-white p-4 md:p-5 lg:p-6 shadow-2xl">
        <div className="flex flex-col lg:flex-row lg:justify-between lg:items-start space-y-4 lg:space-y-0 mb-4">
          <div className="text-center lg:text-left">
            <h1 className="text-lg sm:text-xl md:text-2xl font-bold mb-2">Welcome to Satrong Sajghor Traders Dashboard</h1>
            <p className="text-indigo-100 text-sm md:text-base">View monthly summary information and activities</p>
          </div>
          
          {/* ✅ Month Selector */}
          <div className="bg-gradient-to-r from-purple-800 to-indigo-800 backdrop-blur-sm rounded-xl p-2 md:p-3 border-2 border-purple-400 shadow-xl mx-auto lg:mx-0">
            <div className="flex items-center space-x-2 md:space-x-3">
              <button 
                onClick={handlePreviousMonth}
                className="p-1.5 md:p-2 bg-yellow-500 hover:bg-yellow-400 text-purple-900 rounded-lg transition-all hover:scale-110 shadow-md"
                title="Previous Month"
              >
                <ChevronLeft className="h-4 md:h-5 w-4 md:w-5 font-bold" />
              </button>
              
              <div className="text-center min-w-[120px] md:min-w-[150px]">
                <div className="flex items-center justify-center space-x-1.5 md:space-x-2">
                  <Calendar className="h-3 md:h-4 w-3 md:w-4 text-yellow-300" />
                  <span className="font-bold text-sm md:text-lg text-white drop-shadow-lg">{getMonthName()}</span>
                </div>
                {!isCurrentMonth() && (
                  <button
                    onClick={handleCurrentMonth}
                    className="text-[10px] md:text-xs text-yellow-200 hover:text-yellow-100 mt-1 underline"
                  >
                    Go to Current Month
                  </button>
                )}
              </div>
              
              <button 
                onClick={handleNextMonth}
                className={`p-1.5 md:p-2 rounded-lg transition-all shadow-md ${
                  isCurrentMonth() 
                    ? 'bg-gray-500 text-gray-300 cursor-not-allowed opacity-50' 
                    : 'bg-yellow-500 hover:bg-yellow-400 text-purple-900 hover:scale-110'
                }`}
                disabled={isCurrentMonth()}
                title={isCurrentMonth() ? "Cannot view future months" : "Next Month"}
              >
                <ChevronRight className="h-4 md:h-5 w-4 md:w-5 font-bold" />
              </button>
            </div>
          </div>
        </div>
        
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-center lg:justify-start gap-2 sm:gap-3">
          <div className="bg-white bg-opacity-90 px-3 py-1.5 md:py-1 rounded-full border border-gray-200 text-center">
            <span className="text-xs md:text-xs font-semibold text-gray-800">Today: {formatBDDateShort(new Date())}</span>
          </div>
          <div className="bg-white bg-opacity-90 px-3 py-1.5 md:py-1 rounded-full border border-gray-200 text-center">
            <span className="text-xs md:text-xs font-semibold text-gray-800">Active Members: {stats.totalMembers}</span>
          </div>
          {!isCurrentMonth() && (
            <div className="bg-yellow-500 bg-opacity-90 px-3 py-1.5 md:py-1 rounded-full border border-yellow-600 text-center">
              <span className="text-xs md:text-xs font-semibold text-white">
                📅 Viewing {getMonthName()} Data
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <StatCard
          title="Total Members"
          value={stats.totalMembers || 0}
          icon={Users}
          gradientBg="bg-gradient-to-br from-blue-500 via-blue-600 to-blue-700"
          trend="up"
          trendValue="12"
        />
        <StatCard
          title={`${getMonthName()} Savings`}
          value={`৳${(stats.totalSavings || 0).toLocaleString()}`}
          icon={PiggyBank}
          gradientBg="bg-gradient-to-br from-green-500 via-emerald-600 to-teal-700"
          trend="up"
          trendValue="8.5"
        />
        <StatCard
          title={`${getMonthName()} Collection`}
          value={`৳${(stats.totalCollection || 0).toLocaleString()}`}
          icon={DollarSign}
          gradientBg="bg-gradient-to-br from-yellow-500 via-orange-600 to-red-700"
          trend="up"
          trendValue="15"
        />
        <StatCard
          title="Product Distribution"
          value={stats.productsDistributed || 0}
          icon={Package}
          gradientBg="bg-gradient-to-br from-purple-500 via-pink-600 to-rose-700"
        />
        <StatCard
          title="Total Outstanding Loans"
          value={`৳${(stats.totalOutstandingLoans || 0).toLocaleString()}`}
          icon={Landmark}
          gradientBg="bg-gradient-to-br from-red-500 via-rose-600 to-pink-700"
        />
        <StatCard
          title="Total Savings (All Time)"
          value={`৳${(stats.totalAllTimeSavings || 0).toLocaleString()}`}
          icon={Wallet}
          gradientBg="bg-gradient-to-br from-cyan-500 via-sky-600 to-blue-700"
        />
      </div>

      {/* Charts and Activities */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Monthly Collection Chart */}
        <div className="bg-gradient-to-br from-blue-50 to-indigo-100 rounded-xl shadow-lg p-4 border border-blue-200">
          <h3 className="text-lg font-bold text-blue-900 mb-3 flex items-center">
            <DollarSign className="h-5 w-5 mr-2" />
            Monthly Collection & Savings
          </h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={monthlyData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip formatter={(value) => `৳${value.toLocaleString()}`} />
              <Bar dataKey="collection" fill="#3B82F6" name="Collection" />
              <Bar dataKey="savings" fill="#10B981" name="Savings" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Product Distribution Chart */}
        <div className="bg-gradient-to-br from-green-50 to-emerald-100 rounded-xl shadow-lg p-4 border border-green-200">
          <h3 className="text-lg font-bold text-green-900 mb-3 flex items-center">
            <Package className="h-5 w-5 mr-2" />
            Product Distribution
          </h3>
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie
                data={productDistribution}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={120}
                paddingAngle={5}
                dataKey="value"
              >
                {productDistribution.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip formatter={(value) => `${value}%`} />
            </PieChart>
          </ResponsiveContainer>
          <div className="grid grid-cols-2 gap-2 mt-4">
            {productDistribution.map((item, index) => (
              <div key={index} className="flex items-center">
                <div 
                  className="w-3 h-3 rounded-full mr-2" 
                  style={{ backgroundColor: item.color }}
                ></div>
                <span className="text-sm text-gray-600">{item.name} ({item.value}%)</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recent Activities */}
      <div className="bg-gradient-to-br from-yellow-50 to-orange-100 rounded-xl shadow-lg p-4 border border-yellow-200">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-bold text-yellow-900 flex items-center">
            <Eye className="h-5 w-5 mr-2" />
            Recent Activities
          </h3>
          <button className="text-blue-600 hover:text-blue-700 text-sm font-medium flex items-center">
            <Eye className="h-4 w-4 mr-1" />
            View All
          </button>
        </div>
        <div className="space-y-4">
          {recentActivities.map((activity) => {
            const Icon = activity.icon;
            return (
              <div key={activity.id} className="flex items-start space-x-3 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                <div className={`p-2 rounded-full ${activity.color}`}>
                  <Icon className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900">{activity.message}</p>
                  <p className="text-xs text-gray-500">{activity.time}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>


    </div>
  );
};

export default Dashboard;
