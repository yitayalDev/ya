const TranscriptOrder = require('../models/TranscriptOrder');
const Student = require('../models/Student');

// @desc    Submit a transcript order
// @route   POST /api/transcript-orders
// @access  Private (Student)
const submitOrder = async (req, res) => {
  const { orderType, deliveryMethod, destination, purpose } = req.body;

  try {
    const student = await Student.findOne({ user: req.user._id });
    if (!student) {
      return res.status(404).json({ message: 'Student profile not found' });
    }

    // Example fee logic
    let fee = 0;
    if (orderType === 'OFFICIAL_TRANSCRIPT') fee = 50;
    if (deliveryMethod === 'MAIL') fee += 20;

    const order = await TranscriptOrder.create({
      student: student._id,
      orderType,
      deliveryMethod,
      destination,
      purpose,
      fee
    });

    res.status(201).json(order);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get student's own orders
// @route   GET /api/transcript-orders/my
// @access  Private (Student)
const getMyOrders = async (req, res) => {
  try {
    const student = await Student.findOne({ user: req.user._id });
    const orders = await TranscriptOrder.find({ student: student._id }).sort({ createdAt: -1 });
    res.json(orders);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get all orders for registrar
// @route   GET /api/transcript-orders
// @access  Private (Registrar)
const getAllOrders = async (req, res) => {
  try {
    const orders = await TranscriptOrder.find({})
      .populate({
        path: 'student',
        populate: { path: 'user', select: 'name email' }
      })
      .sort({ createdAt: -1 });
    res.json(orders);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Update order status
// @route   PUT /api/transcript-orders/:id
// @access  Private (Registrar)
const updateOrderStatus = async (req, res) => {
  const { status, registrarNote, trackingNumber } = req.body;

  try {
    const order = await TranscriptOrder.findById(req.params.id);
    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    order.status = status;
    if (registrarNote) order.registrarNote = registrarNote;
    if (trackingNumber) order.trackingNumber = trackingNumber;
    
    if (status === 'COMPLETED') {
      order.completedAt = Date.now();
      order.processedBy = req.user._id;
    }

    await order.save();
    res.json(order);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  submitOrder,
  getMyOrders,
  getAllOrders,
  updateOrderStatus
};
