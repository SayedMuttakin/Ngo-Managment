import React, { useState } from 'react';
import { 
  Plus,
  Users,
  DollarSign,
  Calendar,
  Phone,
  MapPin,
  Search,
  Filter,
  CheckCircle,
  AlertCircle,
  CreditCard
} from 'lucide-react';
import toast from 'react-hot-toast';

const ExtraInstallments = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedMember, setSelectedMember] = useState(null);
  const [extraAmount, setExtraAmount] = useState('');
  const [paymentNote, setPaymentNote] = useState('');
  const [showPaymentModal, setShowPaymentModal] = useState(false);

  // Member information
  const membersData = [
    {
      id: 1,
      name: 'Rokeya Khatun',
      phone: '01967890123',
      branch: 'B006 - Sylhet Branch',
      collector: 'Badshah',
      regularInstallment: 150,
      totalPaid: 1200,
      extraPayments: [
        { date: '2024-08-15', amount: 300, note: 'Bonus Payment' },
        { date: '2024-07-20', amount: 200, note: 'Advance Installment' }
      ]
    },
    {
      id: 2,
      name: 'Abdur Rahim',
      phone: '01578901234',
      branch: 'B006 - Sylhet Branch',
      collector: 'Badshah',
      regularInstallment: 500,
      totalPaid: 2000,
      extraPayments: [
        { date: '2024-09-01', amount: 500, note: 'Double Payment' }
      ]
    },
    {
      id: 3,
      name: 'Fatema Khatun',
      phone: '01823456789',
      branch: 'B001 - Dhaka Branch',
      collector: 'Rahim',
      regularInstallment: 50,
      totalPaid: 1500,
      extraPayments: []
    },
    {
      id: 4,
      name: 'Kamal Hossain',
      phone: '01867890123',
      branch: 'B002 - Gulshan Branch',
      collector: 'Rahim',
      regularInstallment: 300,
      totalPaid: 3000,
      extraPayments: [
        { date: '2024-08-25', amount: 600, note: 'Double Payment' }
      ]
    },
    {
      id: 5,
      name: 'Shahinur Rahman',
      phone: '01978901234',
      branch: 'B003 - Mirpur Branch',
      collector: 'Karim',
      regularInstallment: 800,
      totalPaid: 4800,
      extraPayments: []
    }
  ];

  // Filtered members
  const filteredMembers = membersData.filter(member =>
    member.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    member.phone.includes(searchTerm)
  );

  // Extra installment payment
  const handleExtraPayment = () => {
    if (!selectedMember || !extraAmount) {
      toast.error('Please enter a valid amount.');
      return;
    }

    // Show loading toast
    const loadingToast = toast.loading('Processing payment...');

    // Here you will make API call to save to database
    console.log('Extra Payment:', {
      memberId: selectedMember.id,
      amount: parseFloat(extraAmount),
      note: paymentNote,
      date: new Date().toISOString()
    });

    // Simulate API delay
    setTimeout(() => {
      // Dismiss loading toast
      toast.dismiss(loadingToast);
      
      // Show success toast
      toast.success(`Extra installment of ৳${extraAmount} for ${selectedMember.name} has been successfully accepted!`);
      
      // Reset form
      setSelectedMember(null);
      setExtraAmount('');
      setPaymentNote('');
      setShowPaymentModal(false);
    }, 1000);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center">
            <Plus className="h-8 w-8 mr-3 text-green-600" />
            Extra Installment Collection
          </h1>
          <p className="text-gray-600 mt-2">Accept extra installments from members</p>
        </div>
      </div>


      {/* Search */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search by member name or phone number..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
          />
        </div>
      </div>

      {/* Members List */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-xl font-bold text-gray-900">Member List</h2>
          <p className="text-sm text-gray-600 mt-1">{filteredMembers.length} members found</p>
        </div>
        
        <div className="divide-y divide-gray-200">
          {filteredMembers.map((member) => (
            <div key={member.id} className="p-6 hover:bg-gray-50 transition-colors">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <div className="bg-green-100 p-3 rounded-full">
                    <Users className="h-6 w-6 text-green-600" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-gray-900">{member.name}</h3>
                    <div className="flex items-center space-x-4 mt-1">
                      <div className="flex items-center space-x-1">
                        <Phone className="h-4 w-4 text-gray-400" />
                        <span className="text-sm text-gray-600">{member.phone}</span>
                      </div>
                      <div className="flex items-center space-x-1">
                        <MapPin className="h-4 w-4 text-gray-400" />
                        <span className="text-sm text-gray-600">{member.branch}</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex items-center space-x-4">
                  <div className="text-right">
                    <p className="text-sm text-gray-500">Regular Installment</p>
                    <p className="text-lg font-bold text-gray-900">৳{member.regularInstallment}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-gray-500">Extra Payments</p>
                    <p className="text-lg font-bold text-green-600">
                      {member.extraPayments.length} times
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      setSelectedMember(member);
                      setShowPaymentModal(true);
                    }}
                    className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-medium flex items-center space-x-2 transition-colors"
                  >
                    <Plus className="h-4 w-4" />
                    <span>Extra Installment</span>
                  </button>
                </div>
              </div>

              {/* Extra Payments History */}
              {member.extraPayments.length > 0 && (
                <div className="mt-4 pt-4 border-t border-gray-200">
                  <h4 className="text-sm font-medium text-gray-700 mb-2">Extra Payment History:</h4>
                  <div className="space-y-2">
                    {member.extraPayments.map((payment, index) => (
                      <div key={index} className="flex items-center justify-between bg-green-50 p-3 rounded-lg">
                        <div className="flex items-center space-x-2">
                          <CheckCircle className="h-4 w-4 text-green-600" />
                          <span className="text-sm text-gray-700">{payment.note}</span>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-bold text-green-600">৳{payment.amount}</p>
                          <p className="text-xs text-gray-500">{new Date(payment.date).toLocaleDateString('bn-BD')}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Payment Modal */}
      {showPaymentModal && selectedMember && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-md w-full">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-gray-900">Extra Installment Payment</h2>
                <button
                  onClick={() => setShowPaymentModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Member Info */}
              <div className="bg-gray-50 p-4 rounded-lg mb-6">
                <h3 className="font-bold text-gray-900">{selectedMember.name}</h3>
                <p className="text-sm text-gray-600">{selectedMember.phone}</p>
                <p className="text-sm text-gray-600">{selectedMember.branch}</p>
                <p className="text-sm text-green-600 mt-2">Regular Installment: ৳{selectedMember.regularInstallment}</p>
              </div>

              {/* Payment Form */}
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Extra Installment Amount (৳)
                  </label>
                  <input
                    type="number"
                    value={extraAmount}
                    onChange={(e) => setExtraAmount(e.target.value)}
                    placeholder="Enter amount..."
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Note (Optional)
                  </label>
                  <textarea
                    value={paymentNote}
                    onChange={(e) => setPaymentNote(e.target.value)}
                    placeholder="Reason for payment or special note..."
                    rows={3}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                  />
                </div>

                <div className="flex space-x-3 pt-4">
                  <button
                    onClick={() => setShowPaymentModal(false)}
                    className="flex-1 px-4 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleExtraPayment}
                    disabled={!extraAmount}
                    className="flex-1 px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium disabled:bg-gray-300 disabled:cursor-not-allowed"
                  >
                    Accept Payment
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ExtraInstallments;
