// src/service/HealthRecordService.js
import http from '@/service/http.js';
import * as XLSX from 'xlsx'; // npm i xlsx
import { fetchClassById } from '@/service/classService.js'; // dùng để lấy tên lớp

/* ================== HELPERS CHUNG ================== */

function withApiV1(path) {
    const base = (http?.defaults?.baseURL || '').toLowerCase();
    return base.includes('/api/v1') ? path : `/api/v1${path}`;
}

function extractErrorMessage(err, fallback = 'Lỗi không xác định') {
    return err?.response?.data?.message || err?.response?.data?.error || err?.message || fallback;
}

// đọc ô với nhiều key khác nhau (VD: ['Mã học sinh', 'studentCode'])
function getCell(row, keys = []) {
    for (const k of keys) {
        if (k in row && row[k] !== '') return row[k];
    }
    return '';
}

/* ================== CRUD CƠ BẢN ================== */

/**
 * GET /api/v1/health-records/search
 * params: { studentId?, classId?, year?, month? }
 */
export async function fetchHealthRecords(params = {}) {
    const url = withApiV1('/health-records/search');

    const query = { ...params };
    Object.keys(query).forEach((k) => {
        if (query[k] === null || query[k] === undefined || query[k] === '') {
            delete query[k];
        }
    });

    try {
        const res = await http.get(url, { params: query });
        return res?.data?.data || res?.data || [];
    } catch (e) {
        throw new Error(extractErrorMessage(e, 'Không thể tải hồ sơ sức khỏe'));
    }
}

/**
 * DELETE /api/v1/health-records/{id}
 */
export async function deleteHealthRecord(id) {
    if (!id) throw new Error('Thiếu id hồ sơ');
    const url = withApiV1(`/health-records/${id}`);
    try {
        await http.delete(url);
        return true;
    } catch (e) {
        throw new Error(extractErrorMessage(e, 'Không thể xóa hồ sơ sức khỏe'));
    }
}

/**
 * POST /api/v1/health-records/calculate-bmi
 * (giữ lại nếu cần dùng ở màn khác)
 */
export async function calculateBmi(weightKg, heightCm) {
    const url = withApiV1('/health-records/calculate-bmi');
    try {
        const res = await http.post(url, null, {
            params: { weightKg, heightCm }
        });
        return res?.data?.data ?? null;
    } catch (e) {
        throw new Error(extractErrorMessage(e, 'Không thể tính BMI'));
    }
}

/* ================== HỖ TRỢ LẤY DANH SÁCH HỌC SINH THEO LỚP ================== */

/**
 * Lấy toàn bộ học sinh của 1 lớp (dùng cho tải template + import).
 * Trả về [{ id, studentCode, fullName, className }]
 */
async function loadStudentsByClass(classId) {
    const urlStudents = withApiV1('/students/all');
    const res = await http.get(urlStudents);
    const raw = Array.isArray(res?.data?.data) ? res.data.data : Array.isArray(res?.data) ? res.data : [];

    // Lấy thông tin lớp để chuẩn hoá className
    let classInfo = null;
    try {
        classInfo = await fetchClassById(classId);
    } catch (e) {
        console.warn('[HealthRecordService] Không lấy được thông tin lớp:', e?.message || e);
    }
    const classNameStd = (classInfo?.className || '').trim().toLowerCase();

    const students = raw
        .filter((s) => {
            const cid = s.classId ?? s.class_id ?? s.clazz?.id ?? s.class?.id ?? null;

            const nameRaw = s.className || s.clazz?.className || s.class?.className || '';
            const nameNorm = String(nameRaw).trim().toLowerCase();

            if (cid != null) {
                return Number(cid) === Number(classId);
            }

            if (classNameStd) {
                return nameNorm === classNameStd;
            }

            return false;
        })
        .map((s) => ({
            id: s.id,
            studentCode: s.studentCode || s.code || '',
            fullName: s.fullName || s.studentName || s.name || '',
            className: s.className || classInfo?.className || ''
        }))
        .filter((s) => s.studentCode && s.fullName)
        .sort((a, b) => a.fullName.localeCompare(b.fullName, 'vi'));

    return students;
}

/* ================== TẢI MẪU EXCEL THEO LỚP ================== */

