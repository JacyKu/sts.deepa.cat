import { NextResponse } from 'next/server';
import { getDiscordUser, resolveProfileAvatar } from '../../../../../lib/session';
import { saveUserAvatar, setAvatarSource, MAX_UPLOADED_AVATARS } from '../../../../../lib/sts-builds';

// Upload a custom profile picture (PNG, JPEG, GIF or WebP, up to 2 MB). The
// image arrives as a data URL, is validated by its magic bytes (not just the
// declared type), stored in the database, and immediately becomes the
// account's active picture. Accounts can keep MAX_UPLOADED_AVATARS pictures.
const MAX_AVATAR_BYTES = 2 * 1024 * 1024;
const ALLOWED_MIME = new Set(['image/png', 'image/jpeg', 'image/gif', 'image/webp']);

// Sniffs the real format from the leading bytes, so a renamed file can't
// smuggle non-image data in (the response is always served with the sniffed
// image mime + nosniff).
function sniffImageMime(buffer) {
    if (buffer.length >= 8 && buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) {
        return 'image/png';
    }
    if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
        return 'image/jpeg';
    }
    if (buffer.length >= 6 && buffer.toString('ascii', 0, 4) === 'GIF8') {
        return 'image/gif';
    }
    if (
        buffer.length >= 12 &&
        buffer.toString('ascii', 0, 4) === 'RIFF' &&
        buffer.toString('ascii', 8, 12) === 'WEBP'
    ) {
        return 'image/webp';
    }
    return null;
}

export async function POST(request) {
    const user = await getDiscordUser();
    if (!user) {
        return NextResponse.json({ error: 'not authenticated' }, { status: 401 });
    }
    const body = await request.json().catch(() => null);
    const dataUrl = body && typeof body.dataUrl === 'string' ? body.dataUrl : '';
    const match = /^data:([a-z0-9.+-]+\/[a-z0-9.+-]+);base64,([a-z0-9+/=\s]+)$/i.exec(dataUrl);
    if (!match) {
        return NextResponse.json({ error: 'invalid image' }, { status: 400 });
    }
    const declared = match[1].toLowerCase();
    if (!ALLOWED_MIME.has(declared)) {
        return NextResponse.json({ error: 'unsupported type' }, { status: 400 });
    }
    const data = Buffer.from(match[2], 'base64');
    if (data.length === 0) {
        return NextResponse.json({ error: 'invalid image' }, { status: 400 });
    }
    if (data.length > MAX_AVATAR_BYTES) {
        return NextResponse.json({ error: 'too large' }, { status: 413 });
    }
    const sniffed = sniffImageMime(data);
    if (!sniffed || sniffed !== declared) {
        return NextResponse.json({ error: 'not an image' }, { status: 400 });
    }
    const saved = saveUserAvatar(user.id, sniffed, data);
    if (!saved) {
        return NextResponse.json({ error: 'too many avatars', max: MAX_UPLOADED_AVATARS }, { status: 409 });
    }
    setAvatarSource(user.id, `upload:${saved.id}`);
    const avatar = resolveProfileAvatar(user);
    return NextResponse.json({
        ok: true,
        id: saved.id,
        avatarSource: avatar.avatarSource,
        avatarUrl: avatar.avatarUrl,
        uploadedAvatars: avatar.uploadedAvatars,
    });
}
