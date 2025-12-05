// src/service/albumService.js
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
    if (!classId) throw new Error('Thiếu classId');
    const res = await http.get(withApiV1(`/albums/class/${classId}`));
    const raw = Array.isArray(res?.data?.data)
        ? res.data.data
        : Array.isArray(res?.data)
        ? res.data
        : [];
    return raw.map(mapAlbum);
}

/* GET /albums/status/{status} */
export async function getAlbumsByStatus(status) {
    const res = await http.get(withApiV1(`/albums/status/${status}`));
    const raw = Array.isArray(res?.data?.data)
        ? res.data.data
        : Array.isArray(res?.data)
        ? res.data
        : [];
    return raw.map(mapAlbum);
}

/* GET /albums/{id} */
export async function getAlbumById(id) {
    if (!id) throw new Error('Thiếu id album');
    const res = await http.get(withApiV1(`/albums/${id}`));
    const data = res?.data?.data || res?.data;
    return data ? mapAlbum(data) : null;
}

/**
 * POST /albums/create
 * (gửi body JSON, không kèm ảnh)
 */
export async function createAlbum({ classId, title, description, createdBy }) {
    if (!classId || !title) throw new Error('Thiếu lớp hoặc tiêu đề');
    const body = { classId, title, description, createdBy };
    const res = await http.post(withApiV1('/albums/create'), body);
    const data = res?.data?.data || res?.data;
    return data ? mapAlbum(data) : null;
}

/* PUT /albums/{albumId}/approval */
export async function approveAlbum(albumId, { approvedBy, status }) {
    if (!albumId || !status) throw new Error('Thiếu albumId hoặc status phê duyệt');
    const body = { approvedBy, status }; // APPROVED | REJECTED
    const res = await http.put(withApiV1(`/albums/${albumId}/approval`), body);
    const data = res?.data?.data || res?.data;
    return data ? mapAlbum(data) : null;
}

/* GET /albums/{albumId}/photos */
export async function getPhotosByAlbum(albumId) {
    if (!albumId) throw new Error('Thiếu albumId');
    const res = await http.get(withApiV1(`/albums/${albumId}/photos`));
    const raw = Array.isArray(res?.data?.data)
        ? res.data.data
        : Array.isArray(res?.data)
        ? res.data
        : [];
    return raw.map(mapPhoto);
}

/**
 * POST /albums/{albumId}/photos (multipart/form-data)
 * BE: @RequestPart("photos") List<MultipartFile> photos,
 *     @RequestParam(required=false) List<String> captions
 */
export async function uploadPhotosToAlbum({ albumId, files, captions }) {
    if (!albumId || !files || !files.length) {
        throw new Error('albumId và danh sách file là bắt buộc');
    }

    const formData = new FormData();

    // field "photos" trùng với @RequestPart("photos")
    files.forEach((f) => {
        formData.append('photos', f);
    });

    if (Array.isArray(captions) && captions.length) {
        captions.forEach((c) => {
            formData.append('captions', c || '');
        });
    }

    const res = await http.post(withApiV1(`/albums/${albumId}/photos`), formData);
    const raw = res?.data?.data || res?.data || [];
    const list = Array.isArray(raw) ? raw : [];
    return list.map(mapPhoto);
}

/**
 * Tiện ích: thêm một ảnh bằng file duy nhất
 */
export async function uploadPhotoFileToAlbum({ albumId, file, caption }) {
    if (!albumId || !file) throw new Error('albumId và file là bắt buộc');
    const photos = await uploadPhotosToAlbum({
        albumId,
        files: [file],
        captions: [caption || '']
    });
    return Array.isArray(photos) && photos.length ? photos[0] : null;
}

/* DELETE /albums/{id} */
export async function deleteAlbum(id) {
    if (!id) throw new Error('Thiếu id album');
    const res = await http.delete(withApiV1(`/albums/${id}`));
    return res?.data?.message || true;
}

/* DELETE /albums/photos/{photoId} */
export async function deletePhoto(photoId) {
    if (!photoId) throw new Error('Thiếu photoId');
    const res = await http.delete(withApiV1(`/albums/photos/${photoId}`));
    return res?.data?.message || true;
}
