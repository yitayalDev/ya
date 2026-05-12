const crypto = require('crypto');
const { AccessToken } = require('livekit-server-sdk');
const Appointment = require('../models/Appointment');
const Student = require('../models/Student');
const Clinic = require('../models/Clinic');
const MedicalStaff = require('../models/MedicalStaff');
const { createNotification } = require('./notificationController');

const VIDEO_TOKEN_TTL_SECONDS = Number(process.env.VIDEO_TOKEN_TTL_SECONDS || 300);
const VIDEO_SESSION_DURATION_MINUTES = Number(process.env.VIDEO_SESSION_DURATION_MINUTES || 30);
const VIDEO_JOIN_GRACE_MINUTES = Number(process.env.VIDEO_JOIN_GRACE_MINUTES || 15);

const isVideoSession = (appointment) => appointment.sessionType === 'VIDEO';

const getSessionType = (appointmentType, sessionType) => {
  if (sessionType === 'VIDEO' || appointmentType === 'VIRTUAL') {
    return 'VIDEO';
  }
  return 'PHYSICAL';
};

const normalizeAppointmentType = (appointmentType, sessionType) => {
  const normalizedType = `${appointmentType || ''}`.trim().toUpperCase();

  if (normalizedType === 'IN_PERSON' || normalizedType === 'VIRTUAL') {
    return 'CONSULTATION';
  }

  if (normalizedType === 'COUNSELLING') {
    return 'COUNSELING';
  }

  if (!normalizedType && sessionType === 'VIDEO') {
    return 'CONSULTATION';
  }

  return normalizedType || 'CONSULTATION';
};

const getAbsoluteScheduledTime = (scheduledDate, timeSlot) => {
  const base = new Date(scheduledDate);
  if (!timeSlot) return base;

  const match = `${timeSlot}`.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!match) return base;

  let hours = Number(match[1]);
  const minutes = Number(match[2]);
  const meridiem = match[3].toUpperCase();

  if (meridiem === 'PM' && hours !== 12) hours += 12;
  if (meridiem === 'AM' && hours === 12) hours = 0;

  base.setHours(hours, minutes, 0, 0);
  return base;
};

const parseOperatingTime = (value) => {
  const match = `${value || ''}`.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  return (Number(match[1]) * 60) + Number(match[2]);
};

const parseTimeSlotMinutes = (timeSlot) => {
  const match = `${timeSlot || ''}`.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!match) return null;

  let hours = Number(match[1]);
  const minutes = Number(match[2]);
  const meridiem = match[3].toUpperCase();

  if (meridiem === 'PM' && hours !== 12) hours += 12;
  if (meridiem === 'AM' && hours === 12) hours = 0;

  return (hours * 60) + minutes;
};

const validateClinicTimeSlot = (clinic, timeSlot) => {
  const open = parseOperatingTime(clinic?.operatingHours?.open);
  const close = parseOperatingTime(clinic?.operatingHours?.close);
  const slot = parseTimeSlotMinutes(timeSlot);

  if (open === null || close === null || slot === null) {
    return true;
  }

  return slot >= open && slot < close;
};

const getVideoDeadline = (appointment) => {
  const startsAt = appointment.videoSession?.startsAt || getAbsoluteScheduledTime(appointment.scheduledDate, appointment.timeSlot);
  const durationMinutes = appointment.videoSession?.durationMinutes || VIDEO_SESSION_DURATION_MINUTES;
  return new Date(startsAt.getTime() + ((durationMinutes + VIDEO_JOIN_GRACE_MINUTES) * 60 * 1000));
};

const expireSessionIfNeeded = async (appointment) => {
  if (!isVideoSession(appointment) || !appointment.videoSession || appointment.videoSession.status === 'COMPLETED') {
    return appointment;
  }

  if (new Date() > getVideoDeadline(appointment)) {
    appointment.videoSession.status = 'EXPIRED';
    appointment.videoSession.endedAt = new Date();
    if (appointment.status !== 'COMPLETED' && appointment.status !== 'CANCELLED') {
      appointment.status = 'NOSHOW';
    }
    await appointment.save();
  }

  return appointment;
};

