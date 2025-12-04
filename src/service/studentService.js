import http from '@/service/http.js';
import * as XLSX from 'xlsx'; // npm i xlsx

/* ---------------- Helpers chung ---------------- */
function withApiV1(path) {
    const base = (http?.defaults?.baseURL || '').toLowerCase();
    return base.includes('/api/v1') ? path : `/api/v1${path}`;
}

function toGenderChar(g) {
    if (!g) return 'M';
    const s = String(g).toUpperCase();
    if (s.startsWith('F') || s === 'NỮ') return 'F';
    return 'M';
}

/* Chuẩn hoá ngày: nhận yyyy-MM-dd hoặc dd/MM/yyyy hoặc dd-MM-yyyy -> yyyy-MM-dd */
function normalizeDate(s) {
    if (!s) return '';
    s = String(s).trim();

    // yyyy-MM-dd
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
        const d = new Date(s);
        return isNaN(d.getTime()) ? '' : s;
    }

    // dd/MM/yyyy hoặc dd-MM-yyyy
    if (/^\d{2}[/-]\d{2}[/-]\d{4}$/.test(s)) {
        const [dd, mm, yyyy] = s.split(/[/-]/);
        const iso = `${yyyy}-${mm}-${dd}`;
        const d = new Date(iso);
        return isNaN(d.getTime()) ? '' : iso;
    }

    return '';
}

/* Chuẩn hoá giới tính nhiều dạng -> 'M' | 'F' hoặc '' nếu không hợp lệ */
function normalizeGender(g) {
    if (!g) return '';
    const s = String(g).trim().toLowerCase();
    if (['m', 'nam', 'male'].includes(s)) return 'M';
    if (['f', 'nu', 'nữ', 'female'].includes(s)) return 'F';
    return '';
}

/* ---------------- Parent cache & helpers ---------------- */
const parentCache = {
    loaded: false,
    map: new Map() // id -> { fullName, phone, email }
};

async function loadParentsAllToCache() {
    if (parentCache.loaded) return parentCache.map;
    try {
        const url = withApiV1('/parents/all');
        const res = await http.get(url);
        const raw = Array.isArray(res?.data?.data)
            ? res.data.data
            : Array.isArray(res?.data)
            ? res.data
            : [];
        for (const p of raw) {
            const id = p.id ?? p.parentId;
            if (id == null) continue;
            const fullName = p.fullName || p.username || p.name || `PH ${id}`;
            const phone =
                p.phone ||
                p.parentPhone ||
                p.additionalPhone ||
                p.additional_phone ||
                '';
            const email = p.email || '';
            parentCache.map.set(Number(id), { fullName, phone, email });
        }
        parentCache.loaded = true;
    } catch (e) {
        console.warn('[studentService] loadParentsAllToCache failed:', e?.message || e);
    }
    return parentCache.map;
}

// Build dropdown options [{ value, label }] từ cache phụ huynh
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

// Bổ sung parentName/parentPhone theo parentId nếu thiếu
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

/* ---------------- Map từ BE -> model bảng ---------------- */
function mapStudentRow(s) {
    const classObj = s.clazz || s.classroom || s.classes || s.class || {};

    const classId =
        s.classId ??
        s.class_id ??
        classObj.id ??
        classObj.classId ??
        classObj.class_id ??
        classObj.classroomId ??
        null;

    const className =
        s.className ||
        classObj.className ||
        classObj.name ||
        classObj.class_code ||
        '';

    const parentId = s.parentId ?? s.parent_id ?? s.parent?.id ?? null;
    const parentName = s.parentName || s.parent?.fullName || s.parent?.name || '';
    const parentPhone = s.parentPhone || s.parent?.phone || s.parent?.parentPhone || '';

    const code =
        s.studentCode ||
        s.code ||
        s.student_code ||
        '';

    const dob =
        s.dateOfBirth ||
        s.date_of_birth ||
        s.dob ||
        '';

    return {
        // id học sinh
        id: s.id ?? s.accountId ?? s.account_id,

        // mã học sinh – dùng cả code và studentCode cho chắc
        code,
        studentCode: code,

        // tên & ngày sinh
        name: s.fullName || s.name || '',
        dob,

        gender: toGenderChar(s.gender),

        classId,
        className,

        parentId,
        parentName,
        parentPhone,
        status: s.status || 'studying',
        username: s.username,
        email: s.email,
        phone: s.phone,
        avatarUrl: s.avatarUrl,
        address: s.address,
        enrollmentDate: s.enrollmentDate,
        healthNotes: s.healthNotes
    };
}

