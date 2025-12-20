import http from '@/service/http.js';
import * as XLSX from 'xlsx';

/* =========================================================
 * Student Service (aligned with BE StudentController)
 *
 * BE endpoints:
 * - GET    /students
 * - GET    /students/{id}
 * - POST   /students
 * - PUT    /students/{id}
 * - DELETE /students/{id}
 * - GET    /students/class/{classId}
 * - GET    /students/active
 * - POST   /students/import/excel            (multipart file, .xlsx)
 * - GET    /students/import-template         (blob)
 * - POST   /students/status/change
 * - GET    /students/status/{status}
 * - POST   /students/status/return-from-reserve/{studentId}
 * - GET    /students/status/statistics
 *
 * FE-only:
 * - exportStudentsExcel(): FE generates .xlsx from /students
 * =======================================================*/

/* ---------------- Helpers chung ---------------- */
function withApiV1(path) {
    const base = (http?.defaults?.baseURL || '').toLowerCase();
    return base.includes('/api/v1') ? path : `/api/v1${path}`;
}

function extractErrorMessage(err, fallback = 'Lỗi không xác định') {
    return err?.response?.data?.message || err?.response?.data?.error || err?.message || fallback;
}

function safeStr(v) {
    return v == null ? '' : String(v);
}

function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
}

/* ---------------- Gender helpers ---------------- */
function toGenderChar(g) {
    if (!g) return 'M';
    const s = String(g).trim().toUpperCase();
    if (s === 'NỮ' || s === 'NU' || s === 'F' || s.startsWith('F')) return 'F';
    return 'M';
}

function toGenderLabel(g) {
    const c = toGenderChar(g);
    return c === 'F' ? 'NỮ' : 'NAM';
}

/* ---------------- Status mapping ---------------- */
/**
 * BE: currentStatus = STUDYING | RESERVED | GRADUATED | DROPOUT | TRANSFERRED
 * FE tabs: studying | reserved | graduated | dropped | transferred
 */
const STATUS_BE_TO_FE = {
    STUDYING: 'studying',
    RESERVED: 'reserved',
    GRADUATED: 'graduated',
    DROPOUT: 'dropped',
    TRANSFERRED: 'transferred'
};

const STATUS_FE_TO_BE = {
    studying: 'STUDYING',
    reserved: 'RESERVED',
    graduated: 'GRADUATED',
    dropped: 'DROPOUT',
    transferred: 'TRANSFERRED'
};

const STATUS_BE_TO_VI = {
    STUDYING: 'Đang học',
    RESERVED: 'Bảo lưu',
    GRADUATED: 'Tốt nghiệp',
    DROPOUT: 'Thôi học',
    TRANSFERRED: 'Chuyển trường'
};

export function mapStatusToBackend(statusFeOrBe) {
    if (!statusFeOrBe) return '';
    const k = String(statusFeOrBe).trim();
    const lower = k.toLowerCase();
    if (STATUS_FE_TO_BE[lower]) return STATUS_FE_TO_BE[lower];
    return k.toUpperCase();
}

function mapStatusFromBackend(s) {
    const raw = String(s?.currentStatus || s?.status || '').trim().toUpperCase();
    return STATUS_BE_TO_FE[raw] || (raw ? raw.toLowerCase() : 'studying');
}

function statusLabelFromBackend(statusBe) {
    const k = String(statusBe || '').toUpperCase().trim();
    return STATUS_BE_TO_VI[k] || k;
}

/* ---------------- Parent cache (optional enrich) ---------------- */
const parentCache = {
    loaded: false,
    map: new Map() // id -> { fullName, phone, email }
};

async function loadParentsAllToCache() {
    if (parentCache.loaded) return parentCache.map;

    try {
        const url = withApiV1('/parents/all');
        const res = await http.get(url);
        const raw = Array.isArray(res?.data?.data) ? res.data.data : Array.isArray(res?.data) ? res.data : [];

        for (const p of raw) {
            const id = p.id ?? p.parentId;
            if (id == null) continue;

            const fullName = p.fullName || p.username || p.name || `PH ${id}`;
            const phone = p.phone || p.parentPhone || p.additionalPhone || p.additional_phone || '';
            const email = p.email || '';

            parentCache.map.set(Number(id), { fullName, phone, email });
        }

        parentCache.loaded = true;
    } catch (e) {
        console.warn('[studentService] loadParentsAllToCache failed:', e?.message || e);
    }

    return parentCache.map;
}

export async function fetchParentOptionsLikeStudentService() {
    const map = await loadParentsAllToCache();
    const opts = [];
    for (const [id, p] of map.entries()) {
        const label = p.phone ? `${p.fullName} (${p.phone})` : p.fullName;
        opts.push({ value: id, label });
    }
    opts.sort((a, b) => a.label.localeCompare(b.label, 'vi'));
    return opts;
}

