import React from 'react';
import { Users, UserCheck, UserX, UserPlus } from 'lucide-react';

const MemberStats = ({ members }) => {
  const totalMembers = members.length;
  const activeMembers = members.filter(m => m.status === 'Active').length;
  const inactiveMembers = members.filter(m => m.status === 'Inactive').length;
  const pendingMembers = members.filter(m => m.status === 'Pending').length;

  const stats = [
    {
      title: 'Total Members',
      value: totalMembers,
      icon: Users,
      color: 'from-blue-500 to-blue-600',
      textColor: 'text-blue-600'
    },
    {
      title: 'Active Members',
      value: activeMembers,
      icon: UserCheck,
      color: 'from-green-500 to-green-600',
      textColor: 'text-green-600'
    },
    {
      title: 'Inactive Members',
      value: inactiveMembers,
      icon: UserX,
      color: 'from-red-500 to-red-600',
      textColor: 'text-red-600'
    },
    {
      title: 'Pending Members',
      value: pendingMembers,
      icon: UserPlus,
      color: 'from-yellow-500 to-yellow-600',
      textColor: 'text-yellow-600'
    }
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {stats.map((stat, index) => (
        <div key={index} className={`bg-gradient-to-r ${stat.color} rounded-xl shadow-lg p-6 text-white`}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm opacity-90">{stat.title}</p>
              <p className="text-3xl font-bold mt-1">{stat.value}</p>
            </div>
            <div className="bg-white bg-opacity-20 p-3 rounded-full">
              <stat.icon className="h-8 w-8" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default MemberStats;
