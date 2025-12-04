import http from '@/service/http.js';

/* Helper: tự thêm /api/v1 nếu baseURL chưa có */
function withApiV1(path) {
    const base = (http?.defaults?.baseURL || '').toLowerCase();
    return base.includes('/api/v1') ? path : `/api/v1${path}`;
}

/* Map 1 record BE -> FE */
function mapHealthRecord(r = {}) {
    const s = r.student || r.studentDto || r.studentEntity || {};
    const classObj = r.clazz || r.classroom || s.clazz || s.classroom || {};

    const studentId = r.studentId ?? s.studentId ?? s.id ?? null;

    const studentCode = r.studentCode || s.studentCode || s.code || s.student_code || '';

    const studentName = r.studentName || s.fullName || s.name || '';

    const classId = r.classId ?? classObj.id ?? classObj.classId ?? classObj.class_id ?? null;

    const className = r.className || classObj.className || classObj.name || classObj.class_code || '';

    return {
        id: r.id,
        studentId,
        studentCode,
        studentName,
        classId,
        className,
        recordYear: r.recordYear,
        recordMonth: r.recordMonth,
        ageInMonths: r.ageInMonths,
        weightKg: r.weightKg,
        heightCm: r.heightCm,
        bmi: r.bmi,
        nutritionStatus: r.nutritionStatus,
        bloodType: r.bloodType,
        knowsSwimming: r.knowsSwimming,
        eyeIssue: r.eyeIssue,
        dentalIssue: r.dentalIssue,
        note: r.note,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt
    };
}

/* ===================== CRUD / SEARCH ===================== */

/** GET /health-records/all */
export async function fetchAllHealthRecords() {
    const url = withApiV1('/health-records/all');
    const res = await http.get(url);
    const raw = Array.isArray(res?.data?.data) ? res.data.data : [];
    return raw.map(mapHealthRecord);
}

/** GET /health-records/{id} */
export async function fetchHealthRecordById(id) {
    const url = withApiV1(`/health-records/${id}`);
    const res = await http.get(url);
    return res?.data?.data ? mapHealthRecord(res.data.data) : null;
}

/** GET /health-records/student/{studentId} */
export async function fetchHealthRecordsByStudent(studentId) {
    const url = withApiV1(`/health-records/student/${studentId}`);
    const res = await http.get(url);
    const raw = Array.isArray(res?.data?.data) ? res.data.data : [];
    return raw.map(mapHealthRecord);
}

/** GET /health-records/class/{classId}  (giống Postman) */
export async function fetchHealthRecordsByClass(classId) {
    const url = withApiV1(`/health-records/class/${classId}`);
    const res = await http.get(url);
    const raw = Array.isArray(res?.data?.data) ? res.data.data : [];
    return raw.map(mapHealthRecord);
}

/**
 * FE-side: lấy toàn bộ hồ sơ theo lớp rồi FILTER theo NĂM (month để null)
 */
export async function fetchHealthRecordsByClassAndPeriodFE(classId, year, month) {
    const all = await fetchHealthRecordsByClass(classId);
    if (!year && !month) return all;

    return all.filter((r) => {
        const okYear = year ? r.recordYear === Number(year) : true;
        // nếu month null/undefined thì không lọc theo tháng nữa
        const okMonth = month ? r.recordMonth === Number(month) : true;
        return okYear && okMonth;
    });
}

/**
 * Tìm kiếm theo nhiều tiêu chí bằng /search
 */
export async function searchHealthRecords({ studentId, classId, year, month } = {}) {
    const params = {};
    if (studentId) params.studentId = studentId;
    if (classId) params.classId = classId;
    if (year) params.year = year;
    if (month) params.month = month;

    const url = withApiV1('/health-records/search');
    const res = await http.get(url, { params });
    const raw = Array.isArray(res?.data?.data) ? res.data.data : [];
    return raw.map(mapHealthRecord);
}

