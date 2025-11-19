// src/service/menuService.js
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

/* ============ MÓN ĂN (MenuDish) ============ */

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
        // BE trả ApiResponse<List<MenuDish>>
        return res?.data?.data || res?.data || [];
    } catch (err) {
        throw new Error(getErrMsg(err, 'Tạo món ăn thất bại'));
    }
}

/** Lấy tất cả món ăn (GET /menu/find-all-dishes) */
export async function fetchAllMenuDishes() {
    const url = withApiV1('/menu/find-all-dishes');
    try {
        const res = await http.get(url);
        // BE trả ApiResponse<List<MenuDishResponse>>
        return res?.data?.data || res?.data || [];
    } catch (err) {
        throw new Error(getErrMsg(err, 'Lấy danh sách món ăn thất bại'));
    }
}

/** Sửa tên món ăn (PUT /menu/dishes/{dishId}?newDishName=) */
export async function updateMenuDish(dishId, newDishName) {
    if (!dishId) throw new Error('Thiếu dishId');
    if (!newDishName || !newDishName.trim()) {
        throw new Error('Tên món ăn không được để trống');
    }
    const url = withApiV1(`/menu/dishes/${dishId}`);
    try {
        const res = await http.put(url, null, {
            params: { newDishName: newDishName.trim() }
        });
        return res?.data?.data || res?.data || null;
    } catch (err) {
        throw new Error(getErrMsg(err, 'Cập nhật món ăn thất bại'));
    }
}

/** Xóa món ăn (DELETE /menu/dishes/{dishId}) */
export async function deleteMenuDish(dishId) {
    if (!dishId) throw new Error('Thiếu dishId');
    const url = withApiV1(`/menu/dishes/${dishId}`);
    try {
        const res = await http.delete(url);
        return res?.data?.data || res?.data || true;
    } catch (err) {
        throw new Error(getErrMsg(err, 'Xóa món ăn thất bại'));
    }
}

/* ============ THỰC ĐƠN TUẦN (Menu) ============ */

/**
 * Tạo thực đơn tuần (POST /menu/create-weekly)
 * payload: {
 *   classId,
 *   startDate: 'dd/MM/yyyy',
 *   endDate: 'dd/MM/yyyy',
 *   createdBy,
 *   items: [{ dayOfWeek, mealType, dishIds }]
 * }
 */
export async function createWeeklyMenu(payload) {
    const url = withApiV1('/menu/create-weekly');
    try {
        const res = await http.post(url, payload, {
            headers: {
                'Content-Type': 'application/json',
                Accept: 'application/json'
            }
        });
        return res?.data?.data || res?.data || null;
    } catch (err) {
        throw new Error(getErrMsg(err, 'Tạo thực đơn tuần thất bại'));
    }
}

/**
 * Cập nhật thực đơn tuần (PUT /menu/weekly/{menuId})
 * payload giống createWeeklyMenu (BE đang dùng MenuRequest)
 */
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
        return res?.data?.data || res?.data || null;
    } catch (err) {
        throw new Error(getErrMsg(err, 'Cập nhật thực đơn tuần thất bại'));
    }
}

/**
 * Lấy thực đơn tuần theo classId + khoảng ngày
 * GET /menu/weekly?classId=&startDate=&endDate=
 * startDate / endDate: 'yyyy-MM-dd'
 */
export async function fetchWeeklyMenu({ classId, startDate, endDate }) {
    if (!classId || !startDate || !endDate) {
        throw new Error('Thiếu classId hoặc ngày bắt đầu/kết thúc');
    }
    const url = withApiV1('/menu/weekly');
    try {
        const res = await http.get(url, {
            params: { classId, startDate, endDate }
        });
        return res?.data?.data || res?.data || null;
    } catch (err) {
        // nếu NOT_FOUND -> không có menu tuần, trả null để FE hiểu
        if (err?.response?.status === 404) return null;
        throw new Error(getErrMsg(err, 'Lấy thực đơn tuần thất bại'));
    }
}

/**
 * Lấy tất cả thực đơn của 1 lớp
 * GET /menu/class/{classId}/all
 */
export async function fetchMenusByClass(classId) {
    if (!classId) throw new Error('Thiếu classId');
    const url = withApiV1(`/menu/class/${classId}/all`);
    try {
        const res = await http.get(url);
        // BE trả ApiResponse<List<MenuResponse>>
        return res?.data?.data || res?.data || [];
    } catch (err) {
        throw new Error(getErrMsg(err, 'Lấy thực đơn theo lớp thất bại'));
    }
}

/**
 * Xóa 1 thực đơn tuần theo ID
 * DELETE /menu/{menuId}
 */
export async function deleteWeeklyMenu(menuId) {
    if (!menuId) throw new Error('Thiếu menuId');
    const url = withApiV1(`/menu/${menuId}`);
    try {
        const res = await http.delete(url);
        return res?.data?.data || res?.data || true;
    } catch (err) {
        throw new Error(getErrMsg(err, 'Xóa thực đơn tuần thất bại'));
    }
}

/**
 * Xóa thực đơn theo khoảng thời gian 1 lớp
 * DELETE /menu/class/{classId}/date-range?startDate=dd/MM/yyyy&endDate=dd/MM/yyyy
 */
export async function deleteMenuByDateRange(classId, startDate, endDate) {
    if (!classId || !startDate || !endDate) {
        throw new Error('Thiếu classId hoặc ngày bắt đầu/kết thúc');
    }
    const url = withApiV1(`/menu/class/${classId}/date-range`);
    try {
        const res = await http.delete(url, {
            params: { startDate, endDate }
        });
        return res?.data?.data || res?.data || true;
    } catch (err) {
        throw new Error(getErrMsg(err, 'Xóa thực đơn theo khoảng thời gian thất bại'));
    }
}
