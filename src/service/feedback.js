// src/service/feedback.js
import http from '@/service/http.js';

/* Helper: tự thêm /api/v1 nếu baseURL chưa có */
function withApiV1(path) {
    const base = (http?.defaults?.baseURL || '').toLowerCase();
    return base.includes('/api/v1') ? path : `/api/v1${path}`;
}

/* Bỏ các param null/undefined/'' để query sạch hơn */
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
    return e?.response?.data?.message || e?.response?.data?.error || e?.message || fallback || 'Có lỗi xảy ra';
}

/**
 * SEARCH: GET /api/v1/feedbacks/search
 * params: { studentId?, classId?, status? }
 *  -> nếu không truyền param nào, BE sẽ trả tất cả (giống /all)
 */
export async function fetchFeedbacks(params = {}) {
    const url = withApiV1('/feedbacks/search');
    try {
        const res = await http.get(url, { params: cleanParams(params) });
        return getData(res) || [];
    } catch (e) {
        throw new Error(getErr(e, 'Không thể tải danh sách góp ý'));
    }
}

/**
 * GET ALL: GET /api/v1/feedbacks/all
 */
export async function fetchAllFeedbacks() {
    const url = withApiV1('/feedbacks/all');
    try {
        const res = await http.get(url);
        return getData(res) || [];
    } catch (e) {
        throw new Error(getErr(e, 'Không thể tải tất cả góp ý'));
    }
}

/**
 * GET BY ID: GET /api/v1/feedbacks/{id}
 */
export async function fetchFeedbackById(id) {
    if (!id) throw new Error('Thiếu id feedback');
    const url = withApiV1(`/feedbacks/${id}`);
    try {
        const res = await http.get(url);
        return getData(res) || null;
    } catch (e) {
        throw new Error(getErr(e, 'Không thể tải chi tiết góp ý'));
    }
}

/**
 * GET BY STUDENT: GET /api/v1/feedbacks/student/{studentId}
 */
export async function fetchFeedbacksByStudent(studentId) {
    if (!studentId) throw new Error('Thiếu studentId');
    const url = withApiV1(`/feedbacks/student/${studentId}`);
    try {
        const res = await http.get(url);
        return getData(res) || [];
    } catch (e) {
        throw new Error(getErr(e, 'Không thể tải góp ý theo học sinh'));
    }
}

/**
 * GET BY CLASS: GET /api/v1/feedbacks/class/{classId}
 */
export async function fetchFeedbacksByClass(classId) {
    if (!classId) throw new Error('Thiếu classId');
    const url = withApiV1(`/feedbacks/class/${classId}`);
    try {
        const res = await http.get(url);
        return getData(res) || [];
    } catch (e) {
        throw new Error(getErr(e, 'Không thể tải góp ý theo lớp'));
    }
}

/**
 * GET BY STATUS: GET /api/v1/feedbacks/status/{status}
 */
export async function fetchFeedbacksByStatus(status) {
    if (!status) throw new Error('Thiếu status');
    const url = withApiV1(`/feedbacks/status/${encodeURIComponent(status)}`);
    try {
        const res = await http.get(url);
        return getData(res) || [];
    } catch (e) {
        throw new Error(getErr(e, 'Không thể tải góp ý theo trạng thái'));
    }
}

/**
 * GET MY FEEDBACKS (cho phụ huynh):
 * GET /api/v1/feedbacks/my-feedbacks
 *  -> http instance đã gắn sẵn Authorization header (Bearer token)
 */
export async function fetchMyFeedbacks() {
    const url = withApiV1('/feedbacks/my-feedbacks');
    try {
        const res = await http.get(url);
        return getData(res) || [];
    } catch (e) {
        throw new Error(getErr(e, 'Không thể tải danh sách góp ý của bạn'));
    }
}

/**
 * CREATE: POST /api/v1/feedbacks/create
 * body = FeedbackRequest:
 * {
 *   studentCode,      // mã học sinh
 *   parentName?,      // nếu null BE tự lấy tên phụ huynh từ token
 *   messageDate,      // ISO datetime string (hoặc null, BE có thể set server time)
 *   messageTime?,     // "HH:mm" nếu muốn hiển thị riêng
 *   content,          // nội dung góp ý
 *   status?           // nếu null BE mặc định "PENDING"
 * }
 * Authorization header: BE bắt buộc, http.js nên tự gắn token
 */
export async function createFeedback(payload) {
    const url = withApiV1('/feedbacks/create');
    try {
        const res = await http.post(url, payload, {
            headers: {
                'Content-Type': 'application/json',
                Accept: 'application/json'
            }
        });
        return getData(res) || null;
    } catch (e) {
        throw new Error(getErr(e, 'Tạo góp ý thất bại'));
    }
}

/**
 * UPDATE FULL: PUT /api/v1/feedbacks/{id}
 * body = FeedbackRequest (có thể truyền 1 phần field để update)
 */
export async function updateFeedback(id, payload) {
    if (!id) throw new Error('Thiếu id feedback');
    const url = withApiV1(`/feedbacks/${id}`);
    try {
        const res = await http.put(url, payload, {
            headers: {
                'Content-Type': 'application/json',
                Accept: 'application/json'
            }
        });
        return getData(res) || null;
    } catch (e) {
        throw new Error(getErr(e, 'Cập nhật góp ý thất bại'));
    }
}

/**
 * UPDATE STATUS ONLY: PATCH /api/v1/feedbacks/{id}/status?status=...
 */
export async function updateFeedbackStatus(id, status) {
    if (!id) throw new Error('Thiếu id feedback');
    const url = withApiV1(`/feedbacks/${id}/status`);
    try {
        await http.patch(url, null, {
            params: { status },
            headers: {
                Accept: 'application/json'
            }
        });
        return true;
    } catch (e) {
        throw new Error(getErr(e, 'Không thể cập nhật trạng thái góp ý'));
    }
}

/**
 * DELETE: DELETE /api/v1/feedbacks/{id}
 */
export async function deleteFeedback(id) {
    if (!id) throw new Error('Thiếu id feedback');
    const url = withApiV1(`/feedbacks/${id}`);
    try {
        const res = await http.delete(url);
        return getData(res) || true;
    } catch (e) {
        throw new Error(getErr(e, 'Xóa góp ý thất bại'));
    }
}

/* optional: export default cho tiện import */
export default {
    fetchFeedbacks,
    fetchAllFeedbacks,
    fetchFeedbackById,
    fetchFeedbacksByStudent,
    fetchFeedbacksByClass,
    fetchFeedbacksByStatus,
    fetchMyFeedbacks,
    createFeedback,
    updateFeedback,
    updateFeedbackStatus,
    deleteFeedback
};
