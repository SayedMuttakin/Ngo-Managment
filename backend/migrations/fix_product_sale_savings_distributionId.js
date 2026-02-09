const mongoose = require('mongoose');
require('dotenv').config();

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/ngo-microfinance', {
    useNewUrlParser: true,
    useUnifiedTopology: true
});

const db = mongoose.connection;

db.on('error', console.error.bind(console, 'MongoDB connection error:'));
db.once('open', async () => {
    console.log('✅ Connected to MongoDB');
    await generateDistributionIdsForOldSales();
});

async function generateDistributionIdsForOldSales() {
    try {
        const Installment = mongoose.model('Installment', new mongoose.Schema({}, { strict: false }));

        console.log('\n🔧 Starting migration: Generate distributionId for old product sales\n');

        // Find all product sale records without distributionId
        const productSaleRecords = await Installment.find({
            installmentType: 'extra',
            note: { $regex: 'Product Sale:', $options: 'i' },
            $or: [
                { distributionId: { $exists: false } },
                { distributionId: null },
                { distributionId: '' }
            ],
            isActive: true
        }).sort({ createdAt: 1 });

        console.log(`📊 Found ${productSaleRecords.length} product sale records without distributionId`);

        if (productSaleRecords.length === 0) {
            console.log('✅ No records to update!');
            process.exit(0);
            return;
        }

        // Group by member + timestamp (within 1 minute = same sale transaction)
        const saleGroups = {};

        for (const record of productSaleRecords) {
            const memberId = record.member.toString();
            const timestamp = Math.floor(record.createdAt.getTime() / 60000); // Round to minute
            const groupKey = `${memberId}-${timestamp}`;

            if (!saleGroups[groupKey]) {
                saleGroups[groupKey] = {
                    records: [],
                    member: record.member,
                    createdAt: record.createdAt
                };
            }

            saleGroups[groupKey].records.push(record);
        }

        console.log(`📊 Grouped into ${Object.keys(saleGroups).length} sale transactions\n`);

        let updatedCount = 0;

        for (const [groupKey, group] of Object.entries(saleGroups)) {
            // Generate unique distributionId for this sale transaction
            const distributionId = `SALE-${group.createdAt.getTime()}`;

            console.log(`📦 Processing sale group: ${distributionId}`);
            console.log(`   Member: ${group.member}`);
            console.log(`   Records: ${group.records.length}`);
            console.log(`   Created: ${group.createdAt.toISOString()}`);

            // Update all records in this group
            for (const record of group.records) {
                const notePreview = (record.note || '').substring(0, 60);
                console.log(`   - Updating: ${notePreview}...`);

                await Installment.updateOne(
                    { _id: record._id },
                    { $set: { distributionId: distributionId } }
                );

                updatedCount++;
            }

            console.log(`   ✅ Updated ${group.records.length} records with distributionId: ${distributionId}\n`);
        }

        console.log('='.repeat(60));
        console.log('📊 Migration Summary:');
        console.log(`  ✅ Total records updated: ${updatedCount}`);
        console.log(`  📦 Sale transactions created: ${Object.keys(saleGroups).length}`);
        console.log('='.repeat(60) + '\n');

        console.log('✅ Migration completed successfully!');
        process.exit(0);

    } catch (error) {
        console.error('❌ Migration error:', error);
        console.error(error.stack);
        process.exit(1);
    }
}
