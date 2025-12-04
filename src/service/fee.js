// src/service/fee.js
import http from '@/service/http.js';

function withApiV1(path) {
    const base = (http?.defaults?.baseURL || '').toLowerCase();
    return base.includes('/api/v1') ? path : `/api/v1${path}`;
}

/**
 * Chuẩn hoá object params: xoá các field null / undefined / ''
 */
function cleanParams(obj = {}) {
    const q = { ...obj };
    Object.keys(q).forEach((k) => {
        if (q[k] === null || q[k] === undefined || q[k] === '') {
            delete q[k];
        }
    });
    return q;
}

/**
 * Lấy data chuẩn từ ApiResponse<T> hoặc trả về res.data
 */
function getData(res) {
    if (!res) return null;
    if (res.data && typeof res.data === 'object' && 'data' in res.data) {
        return res.data.data;
    }
    return res.data;
}

/**
 * Lấy message lỗi “dễ đọc”
 */
function getErr(e, fallback) {
    return e?.response?.data?.message || e?.response?.data?.error || e?.message || fallback || 'Có lỗi xảy ra';
}

/**
 * ⭐ Chuyển Date/ISO string → yyyy-MM-dd (LocalDate)
 * để gửi cho các field backend kiểu LocalDate (dueDate, paymentDate,…)
 */
function toLocalDateString(value) {
    if (!value) return null;

    // Nếu là Date
    if (value instanceof Date) {
        const y = value.getFullYear();
        const m = String(value.getMonth() + 1).padStart(2, '0');
        const d = String(value.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`; // yyyy-MM-dd
    }

    // Nếu là string
    if (typeof value === 'string') {
        // ISO: 2025-12-20T17:00:00.000Z → cắt 10 ký tự đầu
        if (value.includes('T')) {
            return value.slice(0, 10);
        }
        // Nếu đã đúng yyyy-MM-dd thì trả lại
        return value;
    }

    return value;
}

/* ==== APIs ==== */

export async function fetchFeesByClassAndSemesterYear({ classId, semester, year }) {
    if (!classId) throw new Error('Thiếu classId');
    const url = withApiV1(`/fees/class/${classId}/semester`);
    try {
        const res = await http.get(url, {
            params: cleanParams({ semester, year })
        });
        return getData(res) || [];
    } catch (e) {
        throw new Error(getErr(e, 'Không thể tải danh sách học phí'));
    }
}

export async function fetchFeeSummary({ classId, semester, year }) {
    if (!classId) throw new Error('Thiếu classId');
    const url = withApiV1('/fees/summary');
    try {
        const res = await http.get(url, {
            params: cleanParams({ classId, semester, year })
        });
        return getData(res) || null;
    } catch (e) {
        throw new Error(getErr(e, 'Không thể tải tổng hợp học phí'));
    }
}

export async function fetchAvailableSemesters() {
    const url = withApiV1('/fees/semesters');
    try {
        const res = await http.get(url);
        return getData(res) || [];
    } catch (e) {
        throw new Error(getErr(e, 'Không thể tải danh sách kỳ học'));
    }
}

export async function fetchAvailableYears() {
    const url = withApiV1('/fees/years');
    try {
        const res = await http.get(url);
        return getData(res) || [];
    } catch (e) {
        throw new Error(getErr(e, 'Không thể tải danh sách năm học'));
    }
}

/**
 * Tạo học phí hàng loạt cho 1 lớp
 * Backend: createBulkFees(Long classId, String semester, Integer year, BigDecimal amount, LocalDate dueDate)
 */
export async function createBulkFees({ classId, semester, year, amount, dueDate }) {
    const url = withApiV1('/fees/bulk');
    try {
        const res = await http.post(url, null, {
            params: cleanParams({
                classId,
                semester,
                year,
                amount,
                // ⭐ Convert Date → yyyy-MM-dd cho LocalDate
                dueDate: toLocalDateString(dueDate)
            })
        });
        return getData(res) || [];
    } catch (e) {
        throw new Error(getErr(e, 'Tạo học phí hàng loạt thất bại'));
    }
}

/**
 * Tải template Excel cho học phí
 */
export async function downloadFeeTemplate() {
    const url = withApiV1('/fees/template');
    try {
        const res = await http.get(url, { responseType: 'arraybuffer' });
        return res.data;
    } catch (e) {
        throw new Error(getErr(e, 'Không tải được file mẫu học phí'));
    }
}

/**
 * Import học phí từ Excel
 */
export async function createFeesFromExcel({ file }) {
    if (!file) throw new Error('Thiếu file Excel');
    const url = withApiV1('/fees/excel');
    const form = new FormData();
    form.append('file', file);

    try {
        const res = await http.post(url, form, {
            headers: { 'Content-Type': 'multipart/form-data' }
        });
        return getData(res) || [];
    } catch (e) {
        throw new Error(getErr(e, 'Import học phí từ Excel thất bại'));
    }
}

/**
 * Thanh toán học phí
 * Backend: payFee(FeePaymentRequest request) – paymentDate là LocalDate
 */
export async function payFee(payload) {
    const url = withApiV1('/fees/payment');
    const body = { ...payload };

    // ⭐ Chuẩn hoá ngày thanh toán về yyyy-MM-dd
    if (body.paymentDate) {
        body.paymentDate = toLocalDateString(body.paymentDate);
    }

    try {
        const res = await http.post(url, body, {
            headers: {
                'Content-Type': 'application/json',
                Accept: 'application/json'
            }
        });
        return getData(res) || null;
    } catch (e) {
        throw new Error(getErr(e, 'Thanh toán học phí thất bại'));
    }
}

/* ✅ Chi tiết học phí – GET /fees/{id} */
export async function fetchFeeDetail(id) {
    if (!id) throw new Error('Thiếu id học phí');
    const url = withApiV1(`/fees/${id}`);
    try {
        const res = await http.get(url);
        return getData(res) || null;
    } catch (e) {
        throw new Error(getErr(e, 'Không thể tải chi tiết học phí'));
    }
}

/**
 * Xoá học phí theo id
 */
export async function deleteFee(id) {
    if (!id) throw new Error('Thiếu id học phí');
    const url = withApiV1(`/fees/${id}`);
    try {
        const res = await http.delete(url);
        return getData(res) || true;
    } catch (e) {
        throw new Error(getErr(e, 'Xóa học phí thất bại'));
    }
}

/**
 * Cập nhật trạng thái OVERDUE cho các khoản đã quá hạn
 */
export async function updateOverdueFees() {
    const url = withApiV1('/fees/update-overdue');
    try {
        const res = await http.post(url);
        return getData(res) || null;
    } catch (e) {
        throw new Error(getErr(e, 'Cập nhật học phí quá hạn thất bại'));
    }
}

export default {
    fetchFeesByClassAndSemesterYear,
    fetchFeeSummary,
    fetchAvailableSemesters,
    fetchAvailableYears,
    createBulkFees,
    downloadFeeTemplate,
    createFeesFromExcel,
    payFee,
    fetchFeeDetail,
    deleteFee,
    updateOverdueFees
};