/** POST /health-records/create */
export async function createHealthRecord(payload) {
    const url = withApiV1('/health-records/create');
    const res = await http.post(url, payload, {
        headers: { Accept: 'application/json' }
    });

    if (res?.data?.status && res.data.status >= 400) {
        throw new Error(res.data.message || 'Tạo hồ sơ sức khỏe thất bại');
    }
    return res?.data?.data ? mapHealthRecord(res.data.data) : null;
}

/** PUT /health-records/{id} */
export async function updateHealthRecord(id, payload) {
    const url = withApiV1(`/health-records/${id}`);
    const res = await http.put(url, payload, {
        headers: { Accept: 'application/json' }
    });

    if (res?.data?.status && res.data.status >= 400) {
        throw new Error(res.data.message || 'Cập nhật hồ sơ sức khỏe thất bại');
    }
    return res?.data?.data ? mapHealthRecord(res.data.data) : null;
}

/** DELETE /health-records/{id} */
export async function deleteHealthRecord(id) {
    const url = withApiV1(`/health-records/${id}`);
    const res = await http.delete(url, {
        headers: { Accept: 'application/json' }
    });

    if (res?.data?.status && res.data.status >= 400) {
        throw new Error(res.data.message || 'Xóa hồ sơ sức khỏe thất bại');
    }
    return true;
}

/* ===================== BMI ===================== */

/**
 * POST /health-records/calculate-bmi?weightKg=&heightCm=
 * Backend trả ApiResponse<BigDecimal>
 */
export async function calculateBMI(weightKg, heightCm) {
    const url = withApiV1('/health-records/calculate-bmi');
    const res = await http.post(url, null, {
        params: { weightKg, heightCm },
        headers: { Accept: 'application/json' }
    });

    if (res?.data?.status && res.data.status >= 400) {
        throw new Error(res.data.message || 'Tính BMI thất bại');
    }
    return res?.data?.data ?? null;
}

/* ===================== EXCEL: TEMPLATE / IMPORT / EXPORT ===================== */

/** Tải file mẫu Excel 1 lớp */
export async function downloadHealthRecordTemplate(classId) {
    const url = withApiV1(`/health-records/class/${classId}/template`);
    const res = await http.get(url, { responseType: 'blob' });
    return res.data; // Blob
}

/**
 * Import từ Excel – gửi theo NĂM, tháng cố định (ví dụ: 6)
 * POST /health-records/import
 * BE: @RequestParam file, classId, recordYear, recordMonth
 */
export async function importHealthRecordsFromExcel({ file, classId, recordYear }) {
    const url = withApiV1('/health-records/import');
    const formData = new FormData();
    formData.append('file', file);
    formData.append('classId', classId);
    formData.append('recordYear', recordYear);
    // FE đo theo NĂM, nhưng BE cần recordMonth => cố định tháng 6
    formData.append('recordMonth', 6);

    const res = await http.post(url, formData, {
        headers: {
            'Content-Type': 'multipart/form-data',
            Accept: 'application/json'
        }
    });

    if (res?.data?.status && res.data.status >= 400) {
        throw new Error(res.data.message || 'Import hồ sơ sức khỏe thất bại');
    }

    const raw = Array.isArray(res?.data?.data) ? res.data.data : [];
    return raw; // giữ nguyên DTO cho màn import result
}

/**
 * Export dữ liệu 1 lớp, 1 NĂM ra Excel
 * GET /health-records/class/{classId}/export?year=&month=
 * FE vẫn chọn theo NĂM, month fix 6 cho thống nhất
 */
export async function exportHealthRecordsToExcel({ classId, year }) {
    const url = withApiV1(`/health-records/class/${classId}/export`);
    const res = await http.get(url, {
        params: { year, month: 6 },
        responseType: 'blob'
    });
    return res.data; // Blob
}

/* default export (tuỳ chọn) */
export default {
    fetchAllHealthRecords,
    fetchHealthRecordById,
    fetchHealthRecordsByStudent,
    fetchHealthRecordsByClass,
    fetchHealthRecordsByClassAndPeriodFE,
    searchHealthRecords,
    createHealthRecord,
    updateHealthRecord,
    deleteHealthRecord,
    calculateBMI,
    downloadHealthRecordTemplate,
    importHealthRecordsFromExcel,
    exportHealthRecordsToExcel
};
