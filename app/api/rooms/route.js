
import { NextResponse } from 'next/server';

import {
  connectDB,
  Room
} from '@/lib/db';

import { getSession } from '@/lib/auth';

const err = (message, status) =>
  NextResponse.json({ error: message }, { status });

// GET: Fetch all rooms available to the logged-in user
export async function GET(req) {
  try {
    const s = getSession(req);

    if (!s?.id) {
      return err('Unauthorized', 401);
    }

    await connectDB();

    // Admins can see all rooms.
    // Other users can see public rooms and private rooms
    // where they are members or owners.
    const query = s.role === 'admin'
      ? {}
      : {
        $or: [
          { isPrivate: false },
          { members: s.id },
          { owner: s.id }
        ]
      };

    const rooms = await Room.find(query)
      .sort({ createdAt: -1 })
      .lean();

    const formattedRooms = rooms.map((room) => {
      const joined = room.members.some(
        (member) => String(member) === String(s.id)
      );

      const canManage =
        String(room.owner) === String(s.id) ||
        s.role === 'admin';

      return {
        _id: String(room._id),
        name: room.name,
        owner: String(room.owner),
        isPrivate: room.isPrivate,
        joined: joined || canManage,
        canManage
      };
    });

    return NextResponse.json({
      rooms: formattedRooms
    });

  } catch (error) {
    console.error('Fetch rooms error:', error);

    return err('Internal server error', 500);
  }
}

// POST: Create a new room
export async function POST(req) {
  try {
    const s = getSession(req);

    if (!s?.id) {
      return err('Unauthorized', 401);
    }

    await connectDB();

    const body = await req.json().catch(() => ({}));

    const name = String(body.name || '').trim();
    const isPrivate = body.isPrivate === true;

    if (!name) {
      return err('Room name is required', 400);
    }

    if (name.length > 50) {
      return err('Room name cannot exceed 50 characters', 400);
    }

    // Check whether the room already exists
    const existingRoom = await Room.findOne({ name });

    if (existingRoom) {
      return err('A room with this name already exists', 409);
    }

    // Create room and automatically add creator as a member
    const room = await Room.create({
      name,
      owner: s.id,
      isPrivate,
      members: [s.id]
    });

    const formattedRoom = {
      _id: String(room._id),
      name: room.name,
      owner: String(room.owner),
      isPrivate: room.isPrivate,
      joined: true,
      canManage: true
    };

    return NextResponse.json(
      {
        message: 'Room created successfully',
        room: formattedRoom
      },
      { status: 201 }
    );

  } catch (error) {
    // Handle MongoDB duplicate-key error
    if (error.code === 11000) {
      return err('A room with this name already exists', 409);
    }

    console.error('Create room error:', error);

    return err('Internal server error', 500);
  }
}