const deriveE2EEKey = (appointmentId, roomName) => {
  const secret = process.env.VIDEO_E2EE_SECRET || process.env.JWT_SECRET || 'clinic-video-secret';
  return crypto
    .createHmac('sha256', secret)
    .update(`${appointmentId}:${roomName}`)
    .digest('hex');
};

const assertLiveKitConfigured = () => {
  const missing = ['LIVEKIT_URL', 'LIVEKIT_API_KEY', 'LIVEKIT_API_SECRET']
    .filter((key) => !process.env[key]);
  if (missing.length > 0) {
    const error = new Error(`Missing video configuration: ${missing.join(', ')}`);
    error.statusCode = 503;
    throw error;
  }
};

const buildLiveKitToken = async ({ appointment, user, canPublish, role }) => {
  assertLiveKitConfigured();

  const roomName = appointment.videoSession.roomName;
  const token = new AccessToken(
    process.env.LIVEKIT_API_KEY,
    process.env.LIVEKIT_API_SECRET,
    {
      identity: user._id.toString(),
      ttl: VIDEO_TOKEN_TTL_SECONDS,
    }
  );

  token.name = user.name;
  token.metadata = JSON.stringify({
    appointmentId: appointment._id.toString(),
    roomName,
    role,
    sessionType: appointment.sessionType,
  });

  token.addGrant({
    roomJoin: true,
    room: roomName,
    canPublish,
    canPublishData: true,
    canSubscribe: true,
  });

  return {
    token: await token.toJwt(),
    wsUrl: process.env.LIVEKIT_URL,
    roomName,
    e2eeKey: deriveE2EEKey(appointment._id.toString(), roomName),
    expiresAt: new Date(Date.now() + (VIDEO_TOKEN_TTL_SECONDS * 1000)).toISOString(),
  };
};

const loadAppointmentForVideo = async (appointmentId) => {
  const appointment = await Appointment.findById(appointmentId)
    .populate({
      path: 'student',
      select: 'user medicalProfile',
      populate: { path: 'user', select: 'name email' }
    })
    .populate({
      path: 'staff',
      select: 'user clinic role specialization',
      populate: { path: 'user', select: 'name email role' }
    })
    .populate('clinic', 'name location');

  if (!appointment) {
    const error = new Error('Appointment not found');
    error.statusCode = 404;
    throw error;
  }

  await expireSessionIfNeeded(appointment);
  return appointment;
};

const ensureVideoAppointment = (appointment) => {
  if (!isVideoSession(appointment) || !appointment.videoSession?.roomName) {
    const error = new Error('This appointment does not have a video session.');
    error.statusCode = 400;
    throw error;
  }

  if (appointment.videoSession.status === 'EXPIRED') {
    const error = new Error('This video session has expired.');
    error.statusCode = 410;
    throw error;
  }
};

const getStaffRecordForUser = async (userId, clinicId) => {
  return MedicalStaff.findOne({
    user: userId,
    clinic: clinicId,
    role: { $in: ['DOCTOR', 'NURSE', 'CLINIC_ADMIN'] }
  }).populate('user', 'name email role');
};

const ensureAuthorizedStaffForAppointment = async (req, appointment) => {
  let staffRecord = appointment.staff;

  if (staffRecord?.user?._id?.toString() === req.user._id.toString()) {
    return staffRecord;
  }

  staffRecord = await getStaffRecordForUser(req.user._id, appointment.clinic._id);
  if (!staffRecord) {
    const error = new Error('You are not assigned to this clinic appointment.');
    error.statusCode = 403;
    throw error;
  }

  if (!appointment.staff) {
    appointment.staff = staffRecord._id;
    await appointment.save();
    appointment.staff = staffRecord;
    return staffRecord;
  }

  if (appointment.staff._id.toString() !== staffRecord._id.toString()) {
    const error = new Error('Only the assigned clinician can access this session.');
    error.statusCode = 403;
    throw error;
  }

  return staffRecord;
};

const ensureAuthorizedStudentForAppointment = (req, appointment) => {
  if (appointment.student?.user?._id?.toString() !== req.user._id.toString()) {
    const error = new Error('Only the assigned student can access this session.');
    error.statusCode = 403;
    throw error;
  }
};

const emitUserEvent = (req, userId, event, payload) => {
  if (req.io && userId) {
    req.io.to(userId.toString()).emit(event, payload);
  }
};

