import http from '@/service/http.js';

/* Helper thêm /api/v1 nếu baseURL chưa có */
function withApiV1(path) {
    const base = (http?.defaults?.baseURL || '').toLowerCase();
    return base.includes('/api/v1') ? path : `/api/v1${path}`;
}

/** Tạo nhiều món ăn 1 lần (POST /menu/dishes) – body là mảng string */
export async function createMenuDishes(dishNames = []) {
    const url = withApiV1('/menu/dishes');
    try {
        const res = await http.post(url, dishNames, {
            headers: {
                'Content-Type': 'application/json',
                Accept: 'application/json'
            }
        });
        return res?.data?.data || res?.data;
    } catch (err) {
        throw new Error(err?.response?.data?.message || err?.response?.data?.error || err?.message || 'Tạo món ăn thất bại');
    }
}

/** Lấy tất cả món ăn (GET /menu/find-all-dishes) */
export async function fetchAllMenuDishes() {
    const url = withApiV1('/menu/find-all-dishes');
    try {
        const res = await http.get(url);
        return res?.data?.data || res?.data || [];
    } catch (err) {
        throw new Error(err?.response?.data?.message || err?.response?.data?.error || err?.message || 'Lấy danh sách món ăn thất bại');
    }
}

/** Tạo thực đơn tuần (POST /menu/create-weekly) */
export async function createWeeklyMenu(payload) {
    const url = withApiV1('/menu/create-weekly');
    try {
        const res = await http.post(url, payload, {
            headers: {
                'Content-Type': 'application/json',
                Accept: 'application/json'
            }
        });
        return res?.data?.data || res?.data;
    } catch (err) {
        throw new Error(err?.response?.data?.message || err?.response?.data?.error || err?.message || 'Tạo thực đơn tuần thất bại');
    }
}

/** Lấy thực đơn tuần theo classId + khoảng ngày (GET /menu/weekly) */
export async function fetchWeeklyMenu({ classId, startDate, endDate }) {
    if (!classId || !startDate || !endDate) {
        throw new Error('Thiếu classId hoặc ngày bắt đầu/kết thúc');
    }
    const url = withApiV1('/menu/weekly');
    try {
        const res = await http.get(url, {
            params: {
                classId,
                startDate, // BE đang dùng LocalDate, nên định dạng 'yyyy-MM-dd'
                endDate
            }
        });
        return res?.data?.data || res?.data || null;
    } catch (err) {
        // nếu NOT_FOUND -> không có menu tuần, trả null để FE hiểu
        if (err?.response?.status === 404) return null;
        throw new Error(err?.response?.data?.message || err?.response?.data?.error || err?.message || 'Lấy thực đơn tuần thất bại');
    }
}

/** Cập nhật thực đơn tuần (PUT /menu/weekly/{menuId}) – dùng sau nếu cần */
export async function updateWeeklyMenu(menuId, payload) {
    if (!menuId) throw new Error('Thiếu menuId');
    const url = withApiV1(`/menu/weekly/${menuId}`);
    try {
        const res = await http.put(url, payload, {
            headers: {
                'Content-Type': 'application/json',
                Accept: 'application/json'
            }
        });
        return res?.data?.data || res?.data;
    } catch (err) {
        throw new Error(err?.response?.data?.message || err?.response?.data?.error || err?.message || 'Cập nhật thực đơn tuần thất bại');
    }
}
