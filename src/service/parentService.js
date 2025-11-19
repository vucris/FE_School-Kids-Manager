// src/service/parentService.js
import http from '@/service/http.js';

/** Map BE -> FE */
function mapParentRow(p) {
    const statusStr = p.status || '';
    const statusKey =
        statusStr.includes('khóa') || statusStr.toLowerCase().includes('lock')
            ? 'blocked'
            : 'active';

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
        // để sẵn, nếu sau này BE trả thêm
        occupation: p.occupation,
        relationship: p.relationship,
        emergencyContact: p.emergencyContact,
        additionalPhone: p.additionalPhone
    };
}

/** FE filter/sort/paginate */
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
            if (typeof va === 'number' && typeof vb === 'number') return (va - vb) * mul;
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

/** GET all parents */
export async function fetchParents(params = {}) {
    const res = await http.get('/parents/all');
    const raw = Array.isArray(res?.data?.data)
        ? res.data.data
        : Array.isArray(res?.data)
        ? res.data
        : [];
    const mapped = raw.map(mapParentRow);
    return applyFilters(mapped, params);
}

/** GET 1 phụ huynh theo id (BE: /parents/find/{id}) */
export async function getParentById(id) {
    const res = await http.get(`/parents/find/${id}`);
    return res?.data?.data || res?.data;
}

/** Tạo phụ huynh (BE: POST /auth/register/parent)
 * payload phải đúng ParentRequest:
 * {
 *   username, password, fullName, email, phone,
 *   dateOfBirth, gender, occupation, relationship,
 *   emergencyContact, additionalPhone
 * }
 */
export async function createParent(payload) {
    const res = await http.post('/auth/register/parent', payload);
    // BE trả String "Đăng ký tài khoản phụ huynh thành công!"
    return res?.data;
}

/** Khóa tài khoản phụ huynh (BE: PATCH /parents/{id}/block) */
export async function blockParents(ids = []) {
    for (const id of ids) {
        await http.patch(`/parents/${id}/block`);
    }
    return true;
}

/** Mở khóa tài khoản phụ huynh (BE: PATCH /parents/{id}/unblock) */
export async function unblockParents(ids = []) {
    for (const id of ids) {
        await http.patch(`/parents/${id}/unblock`);
    }
    return true;
}

/** Import phụ huynh từ Excel (BE: POST /parents/import) */
export async function importParentsFromExcel(file) {
    const formData = new FormData();
    formData.append('file', file);

    const res = await http.post('/parents/import', formData, {
        headers: {
            'Content-Type': 'multipart/form-data'
        }
    });

    // BE trả ApiResponse<ImportResultResponse>
    return res?.data;
}

/** Export Excel; fallback CSV có BOM nếu chưa có /parents/export */
export async function exportParentsExcel() {
    try {
        const res = await http.get('/parents/export', { responseType: 'blob' });
        const blob = new Blob([res.data], {
            type: res.headers['content-type'] || 'application/octet-stream'
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        const cd = res.headers['content-disposition'] || '';
        const m = cd.match(/filename="?([^"]+)"?/i);
        a.href = url;
        a.download = m ? m[1] : 'parents.xlsx';
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
    } catch {
        // Fallback CSV
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

/** Những API BE chưa có → báo lỗi rõ ràng */

/** Update theo ID cho admin: BE chưa support */
export async function updateParent(id, payload) {
    throw new Error('API cập nhật phụ huynh theo ID chưa được BE hỗ trợ.');
}

/** Xóa phụ huynh: BE chưa support */
export async function deleteParents(ids = []) {
    throw new Error('API xóa phụ huynh chưa được BE hỗ trợ.');
}

/** Alias cho code cũ (lock/unlock) */
export const lockParents = blockParents;
export const unlockParents = unblockParents;