/* ---------------- API create đơn lẻ (POST /students/create) ---------------- */
export async function createStudent(payload) {
    try {
        const url = withApiV1('/students/create');
        const res = await http.post(url, payload);
        return res?.data?.data || res?.data;
    } catch (err) {
        throw new Error(
            err?.response?.data?.message || err?.message || 'Tạo học sinh thất bại'
        );
    }
}

/* Lấy chi tiết 1 học sinh (GET /students/{id}) */
export async function getStudentById(id) {
    if (!id) throw new Error('Thiếu id học sinh');
    try {
        const url = withApiV1(`/students/${id}`);
        const res = await http.get(url);
        return res?.data?.data || res?.data;
    } catch (err) {
        throw new Error(
            err?.response?.data?.message ||
                err?.response?.data?.error ||
                err?.message ||
                'Không lấy được thông tin học sinh'
        );
    }
}

/* Cập nhật học sinh (PUT /students/update/{id}) */
export async function updateStudent(id, payload) {
    if (!id) throw new Error('Thiếu id học sinh');
    try {
        const url = withApiV1(`/students/update/${id}`);
        const res = await http.put(url, payload, {
            headers: {
                'Content-Type': 'application/json',
                Accept: 'application/json'
            }
        });
        return res?.data?.data || res?.data;
    } catch (err) {
        throw new Error(
            err?.response?.data?.message ||
                err?.response?.data?.error ||
                err?.message ||
                'Cập nhật học sinh thất bại'
        );
    }
}

/* ---------------- Lỗi ---------------- */
function extractErrorMessage(err, fallback = 'Lỗi không xác định') {
    return (
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        err?.message ||
        fallback
    );
}

