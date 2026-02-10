import React from 'react';
import { User, DollarSign, Calendar, TrendingUp, Plus, Minus } from 'lucide-react';

const SavingsCard = ({ member, onAddSavings, onWithdraw, onViewHistory }) => {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-all">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-start space-x-4">
          <div className="bg-green-100 p-3 rounded-full">
            <User className="h-6 w-6 text-green-600" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">{member.name}</h3>
            <p className="text-sm text-gray-600">{member.phone}</p>
            <p className="text-sm text-gray-600">{member.branch}</p>
          </div>
        </div>
        
        <div className="text-right">
          <p className="text-sm text-gray-500">Total Savings</p>
          <p className="text-2xl font-bold text-green-600">৳{member.totalSavings}</p>
        </div>
      </div>

      <div className="space-y-3 mb-4">
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center text-gray-600">
            <Calendar className="h-4 w-4 mr-2" />
            Last Transaction
          </div>
          <span className="text-gray-900">
            {member.lastTransaction ? new Date(member.lastTransaction).toLocaleDateString('en-US') : 'No transactions'}
          </span>
        </div>

        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center text-gray-600">
            <TrendingUp className="h-4 w-4 mr-2" />
            Monthly Growth
          </div>
          <span className="text-green-600 font-medium">
            +৳{member.monthlyGrowth || 0}
          </span>
        </div>
      </div>

      <div className="flex space-x-2">
        <button
          onClick={() => onAddSavings(member)}
          className="flex-1 bg-green-600 hover:bg-green-700 text-white py-2 px-3 rounded-lg font-medium transition-all flex items-center justify-center"
        >
          <Plus className="h-4 w-4 mr-1" />
          Add
        </button>
        <button
          onClick={() => onWithdraw(member)}
          className="flex-1 bg-red-600 hover:bg-red-700 text-white py-2 px-3 rounded-lg font-medium transition-all flex items-center justify-center"
        >
          <Minus className="h-4 w-4 mr-1" />
          Withdraw
        </button>
        <button
          onClick={() => onViewHistory(member)}
          className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 px-3 rounded-lg font-medium transition-all"
        >
          History
        </button>
      </div>
    </div>
  );
};

export default SavingsCard;
