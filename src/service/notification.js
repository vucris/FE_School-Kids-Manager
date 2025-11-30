// src/service/notification.js
import http from '@/service/http.js';

function withApiV1(path) {
    const base = (http?.defaults?.baseURL || '').toLowerCase();
    return base.includes('/api/v1') ? path : `/api/v1${path}`;
}

/** Xoá field null / undefined / '' khỏi params */
function cleanParams(obj = {}) {
    const q = { ...obj };
    Object.keys(q).forEach((k) => {
        if (q[k] === null || q[k] === undefined || q[k] === '') {
            delete q[k];
        }
    });
    return q;
}

/** Lấy data chuẩn từ ApiResponse<T> hoặc res.data */
function getData(res) {
    if (!res) return null;
    if (res.data && typeof res.data === 'object' && 'data' in res.data) {
        return res.data.data;
    }
    return res.data;
}

/** Lấy message lỗi */
function getErr(e, fallback) {
    return e?.response?.data?.message || e?.response?.data?.error || e?.message || fallback || 'Có lỗi xảy ra';
}

/* ================== APIs ================== */

/** Lấy danh sách thông báo chưa đọc cho 1 tài khoản (phụ huynh / GV / admin) */
export async function fetchUnreadNotifications(recipientId) {
    if (!recipientId) throw new Error('Thiếu recipientId');
    const url = withApiV1('/notifications/unread');
    try {
        const res = await http.get(url, {
            params: cleanParams({ recipientId })
        });
        return getData(res) || [];
    } catch (e) {
        throw new Error(getErr(e, 'Không thể lấy thông báo chưa đọc'));
    }
}

/** Lấy danh sách thông báo dành cho admin (bao gồm cả recipient = null) */
export async function fetchAdminNotifications(adminId) {
    if (!adminId) throw new Error('Thiếu adminId');
    const url = withApiV1('/notifications/admin');
    try {
        const res = await http.get(url, {
            params: cleanParams({ adminId })
        });
        return getData(res) || [];
    } catch (e) {
        throw new Error(getErr(e, 'Không thể lấy thông báo admin'));
    }
}

/** Đánh dấu 1 thông báo đã đọc */
export async function markNotificationAsRead({ notificationId, recipientId }) {
    if (!notificationId) throw new Error('Thiếu notificationId');
    if (!recipientId) throw new Error('Thiếu recipientId');

    const url = withApiV1(`/notifications/${notificationId}/read`);
    try {
        const res = await http.patch(url, null, {
            params: cleanParams({ recipientId })
        });
        return getData(res) || null;
    } catch (e) {
        throw new Error(getErr(e, 'Không thể đánh dấu đã đọc'));
    }
}

/** Đánh dấu tất cả thông báo của 1 tài khoản là đã đọc */
export async function markAllNotificationsAsRead(recipientId) {
    if (!recipientId) throw new Error('Thiếu recipientId');
    const url = withApiV1('/notifications/mark-all-read');
    try {
        const res = await http.patch(url, null, {
            params: cleanParams({ recipientId })
        });
        return getData(res) || null;
    } catch (e) {
        throw new Error(getErr(e, 'Không thể đánh dấu tất cả đã đọc'));
    }
}

/** Lấy số lượng thông báo chưa đọc cho 1 tài khoản */
export async function fetchUnreadNotificationCount(recipientId) {
    if (!recipientId) throw new Error('Thiếu recipientId');
    const url = withApiV1('/notifications/unread-count');
    try {
        const res = await http.get(url, {
            params: cleanParams({ recipientId })
        });
        return getData(res) || 0;
    } catch (e) {
        throw new Error(getErr(e, 'Không thể lấy số lượng thông báo chưa đọc'));
    }
}

export default {
    fetchUnreadNotifications,
    fetchAdminNotifications,
    markNotificationAsRead,
    markAllNotificationsAsRead,
    fetchUnreadNotificationCount
};
