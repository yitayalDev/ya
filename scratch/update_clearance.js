require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const Clearance = require('../models/Clearance');

mongoose.connect(process.env.MONGODB_URI).then(async () => {
  const result = await Clearance.updateMany(
    { student: '69ef44dbb6c607eaeb7d7ba9' },
    {
      $set: {
        status: 'CLEARED',
        'steps.library': { status: 'APPROVED', updatedAt: new Date(), autoChecked: true },
        'steps.department': { status: 'APPROVED', updatedAt: new Date(), gradesCompleted: true, academicCompleted: true },
        'steps.proctor': { status: 'APPROVED', updatedAt: new Date(), identityVerified: true, academicFollowup: true, behaviorClean: true },
        'steps.dormitory': { status: 'APPROVED', updatedAt: new Date(), roomVacated: true, noDamage: true, keyReturned: true },
        'steps.dean': { status: 'APPROVED', updatedAt: new Date(), noSeriousDiscipline: true },
        'steps.registrar': { status: 'APPROVED', updatedAt: new Date(), recordComplete: true },
        clearedAt: new Date()
      }
    }
  );
  console.log('Updated clearances:', result.modifiedCount);
  
  const c = await Clearance.find({ student: '69ef44dbb6c607eaeb7d7ba9' });
  c.forEach(cl => console.log(cl._id, cl.status));
  
  process.exit(0);
}).catch(e => { console.error(e); process.exit(1); });
