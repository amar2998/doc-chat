// File storage: S3-compatible bucket (Backblaze B2) when S3_BUCKET is set, else local disk (dev).
const fs = require('fs/promises');
const { createReadStream } = require('fs');
const path = require('path');
const { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');

const bucket = () => process.env.S3_BUCKET;
const dir = () => process.env.UPLOAD_DIR || path.join(process.cwd(), 'uploads');

function client() {
    if (!global._s3) {
        const ep = process.env.S3_ENDPOINT || '';
        global._s3 = new S3Client({
            region: process.env.S3_REGION,
            endpoint: ep.startsWith('http') ? ep : `https://${ep}`,
            credentials: { accessKeyId: process.env.S3_KEY_ID, secretAccessKey: process.env.S3_SECRET },
            forcePathStyle: true,
            // B2 rejects the SDK's default CRC checksum headers
            requestChecksumCalculation: 'WHEN_REQUIRED',
            responseChecksumValidation: 'WHEN_REQUIRED',
        });
    }
    return global._s3;
}

const coded = (code, extra) => Object.assign(new Error(code), { code }, extra);

async function put(key, buf, mime) {
    if (bucket()) {
        await client().send(new PutObjectCommand({ Bucket: bucket(), Key: key, Body: buf, ContentType: mime, ContentLength: buf.length }));
    } else {
        await fs.mkdir(dir(), { recursive: true });
        await fs.writeFile(path.join(dir(), key), buf);
    }
}

// Returns { stream, status, contentRange, length }. Throws code NOT_FOUND or RANGE.
async function get(key, rangeHeader) {
    const range = /^bytes=\d*-\d*$/.test(rangeHeader || '') ? rangeHeader : undefined;
    if (bucket()) {
        try {
            const r = await client().send(new GetObjectCommand({ Bucket: bucket(), Key: key, Range: range }));
            return { stream: r.Body, status: r.ContentRange ? 206 : 200, contentRange: r.ContentRange, length: r.ContentLength };
        } catch (e) {
            const s = e.$metadata?.httpStatusCode;
            if (e.name === 'NoSuchKey' || s === 404) throw coded('NOT_FOUND');
            if (s === 416) throw coded('RANGE');
            throw e;
        }
    }
    const p = path.join(dir(), key);
    let stat;
    try { stat = await fs.stat(p); } catch { throw coded('NOT_FOUND'); }
    let start = 0, end = stat.size - 1, status = 200;
    const m = /bytes=(\d*)-(\d*)/.exec(range || '');
    if (m && (m[1] || m[2])) {
        if (m[1]) { start = parseInt(m[1], 10); if (m[2]) end = Math.min(parseInt(m[2], 10), end); }
        else start = Math.max(stat.size - parseInt(m[2], 10), 0);
        if (start > end || start >= stat.size) throw coded('RANGE', { total: stat.size });
        status = 206;
    }
    return {
        stream: createReadStream(p, { start, end }), status, length: end - start + 1,
        contentRange: status === 206 ? `bytes ${start}-${end}/${stat.size}` : undefined,
    };
}

async function remove(key) {
    try {
        if (bucket()) await client().send(new DeleteObjectCommand({ Bucket: bucket(), Key: key }));
        else await fs.unlink(path.join(dir(), key));
    } catch { }
}

module.exports = { put, get, remove };