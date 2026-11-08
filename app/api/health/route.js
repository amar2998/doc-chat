import mongoose from 'mongoose';

export const dynamic = 'force-dynamic';

export async function GET() {
    const states = ['disconnected', 'connected', 'connecting', 'disconnecting'];
    return Response.json({
        ok: true,
        db: states[mongoose.connection.readyState] || 'unknown',
        dbError: global._mongoErr || null,
    });
}