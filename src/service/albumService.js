import http from '@/service/http.js';

/* Helper: auto prefix /api/v1 if not present */
function withApiV1(path) {
    const base = (http?.defaults?.baseURL || '').toLowerCase();
    return base.includes('/api/v1') ? path : `/api/v1${path}`;
}

/* Map BE AlbumResponse -> FE */
function mapAlbum(a) {
    return {
        id: a.id,
        classId: a.classId,
        className: a.className,
        title: a.title || '',
        description: a.description || '',
        createdBy: a.createdBy || '',
        createdAt: a.createdAt || null,
        approvedBy: a.approvedBy || '',
        approvedAt: a.approvedAt || null,
        status: a.status || 'PENDING',
        photos: Array.isArray(a.photos) ? a.photos : []
    };
}

/* Map BE AlbumPhotoResponse -> FE */
function mapPhoto(p) {
    return {
        id: p.id,
        albumId: p.albumId,
        url: p.photoUrl || p.url || '',
        caption: p.caption || '',
        uploadedAt: p.uploadedAt || null
    };
}

/* GET /albums/class/{classId} */
export async function getAlbumsByClass(classId) {
    const res = await http.get(withApiV1(`/albums/class/${classId}`));
    const raw = Array.isArray(res?.data?.data) ? res.data.data : Array.isArray(res?.data) ? res.data : [];
    return raw.map(mapAlbum);
}

/* GET /albums/status/{status} */
export async function getAlbumsByStatus(status) {
    const res = await http.get(withApiV1(`/albums/status/${status}`));
    const raw = Array.isArray(res?.data?.data) ? res.data.data : Array.isArray(res?.data) ? res.data : [];
    return raw.map(mapAlbum);
}

/* GET /albums/{id} */
export async function getAlbumById(id) {
    const res = await http.get(withApiV1(`/albums/${id}`));
    const data = res?.data?.data || res?.data;
    return data ? mapAlbum(data) : null;
}

/* POST /albums/create */
export async function createAlbum({ classId, title, description, createdBy }) {
    const body = { classId, title, description, createdBy };
    const res = await http.post(withApiV1('/albums/create'), body, { headers: { Accept: 'application/json' } });
    const data = res?.data?.data || res?.data;
    return data ? mapAlbum(data) : null;
}

/* PUT /albums/{albumId}/approval */
export async function approveAlbum(albumId, { approvedBy, status }) {
    const body = { approvedBy, status }; // APPROVED | REJECTED
    const res = await http.put(withApiV1(`/albums/${albumId}/approval`), body, { headers: { Accept: 'application/json' } });
    const data = res?.data?.data || res?.data;
    return data ? mapAlbum(data) : null;
}

/* GET /albums/{albumId}/photos */
export async function getPhotosByAlbum(albumId) {
    const res = await http.get(withApiV1(`/albums/${albumId}/photos`));
    const raw = Array.isArray(res?.data?.data) ? res.data.data : Array.isArray(res?.data) ? res.data : [];
    return raw.map(mapPhoto);
}

/* POST /albums/photos */
export async function addPhotoToAlbum({ albumId, photoUrl, caption }) {
    const body = { albumId, photoUrl, caption };
    const res = await http.post(withApiV1('/albums/photos'), body, { headers: { Accept: 'application/json' } });
    const data = res?.data?.data || res?.data;
    return data ? mapPhoto(data) : null;
}

/* DELETE /albums/{id} */
export async function deleteAlbum(id) {
    const res = await http.delete(withApiV1(`/albums/${id}`));
    return res?.data?.message || true;
}

/* DELETE /albums/photos/{photoId} */
export async function deletePhoto(photoId) {
    const res = await http.delete(withApiV1(`/albums/photos/${photoId}`));
    return res?.data?.message || true;
}