async function enrichStudentsWithParents(items) {
    if (!items?.length) return items;
    const needs = items.some((x) => !x.parentName || !x.parentPhone);
    if (!needs) return items;

    const map = await loadParentsAllToCache();
    for (const it of items) {
        const pid = Number(it.parentId);
        if (pid && map.has(pid)) {
            const p = map.get(pid);
            if (!it.parentName) it.parentName = p.fullName || it.parentName;
            if (!it.parentPhone) it.parentPhone = p.phone || it.parentPhone;
        }
    }
    return items;
}

/* ---------------- Map BE -> row model (for StudentManagement.vue) ---------------- */
function mapStudentRow(s) {
    const classObj = s.clazz || s.classroom || s.classes || s.class || {};
    const parentObj = s.parent || {};

    const classId =
        s.classId ??
        s.class_id ??
        classObj.id ??
        classObj.classId ??
        classObj.class_id ??
        null;

    const className = s.className || classObj.className || classObj.name || classObj.class_code || '';

    const parentId = s.parentId ?? s.parent_id ?? parentObj.id ?? null;
    const parentName = s.parentName || parentObj.fullName || parentObj.name || '';
    const parentPhone = s.parentPhone || parentObj.phone || parentObj.parentPhone || '';

    const code = s.studentCode || s.code || s.student_code || '';
    const dob = s.dateOfBirth || s.date_of_birth || s.dob || '';

    return {
        id: s.id ?? s.accountId ?? s.account_id,
        code,
        studentCode: code,
        name: s.fullName || s.name || '',
        dob,
        gender: toGenderChar(s.gender),

        classId,
        className,

        parentId,
        parentName,
        parentPhone,

        status: mapStatusFromBackend(s),

        currentStatusRaw: s.currentStatus || s.status || null,
        statusDisplayName: s.statusDisplayName || '',

        username: s.username,
        email: s.email,
        phone: s.phone,
        avatarUrl: s.avatarUrl,
        address: s.address,
        enrollmentDate: s.enrollmentDate,
        healthNotes: s.healthNotes
    };
}

