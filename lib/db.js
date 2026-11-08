const mongoose = require('mongoose');
const { Schema, model, models } = mongoose;

function connectDB() {
  if (!process.env.MONGODB_URI) {
    global._mongoErr = 'MONGODB_URI is not set';
    throw new Error('MONGODB_URI is not set');
  }
  if (!global._mongoConn) {
    global._mongoConn = mongoose
      .connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 10000 })
      .then((m) => { global._mongoErr = null; return m; })
      .catch((e) => {
        global._mongoConn = null;
        global._mongoErr = e.name;
        console.error('[db] connection failed:', e.message);
        throw e;
      });
  }
  return global._mongoConn;
}

const OID = Schema.Types.ObjectId;

const User = models.User || model('User', new Schema({
  username: { type: String, required: true, unique: true, lowercase: true, trim: true },
  passwordHash: { type: String, required: true },
  role: { type: String, enum: ['user', 'admin'], default: 'user' },
}, { timestamps: true }));

const Room = models.Room || model('Room', new Schema({
  name: { type: String, required: true, unique: true },
  owner: { type: OID, ref: 'User', required: true },
  isPrivate: { type: Boolean, default: false },
  members: [{ type: OID, ref: 'User' }],
}, { timestamps: true }));

const Upload = models.Upload || model('Upload', new Schema({
  owner: { type: OID, ref: 'User', required: true },
  room: { type: OID, ref: 'Room', required: true, index: true },
  stored: String, name: String, mime: String, size: Number,
}, { timestamps: true }));

const Message = models.Message || model('Message', new Schema({
  room: { type: OID, ref: 'Room', required: true, index: true },
  sender: { type: OID, ref: 'User', required: true },
  text: { type: String, default: '' },
  file: { upload: OID, name: String, mime: String, size: Number },
}, { timestamps: true }));

async function isMember(roomId, userId) {
  try { return !!(await Room.exists({ _id: roomId, members: userId })); } catch { return false; }
}

const shape = (m) => ({
  _id: String(m._id),
  room: String(m.room),
  sender: { _id: String(m.sender._id || m.sender), username: m.sender.username },
  text: m.text,
  file: m.file && m.file.upload
    ? { id: String(m.file.upload), name: m.file.name, mime: m.file.mime, size: m.file.size }
    : null,
  createdAt: m.createdAt,
});

module.exports = { connectDB, User, Room, Upload, Message, isMember, shape };