/* ---------------- Lọc/sort/paginate FE-side ---------------- */
function applyFiltersSortPaginate(list, params = {}) {
    let items = [...list];
    if (params.status && params.status !== 'all')
        items = items.filter((x) => x.status === params.status);
    if (params.code) {
        const q = params.code.trim().toLowerCase();
        items = items.filter((x) => (x.code || '').toLowerCase().includes(q));
    }
    if (params.name) {
        const q = params.name.trim().toLowerCase();
        items = items.filter((x) => (x.name || '').toLowerCase().includes(q));
    }
    if (params.className) {
        const q = params.className.trim().toLowerCase();
        items = items.filter((x) => (x.className || '').toLowerCase().includes(q));
    }
    if (params.parentName) {
        const q = params.parentName.trim().toLowerCase();
        items = items.filter((x) => (x.parentName || '').toLowerCase().includes(q));
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

/* ---------------- GET /students/all (FE-side filter) ---------------- */
// studentService.js
export async function fetchStudents(params = {}, options = {}) {
    const { skipParentEnrich = false } = options;

    try {
        const url = withApiV1('/students/all');
        const res = await http.get(url);
        const raw = Array.isArray(res?.data?.data)
            ? res.data.data
            : Array.isArray(res?.data)
            ? res.data
            : [];

        let mapped = raw.map(mapStudentRow);

        if (!skipParentEnrich) {
            mapped = await enrichStudentsWithParents(mapped);
        }

        return applyFiltersSortPaginate(mapped, params);
    } catch (err) {
        throw new Error(
            extractErrorMessage(err, 'Không thể tải danh sách học sinh')
        );
    }
}



/* Lấy toàn bộ học sinh theo lớp (dùng cho màn Hồ sơ sức khỏe – hiển thị hết, kể cả chưa có dữ liệu y tế) */
export async function fetchStudentsByClass(classId) {
    if (!classId) return [];
    const { items } = await fetchStudents({ page: 1, size: 10000, status: 'all' });

    const target = Number(classId);
    return items.filter(
        (s) => s.classId != null && Number(s.classId) === target
    );
}

/* ---------------- Import qua BE: POST /api/v1/students/import (multipart 'file') ---------------- */
export async function importStudentsExcel(file, { onProgress, signal } = {}) {
    if (!file) throw new Error('Thiếu file import');

    const endpoint = withApiV1('/students/import');
    const form = new FormData();
    form.append('file', file);

    try {
        const res = await http.post(endpoint, form, {
            headers: {
                'Content-Type': 'multipart/form-data',
                Accept: 'application/json'
            },
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

/* ---------------- Tải template import ---------------- */
export async function downloadStudentsImportTemplate() {
    const header = [
        'Tên đăng nhập',
        'Mật khẩu',
        'Họ và tên học sinh',
        'Email học sinh',
        'Số điện thoại học sinh',
        'Giới tính (Nam/Nữ)',
        'Ngày sinh (dd-MM-yyyy)',
        'Địa chỉ',
        'Ghi chú sức khỏe',
        'Mã lớp (class_code)',
        'Số điện thoại phụ huynh'
    ];

    const demoRow = [
        'DEMO_KHONG_LUU',
        '123456',
        'Ví dụ mẫu - KHÔNG LƯU',
        'demo@example.com',
        '0900000000',
        'Nam',
        'dd-MM-yyyy (ví dụ: 01-09-2017)',
        'Dòng này chỉ dùng minh hoạ',
        'Có thể xoá dòng này trước khi import',
        'MG5A',
        '0999999999'
    ];

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([header, demoRow]);
    XLSX.utils.book_append_sheet(wb, ws, 'ImportStudents');

    const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([wbout], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'mau_import_hoc_sinh.xlsx';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
}

/* ---------------- Tải template từ BE (nếu có) ---------------- */
export async function downloadStudentsTemplate() {
    try {
        const url = withApiV1('/students/template');
        const res = await http.get(url, { responseType: 'blob' });
        const blob = new Blob([res.data], {
            type: res.headers['content-type'] || 'application/octet-stream'
        });
        const dlUrl = URL.createObjectURL(blob);
        const a = document.createElement('a');
        const cd = res.headers['content-disposition'] || '';
        const m = cd.match(/filename="?([^"]+)"?/i);
        a.href = dlUrl;
        a.download = m ? m[1] : 'students_template.xlsx';
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(dlUrl);
    } catch (err) {
        throw new Error(extractErrorMessage(err, 'Tải mẫu thất bại'));
    }
}

/* ---------------- Export danh sách học sinh ---------------- */
export async function exportStudentsExcel() {
    try {
        const url = withApiV1('/students/export');
        const res = await http.get(url, { responseType: 'blob' });
        const blob = new Blob([res.data], {
            type: res.headers['content-type'] || 'application/octet-stream'
        });
        const dlUrl = URL.createObjectURL(blob);
        const a = document.createElement('a');
        const cd = res.headers['content-disposition'] || '';
        const name =
            (cd.match(/filename="?([^"]+)"?/i) || [])[1] || 'students.xlsx';
        theDownload(a, dlUrl, name);
    } catch (err) {
        // fallback CSV
        const { items } = await fetchStudents({ page: 1, size: 10000 });
        const header = 'code,name,className,parentName\n';
        const rows = items
            .map(
                (r) =>
                    `${csv(r.code)},${csv(r.name)},${csv(r.className)},${csv(r.parentName)}`
            )
            .join('\n');
        const BOM = new Uint8Array([0xef, 0xbb, 0xbf]);
        const blob = new Blob([BOM, header + rows], {
            type: 'text/csv;charset=utf-8;'
        });
        const a = document.createElement('a');
        const dlUrl = URL.createObjectURL(blob);
        theDownload(a, dlUrl, 'students.csv');
    }
}

function theDownload(a, url, name) {
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
}

/* ---------------- CSV escape ---------------- */
function csv(v) {
    if (v == null) return '';
    const s = String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/* ---------------- DELETE (thử nhiều endpoint) ---------------- */
async function tryDelete(url, { timeoutMs = 12000, withCredentials = false } = {}) {
    try {
        const res = await http.delete(withApiV1(url), {
            timeout: timeoutMs,
            withCredentials,
            validateStatus: (s) => (s >= 200 && s < 300) || s === 204
        });
        return { ok: true, status: res?.status ?? 200 };
    } catch (err) {
        const status = err?.response?.status;
        const bodyMsg =
            err?.response?.data?.message ||
            err?.response?.data?.error ||
            err?.response?.data?.detail ||
            err?.message;
        const isTimeout =
            err?.code === 'ECONNABORTED' ||
            String(err?.message || '')
                .toLowerCase()
                .includes('timeout');
        const message = isTimeout ? 'TIMEOUT' : bodyMsg || 'Request failed';
        return { ok: false, status, message };
    }
}

export async function deleteStudent(
    id,
    { timeoutMs = 12000, withCredentials = false } = {}
) {
    if (!id) throw new Error('Thiếu id học sinh');

    const candidates = [`/students/delete/${id}`, `/students/${id}`];

    let lastErr;
    for (const path of candidates) {
        const r = await tryDelete(path, { timeoutMs, withCredentials });
        if (r.ok) return true;

        if (r.status === 404 || r.status === 405 || r.status === 400) {
            lastErr = new Error(`Xóa thất bại (${r.status}) tại ${path}`);
            continue;
        }

        const msg =
            r.message === 'TIMEOUT'
                ? `Hết thời gian chờ (timeout) khi xóa (URL: ${path})`
                : `Xóa học sinh thất bại (${r.status || 'n/a'}) tại ${path}: ${r.message}`;
        throw new Error(msg);
    }

    throw lastErr || new Error('Xóa học sinh thất bại (không có endpoint phù hợp)');
}

/* ---------------- Xóa nhiều ---------------- */
export async function deleteStudents(ids = [], opts = {}) {
    if (!Array.isArray(ids) || !ids.length)
        return { ok: 0, fail: 0, errors: [] };

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

    const workers = Array.from(
        { length: Math.min(concurrency, ids.length) },
        () => worker()
    );
    await Promise.all(workers);
    return { ok, fail, errors };
}

/* ---------------- Đổi lớp cho 1 học sinh ---------------- */
export async function changeStudentClass(studentId, newClassId) {
    if (!studentId || !newClassId) {
        throw new Error('Thiếu học sinh hoặc lớp cần chuyển');
    }

    const url = withApiV1(`/students/${studentId}/class`);

    try {
        const res = await http.put(
            url,
            { classId: newClassId },
            {
                headers: {
                    'Content-Type': 'application/json',
                    Accept: 'application/json'
                }
            }
        );
        return res?.data?.data || res?.data;
    } catch (err) {
        throw new Error(
            err?.response?.data?.message ||
                err?.response?.data?.error ||
                err?.message ||
                'Chuyển lớp thất bại'
        );
    }
}
export async function fetchStudentsOfMyClass(classId, params = {}, options = {}) {
    if (!classId) return { items: [], total: 0 };

    const { skipParentEnrich = false } = options;

    try {
        const url = withApiV1(`/students/teachers/my-classes/${classId}`);
        const res = await http.get(url);

        const raw = Array.isArray(res?.data?.data)
            ? res.data.data
            : Array.isArray(res?.data)
            ? res.data
            : [];

        let mapped = raw.map(mapStudentRow);

        if (!skipParentEnrich) {
            mapped = await enrichStudentsWithParents(mapped);
        }

        // Tận dụng lại filter/sort/pagination FE-side
        return applyFiltersSortPaginate(mapped, params);
    } catch (err) {
        throw new Error(
            extractErrorMessage(err, 'Không thể tải danh sách học sinh theo lớp giáo viên')
        );
    }
}

/**
 * Nếu cần raw list (không paginate, không filter) cho 1 lớp giáo viên:
 * Ví dụ dùng cho dropdown, xuất Excel riêng lớp.
 */
export async function fetchStudentsOfMyClassRaw(classId) {
    if (!classId) return [];
    try {
        const url = withApiV1(`/students/teachers/my-classes/${classId}`);
        const res = await http.get(url);

        const raw = Array.isArray(res?.data?.data)
            ? res.data.data
            : Array.isArray(res?.data)
            ? res.data
            : [];

        let mapped = raw.map(mapStudentRow);
        mapped = await enrichStudentsWithParents(mapped);
        return mapped;
    } catch (err) {
        throw new Error(
            extractErrorMessage(err, 'Không thể tải danh sách học sinh theo lớp giáo viên')
        );
    }
}
/* ---------------- bulkImportStudentsFromFile (FE tự đọc Excel, gọi /students/create) ---------------- */
export async function bulkImportStudentsFromFile(file, options = {}) {
    const {
        requiredHeaders = [
            'studentCode',
            'fullName',
            'dateOfBirth',
            'gender',
            'className',
            'parentName',
            'parentPhone',
            'parentEmail',
            'address'
        ],
        maxPreview = 20000,
        chunkSize = 20,
        maxConcurrency = 5,
        onProgress = () => {},
        autoGenerateCode = true
    } = options;

    if (!file) throw new Error('Thiếu file');

    let workbook;
    try {
        const buf = await file.arrayBuffer();
        workbook = XLSX.read(buf, { type: 'array' });
    } catch {
        throw new Error('Không đọc được file Excel');
    }

    const sheetName = workbook.SheetNames[0];
    if (!sheetName) throw new Error('Không có sheet trong file');
    const ws = workbook.Sheets[sheetName];
    const json = XLSX.utils.sheet_to_json(ws, { defval: '', raw: false });
    if (!json.length) throw new Error('File rỗng');

    const headers = Object.keys(json[0]).map((h) => h.trim());
    const missing = requiredHeaders.filter((h) => !headers.includes(h));
    if (missing.length) throw new Error('Thiếu cột: ' + missing.join(', '));

    let existing = [];
    try {
        const all = await fetchStudents({ status: 'all', page: 1, size: 99999 });
        existing = all.items;
    } catch {
        existing = [];
    }
    const codeSet = new Set(existing.map((s) => s.code).filter(Boolean));
    const parentPhoneSet = new Set(
        existing.map((s) => s.parentPhone).filter(Boolean)
    );
    const emailSet = new Set(existing.map((s) => s.email).filter(Boolean));

    const rows = json.slice(0, maxPreview).map((r, i) => {
        const rowErrors = [];

        let studentCode = (r.studentCode || '').trim();
        if (!studentCode && autoGenerateCode) {
            studentCode =
                'HS' +
                Date.now().toString().slice(-6) +
                (Math.floor(Math.random() * 900) + 100);
        }
        if (!studentCode) rowErrors.push('Thiếu studentCode');

        const fullName = (r.fullName || '').trim();
        if (!fullName) rowErrors.push('Thiếu fullName');

        const rawDob = (r.dateOfBirth || '').trim();
        const dateOfBirth = normalizeDate(rawDob);
        if (!rawDob) rowErrors.push('Thiếu dateOfBirth');
        else if (!dateOfBirth) rowErrors.push('dateOfBirth không hợp lệ');

        const gender = normalizeGender(r.gender);
        if (!gender) rowErrors.push('gender không hợp lệ (M|F|Nam|Nữ)');

        const className = (r.className || '').trim();
        if (!className) rowErrors.push('Thiếu className');

        const parentName = (r.parentName || '').trim();
        if (!parentName) rowErrors.push('Thiếu parentName');

        const parentPhone = (r.parentPhone || '').trim();
        if (!parentPhone) rowErrors.push('Thiếu parentPhone');
        else if (!/^[0-9+()\-\s]{6,20}$/.test(parentPhone))
            rowErrors.push('parentPhone sai định dạng');

        const parentEmail = (r.parentEmail || '').trim();
        if (parentEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(parentEmail))
            rowErrors.push('parentEmail không hợp lệ');

        const address = (r.address || '').trim();

        if (studentCode && codeSet.has(studentCode))
            rowErrors.push('studentCode trùng');
        if (parentPhone && parentPhoneSet.has(parentPhone))
            rowErrors.push('parentPhone trùng');
        if (parentEmail && emailSet.has(parentEmail))
            rowErrors.push('parentEmail trùng');

        return {
            index: i,
            rowNumber: i + 2,
            errors: rowErrors,
            payload: {
                studentCode,
                fullName,
                dateOfBirth,
                gender,
                className,
                parentName,
                parentPhone,
                parentEmail,
                address
            }
        };
    });

    const validRows = rows.filter((r) => r.errors.length === 0);
    const invalidRows = rows.filter((r) => r.errors.length > 0);

    const report = {
        total: rows.length,
        valid: validRows.length,
        invalid: invalidRows.length,
        inserted: 0,
        failed: 0,
        skipped: invalidRows.length,
        errors: []
    };

    const chunks = [];
    for (let i = 0; i < validRows.length; i += chunkSize || 20) {
        chunks.push(validRows.slice(i, i + (chunkSize || 20)));
    }

    let processed = 0;

    async function runChunk(chunk) {
        const promises = chunk.map(async (r) => {
            try {
                const url = withApiV1('/students/create');
                await http.post(url, r.payload);
                if (r.payload.studentCode) codeSet.add(r.payload.studentCode);
                if (r.payload.parentPhone)
                    parentPhoneSet.add(r.payload.parentPhone);
                if (r.payload.parentEmail) emailSet.add(r.payload.parentEmail);
                report.inserted += 1;
            } catch (e) {
                report.failed += 1;
                report.errors.push(
                    `Row ${r.rowNumber}: ${extractErrorMessage(e, 'Lỗi tạo')}`
                );
            } finally {
                processed += 1;
                (onProgress || (() => {}))({
                    processed,
                    total: validRows.length,
                    percent: Math.round(
                        (processed * 100) / (validRows.length || 1)
                    )
                });
            }
        });
        await Promise.all(promises);
    }

    let active = 0;
    let idx = 0;
    await new Promise((resolve) => {
        function next() {
            if (idx >= chunks.length && active === 0) return resolve();
            while (active < (maxConcurrency || 5) && idx < chunks.length) {
                const c = chunks[idx++];
                active++;
                runChunk(c).then(() => {
                    active--;
                    next();
                });
            }
        }
        next();
    });

    return { report, rows, validRows, invalidRows };
}
