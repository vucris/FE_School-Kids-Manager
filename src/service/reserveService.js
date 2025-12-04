// Demo service cho "Đơn xin bảo lưu"
// Sau này bạn chỉ cần chỉnh lại URL & method cho khớp BE thật.

import http from '@/service/http.js';

/**
 * Lấy danh sách đơn bảo lưu
 * @param {Object} params
 *  - classId?: number
 *  - status?: 'NEW' | 'APPROVED' | 'REJECTED' | 'EXPIRED'
 *  - keyword?: string
 *  - fromDate?: 'yyyy-MM-dd'
 *  - toDate?: 'yyyy-MM-dd'
 */
export async function fetchReserveRequests(params = {}) {
    // DEMO: trả về dữ liệu giả
    // Khi có API thật, thay bằng:
    // const res = await http.get('/api/v1/reserve-requests', { params });
    // return res.data?.data || res.data || [];

    return Promise.resolve([
        {
            id: 11,
            studentId: 201,
            studentName: 'Lê Văn C',
            parentName: 'Lê Văn D',
            classId: 2,
            className: 'Panda 2',
            fromDate: '2025-12-01',
            toDate: '2026-02-28',
            reason: 'Gia đình chuyển công tác tạm thời, xin bảo lưu 3 tháng.',
            status: 'NEW',
            createdAt: '2025-11-10T09:00:00Z',
            processedBy: null
        },
        {
            id: 12,
            studentId: 202,
            studentName: 'Phạm Thị D',
            parentName: 'Phạm Văn E',
            classId: 2,
            className: 'Panda 2',
            fromDate: '2025-10-01',
            toDate: '2025-12-31',
            reason: 'Học sinh về quê chăm ông bà, xin bảo lưu đến hết kỳ.',
            status: 'APPROVED',
            createdAt: '2025-09-25T08:30:00Z',
            processedBy: 'admin'
        }
    ]);
}

/**
 * Cập nhật trạng thái đơn bảo lưu
 * @param {number} id
 * @param {Object} payload
 *  - status: 'NEW' | 'APPROVED' | 'REJECTED' | 'EXPIRED'
 *  - processedBy?: string
 */
export async function updateReserveRequestStatus(id, payload) {
    // DEMO: chỉ log ra console
    // Khi có API thật, thay bằng:
    // const res = await http.put(`/api/v1/reserve-requests/${id}/status`, payload);
    // return res.data;

    console.log('updateReserveRequestStatus DEMO', { id, payload });
    return Promise.resolve({ success: true });
}
