const mongoose = require('mongoose');
require('dotenv').config();

const User = require('./models/User');

async function approveAdmin() {
  try {
    console.log('🔗 Connecting to MongoDB...');
    
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    console.log('✅ Connected to MongoDB');

    // Find admin user
    const admin = await User.findOne({ email: 'admin@satrong.com' });
    
    if (!admin) {
      console.log('❌ Admin user not found!');
      process.exit(1);
    }

    console.log('\n📋 Current admin status:');
    console.log('   isActive:', admin.isActive);
    console.log('   isApproved:', admin.isApproved);

    // Update admin to be approved and active
    admin.isActive = true;
    admin.isApproved = true;
    admin.approvedBy = admin._id; // Self-approved
    admin.approvedAt = new Date();
    
    await admin.save();

    console.log('\n✅ Admin approved successfully!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📧 Email:    admin@satrong.com');
    console.log('🔑 Password: admin123');
    console.log('✅ Status:   Active & Approved');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    await mongoose.connection.close();
    process.exit(0);

  } catch (error) {
    console.error('❌ Error:', error);
    await mongoose.connection.close();
    process.exit(1);
  }
}

approveAdmin();
