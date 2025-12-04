// src/service/parentService.js
import http from '@/service/http.js';

/* Helper thêm /api/v1 nếu baseURL chưa có */
function withApiV1(path) {
    const base = (http?.defaults?.baseURL || '').toLowerCase();
    return base.includes('/api/v1') ? path : `/api/v1${path}`;
}

/** Map BE -> FE 1 dòng phụ huynh */
function mapParentRow(p) {
    const statusStr = p.status || '';
    const lower = statusStr.toLowerCase();
    const statusKey = lower.includes('khóa') || lower.includes('lock') ? 'blocked' : 'active';

    return {
        id: p.id,
        name: p.fullName || '',
        username: p.username || '',
        phone: p.phone || '',
        email: p.email || '',
        dob: p.dateOfBirth || '',
        studentNames: Array.isArray(p.studentNames) ? p.studentNames : [],
        status: statusStr || (statusKey === 'blocked' ? 'Đã khóa' : 'Hoạt động'),
        statusKey,

        // sẵn chỗ nếu BE trả thêm
        occupation: p.occupation,
        relationship: p.relationship,
        emergencyContact: p.emergencyContact,
        additionalPhone: p.additionalPhone
    };
}

/** FE filter/sort/paginate trên mảng đã map */
function applyFilters(list, params = {}) {
    let items = [...list];

    const q = (params.q || '').toLowerCase();
    if (q) {
        items = items.filter(
            (x) =>
                (x.name || '').toLowerCase().includes(q) ||
                (x.phone || '').toLowerCase().includes(q) ||
                (x.email || '').toLowerCase().includes(q)
        );
    }

    if (params.status && params.status !== 'all') {
        items = items.filter((x) => x.statusKey === params.status);
    }

    if (params.sort) {
        const [field, dir = 'asc'] = params.sort.split(',');
        const mul = dir.toLowerCase() === 'desc' ? -1 : 1;
        items.sort((a, b) => {
            const va = a?.[field];
            const vb = b?.[field];
            if (va == null && vb == null) return 0;
            if (va == null) return -1 * mul;
            if (vb == null) return 1 * mul;
            if (typeof va === 'number' && typeof vb === 'number') {
                return (va - vb) * mul;
            }
            return String(va).localeCompare(String(vb), 'vi') * mul;
        });
    }

    const total = items.length;
    const page = Number(params.page) || 1;
    const size = Number(params.size) || 10;
    const start = (page - 1) * size;
    const end = start + size;
    items = items.slice(start, end);

    const counts = {
        total: list.length,
        active: list.filter((x) => x.statusKey === 'active').length,
        blocked: list.filter((x) => x.statusKey === 'blocked').length
    };

    return { items, total, counts };
}

/* Helper: convert Date/string -> yyyy-MM-dd cho LocalDate */
function toLocalDateString(value) {
    if (!value) return null;

    if (value instanceof Date) {
        const y = value.getFullYear();
        const m = String(value.getMonth() + 1).padStart(2, '0');
        const d = String(value.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    }

    if (typeof value === 'string') {
        if (value.includes('T')) {
            return value.slice(0, 10);
        }
        return value;
    }

    return value;
}

/* ==================== ADMIN – QUẢN LÝ PHỤ HUYNH ==================== */

/** GET /api/parents – lấy toàn bộ phụ huynh */
export async function fetchParents(params = {}) {
    const url = withApiV1('/parents/all');
    const res = await http.get(url);

    const raw = Array.isArray(res?.data?.data)
        ? res.data.data
        : Array.isArray(res?.data)
        ? res.data
        : [];

    const mapped = raw.map(mapParentRow);
    return applyFilters(mapped, params);
}

/** GET /api/parents/{parentId} – lấy 1 phụ huynh theo id */
export async function getParentById(id) {
    if (!id) throw new Error('Thiếu parentId');
    const url = withApiV1(`/parents/${id}`);
    const res = await http.get(url);
    return res?.data?.data || res?.data;
}

/** POST /auth/register/parent – tạo phụ huynh mới (controller auth riêng) */
export async function createParent(payload) {
    const url = withApiV1('/auth/register/parent');
    const res = await http.post(url, payload);
    // BE hiện trả String: "Đăng ký tài khoản phụ huynh thành công!"
    return res?.data;
}

/** PUT /api/parents/{parentId}/block */
export async function blockParents(ids = []) {
    for (const id of ids) {
        const url = withApiV1(`/parents/${id}/block`);
        await http.put(url);
    }
    return true;
}

/** PUT /api/parents/{parentId}/unblock */
export async function unblockParents(ids = []) {
    for (const id of ids) {
        const url = withApiV1(`/parents/${id}/unblock`);
        await http.put(url);
    }
    return true;
}

/** POST /api/parents/import – import Excel */
export async function importParentsFromExcel(file) {
    if (!file) throw new Error('Thiếu file Excel');
    const formData = new FormData();
    formData.append('file', file);

    const url = withApiV1('/parents/import');
    const res = await http.post(url, formData, {
        headers: {
            'Content-Type': 'multipart/form-data'
        }
    });

    // BE trả ApiResponse<ImportResultResponse>
    return res?.data;
}

/** Export Excel; nếu BE chưa có /api/parents/export thì fallback CSV */
export async function exportParentsExcel() {
    try {
        const url = withApiV1('/parents/export');
        const res = await http.get(url, { responseType: 'blob' });

        const blob = new Blob([res.data], {
            type: res.headers['content-type'] || 'application/octet-stream'
        });
        const urlBlob = URL.createObjectURL(blob);
        const a = document.createElement('a');
        const cd = res.headers['content-disposition'] || '';
        const m = cd.match(/filename="?([^"]+)"?/i);
        a.href = urlBlob;
        a.download = m ? m[1] : 'parents.xlsx';
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(urlBlob);
    } catch {
        // Fallback CSV nếu BE chưa làm export
        const { items } = await fetchParents({ page: 1, size: 100000 });
        const header = 'id,fullName,username,phone,email,status\n';
        const csv = (v) => {
            if (v == null) return '';
            const s = String(v);
            return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
        };
        const body = items
            .map((i) =>
                [i.id, i.name, i.username, i.phone, i.email, i.status]
                    .map(csv)
                    .join(',')
            )
            .join('\n');
        const BOM = new Uint8Array([0xef, 0xbb, 0xbf]);
        const blob = new Blob([BOM, header + body], {
            type: 'text/csv;charset=utf-8;'
        });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'parents.csv';
        a.click();
    }
}

