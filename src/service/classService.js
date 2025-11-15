import http from '@/service/http.js';

/* ---------------- Helpers chung ---------------- */
function withApiV1(path) {
    const base = (http?.defaults?.baseURL || '').toLowerCase();
    return base.includes('/api/v1') ? path : `/api/v1${path}`;
}

/* ---------------- Chuẩn hoá record lớp từ BE -> FE ---------------- */
function mapClassRow(c) {
    return {
        id: c.id,
        className: c.className || '',
        classCode: c.classCode || '',
        grade: c.grade || '',
        roomNumber: c.roomNumber || '',
        academicYear: c.academicYear || '',
        teacherName: c.teacherName || 'Chưa có giáo viên',
        // nếu sau này BE bổ sung thì map thêm ở đây
        studentCurrent: c.studentCurrent ?? 0,
        studentCapacity: c.studentCapacity ?? null,
        status: c.status || 'active'
    };
}

/* ---------------- CSV helper ---------------- */
function csv(v) {
    if (v == null) return '';
    const s = String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/* ---------------- Lọc/sort/paginate FE-side ---------------- */
function applyFiltersSortPaginate(list, params = {}) {
    let items = [...list];

    if (params.year) {
        items = items.filter((x) => x.academicYear === params.year);
    }
    if (params.className) {
        const q = params.className.trim().toLowerCase();
        items = items.filter((x) => (x.className || '').toLowerCase().includes(q));
    }
    if (params.roomNumber) {
        const q = params.roomNumber.trim().toLowerCase();
        items = items.filter((x) => (x.roomNumber || '').toLowerCase().includes(q));
    }
    if (params.grade) {
        const q = params.grade.trim().toLowerCase();
        items = items.filter((x) => (x.grade || '').toLowerCase().includes(q));
    }
    if (params.teacherName) {
        const q = params.teacherName.trim().toLowerCase();
        items = items.filter((x) => (x.teacherName || '').toLowerCase().includes(q));
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
    return { items, total };
}

/* ---------------- Extract error message ---------------- */
function extractErrorMessage(err, fallback = 'Lỗi không xác định') {
    return err?.response?.data?.message || err?.response?.data?.error || err?.message || fallback;
}

/* ---------------- API chính theo backend bạn gửi ---------------- */

/* GET /classes/all */
export async function fetchClasses(params = {}) {
    try {
        const url = withApiV1('/classes/all');
        const res = await http.get(url);
        const raw = Array.isArray(res?.data?.data) ? res.data.data : Array.isArray(res?.data) ? res.data : [];

        const mapped = raw.map(mapClassRow);
        return applyFiltersSortPaginate(mapped, params);
    } catch (err) {
        throw new Error(extractErrorMessage(err, 'Không thể tải danh sách lớp'));
    }
}

/* GET /classes/find/{id} */
export async function fetchClassById(id) {
    if (!id) throw new Error('Thiếu id lớp');
    try {
        const url = withApiV1(`/classes/find/${id}`);
        const res = await http.get(url);
        const c = res?.data?.data || res?.data;
        return mapClassRow(c);
    } catch (err) {
        throw new Error(extractErrorMessage(err, 'Không lấy được thông tin lớp'));
    }
}

/* POST /classes/create */
export async function createClass(payload) {
    try {
        const url = withApiV1('/classes/create');
        const body = {
            className: payload.className?.trim(),
            grade: payload.grade?.trim() || '',
            roomNumber: payload.roomNumber?.trim() || '',
            academicYear: payload.academicYear?.trim() || '',
            teacherId: payload.teacherId ?? null
        };
        const res = await http.post(url, body, {
            headers: {
                'Content-Type': 'application/json',
                Accept: 'application/json'
            }
        });
        const c = res?.data?.data || res?.data;
        return mapClassRow(c);
    } catch (err) {
        throw new Error(extractErrorMessage(err, 'Tạo lớp học thất bại'));
    }
}

/* PUT /classes/update/{id} */
export async function updateClass(id, payload) {
    if (!id) throw new Error('Thiếu id lớp');
    try {
        const url = withApiV1(`/classes/update/${id}`);
        const body = {
            className: payload.className?.trim(),
            grade: payload.grade?.trim() || '',
            roomNumber: payload.roomNumber?.trim() || '',
            academicYear: payload.academicYear?.trim() || '',
            teacherId: payload.teacherId ?? null
        };
        const res = await http.put(url, body, {
            headers: {
                'Content-Type': 'application/json',
                Accept: 'application/json'
            }
        });
        const c = res?.data?.data || res?.data;
        return mapClassRow(c);
    } catch (err) {
        throw new Error(extractErrorMessage(err, 'Cập nhật lớp học thất bại'));
    }
}

/* DELETE /classes/delete/{id} */
export async function deleteClass(id) {
    if (!id) throw new Error('Thiếu id lớp');
    try {
        const url = withApiV1(`/classes/delete/${id}`);
        const res = await http.delete(url);
        return res?.data?.message || 'Đã xoá lớp học';
    } catch (err) {
        throw new Error(extractErrorMessage(err, 'Xoá lớp học thất bại'));
    }
}

/* GET /classes/all lite -> dropdown đơn giản */
export async function fetchClassesLite() {
    try {
        const url = withApiV1('/classes/all');
        const res = await http.get(url);
        const raw = Array.isArray(res?.data?.data) ? res.data.data : Array.isArray(res?.data) ? res.data : [];
        return raw.map((c) => ({
            value: c.id,
            label: c.className || c.classCode || `Lớp #${c.id}`
        }));
    } catch (err) {
        console.warn('[classService] fetchClassesLite failed:', err?.message || err);
        return [];
    }
}

/* Export Excel nếu BE có /classes/export, fallback CSV */
export async function exportClassesExcel() {
    try {
        const url = withApiV1('/classes/export');
        const res = await http.get(url, { responseType: 'blob' });
        const blob = new Blob([res.data], {
            type: res.headers['content-type'] || 'application/octet-stream'
        });
        const dlUrl = URL.createObjectURL(blob);
        const a = document.createElement('a');
        const cd = res.headers['content-disposition'] || '';
        const m = cd.match(/filename="?([^"]+)"?/i);
        a.href = dlUrl;
        a.download = m ? m[1] : 'classes.xlsx';
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(dlUrl);
    } catch (err) {
        // fallback CSV
        const { items } = await fetchClasses({ page: 1, size: 100000 });
        const header = 'id,className,classCode,grade,roomNumber,academicYear,teacherName\n';
        const body = items
            .map((c) =>
                [csv(c.id), csv(c.className), csv(c.classCode), csv(c.grade), csv(c.roomNumber), csv(c.academicYear), csv(c.teacherName)].join(',')
            )
            .join('\n');
        const BOM = new Uint8Array([0xef, 0xbb, 0xbf]);
        const blob = new Blob([BOM, header + body], {
            type: 'text/csv;charset=utf-8;'
        });
        const a = document.createElement('a');
        const dlUrl = URL.createObjectURL(blob);
        a.href = dlUrl;
        a.download = 'classes.csv';
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(dlUrl);
    }
}

/* ---------------- fetchClassOptions cho CreateStudentModal / Album ---------------- */

function mapClassOption(c) {
    if (!c || c.id == null) return null;
    const name = c.className || c.classCode || `Lớp #${c.id}`;
    const grade = c.grade || '';
    const room = c.roomNumber || '';
    const year = c.academicYear || '';
    let label = name;
    if (grade) label += ` - ${grade}`;
    if (room) label += ` (${room})`;
    if (year) label += ` • ${year}`;
    return { value: c.id, label };
}

/**
 * Lấy options cho Dropdown lớp học
 * -> [{ value, label }]
 */
export async function fetchClassOptions(params = {}) {
    const { year } = params || {};
    const { items } = await fetchClasses({
        year: year || undefined,
        page: 1,
        size: 9999
    });
    return items.map(mapClassOption).filter(Boolean);
}