/**
 * Tải file Excel mẫu nhập thông tin sức khỏe cho toàn bộ học sinh của 1 lớp.
 *
 * Header tiếng Việt, có 1 dòng DEMO ở trên cùng.
 * Dòng DEMO dùng mã học sinh bắt đầu bằng "VD_" để khi import sẽ tự bỏ qua.
 */
export async function downloadHealthTemplateForClass(classId) {
    if (!classId) throw new Error('Vui lòng chọn lớp trước khi tải mẫu');

    const students = await loadStudentsByClass(classId);

    if (!students.length) {
        throw new Error('Lớp này hiện chưa có học sinh để tạo mẫu');
    }

    // Header tiếng Việt
    const header = ['Mã học sinh', 'Tên học sinh', 'Lớp', 'Tuổi (tháng)', 'Cân nặng (kg)', 'Chiều cao (cm)', 'Tình trạng dinh dưỡng', 'Nhóm máu', 'Biết bơi', 'Vấn đề mắt', 'Vấn đề răng miệng', 'Ghi chú'];

    // Dòng demo mẫu (sẽ không import vì mã bắt đầu bằng "VD_")
    const demoRow = ['VD_HS0001', 'Ví dụ: Nguyễn An', 'Ví dụ: Lớp Mẫu giáo 5A', '60', '18.5', '110', 'Bình thường', 'O', 'Có', 'Không', 'Không', 'DÒNG MẪU – có thể tham khảo, nếu sửa lại thành học sinh thật thì sẽ được nhập.'];

    // Các dòng học sinh thật (chưa có số đo)
    const rows = students.map((s) => [
        s.studentCode,
        s.fullName,
        s.className,
        '', // Tuổi tháng
        '', // Cân nặng
        '', // Chiều cao
        '', // Tình trạng dinh dưỡng
        '', // Nhóm máu
        '', // Biết bơi
        '', // Vấn đề mắt
        '', // Vấn đề răng miệng
        '' // Ghi chú
    ]);

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([header, demoRow, ...rows]);
    XLSX.utils.book_append_sheet(wb, ws, 'NhapYTe');

    const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([wbout], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    });

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `mau_nhap_yte_lop_${classId}.xlsx`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
}

/* ================== IMPORT EXCEL VÀO HEALTH RECORD ================== */

function parseBool(v) {
    if (v === true || v === false) return v;
    if (v == null || v === '') return null;
    const s = String(v).trim().toLowerCase();
    if (['1', 'true', 'x', 'yes', 'y', 'có', 'co'].includes(s)) return true;
    if (['0', 'false', 'no', 'không', 'khong'].includes(s)) return false;
    return null;
}

/**
 * Import file Excel chiều cao – cân nặng cho 1 lớp.
 *
 * Quy tắc:
 *  - Dòng DEMO có mã học sinh bắt đầu bằng "VD_" -> bỏ qua.
 *  - Hàng nào không có mã học sinh, hoặc thiếu cả cân nặng & chiều cao -> BỎ QUA, KHÔNG LỖI.
 *  - Tìm học sinh bằng studentCode trong danh sách lớp; nếu không thấy -> đánh dấu failed.
 *
 * Gọi BE: POST /api/v1/health-records/create (cho từng dòng hợp lệ).
 */
