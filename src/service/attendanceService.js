// src/service/attendanceService.js
import http from '@/service/http.js';

/* Thêm /api/v1 nếu baseURL chưa có */
function withApiV1(path) {
    const base = (http?.defaults?.baseURL || '').toLowerCase();
    return base.includes('/api/v1') ? path : `/api/v1${path}`;
}

/* Bỏ các param null/undefined/'' */
function cleanParams(obj = {}) {
    const q = { ...obj };
    Object.keys(q).forEach((k) => {
        if (q[k] === null || q[k] === undefined || q[k] === '') {
            delete q[k];
        }
    });
    return q;
}

/* Lấy data từ ApiResponse { status, message, data } */
function getData(res) {
    if (!res) return null;
    if (res.data && typeof res.data === 'object' && 'data' in res.data) {
        return res.data.data;
    }
    return res.data;
}

/* Lấy message lỗi cho đẹp */
function getErr(e, fallback) {
    return (
        e?.response?.data?.message ||
        e?.response?.data?.error ||
        e?.message ||
        fallback ||
        'Có lỗi xảy ra'
    );
}

/* Đổi Date/ISO -> chuỗi dd-MM-yyyy cho đúng format backend */
function formatDateParam(value) {
    if (!value) return null;

    if (typeof value === 'string') {
        // nếu đã đúng định dạng dd-MM-yyyy thì dùng luôn
        if (/^\d{2}-\d{2}-\d{4}$/.test(value)) return value;
        const d = new Date(value);
        if (Number.isNaN(d.getTime())) return null;
        const dd = String(d.getDate()).padStart(2, '0');
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const yyyy = d.getFullYear();
        return `${dd}-${mm}-${yyyy}`;
    }

    const d = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(d.getTime())) return null;
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = d.getFullYear();
    return `${dd}-${mm}-${yyyy}`;
}

/* ====== READ APIs – cho báo cáo điểm danh ====== */

/**
 * GET LIST: GET /api/v1/attendance/list
 * params: { classId, date, status?, keyword? }
 *  - date: Date hoặc chuỗi, sẽ convert thành dd-MM-yyyy
 */
export async function fetchAttendanceList({ classId, date, status, keyword } = {}) {
    if (!classId) throw new Error('Thiếu classId');
    if (!date) throw new Error('Thiếu ngày điểm danh');

    const url = withApiV1('/attendance/list');
    const params = cleanParams({
        classId,
        date: formatDateParam(date),
        status,
        keyword
    });

    try {
        const res = await http.get(url, { params });
        return getData(res) || [];
    } catch (e) {
        throw new Error(getErr(e, 'Không thể tải danh sách điểm danh'));
    }
}

/**
 * GET SUMMARY: GET /api/v1/attendance/summary
 * params: { classId, date }
 */
export async function fetchAttendanceSummary({ classId, date } = {}) {
    if (!classId) throw new Error('Thiếu classId');
    if (!date) throw new Error('Thiếu ngày điểm danh');

    const url = withApiV1('/attendance/summary');
    const params = cleanParams({
        classId,
        date: formatDateParam(date)
    });

    try {
        const res = await http.get(url, { params });
        return getData(res) || null;
    } catch (e) {
        throw new Error(getErr(e, 'Không thể tải thống kê điểm danh'));
    }
}

/**
 * GET STUDENT HISTORY:
 * GET /api/v1/attendance/history/{studentId}?startDate=&endDate=
 */
export async function fetchStudentAttendanceHistory(studentId, { startDate, endDate } = {}) {
    if (!studentId) throw new Error('Thiếu studentId');

    const url = withApiV1(`/attendance/history/${studentId}`);
    const params = cleanParams({
        startDate: formatDateParam(startDate),
        endDate: formatDateParam(endDate)
    });

    try {
        const res = await http.get(url, { params });
        return getData(res) || [];
    } catch (e) {
        throw new Error(getErr(e, 'Không thể tải lịch sử điểm danh'));
    }
}

/* ====== WRITE APIs – dùng cho màn điểm danh (nếu cần) ====== */

function mapUpdatePayload(payload = {}) {
    const cloned = { ...payload };
    if (cloned.date) {
        cloned.date = formatDateParam(cloned.date);
    }
    return cloned;
}

/** POST /attendance/update */
export async function updateAttendance(payload) {
    const url = withApiV1('/attendance/update');
    try {
        const res = await http.post(url, mapUpdatePayload(payload), {
            headers: { 'Content-Type': 'application/json', Accept: 'application/json' }
        });
        return getData(res) ?? true;
    } catch (e) {
        throw new Error(getErr(e, 'Cập nhật điểm danh thất bại'));
    }
}

/** POST /attendance/bulk-update */
export async function bulkUpdateAttendance(payload) {
    const url = withApiV1('/attendance/bulk-update');
    const cloned = { ...payload };
    if (cloned.date) cloned.date = formatDateParam(cloned.date);
    if (!Array.isArray(cloned.items)) cloned.items = [];
    try {
        const res = await http.post(url, cloned, {
            headers: { 'Content-Type': 'application/json', Accept: 'application/json' }
        });
        return getData(res) ?? true;
    } catch (e) {
        throw new Error(getErr(e, 'Cập nhật điểm danh hàng loạt thất bại'));
    }
}

/** POST /attendance/check-in */
export async function checkIn(payload) {
    const url = withApiV1('/attendance/check-in');
    try {
        const res = await http.post(url, mapUpdatePayload(payload), {
            headers: { 'Content-Type': 'application/json', Accept: 'application/json' }
        });
        return getData(res) ?? true;
    } catch (e) {
        throw new Error(getErr(e, 'Điểm danh đến thất bại'));
    }
}

/** POST /attendance/check-out */
export async function checkOut(payload) {
    const url = withApiV1('/attendance/check-out');
    try {
        const res = await http.post(url, mapUpdatePayload(payload), {
            headers: { 'Content-Type': 'application/json', Accept: 'application/json' }
        });
        return getData(res) ?? true;
    } catch (e) {
        throw new Error(getErr(e, 'Điểm danh về thất bại'));
    }
}

/** POST /attendance/mark-absent */
export async function markAbsent(payload) {
    const url = withApiV1('/attendance/mark-absent');
    try {
        const res = await http.post(url, mapUpdatePayload(payload), {
            headers: { 'Content-Type': 'application/json', Accept: 'application/json' }
        });
        return getData(res) ?? true;
    } catch (e) {
        throw new Error(getErr(e, 'Điểm danh nghỉ thất bại'));
    }
}

/* default export cho tiện import */
export default {
    fetchAttendanceList,
    fetchAttendanceSummary,
    fetchStudentAttendanceHistory,
    updateAttendance,
    bulkUpdateAttendance,
    checkIn,
    checkOut,
    markAbsent
};