/* ==================== ENDPOINTS DÀNH CHO PHỤ HUYNH (DÙNG TOKEN) ==================== */
/* Tương ứng ParentController phần đầu file bạn gửi */

/** PUT /api/parents/update – parent tự cập nhật thông tin */
export async function updateParentProfile(payload) {
    const url = withApiV1('/api/parents/update');
    const res = await http.put(url, payload);
    return res?.data;
}

/** GET /api/parents/children – lấy danh sách con của phụ huynh theo token */
export async function getParentChildren(/* parentId optional, không dùng nữa */) {
    const url = withApiV1('/parents/children');
    const res = await http.get(url);
    return res?.data?.data || res?.data;
}

/** GET /api/parents/children/{studentId} */
export async function getParentChild(parentIdOrStudentId, maybeStudentId) {
    const studentId = maybeStudentId ?? parentIdOrStudentId;
    if (!studentId) throw new Error('Thiếu studentId');
    const url = withApiV1(`/parents/children/${studentId}`);
    const res = await http.get(url);
    return res?.data?.data || res?.data;
}

/** GET /api/parents/children/{studentId}/attendance?startDate&endDate (yyyy-MM-dd) */
export async function getParentChildAttendance(parentIdOrStudentId, maybeStudentId, startDate, endDate) {
    const studentId = maybeStudentId ?? parentIdOrStudentId;
    if (!studentId) throw new Error('Thiếu studentId');

    const url = withApiV1(`/parents/children/${studentId}/attendance`);
    const res = await http.get(url, {
        params: {
            startDate: toLocalDateString(startDate),
            endDate: toLocalDateString(endDate)
        }
    });
    return res?.data?.data || res?.data;
}

/** GET /api/parents/children/{studentId}/menu?startDate&endDate */
export async function getParentChildMenus(parentIdOrStudentId, maybeStudentId, startDate, endDate) {
    const studentId = maybeStudentId ?? parentIdOrStudentId;
    if (!studentId) throw new Error('Thiếu studentId');

    const url = withApiV1(`/parents/children/${studentId}/menu`);
    const res = await http.get(url, {
        params: {
            startDate: toLocalDateString(startDate),
            endDate: toLocalDateString(endDate)
        }
    });
    return res?.data?.data || res?.data;
}

/** GET /api/parents/children/{studentId}/albums */
export async function getParentChildAlbums(parentIdOrStudentId, maybeStudentId) {
    const studentId = maybeStudentId ?? parentIdOrStudentId;
    if (!studentId) throw new Error('Thiếu studentId');
    const url = withApiV1(`/parents/children/${studentId}/albums`);
    const res = await http.get(url);
    return res?.data?.data || res?.data;
}

/** GET /api/parents/children/{studentId}/albums/{albumId} */
export async function getParentChildAlbumDetail(parentIdOrStudentId, maybeStudentId, albumId) {
    const studentId = maybeStudentId ?? parentIdOrStudentId;
    if (!studentId) throw new Error('Thiếu studentId');
    if (!albumId) throw new Error('Thiếu albumId');

    const url = withApiV1(`/api/parents/children/${studentId}/albums/${albumId}`);
    const res = await http.get(url);
    return res?.data?.data || res?.data;
}

/** Những API BE chưa có → báo lỗi rõ ràng (delete/update theo ID) */
export async function deleteParents(ids = []) {
    throw new Error('API xóa phụ huynh chưa được BE hỗ trợ.');
}

export async function updateParent(id, payload) {
    throw new Error('API cập nhật phụ huynh theo ID chưa được BE hỗ trợ.');
}

/** Alias cho code cũ (lock/unlock) để màn list dùng */
export const lockParents = blockParents;
export const unlockParents = unblockParents;

export default {
    fetchParents,
    getParentById,
    createParent,
    blockParents,
    unblockParents,
    importParentsFromExcel,
    exportParentsExcel,
    updateParentProfile,
    getParentChildren,
    getParentChild,
    getParentChildAttendance,
    getParentChildMenus,
    getParentChildAlbums,
    getParentChildAlbumDetail,
    deleteParents,
    updateParent,
    lockParents,
    unlockParents
};
