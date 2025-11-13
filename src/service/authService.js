import http from '@/service/http.js';

/* Trích xuất username từ nhiều kiểu object user khác nhau */
export function getUsernameFromUser(user) {
    if (!user) return undefined;
    const u =
        user.username ||
        user.user?.username ||
        user.account?.username ||
        user.login ||
        user.code ||
        user.full_name || // phòng khi BE trả full_name làm mã đăng nhập
        user.fullName ||
        user.name ||
        (user.email ? String(user.email).split('@')[0] : undefined) ||
        user.phone;
    return u ? String(u) : undefined;
}

/* Lấy username từ localStorage (auth_user) hoặc JWT (access_token) */
export function getCurrentUsername() {
    try {
        const raw = localStorage.getItem('auth_user');
        if (raw) {
            const obj = JSON.parse(raw);
            const u = getUsernameFromUser(obj);
            if (u) return u;
        }
    } catch {}

    try {
        const token = localStorage.getItem('access_token') || localStorage.getItem('token');
        if (token && token.split('.').length === 3) {
            const payload = JSON.parse(atob(token.split('.')[1]));
            const u = payload?.preferred_username || payload?.username || (payload?.email ? String(payload.email).split('@')[0] : undefined) || payload?.sub;
            if (u) return String(u);
        }
    } catch {}

    return undefined;
}

/* Nếu có /auth/me thì dùng để lấy username chính xác từ BE */
export async function fetchCurrentUsername() {
    try {
        const base = (http?.defaults?.baseURL || '').toLowerCase();
        const url = base.includes('/api/v1') ? '/auth/me' : '/api/v1/auth/me';
        const res = await http.get(url);
        const data = res?.data?.data || res?.data;
        const u = getUsernameFromUser(data);
        return u || undefined;
    } catch {
        return undefined;
    }
}