export async function importHealthRecordsFromFile(file, { classId, recordDate, onProgress } = {}) {
    if (!file) throw new Error('Chưa chọn file nhập');
    if (!classId) throw new Error('Chưa chọn lớp cần nhập');

    let dateObj = recordDate;
    if (!(dateObj instanceof Date)) {
        dateObj = new Date(recordDate);
    }
    if (!(dateObj instanceof Date) || Number.isNaN(dateObj.getTime())) {
        throw new Error('Ngày đo không hợp lệ');
    }

    const recordYear = dateObj.getFullYear();
    const recordMonth = dateObj.getMonth() + 1;

    // đọc Excel
    let workbook;
    try {
        const buf = await file.arrayBuffer();
        workbook = XLSX.read(buf, { type: 'array' });
    } catch {
        throw new Error('Không đọc được file Excel. Vui lòng kiểm tra lại định dạng.');
    }

    const sheetName = workbook.SheetNames[0];
    if (!sheetName) throw new Error('File không có sheet dữ liệu');
    const ws = workbook.Sheets[sheetName];

    // rows: mỗi phần tử là 1 dòng (bỏ header)
    const rows = XLSX.utils.sheet_to_json(ws, { defval: '' });
    if (!rows.length) throw new Error('File không có dữ liệu');

    // Map studentCode -> id cho lớp này
    const students = await loadStudentsByClass(classId);
    const codeMap = new Map();
    for (const s of students) {
        const key = String(s.studentCode).trim().toUpperCase();
        if (key) codeMap.set(key, s.id);
    }

    let success = 0;
    let failed = 0;
    let skipped = 0;
    const errors = [];

    for (let i = 0; i < rows.length; i++) {
        const r = rows[i];
        const excelRowNumber = i + 2; // header = dòng 1

        // đọc theo nhiều tên cột khác nhau (tiếng Việt / tiếng Anh)
        let studentCode = getCell(r, ['Mã học sinh', 'maHocSinh', 'studentCode', 'Mã HS', 'Ma HS']);
        studentCode = String(studentCode || '').trim();

        // DÒNG DEMO: mã bắt đầu bằng "VD_" -> bỏ qua, không lỗi
        if (studentCode.startsWith('VD_')) {
            skipped++;
            if (typeof onProgress === 'function') {
                onProgress(Math.round(((i + 1) * 100) / rows.length));
            }
            continue;
        }

        const weightKg = getCell(r, ['Cân nặng (kg)', 'canNangKg', 'weightKg', 'weight']);
        const heightCm = getCell(r, ['Chiều cao (cm)', 'chieuCaoCm', 'heightCm', 'height']);

        // Nếu không có mã học sinh → bỏ qua, KHÔNG lỗi
        if (!studentCode) {
            skipped++;
            if (typeof onProgress === 'function') {
                onProgress(Math.round(((i + 1) * 100) / rows.length));
            }
            continue;
        }

        // Nếu thiếu cả cân nặng & chiều cao → bỏ qua, KHÔNG lỗi
        if (weightKg === '' && heightCm === '') {
            skipped++;
            if (typeof onProgress === 'function') {
                onProgress(Math.round(((i + 1) * 100) / rows.length));
            }
            continue;
        }

        const codeKey = studentCode.toUpperCase();
        const studentId = codeMap.get(codeKey);

        // Không tìm thấy học sinh theo mã → coi là failed (dữ liệu sai mã)
        if (!studentId) {
            failed++;
            errors.push(`Dòng ${excelRowNumber}: không tìm thấy học sinh với mã '${studentCode}' trong lớp.`);
            if (typeof onProgress === 'function') {
                onProgress(Math.round(((i + 1) * 100) / rows.length));
            }
            continue;
        }

        const ageInMonths = getCell(r, ['Tuổi (tháng)', 'tuoiThang', 'ageInMonths', 'age_months']);
        const nutritionStatus = getCell(r, ['Tình trạng dinh dưỡng', 'tinhTrangDinhDuong', 'nutritionStatus', 'nutrition']);
        const bloodType = getCell(r, ['Nhóm máu', 'nhomMau', 'bloodType']);
        const knowsSwimming = parseBool(getCell(r, ['Biết bơi', 'bietBoi', 'knowsSwimming']));
        const eyeIssue = parseBool(getCell(r, ['Vấn đề mắt', 'vanDeMat', 'eyeIssue']));
        const dentalIssue = parseBool(getCell(r, ['Vấn đề răng miệng', 'vanDeRangMieng', 'dentalIssue']));
        const note = getCell(r, ['Ghi chú', 'ghiChu', 'note']);

        const payload = {
            studentId,
            classId,
            recordYear,
            recordMonth,
            ageInMonths: ageInMonths || null,
            weightKg: weightKg || null,
            heightCm: heightCm || null,
            nutritionStatus: nutritionStatus || '',
            bloodType: bloodType || '',
            knowsSwimming,
            eyeIssue,
            dentalIssue,
            note: note || ''
        };

        try {
            const url = withApiV1('/health-records/create');
            await http.post(url, payload, {
                headers: {
                    'Content-Type': 'application/json',
                    Accept: 'application/json'
                }
            });
            success++;
        } catch (e) {
            failed++;
            errors.push(`Dòng ${excelRowNumber}: ${extractErrorMessage(e, 'Tạo hồ sơ thất bại')}`);
        }

        if (typeof onProgress === 'function') {
            onProgress(Math.round(((i + 1) * 100) / rows.length));
        }
    }

    return {
        total: rows.length,
        success,
        failed,
        skipped,
        errors
    };
}
