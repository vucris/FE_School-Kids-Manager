// Demo service cho "Đơn xin nghỉ học"
// Sau này bạn chỉ cần chỉnh lại URL & method cho khớp BE thật.

import http from '@/service/http.js';

/**
 * Lấy danh sách đơn xin nghỉ học
 * @param {Object} params
 *  - classId?: number
 *  - status?: 'NEW' | 'APPROVED' | 'REJECTED' | 'CANCELLED'
 *  - keyword?: string (tên HS / PH)
 *  - fromDate?: 'yyyy-MM-dd'
 *  - toDate?: 'yyyy-MM-dd'
 */
export async function fetchLeaveRequests(params = {}) {
    // DEMO: trả về dữ liệu giả để view hoạt động trước
    // Khi có API thật, thay bằng:
    // const res = await http.get('/api/v1/leave-requests', { params });
    // return res.data?.data || res.data || [];

    return Promise.resolve([
        {
            id: 1,
            studentId: 101,
            studentName: 'Nguyễn Văn A',
            parentName: 'Nguyễn Văn B',
            classId: 1,
            className: 'Koala 1',
            fromDate: '2025-11-18',
            toDate: '2025-11-18',
            reason: 'Học sinh bị sốt cao, xin nghỉ 1 ngày để theo dõi sức khỏe.',
            status: 'NEW',
            createdAt: '2025-11-17T22:10:00Z',
            processedBy: null
        },
        {
            id: 2,
            studentId: 102,
            studentName: 'Trần Thị B',
            parentName: 'Trần Văn C',
            classId: 1,
            className: 'Koala 1',
            fromDate: '2025-11-15',
            toDate: '2025-11-16',
            reason: 'Gia đình có việc bận về quê.',
            status: 'APPROVED',
            createdAt: '2025-11-14T12:00:00Z',
            processedBy: 'admin'
        }
    ]);
}

/**
 * Cập nhật trạng thái đơn xin nghỉ
 * @param {number} id
 * @param {Object} payload
 *  - status: 'NEW' | 'APPROVED' | 'REJECTED' | 'CANCELLED'
 *  - processedBy?: string
 */
export async function updateLeaveRequestStatus(id, payload) {
    // DEMO: chỉ log ra console
    // Khi có API thật, thay bằng:
    // const res = await http.put(`/api/v1/leave-requests/${id}/status`, payload);
    // return res.data;

    console.log('updateLeaveRequestStatus DEMO', { id, payload });
    return Promise.resolve({ success: true });
}