const sendVideoNotification = async ({ req, recipient, title, message, priority = 'HIGH', relatedId, event, payload }) => {
  await createNotification({
    recipient,
    title,
    message,
    type: 'CLINIC',
    priority,
    relatedId,
    actionUrl: '/health',
  });

  emitUserEvent(req, recipient, event, payload);
};

// @desc    Book a new appointment
// @route   POST /api/appointments
// @access  Private (Student)
const bookAppointment = async (req, res) => {
  try {
    const { clinicId, appointmentType = 'CONSULTATION', sessionType, reason, symptoms, scheduledDate, timeSlot } = req.body;

    if (!clinicId) {
      return res.status(400).json({ message: 'Please select a clinic.' });
    }

    if (!reason || !scheduledDate || !timeSlot) {
      return res.status(400).json({ message: 'Reason, date, and time are required.' });
    }

    const resolvedSessionType = getSessionType(appointmentType, sessionType);
    const normalizedAppointmentType = normalizeAppointmentType(appointmentType, resolvedSessionType);

    if (resolvedSessionType === 'VIDEO' && (!scheduledDate || !timeSlot)) {
      return res.status(400).json({ message: 'Video sessions require a scheduled appointment time.' });
    }

    const clinic = await Clinic.findById(clinicId);
    if (!clinic) {
      return res.status(404).json({ message: 'Clinic not found.' });
    }

    if (!validateClinicTimeSlot(clinic, timeSlot)) {
      return res.status(400).json({
        message: 'Selected time is outside the clinic working hours.',
      });
    }

    const student = await Student.findOne({ user: req.user._id }).populate('user');
    if (!student) {
      return res.status(404).json({ message: 'Student profile not found' });
    }

    let assignedStaff = await MedicalStaff.findOne({
      clinic: clinicId,
      role: { $in: ['DOCTOR', 'NURSE'] },
      isAvailable: true
    }).sort({ role: 1, createdAt: 1 }).populate('user', 'name email');

    if (!assignedStaff) {
      assignedStaff = await MedicalStaff.findOne({
        clinic: clinicId,
        role: { $in: ['DOCTOR', 'NURSE', 'CLINIC_ADMIN'] }
      }).sort({ createdAt: 1 }).populate('user', 'name email');
    }

    // Expanded AI Triage Engine
    let priority = 'LOW';
    let reasoning = 'Standard appointment';
    let flaggedKeywords = [];

    const emergencyCategories = {
      cardiac: ['chest pain', 'heart attack', 'arrhythmia', 'palpitations'],
      respiratory: ['shortness of breath', 'difficulty breathing', 'asthma attack', 'suffocating'],
      trauma: ['bleeding', 'accident', 'fracture', 'broken bone', 'unconscious', 'fainting'],
      mentalHealth: ['suicidal', 'self harm', 'hallucination', 'panic attack']
    };

    const highPriorityKeywords = ['fever', 'severe headache', 'vision loss', 'sudden pain', 'vomiting', 'diarrhea'];

    const content = (reason + ' ' + (symptoms || []).join(' ')).toLowerCase();

    for (const [category, keys] of Object.entries(emergencyCategories)) {
      const matches = keys.filter((key) => content.includes(key));
      if (matches.length > 0) {
        priority = 'EMERGENCY';
        reasoning = `AI detected potential ${category} emergency.`;
        flaggedKeywords.push(...matches);
        break;
      }
    }

    if (priority === 'LOW') {
      const matches = highPriorityKeywords.filter((key) => content.includes(key));
      if (matches.length > 0) {
        priority = 'HIGH';
        reasoning = 'AI detected high-risk symptoms requiring priority attention.';
        flaggedKeywords.push(...matches);
      }
    }

    if (normalizedAppointmentType === 'EMERGENCY') priority = 'EMERGENCY';

    const startOfDay = new Date(scheduledDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(scheduledDate);
    endOfDay.setHours(23, 59, 59, 999);

    const count = await Appointment.countDocuments({
      clinic: clinicId,
      scheduledDate: { $gte: startOfDay, $lte: endOfDay }
    });

    const startsAt = getAbsoluteScheduledTime(scheduledDate, timeSlot);
    const roomSeed = crypto.randomBytes(12).toString('hex');
    const roomName = resolvedSessionType === 'VIDEO' ? `clinic-${clinicId}-${student._id}-${roomSeed}` : undefined;

    const appointment = await Appointment.create({
      student: student._id,
      clinic: clinicId,
      staff: assignedStaff?._id,
      appointmentType: normalizedAppointmentType,
      sessionType: resolvedSessionType,
      reason,
      symptoms,
      scheduledDate,
      timeSlot,
      status: 'CONFIRMED',
      priority,
      queueNumber: count + 1,
      aiTriage: {
        reasoning,
        confidence: priority === 'EMERGENCY' ? 0.95 : 0.75,
        flaggedKeywords
      },
      videoSession: resolvedSessionType === 'VIDEO' ? {
        roomName,
        status: 'SCHEDULED',
        startsAt,
        durationMinutes: VIDEO_SESSION_DURATION_MINUTES,
      } : undefined,
    });

    await sendVideoNotification({
      req,
      recipient: student.user._id,
      title: 'Appointment Confirmed',
      message: resolvedSessionType === 'VIDEO'
        ? `Your video consultation is scheduled for ${timeSlot}.`
        : `Your clinic appointment is scheduled for ${timeSlot}.`,
      priority: 'HIGH',
      relatedId: appointment._id,
      event: 'appointment_confirmed',
      payload: {
        appointmentId: appointment._id,
        sessionType: resolvedSessionType,
        scheduledDate,
        timeSlot,
      }
    });

    if (assignedStaff?.user?._id) {
      await sendVideoNotification({
        req,
        recipient: assignedStaff.user._id,
        title: resolvedSessionType === 'VIDEO' ? 'New Video Consultation Assigned' : 'New Appointment Assigned',
        message: `${student.user.name} booked a ${resolvedSessionType === 'VIDEO' ? 'video consultation' : 'clinic visit'} at ${timeSlot}.`,
        priority: priority === 'EMERGENCY' ? 'URGENT' : 'HIGH',
        relatedId: appointment._id,
        event: 'appointment_assigned',
        payload: {
          appointmentId: appointment._id,
          studentName: student.user.name,
          sessionType: resolvedSessionType,
          priority,
        }
      });
    }

    if (req.io) {
      req.io.to(`clinic_${clinicId}`).emit('new_appointment', {
        appointmentId: appointment._id,
        studentName: student.user.name,
        priority,
        sessionType: resolvedSessionType,
      });
    }

    res.status(201).json(appointment);
  } catch (error) {
    console.error('BOOK_APPT_ERROR:', error);
    res.status(error.statusCode || 500).json({ message: error.message });
  }
};

// @desc    Get logged in student's appointments
// @route   GET /api/appointments/my
// @access  Private (Student)
const getMyAppointments = async (req, res) => {
  try {
    const student = await Student.findOne({ user: req.user._id }).populate('user', 'name email');
    const appointments = await Appointment.find({ student: student._id })
      .populate('clinic', 'name location')
      .populate({ path: 'student', select: 'user', populate: { path: 'user', select: 'name email' } })
      .populate({ path: 'staff', select: 'role user', populate: { path: 'user', select: 'name email role' } })
      .sort({ scheduledDate: -1 });

    await Promise.all(appointments.map((appointment) => expireSessionIfNeeded(appointment)));

    const enrichedAppointments = await Promise.all(appointments.map(async (appt) => {
      if (appt.status === 'PENDING' || appt.status === 'CONFIRMED' || appt.status === 'ARRIVED') {
        const peopleAhead = await Appointment.countDocuments({
          clinic: appt.clinic._id,
          status: { $in: ['PENDING', 'CONFIRMED', 'ARRIVED', 'IN_PROGRESS'] },
          scheduledDate: appt.scheduledDate,
          queueNumber: { $lt: appt.queueNumber }
        });

        const estMinutes = (peopleAhead * 15) + 5;
        return {
          ...appt.toObject(),
          aiEstimatedWait: estMinutes,
          peopleAhead
        };
      }
      return appt.toObject();
    }));

    res.json(enrichedAppointments);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get all appointments for a clinic (for staff)
// @route   GET /api/appointments/clinic/:clinicId
// @access  Private (Medical Staff)
const getClinicAppointments = async (req, res) => {
  try {
    const { status, date } = req.query;
    const query = { clinic: req.params.clinicId };

    if (status) query.status = status;
    if (date) {
      const start = new Date(date);
      start.setHours(0, 0, 0, 0);
      const end = new Date(date);
      end.setHours(23, 59, 59, 999);
      query.scheduledDate = { $gte: start, $lte: end };
    }

    const appointments = await Appointment.find(query)
      .populate({
        path: 'student',
        select: 'medicalProfile user',
        populate: { path: 'user', select: 'name email' }
      })
      .populate({
        path: 'staff',
        select: 'role user clinic',
        populate: { path: 'user', select: 'name email role' }
      })
      .sort({ priority: -1, queueNumber: 1 });

    await Promise.all(appointments.map((appointment) => expireSessionIfNeeded(appointment)));

    const validAppointments = appointments.filter((appointment) => appointment.student !== null && appointment.student.user !== null);
    res.json(validAppointments);
  } catch (error) {
    console.error('GET_CLINIC_APPTS_ERROR:', error);
    res.status(500).json({ message: error.message });
  }
};

// @desc    Update appointment status
// @route   PUT /api/appointments/:id/status
// @access  Private (Medical Staff)
const updateStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const appointment = await Appointment.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true }
    ).populate({ path: 'student', populate: { path: 'user' } });

    if (appointment && appointment.student && appointment.student.user) {
      await createNotification({
        recipient: appointment.student.user._id,
        title: 'Clinic Appointment Update',
        message: `Your clinic appointment status has been updated to ${status}.`,
        type: 'CLINIC',
        priority: status === 'CONFIRMED' || status === 'IN_PROGRESS' ? 'HIGH' : 'NORMAL',
        relatedId: appointment._id,
        actionUrl: '/health',
      });
    }

    res.json(appointment);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Start a secure video session
// @route   POST /api/appointments/:id/video/start
// @access  Private (Medical Staff)
const startVideoSession = async (req, res) => {
  try {
    const appointment = await loadAppointmentForVideo(req.params.id);
    ensureVideoAppointment(appointment);
    const staffRecord = await ensureAuthorizedStaffForAppointment(req, appointment);

    appointment.status = 'IN_PROGRESS';
    appointment.videoSession.status = 'LIVE';
    appointment.videoSession.hostJoinedAt = new Date();
    appointment.videoSession.joinTokenExpiresAt = new Date(Date.now() + (VIDEO_TOKEN_TTL_SECONDS * 1000));
    await appointment.save();

    const sessionAccess = await buildLiveKitToken({
      appointment,
      user: req.user,
      canPublish: true,
      role: 'host'
    });

    if (appointment.student?.user?._id) {
      await sendVideoNotification({
        req,
        recipient: appointment.student.user._id,
        title: 'Session Started',
        message: `${staffRecord.user?.name || 'Your clinician'} has started the video session.`,
        priority: 'URGENT',
        relatedId: appointment._id,
        event: 'video_session_started',
        payload: {
          appointmentId: appointment._id,
          roomName: appointment.videoSession.roomName,
          startedAt: appointment.videoSession.hostJoinedAt,
          clinicName: appointment.clinic?.name,
        }
      });
    }

    res.json({
      appointment,
      sessionAccess,
      role: 'host',
    });
  } catch (error) {
    res.status(error.statusCode || 500).json({ message: error.message });
  }
};

// @desc    Join a secure video session
// @route   POST /api/appointments/:id/video/join
// @access  Private
const joinVideoSession = async (req, res) => {
  try {
    const appointment = await loadAppointmentForVideo(req.params.id);
    ensureVideoAppointment(appointment);

    let role = 'participant';
    let canPublish = false;

    if (req.user.role === 'STUDENT') {
      ensureAuthorizedStudentForAppointment(req, appointment);
      if (appointment.videoSession.status !== 'LIVE') {
        return res.status(409).json({ message: 'The clinician has not started this session yet.' });
      }
      canPublish = true;
      appointment.videoSession.participantJoinedAt = new Date();
    } else {
      await ensureAuthorizedStaffForAppointment(req, appointment);
      role = 'host';
      canPublish = true;
      if (appointment.videoSession.status === 'SCHEDULED') {
        appointment.videoSession.status = 'LIVE';
        appointment.status = 'IN_PROGRESS';
      }
      appointment.videoSession.hostJoinedAt = appointment.videoSession.hostJoinedAt || new Date();
    }

    appointment.videoSession.joinTokenExpiresAt = new Date(Date.now() + (VIDEO_TOKEN_TTL_SECONDS * 1000));
    await appointment.save();

    const sessionAccess = await buildLiveKitToken({
      appointment,
      user: req.user,
      canPublish,
      role,
    });

    res.json({
      appointment,
      sessionAccess,
      role,
    });
  } catch (error) {
    res.status(error.statusCode || 500).json({ message: error.message });
  }
};

// @desc    Send a reminder for a video session
// @route   POST /api/appointments/:id/video/reminder
// @access  Private (Medical Staff)
const sendVideoReminder = async (req, res) => {
  try {
    const appointment = await loadAppointmentForVideo(req.params.id);
    ensureVideoAppointment(appointment);
    await ensureAuthorizedStaffForAppointment(req, appointment);

    if (!appointment.student?.user?._id) {
      return res.status(400).json({ message: 'Student user is missing for this appointment.' });
    }

    await sendVideoNotification({
      req,
      recipient: appointment.student.user._id,
      title: 'Session Reminder',
      message: `Reminder: your video consultation at ${appointment.timeSlot} is coming up soon.`,
      priority: 'HIGH',
      relatedId: appointment._id,
      event: 'video_session_reminder',
      payload: {
        appointmentId: appointment._id,
        timeSlot: appointment.timeSlot,
        scheduledDate: appointment.scheduledDate,
      }
    });

    res.json({ message: 'Reminder sent.' });
  } catch (error) {
    res.status(error.statusCode || 500).json({ message: error.message });
  }
};

// @desc    Save in-session notes for a video session
// @route   PUT /api/appointments/:id/video/notes
// @access  Private (Medical Staff)
const saveSessionNotes = async (req, res) => {
  try {
    const appointment = await loadAppointmentForVideo(req.params.id);
    ensureVideoAppointment(appointment);
    await ensureAuthorizedStaffForAppointment(req, appointment);

    const { sessionNotes, observations, followUpPlan } = req.body;
    appointment.videoSession.notes = {
      sessionNotes: sessionNotes || '',
      observations: observations || '',
      followUpPlan: followUpPlan || '',
      updatedAt: new Date(),
      updatedBy: req.user._id,
    };
    await appointment.save();

    res.json(appointment.videoSession.notes);
  } catch (error) {
    res.status(error.statusCode || 500).json({ message: error.message });
  }
};

// @desc    End a secure video session
// @route   POST /api/appointments/:id/video/end
// @access  Private (Medical Staff)
const endVideoSession = async (req, res) => {
  try {
    const appointment = await loadAppointmentForVideo(req.params.id);
    ensureVideoAppointment(appointment);
    await ensureAuthorizedStaffForAppointment(req, appointment);

    appointment.videoSession.status = 'COMPLETED';
    appointment.videoSession.endedAt = new Date();
    appointment.videoSession.endsAt = appointment.videoSession.endedAt;
    await appointment.save();

    if (appointment.student?.user?._id) {
      await sendVideoNotification({
        req,
        recipient: appointment.student.user._id,
        title: 'Session Ended',
        message: 'Your clinician has ended the video session. Consultation notes are being saved securely.',
        priority: 'HIGH',
        relatedId: appointment._id,
        event: 'video_session_ended',
        payload: {
          appointmentId: appointment._id,
          endedAt: appointment.videoSession.endedAt,
        }
      });
    }

    res.json({
      message: 'Video session ended.',
      videoSession: appointment.videoSession,
    });
  } catch (error) {
    res.status(error.statusCode || 500).json({ message: error.message });
  }
};

module.exports = {
  bookAppointment,
  getMyAppointments,
  getClinicAppointments,
  updateStatus,
  startVideoSession,
  joinVideoSession,
  sendVideoReminder,
  saveSessionNotes,
  endVideoSession,
};
