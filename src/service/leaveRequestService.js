// src/service/leaveRequestService.js
import http from '@/service/http.js';

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

/* =========================================================
 * 1. API GIÁO VIÊN – LeaveRequestService (BE)
 *    - GET  /leave-requests/teachers/classes/{classId}/pending
 *    - PATCH /leave-requests/teachers/{requestId}/approve
 *    - PATCH /leave-requests/teachers/{requestId}/reject
 *
 *  Backend sẽ:
 *    - Lấy teacher từ token (Authorization)
 *    - Kiểm tra teacher có dạy classId đó không
 * =======================================================*/

/** Lấy danh sách đơn xin nghỉ CHỜ DUYỆT theo lớp (giáo viên) */
export async function fetchPendingLeaveRequestsByClass(classId) {
    if (!classId) throw new Error('Thiếu classId');
    const url = withApiV1(`/leave-requests/teachers/classes/${classId}/pending`);
    try {
        const res = await http.get(url);
        // BE trả ApiResponse<List<LeaveRequestResponse>>
        return res?.data?.data || res?.data || [];
    } catch (err) {
        if (err?.response?.status === 401) {
            throw new Error(
                'Không có quyền truy cập (401). Vui lòng đăng nhập lại hoặc kiểm tra token.'
            );
        }
        throw new Error(getErrMsg(err, 'Lấy danh sách đơn xin nghỉ thất bại'));
    }
}

/**
 * Duyệt đơn xin nghỉ
 * @param requestId  ID đơn xin nghỉ
 * @param teacherName  Tên GV (BE đang nhận qua param, bạn có thể lấy từ store auth)
 * @param teacherNote  Ghi chú giáo viên
 */
export async function approveLeaveRequest(
    requestId,
    teacherName,
    teacherNote = ''
) {
    if (!requestId) throw new Error('Thiếu requestId');
    const url = withApiV1(`/leave-requests/teachers/${requestId}/approve`);
    try {
        const res = await http.patch(
            url,
            { teacherNote },
            {
                params: { teacherName }
            }
        );
        // BE trả ApiResponse<LeaveRequestResponse>
        return res?.data?.data || res?.data || null;
    } catch (err) {
        throw new Error(getErrMsg(err, 'Duyệt đơn xin nghỉ thất bại'));
    }
}

/**
 * Từ chối đơn xin nghỉ
 */
export async function rejectLeaveRequest(
    requestId,
    teacherName,
    teacherNote = ''
) {
    if (!requestId) throw new Error('Thiếu requestId');
    const url = withApiV1(`/leave-requests/teachers/${requestId}/reject`);
    try {
        const res = await http.patch(
            url,
            { teacherNote },
            {
                params: { teacherName }
            }
        );
        // BE trả ApiResponse<LeaveRequestResponse>
        return res?.data?.data || res?.data || null;
    } catch (err) {
        throw new Error(getErrMsg(err, 'Từ chối đơn xin nghỉ thất bại'));
    }
}

/* =========================================================
 * 2. (OPTIONAL) API PHỤ HUYNH – Nếu sau này bạn cần
 *    - createLeaveRequest (POST)
 *    - getLeaveRequestsByParent (GET)
 *    - cancelLeaveRequest (PATCH)
 *    Có thể bổ sung sau cho Quasar mobile.
 * =======================================================*/
