require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const Clearance = require('../models/Clearance');
const User = require('../models/User');

mongoose.connect(process.env.MONGODB_URI).then(async () => {
  const c = await Clearance.findOne({ _id: '69f0656c8297e828ff9ec621' })
    .populate('student');
  console.log(JSON.stringify(c, null, 2));
  process.exit(0);
}).catch(e => { console.error(e); process.exit(1); });
