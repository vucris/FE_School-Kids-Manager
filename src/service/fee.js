// src/service/fee.js
import http from '@/service/http.js';

function withApiV1(path) {
    const base = (http?.defaults?.baseURL || '').toLowerCase();
    return base.includes('/api/v1') ? path : `/api/v1${path}`;
}

function cleanParams(obj = {}) {
    const q = { ...obj };
    Object.keys(q).forEach((k) => {
        if (q[k] === null || q[k] === undefined || q[k] === '') {
            delete q[k];
        }
    });
    return q;
}

function getData(res) {
    if (!res) return null;
    if (res.data && typeof res.data === 'object' && 'data' in res.data) {
        return res.data.data;
    }
    return res.data;
}

function getErr(e, fallback) {
    return e?.response?.data?.message || e?.response?.data?.error || e?.message || fallback || 'Có lỗi xảy ra';
}

// yyyy-MM-dd
function toIsoDate(value) {
    if (!value) return null;
    if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return null;
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

// dd-MM-yyyy (dùng cho /excel)
function toDMY(value) {
    if (!value) return null;
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return null;
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${day}-${m}-${y}`;
}

/* ========== CRUD / QUERY ========== */

// POST /api/v1/api/fees/create
export async function createFee(payload) {
    const url = withApiV1('/api/fees/create');
    try {
        const res = await http.post(url, payload, {
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

// POST /api/v1/api/fees/bulk?classId=&semester=&year=&amount=&dueDate=
export async function createBulkFees({ classId, semester, year, amount, dueDate }) {
    if (!classId || !semester || !year || !amount || !dueDate) {
        throw new Error('Thiếu tham số tạo học phí hàng loạt');
    }
    const url = withApiV1('/api/fees/bulk');
    try {
        const res = await http.post(url, null, {
            params: {
                classId,
                semester,
                year,
                amount,
                dueDate: toIsoDate(dueDate)
            }
        });
        return getData(res) || [];
    } catch (e) {
        throw new Error(getErr(e, 'Tạo học phí hàng loạt thất bại'));
    }
}

// PUT /api/v1/api/fees/{id}
export async function updateFee(id, payload) {
    if (!id) throw new Error('Thiếu id học phí');
    const url = withApiV1(`/api/fees/${id}`);
    try {
        const res = await http.put(url, payload, {
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

// POST /api/v1/api/fees/payment
export async function payFee(payload) {
    const url = withApiV1('/api/fees/payment');
    const body = {
        ...payload,
        paymentDate: payload.paymentDate ? toIsoDate(payload.paymentDate) : null
    };
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

// GET /api/v1/api/fees/{id}
export async function fetchFeeById(id) {
    if (!id) throw new Error('Thiếu id học phí');
    const url = withApiV1(`/api/fees/${id}`);
    try {
        const res = await http.get(url);
        return getData(res) || null;
    } catch (e) {
        throw new Error(getErr(e, 'Không thể tải chi tiết học phí'));
    }
}

// GET /api/v1/api/fees/student/{studentId}
export async function fetchFeesByStudent(studentId) {
    if (!studentId) throw new Error('Thiếu studentId');
    const url = withApiV1(`/api/fees/student/${studentId}`);
    try {
        const res = await http.get(url);
        return getData(res) || [];
    } catch (e) {
        throw new Error(getErr(e, 'Không thể tải học phí theo học sinh'));
    }
}

// GET /api/v1/api/fees/class/{classId}
export async function fetchFeesByClass(classId) {
    if (!classId) throw new Error('Thiếu classId');
    const url = withApiV1(`/api/fees/class/${classId}`);
    try {
        const res = await http.get(url);
        return getData(res) || [];
    } catch (e) {
        throw new Error(getErr(e, 'Không thể tải học phí theo lớp'));
    }
}

// GET /api/v1/api/fees/semester?semester&year
export async function fetchFeesBySemester({ semester, year }) {
    const url = withApiV1('/api/fees/semester');
    try {
        const res = await http.get(url, { params: cleanParams({ semester, year }) });
        return getData(res) || [];
    } catch (e) {
        throw new Error(getErr(e, 'Không thể tải học phí theo kỳ học'));
    }
}

// GET /api/v1/api/fees/class/{classId}/semester?semester&year
export async function fetchFeesByClassAndSemesterYear({ classId, semester, year }) {
    if (!classId) throw new Error('Thiếu classId');
    const url = withApiV1(`/api/fees/class/${classId}/semester`);
    try {
        const res = await http.get(url, { params: cleanParams({ semester, year }) });
        return getData(res) || [];
    } catch (e) {
        throw new Error(getErr(e, 'Không thể tải học phí theo lớp & kỳ'));
    }
}

// GET /api/v1/api/fees/summary?classId&semester&year
export async function fetchFeeSummary({ classId, semester, year }) {
    const url = withApiV1('/api/fees/summary');
    try {
        const res = await http.get(url, {
            params: cleanParams({ classId, semester, year })
        });
        return getData(res) || null;
    } catch (e) {
        throw new Error(getErr(e, 'Không thể tải thống kê học phí'));
    }
}

// DELETE /api/v1/api/fees/{id}
export async function deleteFee(id) {
    if (!id) throw new Error('Thiếu id học phí');
    const url = withApiV1(`/api/fees/${id}`);
    try {
        const res = await http.delete(url);
        return getData(res) || true;
    } catch (e) {
        throw new Error(getErr(e, 'Xóa học phí thất bại'));
    }
}

// POST /api/v1/api/fees/update-overdue
export async function updateOverdueFees() {
    const url = withApiV1('/api/fees/update-overdue');
    try {
        const res = await http.post(url);
        return getData(res) || null;
    } catch (e) {
        throw new Error(getErr(e, 'Cập nhật học phí quá hạn thất bại'));
    }
}

// GET /api/v1/api/fees/semesters
export async function fetchAvailableSemesters() {
    const url = withApiV1('/api/fees/semesters');
    try {
        const res = await http.get(url);
        return getData(res) || [];
    } catch (e) {
        throw new Error(getErr(e, 'Không thể tải danh sách kỳ học'));
    }
}

// GET /api/v1/api/fees/years
export async function fetchAvailableYears() {
    const url = withApiV1('/api/fees/years');
    try {
        const res = await http.get(url);
        return getData(res) || [];
    } catch (e) {
        throw new Error(getErr(e, 'Không thể tải danh sách năm học'));
    }
}

/* ========== Excel template + import ========== */

// GET /api/v1/api/fees/template
export async function downloadFeeTemplate() {
    const url = withApiV1('/api/fees/template');
    try {
        const res = await http.get(url, { responseType: 'blob' });
        return res.data;
    } catch (e) {
        throw new Error(getErr(e, 'Không thể tải file mẫu học phí'));
    }
}

// POST /api/v1/api/fees/excel (multipart/form-data)
export async function createFeesFromExcel({ file, semester, feeYear, dueDate }) {
    if (!file) throw new Error('Chưa chọn file Excel');
    const url = withApiV1('/api/fees/excel');
    const formData = new FormData();
    formData.append('file', file);
    if (semester) formData.append('semester', semester);
    if (feeYear) formData.append('feeYear', feeYear);
    if (dueDate) formData.append('dueDate', toDMY(dueDate)); // dd-MM-yyyy

    try {
        const res = await http.post(url, formData);
        return getData(res) || [];
    } catch (e) {
        throw new Error(getErr(e, 'Import học phí từ Excel thất bại'));
    }
}

/* ========== Minh chứng & xác nhận ========== */

// POST /api/v1/api/fees/proof (multipart/form-data)
export async function submitFeeProof({ feeId, file, note }) {
    if (!feeId || !file) throw new Error('Thiếu feeId hoặc file minh chứng');
    const url = withApiV1('/api/fees/proof');
    const formData = new FormData();
    formData.append('feeId', feeId);
    formData.append('proofImage', file);
    if (note) formData.append('note', note);

    try {
        const res = await http.post(url, formData);
        return getData(res) || null;
    } catch (e) {
        throw new Error(getErr(e, 'Nộp minh chứng học phí thất bại'));
    }
}

// POST /api/v1/api/fees/verify
export async function verifyFeePayment(payload) {
    const url = withApiV1('/api/fees/verify');
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

// GET /api/v1/api/fees/waiting-verification
export async function fetchFeesWaitingVerification() {
    const url = withApiV1('/api/fees/waiting-verification');
    try {
        const res = await http.get(url);
        return getData(res) || [];
    } catch (e) {
        throw new Error(getErr(e, 'Không thể tải học phí chờ xác nhận'));
    }
}

// GET /api/v1/api/fees/my-fees  (cho phụ huynh – token gắn sẵn ở http)
export async function fetchMyFees() {
    const url = withApiV1('/api/fees/my-fees');
    try {
        const res = await http.get(url);
        return getData(res) || [];
    } catch (e) {
        throw new Error(getErr(e, 'Không thể tải học phí của phụ huynh'));
    }
}
