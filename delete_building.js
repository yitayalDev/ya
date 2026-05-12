const mongoose = require('mongoose');

const deleteBuilding = async () => {
  await mongoose.connect('mongodb://localhost:27017/university_app');
  console.log('Connected to DB');

  const building = await mongoose.connection.collection('dormbuildings').findOne({ name: 'T-34' });
  if (!building) {
    console.log('Building T-34 not found');
    process.exit(0);
  }

  const buildingId = building._id;
  
  // Find blocks
  const blocks = await mongoose.connection.collection('dormblocks').find({ building: buildingId }).toArray();
  const blockIds = blocks.map(b => b._id);
  
  // Find floors
  const floors = await mongoose.connection.collection('dormfloors').find({ block: { $in: blockIds } }).toArray();
  const floorIds = floors.map(f => f._id);
  
  // Find rooms
  const rooms = await mongoose.connection.collection('dormrooms').find({ floor: { $in: floorIds } }).toArray();
  const roomIds = rooms.map(r => r._id);
  
  // Delete beds
  const deleteBeds = await mongoose.connection.collection('dormbeds').deleteMany({ room: { $in: roomIds } });
  
  // Delete rooms
  const deleteRooms = await mongoose.connection.collection('dormrooms').deleteMany({ floor: { $in: floorIds } });
  
  // Delete floors
  const deleteFloors = await mongoose.connection.collection('dormfloors').deleteMany({ block: { $in: blockIds } });
  
  // Delete blocks
  const deleteBlocks = await mongoose.connection.collection('dormblocks').deleteMany({ building: buildingId });
  
  // Delete building
  const deleteBldg = await mongoose.connection.collection('dormbuildings').deleteOne({ _id: buildingId });
  
  console.log(`Deleted:
  - ${deleteBldg.deletedCount} Buildings
  - ${deleteBlocks.deletedCount} Blocks
  - ${deleteFloors.deletedCount} Floors
  - ${deleteRooms.deletedCount} Rooms
  - ${deleteBeds.deletedCount} Beds
  `);
  
  process.exit(0);
};

deleteBuilding().catch(console.error);
