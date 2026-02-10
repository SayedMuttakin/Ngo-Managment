import React, { useState } from 'react';
import { 
  FileText,
  Download,
  Filter,
  Search
} from 'lucide-react';

const Weekly = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterBranch, setFilterBranch] = useState('all');
  const [filterInstallmentType, setFilterInstallmentType] = useState('all');

  // Complete member information
  const membersData = [
    {
      id: 1,
      name: 'Rokeya Khatun',
      age: 26,
      phone: '01967890123',
      joinDate: '2024-02-25',
      nidNumber: '6789012345678',
      branch: 'B006 - Sylhet Branch',
      collector: 'Badshah',
      installmentType: 'Weekly',
      installmentAmount: 150,
      totalInstallments: 12,
      paidInstallments: 8,
      remainingInstallments: 4,
      dueAmount: 600,
      products: ['Rice (50 kg)', 'Lentils (10 kg)'],
      lastPayment: '2024-09-10'
    },
    {
      id: 2,
      name: 'Abdur Rahim',
      age: 39,
      phone: '01578901234',
      joinDate: '2024-01-08',
      nidNumber: '7890123456789',
      branch: 'B006 - Sylhet Branch',
      collector: 'Badshah',
      installmentType: 'Monthly',
      installmentAmount: 500,
      totalInstallments: 6,
      paidInstallments: 4,
      remainingInstallments: 2,
      dueAmount: 1000,
      products: ['Sewing Machine'],
      lastPayment: '2024-08-15'
    },
    {
      id: 3,
      name: 'Fatema Khatun',
      age: 28,
      phone: '01823456789',
      joinDate: '2024-02-10',
      nidNumber: '2345678901234',
      branch: 'B001 - Dhaka Branch',
      collector: 'Rahim',
      installmentType: 'Daily',
      installmentAmount: 50,
      totalInstallments: 30,
      paidInstallments: 25,
      remainingInstallments: 5,
      dueAmount: 250,
      products: ['Oil (5 liters)', 'Sugar (5 kg)'],
      lastPayment: '2024-09-12'
    },
    {
      id: 4,
      name: 'Kamal Hossain',
      age: 38,
      phone: '01867890123',
      joinDate: '2024-01-30',
      nidNumber: '6789012345678',
      branch: 'B002 - Gulshan Branch',
      collector: 'Rahim',
      installmentType: 'Weekly',
      installmentAmount: 300,
      totalInstallments: 15,
      paidInstallments: 10,
      remainingInstallments: 5,
      dueAmount: 1500,
      products: ['Rickshaw'],
      lastPayment: '2024-09-08'
    },
    {
      id: 5,
      name: 'Shahinur Rahman',
      age: 33,
      phone: '01978901234',
      joinDate: '2024-02-15',
      nidNumber: '7890123456789',
      branch: 'B003 - Mirpur Branch',
      collector: 'Karim',
      installmentType: 'Monthly',
      installmentAmount: 800,
      totalInstallments: 10,
      paidInstallments: 6,
      remainingInstallments: 4,
      dueAmount: 3200,
      products: ['Cow'],
      lastPayment: '2024-08-20'
    }
  ];

  // Filtered data
  const filteredMembers = membersData.filter(member => {
    const matchesSearch = member.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         member.phone.includes(searchTerm) ||
                         member.nidNumber.includes(searchTerm);
    const matchesBranch = filterBranch === 'all' || member.branch.includes(filterBranch);
    const matchesInstallmentType = filterInstallmentType === 'all' || member.installmentType === filterInstallmentType;
    
    return matchesSearch && matchesBranch && matchesInstallmentType;
  });

  // PDF Download Function
  const generatePDF = () => {
    const printContent = `
      <html>
        <head>
          <title>Member Information Report</title>
          <style>
            @page {
              margin: 0.2cm 0.5cm 0.5cm 0.5cm;
              size: A4;
            }
            * {
              margin: 0;
              padding: 0;
              box-sizing: border-box;
            }
            body { 
              font-family: Arial, sans-serif; 
              margin: 0;
              padding: 0;
              font-size: 11px;
              line-height: 1.2;
            }
            .header { 
              text-align: center; 
              margin: 0 0 10px 0;
              padding: 5px 0 8px 0;
              border-bottom: 2px solid #333;
            }
            .header h1 {
              font-size: 18px;
              margin-bottom: 5px;
              color: #333;
            }
            .header h2 {
              font-size: 14px;
              margin-bottom: 5px;
              color: #666;
            }
            .header p {
              font-size: 12px;
              color: #666;
            }
            table { 
              width: 100%; 
              border-collapse: collapse; 
              margin: 10px 0;
              page-break-inside: auto;
            }
            th, td { 
              border: 1px solid #333; 
              padding: 4px; 
              text-align: left; 
              font-size: 10px;
              vertical-align: top;
            }
            th { 
              background-color: #f0f0f0; 
              font-weight: bold;
              font-size: 9px;
              text-align: center;
            }
            tr {
              page-break-inside: avoid;
            }
            tr:nth-child(even) { 
              background-color: #f9f9f9; 
            }
            .status-due { 
              color: #dc3545; 
              font-weight: bold; 
            }
            .status-paid { 
              color: #28a745; 
              font-weight: bold; 
            }
            @media print {
              body {
                margin: 0 !important;
                padding: 5px !important;
              }
              .header {
                margin-bottom: 10px !important;
              }
              table {
                margin: 5px 0 !important;
              }
              th, td {
                padding: 3px !important;
                font-size: 9px !important;
              }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>Satrong Sajghor Traders</h1>
            <h2>Member Details & Installment Report</h2>
            <p>Date: ${new Date().toLocaleDateString('en-US')}</p>
          </div>
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Name</th>
                <th>Age</th>
                <th>Phone</th>
                <th>NID Number</th>
                <th>Join Date</th>
                <th>Branch</th>
                <th>Collector</th>
                <th>Installment Type</th>
                <th>Amount Per Installment</th>
                <th>Total Installments</th>
                <th>Paid Installments</th>
                <th>Remaining Installments</th>
                <th>Due Amount</th>
                <th>Products</th>
                <th>Last Payment</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              ${filteredMembers.map(member => `
                <tr>
                  <td>${member.id}</td>
                  <td>${member.name}</td>
                  <td>${member.age}</td>
                  <td>${member.phone}</td>
                  <td>${member.nidNumber}</td>
                  <td>${new Date(member.joinDate).toLocaleDateString('en-US')}</td>
                  <td>${member.branch}</td>
                  <td>${member.collector}</td>
                  <td>${member.installmentType === 'দৈনিক' ? 'Daily' : member.installmentType === 'সাপ্তাহিক' ? 'Weekly' : 'Monthly'}</td>
                  <td>৳${member.installmentAmount}</td>
                  <td>${member.totalInstallments}</td>
                  <td>${member.paidInstallments}</td>
                  <td>${member.remainingInstallments}</td>
                  <td class="${member.dueAmount > 0 ? 'status-due' : 'status-paid'}">৳${member.dueAmount}</td>
                  <td>${member.products.join(', ')}</td>
                  <td>${new Date(member.lastPayment).toLocaleDateString('en-US')}</td>
                  <td class="${member.dueAmount > 0 ? 'status-due' : 'status-paid'}">${member.dueAmount > 0 ? 'Due' : 'Paid'}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </body>
      </html>
    `;
    
    const printWindow = window.open('', '_blank');
    printWindow.document.write(printContent);
    printWindow.document.close();
    
    // Wait for content to load before printing
    printWindow.onload = function() {
      printWindow.print();
      // Close window after printing (optional)
      // printWindow.close();
    };
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center">
            <FileText className="h-8 w-8 mr-3 text-blue-600" />
            Sheet Collection
          </h1>
          <p className="text-gray-600 mt-2">Complete member information and installment report</p>
        </div>
        <div className="mt-4 sm:mt-0">
          <button
            onClick={generatePDF}
            className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white px-6 py-3 rounded-xl font-semibold flex items-center space-x-2 shadow-lg transition-all transform hover:scale-105"
          >
            <Download className="h-5 w-5" />
            <span>Download PDF</span>
          </button>
        </div>
      </div>


      {/* Search and Filter */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search by name, phone or NID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          
          <div>
            <select
              value={filterBranch}
              onChange={(e) => setFilterBranch(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="all">All Branches</option>
              <option value="Dhaka">Dhaka Branch</option>
              <option value="Gulshan">Gulshan Branch</option>
              <option value="Mirpur">Mirpur Branch</option>
              <option value="Sylhet">Sylhet Branch</option>
            </select>
          </div>

          <div>
            <select
              value={filterInstallmentType}
              onChange={(e) => setFilterInstallmentType(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="all">All Installment Types</option>
              <option value="Daily">Daily</option>
              <option value="Weekly">Weekly</option>
              <option value="Monthly">Monthly</option>
            </select>
          </div>

          <div className="flex items-center">
            <Filter className="h-5 w-5 text-gray-400 mr-2" />
            <span className="text-sm text-gray-600">
              {filteredMembers.length} members found
            </span>
          </div>
        </div>
      </div>

      {/* Excel-style Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-xl font-bold text-gray-900">Member Details Sheet</h2>
        </div>
        
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-r border-gray-200">
                  ID
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-r border-gray-200">
                  Name
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-r border-gray-200">
                  Age
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-r border-gray-200">
                  Phone
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-r border-gray-200">
                  NID Number
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-r border-gray-200">
                  Join Date
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-r border-gray-200">
                  Branch
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-r border-gray-200">
                  Collector
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-r border-gray-200">
                  Installment Type
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-r border-gray-200">
                  Amount Per Installment
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-r border-gray-200">
                  Total Installments
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-r border-gray-200">
                  Paid Installments
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-r border-gray-200">
                  Remaining Installments
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-r border-gray-200">
                  Due Amount
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-r border-gray-200">
                  Products
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-r border-gray-200">
                  Last Payment
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredMembers.map((member, index) => (
                <tr key={member.id} className={`hover:bg-gray-50 ${index % 2 === 0 ? 'bg-white' : 'bg-gray-25'}`}>
                  <td className="px-4 py-3 text-sm text-gray-900 border-r border-gray-200 font-medium">
                    {member.id}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-900 border-r border-gray-200 font-medium">
                    {member.name}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-900 border-r border-gray-200">
                    {member.age}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-900 border-r border-gray-200">
                    {member.phone}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-900 border-r border-gray-200">
                    {member.nidNumber}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-900 border-r border-gray-200">
                    {new Date(member.joinDate).toLocaleDateString('en-US')}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-900 border-r border-gray-200">
                    {member.branch}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-900 border-r border-gray-200">
                    {member.collector}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-900 border-r border-gray-200">
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                      member.installmentType === 'Daily' ? 'bg-green-100 text-green-800' :
                      member.installmentType === 'Weekly' ? 'bg-blue-100 text-blue-800' :
                      'bg-purple-100 text-purple-800'
                    }`}>
                      {member.installmentType}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-900 border-r border-gray-200 font-medium">
                    ৳{member.installmentAmount}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-900 border-r border-gray-200">
                    {member.totalInstallments}
                  </td>
                  <td className="px-4 py-3 text-sm text-green-600 border-r border-gray-200 font-medium">
                    {member.paidInstallments}
                  </td>
                  <td className="px-4 py-3 text-sm text-orange-600 border-r border-gray-200 font-medium">
                    {member.remainingInstallments}
                  </td>
                  <td className="px-4 py-3 text-sm border-r border-gray-200 font-bold">
                    <span className={member.dueAmount > 0 ? 'text-red-600' : 'text-green-600'}>
                      ৳{member.dueAmount}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-900 border-r border-gray-200">
                    <div className="max-w-xs">
                      {member.products.map((product, idx) => (
                        <div key={idx} className="text-xs bg-gray-100 px-2 py-1 rounded mb-1 inline-block mr-1">
                          {product}
                        </div>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-900 border-r border-gray-200">
                    {new Date(member.lastPayment).toLocaleDateString('en-US')}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                      member.dueAmount > 0 
                        ? 'bg-red-100 text-red-800' 
                        : 'bg-green-100 text-green-800'
                    }`}>
                      {member.dueAmount > 0 ? 'Due' : 'Paid'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Weekly;
