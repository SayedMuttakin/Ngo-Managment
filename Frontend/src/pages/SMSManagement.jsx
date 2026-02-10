import React, { useState, useEffect } from 'react';
import { smsAPI } from '../utils/api';
import toast from 'react-hot-toast';
import {
  MessageSquare,
  DollarSign,
  Send,
  CheckCircle,
  AlertCircle,
  RefreshCw,
  Settings,
  Clock
} from 'lucide-react';

const SMSManagement = () => {
  const [balance, setBalance] = useState(null);
  const [loading, setLoading] = useState(false);
  const [schedulerStatus, setSchedulerStatus] = useState(null);
  const [testPhone, setTestPhone] = useState('');
  const [testMessage, setTestMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [smsEnabled, setSmsEnabled] = useState(true);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    checkBalance();
    getSchedulerStatus();
    loadSMSSettings();
  }, []);

  const loadSMSSettings = () => {
    // Load from config - assuming enabled by default
    // In real app, fetch from backend
    setSmsEnabled(true);
  };

  const checkBalance = async () => {
    try {
      setLoading(true);
      const response = await smsAPI.checkBalance();

      if (response.success) {
        setBalance(response.data);
        toast.success('Balance updated');
      } else {
        toast.error('Failed to check balance');
      }
    } catch (error) {
      console.error('Balance check error:', error);
      toast.error('Error checking balance');
    } finally {
      setLoading(false);
    }
  };

  const getSchedulerStatus = async () => {
    try {
      const response = await smsAPI.getSchedulerStatus();

      if (response.success) {
        setSchedulerStatus(response.data);
      }
    } catch (error) {
      console.error('Scheduler status error:', error);
    }
  };

  const sendTestSMS = async () => {
    if (!testPhone || !testMessage) {
      toast.error('Phone and message required');
      return;
    }

    try {
      setSending(true);
      const response = await smsAPI.sendTestSMS(testPhone, testMessage);

      if (response.success) {
        toast.success('Test SMS sent successfully!');
        setTestPhone('');
        setTestMessage('');
      } else {
        toast.error('Failed to send test SMS');
      }
    } catch (error) {
      console.error('Test SMS error:', error);
      toast.error('Error sending test SMS');
    } finally {
      setSending(false);
    }
  };

  const toggleSMSSystem = async () => {
    try {
      setUpdating(true);
      const newStatus = !smsEnabled;

      const response = await smsAPI.updateSettings({
        enableSMS: newStatus
      });

      if (response.success) {
        setSmsEnabled(newStatus);
        toast.success(`SMS System ${newStatus ? 'Enabled' : 'Disabled'}`);
      } else {
        toast.error('Failed to update SMS settings');
      }
    } catch (error) {
      console.error('Toggle SMS error:', error);
      toast.error('Error updating SMS settings');
    } finally {
      setUpdating(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-xl shadow-sm border p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-3 bg-gradient-to-br from-green-100 to-blue-100 rounded-lg">
              <MessageSquare className="h-6 w-6 text-green-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">SMS Management</h1>
              <p className="text-sm text-gray-600">Manage SMS balance, settings, and send test messages</p>
            </div>
          </div>
        </div>
      </div>

      {/* Balance & Status */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Balance Card */}
        <div className="bg-white rounded-xl shadow-sm border p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-2">
              <DollarSign className="h-5 w-5 text-green-600" />
              <h3 className="font-semibold text-gray-900">SMS Balance</h3>
            </div>
            <button
              onClick={checkBalance}
              disabled={loading}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <RefreshCw className={`h-4 w-4 text-gray-600 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
          {balance ? (
            <>
              <p className="text-3xl font-bold text-green-600">৳{balance.balance}</p>
              <p className="text-xs text-gray-500 mt-1">Provider: {balance.provider}</p>
            </>
          ) : (
            <p className="text-gray-500">Loading...</p>
          )}
        </div>

        {/* Scheduler Status */}
        <div className="bg-white rounded-xl shadow-sm border p-6">
          <div className="flex items-center space-x-2 mb-4">
            <Clock className="h-5 w-5 text-blue-600" />
            <h3 className="font-semibold text-gray-900">Auto Scheduler</h3>
          </div>
          {schedulerStatus ? (
            <>
              <div className="flex items-center space-x-2 mb-2">
                <div className="h-2 w-2 bg-green-500 rounded-full"></div>
                <p className="text-sm text-gray-700 font-medium">Active</p>
              </div>
              <p className="text-xs text-gray-600">Schedule: {schedulerStatus.scheduledTime}</p>
              <p className="text-xs text-gray-500 mt-1">
                Next: {schedulerStatus.nextRun || '9:00 PM Today'}
              </p>
            </>
          ) : (
            <p className="text-gray-500">Loading...</p>
          )}
        </div>

        {/* SMS System Control */}
        <div className="bg-white rounded-xl shadow-sm border p-6">
          <div className="flex items-center space-x-2 mb-4">
            <Settings className="h-5 w-5 text-purple-600" />
            <h3 className="font-semibold text-gray-900">SMS System</h3>
          </div>
          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
            <div>
              <p className="text-sm font-medium text-gray-900">Auto SMS Reminders</p>
              <p className="text-xs text-gray-500 mt-1">Daily at 9:00 PM</p>
            </div>
            <button
              onClick={toggleSMSSystem}
              disabled={updating}
              className={`relative inline-flex h-8 w-14 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 ${smsEnabled ? 'bg-green-600' : 'bg-gray-300'
                }`}
            >
              <span
                className={`inline-block h-6 w-6 transform rounded-full bg-white transition-transform ${smsEnabled ? 'translate-x-7' : 'translate-x-1'
                  }`}
              />
            </button>
          </div>
          <p className="text-xs text-gray-500 mt-3">
            {smsEnabled ? '✅ SMS reminders are enabled' : '⚠️ SMS reminders are disabled'}
          </p>
        </div>
      </div>

      {/* Test SMS */}
      <div className="bg-white rounded-xl shadow-sm border p-6">
        <div className="flex items-center space-x-2 mb-4">
          <Send className="h-5 w-5 text-blue-600" />
          <h3 className="text-lg font-semibold text-gray-900">Send Test SMS</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Phone Number
            </label>
            <input
              type="text"
              value={testPhone}
              onChange={(e) => setTestPhone(e.target.value)}
              placeholder="01XXXXXXXXX"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Message
            </label>
            <input
              type="text"
              value={testMessage}
              onChange={(e) => setTestMessage(e.target.value)}
              placeholder="Test message"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>

        <button
          onClick={sendTestSMS}
          disabled={sending || !testPhone || !testMessage}
          className="mt-4 inline-flex items-center px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Send className="h-4 w-4 mr-2" />
          {sending ? 'Sending...' : 'Send Test SMS'}
        </button>
      </div>

      {/* Info */}
      <div className="bg-blue-50 rounded-xl border border-blue-200 p-4">
        <div className="flex items-start space-x-3">
          <AlertCircle className="h-5 w-5 text-blue-600 mt-0.5" />
          <div className="text-sm text-blue-800">
            <p className="font-semibold mb-1">SMS System Information</p>
            <ul className="list-disc list-inside space-y-1">
              <li>Automatic due reminders are sent daily at 9:00 PM Bangladesh time</li>
              <li>Only members with dues today will receive SMS reminders</li>
              <li>SMS balance is checked from BulkSMSBD API</li>
              <li>Test SMS feature available to verify system</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SMSManagement;
