const mongoose = require('mongoose');

const deleteBuilding100 = async () => {
  try {
    await mongoose.connect('mongodb://localhost:27017/university_app');
    console.log('Connected to DB');

    // Find the building named "100"
    const building = await mongoose.connection.collection('dormbuildings').findOne({ name: '100' });

    if (!building) {
      console.log('Building "100" not found.');
      process.exit(0);
    }

    const buildingId = building._id;
    console.log(`Found building "100" with ID: ${buildingId}. Proceeding with deletion...`);

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
    
    console.log(`Deletion Summary:
    - ${deleteBldg.deletedCount} Building ("100")
    - ${deleteBlocks.deletedCount} Blocks
    - ${deleteFloors.deletedCount} Floors
    - ${deleteRooms.deletedCount} Rooms
    - ${deleteBeds.deletedCount} Beds
    `);
    
    process.exit(0);
  } catch (error) {
    console.error('Deletion failed:', error);
    process.exit(1);
  }
};

deleteBuilding100();
