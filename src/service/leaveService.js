// src/service/leaveRequestService.js
import http from '@/service/http.js';

const WITH_CREDENTIALS = (import.meta.env.VITE_WITH_CREDENTIALS ?? 'true') === 'true';

/* Helper thêm /api/v1 nếu baseURL chưa có */
function withApiV1(path) {
    const base = (http?.defaults?.baseURL || '').toLowerCase();
    return base.includes('/api/v1') ? path : `/api/v1${path}`;
}

/* Helper lấy message lỗi đẹp hơn */
function getErrMsg(err, fallback) {
    return (
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        err?.message ||
        fallback
    );
}

/* ====================== PARENT APIs ====================== */
/**
 * PARENT – Gửi đơn xin nghỉ
 * POST /leave-requests/parents
 * body: { studentId, leaveDate (yyyy-MM-dd), reason }
 */
export async function createLeaveRequest(payload) {
    const url = withApiV1('/leave-requests/parents');
    try {
        const res = await http.post(url, payload, {
            withCredentials: WITH_CREDENTIALS
        });
        return res?.data?.data || res?.data || null;
    } catch (err) {
        throw new Error(getErrMsg(err, 'Gửi đơn xin nghỉ thất bại'));
    }
}

/**
 * PARENT – Lấy danh sách đơn xin nghỉ của phụ huynh hiện tại
 * GET /leave-requests/parents
 */
export async function fetchLeaveRequestsOfParent() {
    const url = withApiV1('/leave-requests/parents');
    try {
        const res = await http.get(url, {
            withCredentials: WITH_CREDENTIALS
        });
        return res?.data?.data || res?.data || [];
    } catch (err) {
        throw new Error(getErrMsg(err, 'Lấy danh sách đơn xin nghỉ thất bại'));
    }
}

/**
 * PARENT – Hủy đơn xin nghỉ
 * PATCH /leave-requests/parents/{requestId}/cancel
 */
export async function cancelLeaveRequest(requestId) {
    if (!requestId) throw new Error('Thiếu requestId');
    const url = withApiV1(`/leave-requests/parents/${requestId}/cancel`);
    try {
        const res = await http.patch(
            url,
            {},
            {
                withCredentials: WITH_CREDENTIALS
            }
        );
        return res?.data || null;
    } catch (err) {
        throw new Error(getErrMsg(err, 'Hủy đơn xin nghỉ thất bại'));
    }
}

/* ====================== TEACHER APIs ====================== */

/**
 * TEACHER – Lấy danh sách đơn PENDING theo lớp
 * GET /leave-requests/teachers/classes/{classId}/pending
 */
export async function fetchPendingLeaveRequestsByClass(classId) {
    if (!classId) throw new Error('Thiếu classId');
    const url = withApiV1(`/leave-requests/teachers/classes/${classId}/pending`);
    try {
        const res = await http.get(url, {
            withCredentials: WITH_CREDENTIALS
        });
        return res?.data?.data || res?.data || [];
    } catch (err) {
        throw new Error(getErrMsg(err, 'Lấy danh sách đơn xin nghỉ chờ duyệt thất bại'));
    }
}

/**
 * TEACHER – Duyệt đơn xin nghỉ
 * PATCH /leave-requests/teachers/{requestId}/approve?teacherName=
 * body: { teacherNote }
 */
export async function approveLeaveRequest(requestId, teacherName, teacherNote = '') {
    if (!requestId) throw new Error('Thiếu requestId');
    if (!teacherName) throw new Error('Thiếu teacherName');

    const url = withApiV1(`/leave-requests/teachers/${requestId}/approve`);

    try {
        const res = await http.patch(
            url,
            { teacherNote },
            {
                params: { teacherName },
                withCredentials: WITH_CREDENTIALS
            }
        );
        return res?.data?.data || res?.data || null;
    } catch (err) {
        throw new Error(getErrMsg(err, 'Duyệt đơn xin nghỉ thất bại'));
    }
}

/**
 * TEACHER – Từ chối đơn xin nghỉ
 * PATCH /leave-requests/teachers/{requestId}/reject?teacherName=
 * body: { teacherNote }
 */
export async function rejectLeaveRequest(requestId, teacherName, teacherNote = '') {
    if (!requestId) throw new Error('Thiếu requestId');
    if (!teacherName) throw new Error('Thiếu teacherName');

    const url = withApiV1(`/leave-requests/teachers/${requestId}/reject`);

    try {
        const res = await http.patch(
            url,
            { teacherNote },
            {
                params: { teacherName },
                withCredentials: WITH_CREDENTIALS
            }
        );
        return res?.data?.data || res?.data || null;
    } catch (err) {
        throw new Error(getErrMsg(err, 'Từ chối đơn xin nghỉ thất bại'));
    }
}
