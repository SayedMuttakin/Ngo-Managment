const mongoose = require('mongoose');

const systemSettingsSchema = new mongoose.Schema({
    // Login time restriction settings
    loginTimeRestriction: {
        enabled: {
            type: Boolean,
            default: false
        },
        startTime: {
            type: String,
            default: '00:00',  // Format: 'HH:MM'
            validate: {
                validator: function (v) {
                    return /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/.test(v);
                },
                message: 'Invalid time format. Use HH:MM'
            }
        },
        endTime: {
            type: String,
            default: '23:59',  // Format: 'HH:MM'
            validate: {
                validator: function (v) {
                    return /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/.test(v);
                },
                message: 'Invalid time format. Use HH:MM'
            }
        }
    },
    adminPin: {
        type: String,
        default: null
    }
}, {
    timestamps: true
});

// Method to check if login is allowed at current time
systemSettingsSchema.methods.isLoginAllowed = function () {
    if (!this.loginTimeRestriction.enabled) {
        return { allowed: true };
    }

    const now = new Date();
    const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    const start = this.loginTimeRestriction.startTime;
    const end = this.loginTimeRestriction.endTime;

    // Convert time strings to minutes for comparison
    const timeToMinutes = (time) => {
        const [hours, minutes] = time.split(':').map(Number);
        return hours * 60 + minutes;
    };

    const currentMinutes = timeToMinutes(currentTime);
    const startMinutes = timeToMinutes(start);
    const endMinutes = timeToMinutes(end);

    let allowed = false;

    if (startMinutes <= endMinutes) {
        // Normal case: start time is before end time (e.g., 09:00 to 18:00)
        allowed = currentMinutes >= startMinutes && currentMinutes <= endMinutes;
    } else {
        // Cross-midnight case: start time is after end time (e.g., 22:00 to 06:00)
        allowed = currentMinutes >= startMinutes || currentMinutes <= endMinutes;
    }

    return {
        allowed,
        startTime: start,
        endTime: end,
        currentTime
    };
};

// Static method to get or create settings
systemSettingsSchema.statics.getSettings = async function () {
    let settings = await this.findOne();

    if (!settings) {
        settings = await this.create({});
    }

    return settings;
};

module.exports = mongoose.model('SystemSettings', systemSettingsSchema);
