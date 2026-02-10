import React from 'react';
import { Calendar, Clock } from 'lucide-react';

const DaySelection = ({ weekDays, onDaySelect }) => {
  return (
    <div className="bg-white rounded-3xl shadow-2xl border p-8">
      <div className="text-center mb-8">
        <h2 className="text-3xl font-bold text-gray-900 mb-4">Select Day</h2>
        <p className="text-gray-600">Choose the day for installment collection</p>
      </div>
      
      <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
        {weekDays.map((day) => (
          <button
            key={day.id}
            onClick={() => onDaySelect(day)}
            className={`bg-gradient-to-r ${day.color} hover:scale-105 text-white p-6 rounded-2xl font-bold text-xl shadow-lg transform transition-all duration-300 hover:shadow-2xl ${
              day.isDaily ? 'md:col-span-3' : ''
            }`}
          >
            {day.isDaily ? (
              <Clock className="h-8 w-8 mx-auto mb-3" />
            ) : (
              <Calendar className="h-8 w-8 mx-auto mb-3" />
            )}
            {day.name}
          </button>
        ))}
      </div>
    </div>
  );
};

export default DaySelection;