/* ---------------- Filter/sort/paginate FE-side ---------------- */
function applyFiltersSortPaginate(list, params = {}) {
    let items = [...list];

    if (params.status && params.status !== 'all') {
        items = items.filter((x) => x.status === params.status);
    }
    if (params.code) {
        const q = String(params.code).trim().toLowerCase();
        items = items.filter((x) => String(x.code || '').toLowerCase().includes(q));
    }
    if (params.name) {
        const q = String(params.name).trim().toLowerCase();
        items = items.filter((x) => String(x.name || '').toLowerCase().includes(q));
    }
    if (params.className) {
        const q = String(params.className).trim().toLowerCase();
        items = items.filter((x) => String(x.className || '').toLowerCase().includes(q));
    }
    if (params.parentName) {
        const q = String(params.parentName).trim().toLowerCase();
        items = items.filter((x) => String(x.parentName || '').toLowerCase().includes(q));
    }

    if (params.sort) {
        const [field, dir = 'asc'] = String(params.sort).split(',');
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
    return { items: items.slice(start, end), total };
}

/* =========================================================
 * CRUD
 * =======================================================*/
export async function createStudent(payload) {
    try {
        const url = withApiV1('/students');
        const res = await http.post(url, payload, {
            headers: { 'Content-Type': 'application/json', Accept: 'application/json' }
        });
        return res?.data?.data || res?.data;
    } catch (err) {
        throw new Error(extractErrorMessage(err, 'Tạo học sinh thất bại'));
    }
}

export async function updateStudent(id, payload) {
    if (!id) throw new Error('Thiếu id học sinh');
    try {
        const url = withApiV1(`/students/${id}`);
        const res = await http.put(url, payload, {
            headers: { 'Content-Type': 'application/json', Accept: 'application/json' }
        });
        return res?.data?.data || res?.data;
    } catch (err) {
        throw new Error(extractErrorMessage(err, 'Cập nhật học sinh thất bại'));
    }
}

export async function deleteStudent(id, { timeoutMs = 12000 } = {}) {
    if (!id) throw new Error('Thiếu id học sinh');
    try {
        const url = withApiV1(`/students/${id}`);
        await http.delete(url, {
            timeout: timeoutMs,
            validateStatus: (s) => (s >= 200 && s < 300) || s === 204
        });
        return true;
    } catch (err) {
        throw new Error(extractErrorMessage(err, 'Xóa học sinh thất bại'));
    }
}

export async function deleteStudents(ids = [], opts = {}) {
    if (!Array.isArray(ids) || !ids.length) return { ok: 0, fail: 0, errors: [] };

    const concurrency = Number(opts.concurrency ?? 4);
    let i = 0;
    let ok = 0;
    let fail = 0;
    const errors = [];

    async function worker() {
        while (i < ids.length) {
            const idx = i++;
            const id = ids[idx];
            try {
                await deleteStudent(id, opts);
                ok++;
            } catch (e) {
                fail++;
                errors.push({ id, message: e?.message || 'Xóa thất bại' });
            }
        }
    }

    const workers = Array.from({ length: Math.min(concurrency, ids.length) }, () => worker());
    await Promise.all(workers);
    return { ok, fail, errors };
}

export async function getStudentById(id) {
    if (!id) throw new Error('Thiếu id học sinh');
    try {
        const url = withApiV1(`/students/${id}`);
        const res = await http.get(url);
        return res?.data?.data || res?.data;
    } catch (err) {
        throw new Error(extractErrorMessage(err, 'Không lấy được thông tin học sinh'));
    }
}

/* =========================================================
 * LISTING
 * =======================================================*/
export async function fetchStudents(params = {}, options = {}) {
    const { skipParentEnrich = false } = options;

    try {
        const url = withApiV1('/students');
        const res = await http.get(url);

        const raw = Array.isArray(res?.data?.data) ? res.data.data : Array.isArray(res?.data) ? res.data : [];
        let mapped = raw.map(mapStudentRow);

        if (!skipParentEnrich) mapped = await enrichStudentsWithParents(mapped);

        return applyFiltersSortPaginate(mapped, params);
    } catch (err) {
        throw new Error(extractErrorMessage(err, 'Không thể tải danh sách học sinh'));
    }
}

export async function fetchStudentsByClass(classId, options = {}) {
    if (!classId) return [];
    const { skipParentEnrich = false } = options;

    try {
        const url = withApiV1(`/students/class/${classId}`);
        const res = await http.get(url);

        const raw = Array.isArray(res?.data?.data) ? res.data.data : Array.isArray(res?.data) ? res.data : [];
        let mapped = raw.map(mapStudentRow);

        if (!skipParentEnrich) mapped = await enrichStudentsWithParents(mapped);

        return mapped;
    } catch (err) {
        throw new Error(extractErrorMessage(err, 'Không lấy được danh sách học sinh theo lớp'));
    }
}

export async function fetchActiveStudentsFromBackend(options = {}) {
    const { skipParentEnrich = false } = options;

    try {
        const url = withApiV1('/students/active');
        const res = await http.get(url);

        const raw = Array.isArray(res?.data?.data) ? res.data.data : Array.isArray(res?.data) ? res.data : [];
        let mapped = raw.map(mapStudentRow);

        if (!skipParentEnrich) mapped = await enrichStudentsWithParents(mapped);

        return mapped;
    } catch (err) {
        throw new Error(extractErrorMessage(err, 'Không lấy được danh sách học sinh đang học'));
    }
}

/* =========================================================
 * IMPORT / TEMPLATE
 * =======================================================*/
export async function importStudentsExcel(file, { onProgress, signal } = {}) {
    if (!file) throw new Error('Thiếu file import');
    if (!/\.xlsx$/i.test(file.name || '')) throw new Error('Chỉ chấp nhận file Excel .xlsx');

    const endpoint = withApiV1('/students/import/excel');
    const form = new FormData();
    form.append('file', file);

    try {
        const res = await http.post(endpoint, form, {
            headers: { 'Content-Type': 'multipart/form-data', Accept: 'application/json' },
            onUploadProgress: (e) => {
                if (typeof onProgress === 'function' && e?.total) {
                    onProgress(Math.round((e.loaded * 100) / e.total));
                }
            },
            signal
        });

        return res?.data?.message || 'Import hoàn tất';
    } catch (err) {
        throw new Error(extractErrorMessage(err, 'Import Excel thất bại'));
    }
}

export async function downloadStudentsImportTemplateFromBackend() {
    try {
        const url = withApiV1('/students/import-template');
        const res = await http.get(url, { responseType: 'blob' });

        const blob = new Blob([res.data], {
            type: res.headers?.['content-type'] || 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        });

        const cd = res.headers?.['content-disposition'] || '';
        const m = cd.match(/filename\*?=(?:UTF-8'')?["']?([^"';]+)["']?/i);
        const filename = m ? decodeURIComponent(m[1]) : 'Mau_nhap_hoc_sinh.xlsx';

        downloadBlob(blob, filename);
        return true;
    } catch (err) {
        throw new Error(extractErrorMessage(err, 'Tải file mẫu Excel thất bại'));
    }
}

/* =========================================================
 * STATUS endpoints
 * =======================================================*/
export async function changeStudentStatus(payload) {
    try {
        const url = withApiV1('/students/status/change');
        const res = await http.post(url, payload, {
            headers: { 'Content-Type': 'application/json', Accept: 'application/json' }
        });
        return res?.data?.data || res?.data;
    } catch (err) {
        throw new Error(extractErrorMessage(err, 'Cập nhật trạng thái học sinh thất bại'));
    }
}

export async function returnFromReserve(studentId) {
    if (!studentId) throw new Error('Thiếu id học sinh');
    try {
        const url = withApiV1(`/students/status/return-from-reserve/${studentId}`);
        const res = await http.post(url);
        return res?.data?.data || res?.data;
    } catch (err) {
        throw new Error(extractErrorMessage(err, 'Xử lý quay lại học thất bại'));
    }
}
export async function returnStudentFromReserve(studentId) {
    return returnFromReserve(studentId);
}

export async function fetchStudentStatusStatistics() {
    try {
        const url = withApiV1('/students/status/statistics');
        const res = await http.get(url);
        return res?.data?.data || res?.data;
    } catch (err) {
        throw new Error(extractErrorMessage(err, 'Không lấy được thống kê trạng thái học sinh'));
    }
}

export async function fetchStudentsByStatusFromBackend(statusFeOrBe) {
    if (!statusFeOrBe) throw new Error('Thiếu status');
    const statusBe = mapStatusToBackend(statusFeOrBe);

    try {
        const url = withApiV1(`/students/status/${statusBe}`);
        const res = await http.get(url);

        const raw = Array.isArray(res?.data?.data) ? res.data.data : Array.isArray(res?.data) ? res.data : [];

        return raw.map((x) => ({
            id: x.studentId,
            code: x.studentCode,
            studentCode: x.studentCode,
            name: x.studentName,
            className: x.className,
            parentName: x.parentName,
            status: mapStatusFromBackend({ currentStatus: x.currentStatus }),
            currentStatusRaw: x.currentStatus,
            statusDisplayName: x.statusDisplayName,
            statusReason: x.statusReason,
            statusChangedDate: x.statusChangedDate
        }));
    } catch (err) {
        throw new Error(extractErrorMessage(err, 'Không lấy được danh sách theo trạng thái'));
    }
}

/* =========================================================
 * CHANGE CLASS (required by ChangeStudentClassModal.vue)
 * =======================================================*/
export async function changeStudentClass(studentId, newClassId) {
    if (!studentId || !newClassId) {
        throw new Error('Thiếu học sinh hoặc lớp cần chuyển');
    }

    try {
        const url = withApiV1(`/students/${studentId}`);
        const res = await http.put(
            url,
            { classId: newClassId },
            { headers: { 'Content-Type': 'application/json', Accept: 'application/json' } }
        );
        return res?.data?.data || res?.data;
    } catch (err) {
        throw new Error(extractErrorMessage(err, 'Chuyển lớp thất bại'));
    }
}

/* =========================================================
 * EXPORT EXCEL (FE-side)
 * - No BE export endpoint required.
 * =======================================================*/
export async function exportStudentsExcel(options = {}) {
    const {
        filename = `Danh_sach_hoc_sinh_${new Date().toISOString().slice(0, 10)}.xlsx`,
        includeAllStatuses = true
    } = options;

    try {
        // lấy toàn bộ học sinh (BE trả list)
        const res = await fetchStudents({ status: 'all', page: 1, size: 999999 }, { skipParentEnrich: false });
        const list = Array.isArray(res?.items) ? res.items : [];

        // Chuẩn hóa dữ liệu để export
        const rows = list
            .filter((s) => (includeAllStatuses ? true : s.status === 'studying'))
            .map((s, idx) => {
                const statusBe = safeStr(s.currentStatusRaw).toUpperCase();
                return {
                    STT: idx + 1,
                    'Mã học sinh': safeStr(s.code || s.studentCode),
                    'Họ và tên': safeStr(s.name),
                    'Giới tính': toGenderLabel(s.gender),
                    'Ngày sinh': safeStr(s.dob),
                    Lớp: safeStr(s.className),
                    'Phụ huynh': safeStr(s.parentName),
                    'SĐT phụ huynh': safeStr(s.parentPhone),
                    'SĐT học sinh': safeStr(s.phone),
                    Email: safeStr(s.email),
                    'Trạng thái': statusLabelFromBackend(statusBe) || safeStr(s.statusDisplayName || s.status),
                    'Ngày nhập học': safeStr(s.enrollmentDate),
                    'Địa chỉ': safeStr(s.address),
                    'Ghi chú sức khỏe': safeStr(s.healthNotes)
                };
            });

        // tạo workbook
        const ws = XLSX.utils.json_to_sheet(rows);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'DanhSachHocSinh');

        // xuất file
        XLSX.writeFile(wb, filename);
        return true;
    } catch (err) {
        throw new Error(extractErrorMessage(err, 'Xuất Excel thất bại'));
    }
}
