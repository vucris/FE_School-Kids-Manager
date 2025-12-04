// src/service/menuService.js
import http from '@/service/http.js';

/**
 * Helper: đảm bảo path có /api/v1 nếu baseURL chưa có.
 * - Nếu baseURL đã chứa "/api/v1" -> dùng path như truyền vào (ví dụ: "/menu/dishes")
 * - Nếu baseURL KHÔNG chứa "/api/v1" -> tự prepend "/api/v1" (ví dụ: "/api/v1/menu/dishes")
 */
function withApiV1(path) {
    const base = (http?.defaults?.baseURL || '').toLowerCase();
    const normalized = path.startsWith('/') ? path : `/${path}`;
    return base.includes('/api/v1') ? normalized : `/api/v1${normalized}`;
}

/** Helper lấy message lỗi đẹp hơn từ ApiResponse */
function getErrMsg(err, fallback) {
    return err?.response?.data?.message || err?.response?.data?.error || err?.message || fallback;
}

/* ======================= MÓN ĂN (MenuDish) ======================= */

/**
 * Tạo nhiều món ăn 1 lần
 * BE: POST /menu/dishes
 * Body: ["Cơm chiên", "Canh rau", ...]
 * Response: ApiResponse<List<MenuDish>>
 */
export async function createMenuDishes(dishNames = []) {
    const url = withApiV1('/menu/dishes');
    try {
        const res = await http.post(url, dishNames, {
            headers: {
                'Content-Type': 'application/json',
                Accept: 'application/json'
            }
        });
        return res?.data?.data || res?.data || [];
    } catch (err) {
        throw new Error(getErrMsg(err, 'Tạo món ăn thất bại'));
    }
}

/**
 * Lấy tất cả món ăn
 * BE: GET /menu/find-all-dishes
 * Response: ApiResponse<List<MenuDishResponse>>
 */
export async function fetchAllMenuDishes() {
    const url = withApiV1('/menu/find-all-dishes');
    try {
        const res = await http.get(url);
        return res?.data?.data || res?.data || [];
    } catch (err) {
        throw new Error(getErrMsg(err, 'Lấy danh sách món ăn thất bại'));
    }
}

/**
 * Sửa tên món ăn
 * BE: PUT /menu/dishes/{dishId}?newDishName=
 * - Không có body
 */
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

/**
 * Xóa món ăn
 * BE: DELETE /menu/dishes/{dishId}
 */
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

/* ======================= THỰC ĐƠN TUẦN (Menu) ======================= */

/**
 * Tạo thực đơn tuần
 * BE: POST /menu/create-weekly
 *
 * Payload (MenuRequest):
 * {
 *   classId: number,
 *   startDate: 'dd/MM/yyyy',
 *   endDate: 'dd/MM/yyyy',
 *   createdBy: 'Admin',
 *   items: [
 *     {
 *       dayOfWeek: 'Thứ 2',
 *       mealType: 'Sáng' | 'Trưa' | 'Chiều',
 *       dishIds: [1, 2, 3]
 *     },
 *     ...
 *   ]
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
 * Cập nhật thực đơn tuần
 * BE: PUT /menu/weekly/{menuId}
 * Body: MenuRequest (giống createWeeklyMenu)
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
 * Lấy thực đơn tuần theo lớp + khoảng ngày
 * BE: GET /menu/weekly?classId=&startDate=&endDate=
 *
 * - startDate / endDate: 'yyyy-MM-dd' (vì BE dùng LocalDate không @DateTimeFormat)
 * - Nếu không có menu -> BE trả 404 -> FE trả null
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
        if (err?.response?.status === 404) {
            // Không có thực đơn tuần cho khoảng này
            return null;
        }
        throw new Error(getErrMsg(err, 'Lấy thực đơn tuần thất bại'));
    }
}

/**
 * Lấy tất cả thực đơn của 1 lớp
 * BE: GET /menu/class/{classId}/all
 * Response: ApiResponse<List<MenuResponse>>
 */
export async function fetchMenusByClass(classId) {
    if (!classId) throw new Error('Thiếu classId');

    const url = withApiV1(`/menu/class/${classId}/all`);
    try {
        const res = await http.get(url);
        return res?.data?.data || res?.data || [];
    } catch (err) {
        throw new Error(getErrMsg(err, 'Lấy thực đơn theo lớp thất bại'));
    }
}

/**
 * Xóa 1 thực đơn tuần theo ID
 * BE: DELETE /menu/{menuId}
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
 * Xóa toàn bộ thực đơn trong khoảng thời gian của 1 lớp
 * BE: DELETE /menu/class/{classId}/date-range?startDate=dd/MM/yyyy&endDate=dd/MM/yyyy
 *
 * startDate / endDate: 'dd/MM/yyyy' (BE có @DateTimeFormat(pattern = "dd/MM/yyyy"))
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
