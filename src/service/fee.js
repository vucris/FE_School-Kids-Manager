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
export function toLocalDateString(value) {
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

/* ============================================================================
 *                           CÁC API TRA CỨU / DANH MỤC
 * ==========================================================================*/

/**
 * Lấy học phí theo lớp + kỳ + năm
 * GET /fees/class/{classId}/semester?semester&year
 */
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

/**
 * Lấy tổng hợp học phí theo lớp + kỳ + năm
 * GET /fees/summary?classId&semester&year
 */
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

/**
 * Danh sách kỳ học (semester) đang có trong hệ thống
 * GET /fees/semesters
 */
export async function fetchAvailableSemesters() {
    const url = withApiV1('/fees/semesters');
    try {
        const res = await http.get(url);
        return getData(res) || [];
    } catch (e) {
        throw new Error(getErr(e, 'Không thể tải danh sách kỳ học'));
    }
}

/**
 * Danh sách năm học đang có trong hệ thống
 * GET /fees/years
 */
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
 * Lấy học phí theo student
 * GET /fees/student/{studentId}
 */
export async function fetchFeesByStudent(studentId) {
    if (!studentId) throw new Error('Thiếu studentId');
    const url = withApiV1(`/fees/student/${studentId}`);
    try {
        const res = await http.get(url);
        return getData(res) || [];
    } catch (e) {
        throw new Error(getErr(e, 'Không thể tải học phí học sinh'));
    }
}

/**
 * Lấy học phí theo class (tất cả kỳ)
 * GET /fees/class/{classId}
 */
export async function fetchFeesByClass(classId) {
    if (!classId) throw new Error('Thiếu classId');
    const url = withApiV1(`/fees/class/${classId}`);
    try {
        const res = await http.get(url);
        return getData(res) || [];
    } catch (e) {
        throw new Error(getErr(e, 'Không thể tải học phí theo lớp'));
    }
}

/**
 * Lấy học phí theo kỳ + năm toàn trường
 * GET /fees/semester?semester&year
 */
export async function fetchFeesBySemesterYear({ semester, year }) {
    const url = withApiV1('/fees/semester');
    try {
        const res = await http.get(url, {
            params: cleanParams({ semester, year })
        });
        return getData(res) || [];
    } catch (e) {
        throw new Error(getErr(e, 'Không thể tải học phí theo kỳ/năm'));
    }
}

/* ============================================================================
 *                           TẠO / CẬP NHẬT / XOÁ
 * ==========================================================================*/

/**
 * Tạo học phí đơn lẻ
 * POST /fees/create
 */
export async function createFee(payload) {
    const url = withApiV1('/fees/create');
    const body = { ...payload };
    if (body.dueDate) {
        body.dueDate = toLocalDateString(body.dueDate);
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
        throw new Error(getErr(e, 'Tạo học phí thất bại'));
    }
}

/**
 * Tạo học phí hàng loạt cho 1 lớp
 * POST /fees/bulk
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
 * Cập nhật học phí
 * PUT /fees/{id}
 */
export async function updateFee(id, payload) {
    if (!id) throw new Error('Thiếu id học phí');
    const url = withApiV1(`/fees/${id}`);
    const body = { ...payload };
    if (body.dueDate) {
        body.dueDate = toLocalDateString(body.dueDate);
    }
    try {
        const res = await http.put(url, body, {
            headers: {
                'Content-Type': 'application/json',
                Accept: 'application/json'
            }
        });
        return getData(res) || null;
    } catch (e) {
        throw new Error(getErr(e, 'Cập nhật học phí thất bại'));
    }
}

/**
 * Xoá học phí theo id
 * DELETE /fees/{id}
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

/* ============================================================================
 *                           THANH TOÁN HỌC PHÍ
 * ==========================================================================*/

/**
 * Thanh toán học phí
 * POST /fees/payment
 * Backend: FeePaymentRequest { feeId, amount, paymentDate(LocalDate), paymentMethod, note, receivedBy }
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

/* ============================================================================
 *                        CHI TIẾT / TRẠNG THÁI / QUÁ HẠN
 * ==========================================================================*/

/**
 * Chi tiết học phí – GET /fees/{id}
 */
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
 * Cập nhật trạng thái OVERDUE cho các khoản đã quá hạn
 * POST /fees/update-overdue
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

/**
 * Lấy danh sách học phí trễ hạn
 * GET /fees/overdue
 */
export async function fetchOverdueFees() {
    const url = withApiV1('/fees/overdue');
    try {
        const res = await http.get(url);
        return getData(res) || [];
    } catch (e) {
        throw new Error(getErr(e, 'Không thể tải danh sách học phí trễ hạn'));
    }
}

/**
 * ⭐ Gửi thông báo học phí trễ hạn cho 1 lớp (theo BE: /fees/notify-overdue)
 * Body: { classId, customMessage }
 */
export async function sendFeeOverdueNotificationsToClass({ classId, customMessage }) {
    if (!classId) throw new Error('Thiếu classId');
    const url = withApiV1('/fees/notify-overdue');
    try {
        const res = await http.post(
            url,
            {
                classId,
                customMessage: customMessage || null
            },
            {
                headers: {
                    'Content-Type': 'application/json',
                    Accept: 'application/json'
                }
            }
        );
        // Ở đây ta cần cả message + data từ ApiResponse, nên trả về res.data luôn
        return res.data; // { status, message, data }
    } catch (e) {
        throw new Error(getErr(e, 'Gửi thông báo học phí trễ hạn thất bại'));
    }
}

/**
 * (Tuỳ chọn) Gửi thông báo học phí trễ hạn toàn hệ thống
 * POST /fees/send-overdue-notifications
 */
export async function sendGlobalOverdueFeeNotifications() {
    const url = withApiV1('/fees/send-overdue-notifications');
    try {
        const res = await http.post(url);
        return res.data;
    } catch (e) {
        throw new Error(getErr(e, 'Gửi thông báo học phí trễ hạn toàn trường thất bại'));
    }
}

/* ============================================================================
 *                              EXCEL EXPORT
 * ==========================================================================*/

/**
 * Xuất Excel học phí theo lớp (có thể lọc theo kỳ & năm)
 * GET /fees/export/excel?classId&semester&year
 * → Controller trả về ResponseEntity<byte[]>
 */
export async function exportFeesToExcel({ classId, semester, year }) {
    const url = withApiV1('/fees/export/excel');
    try {
        const res = await http.get(url, {
            params: cleanParams({ classId, semester, year }),
            responseType: 'arraybuffer'
        });
        return res.data; // ArrayBuffer hoặc rỗng nếu 204
    } catch (e) {
        throw new Error(getErr(e, 'Xuất Excel học phí thất bại'));
    }
}

/* ============================================================================
 *                   MINH CHỨNG / XÁC NHẬN THANH TOÁN
 * ==========================================================================*/

/**
 * Nộp minh chứng học phí
 * POST /fees/proof (multipart)
 */
export async function submitFeeProof({ feeId, file, note }) {
    if (!feeId) throw new Error('Thiếu feeId');
    const url = withApiV1('/fees/proof');
    const form = new FormData();
    form.append('feeId', feeId);
    if (file) form.append('proofImage', file);
    if (note) form.append('note', note);

    try {
        const res = await http.post(url, form, {
            headers: { 'Content-Type': 'multipart/form-data' }
        });
        return getData(res) || null;
    } catch (e) {
        throw new Error(getErr(e, 'Nộp minh chứng học phí thất bại'));
    }
}

/**
 * Xác nhận / từ chối minh chứng học phí
 * POST /fees/verify
 * payload: { feeId, status: 'VERIFIED' | 'REJECTED', verifiedBy, verificationNote }
 */
export async function verifyFeePayment(payload) {
    const url = withApiV1('/fees/verify');
    try {
        const res = await http.post(url, payload, {
            headers: {
                'Content-Type': 'application/json',
                Accept: 'application/json'
            }
        });
        return getData(res) || null;
    } catch (e) {
        throw new Error(getErr(e, 'Xác nhận học phí thất bại'));
    }
}

/**
 * Danh sách học phí đang chờ xác nhận minh chứng
 * GET /fees/waiting-verification
 */
export async function fetchFeesWaitingVerification() {
    const url = withApiV1('/fees/waiting-verification');
    try {
        const res = await http.get(url);
        return getData(res) || [];
    } catch (e) {
        throw new Error(getErr(e, 'Không thể tải danh sách chờ xác nhận'));
    }
}

/* ============================================================================
 *                            API CHO PHỤ HUYNH
 * ==========================================================================*/

/**
 * Lấy học phí của phụ huynh (dựa theo token hiện tại)
 * GET /fees/my-fees
 */
export async function fetchMyFees() {
    const url = withApiV1('/fees/my-fees');
    try {
        const res = await http.get(url);
        return getData(res) || [];
    } catch (e) {
        throw new Error(getErr(e, 'Không thể tải học phí của bạn'));
    }
}

/* ============================================================================
 *                          DEFAULT EXPORT (tuỳ chọn)
 * ==========================================================================*/

export default {
    fetchFeesByClassAndSemesterYear,
    fetchFeeSummary,
    fetchAvailableSemesters,
    fetchAvailableYears,
    fetchFeesByStudent,
    fetchFeesByClass,
    fetchFeesBySemesterYear,
    createFee,
    createBulkFees,
    updateFee,
    deleteFee,
    payFee,
    fetchFeeDetail,
    updateOverdueFees,
    exportFeesToExcel,
    submitFeeProof,
    verifyFeePayment,
    fetchFeesWaitingVerification,
    fetchMyFees,
    fetchOverdueFees,
    sendFeeOverdueNotificationsToClass,
    sendGlobalOverdueFeeNotifications
};
