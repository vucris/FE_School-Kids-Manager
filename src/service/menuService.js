import http from '@/service/http.js';

function withApiV1(path) {
    const base = (http?.defaults?.baseURL || '').toLowerCase();
    return base.includes('/api/v1') ? path : `/api/v1${path}`;
}

/* YYYY-MM-DD */
export function toYMD(d) {
    if (!d) return undefined;
    const dd = d instanceof Date ? d : new Date(d);
    if (Number.isNaN(dd)) return undefined;
    const yyyy = dd.getFullYear();
    const mm = String(dd.getMonth() + 1).padStart(2, '0');
    const day = String(dd.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${day}`;
}

/**
 * POST /menu/dishes
 * body: string[] dishNames
 * return: Array<{id:number, dishName:string}>
 */
export async function createMenuDishes(dishNames = []) {
    const url = withApiV1('/menu/dishes');
    try {
        const res = await http.post(url, dishNames, {
            headers: { 'Content-Type': 'application/json', Accept: 'application/json' }
        });
        return res?.data?.data || [];
    } catch (e) {
        throw new Error(e?.response?.data?.message || 'Tạo danh sách món thất bại');
    }
}

/**
 * POST /menu/create-weekly
 * MenuRequest {
 *  classId, startDate(LocalDate), endDate(LocalDate), createdBy,
 *  items: [{ dayOfWeek (vi), mealType (vi), dishIds: number[] }]
 * }
 */
export async function createWeeklyMenu(payload) {
    const url = withApiV1('/menu/create-weekly');
    const body = {
        classId: payload.classId,
        startDate: typeof payload.startDate === 'string' ? payload.startDate : toYMD(payload.startDate),
        endDate: typeof payload.endDate === 'string' ? payload.endDate : toYMD(payload.endDate),
        createdBy: payload.createdBy || 'system',
        items: (payload.items || []).map((i) => ({
            dayOfWeek: i.dayOfWeek, // "Thứ 2"...
            mealType: i.mealType, // "Sáng"/"Trưa"/"Xế chiều"/"Phụ sáng"
            dishIds: Array.isArray(i.dishIds) ? i.dishIds : []
        }))
    };
    try {
        const res = await http.post(url, body, { headers: { Accept: 'application/json' } });
        return res?.data?.data || res?.data;
    } catch (e) {
        throw new Error(e?.response?.data?.message || 'Tạo thực đơn tuần thất bại');
    }
}

/**
 * GET /menu/weekly?classId&startDate&endDate
 * returns MenuResponse or null (404)
 */
export async function getWeeklyMenu({ classId, startDate, endDate }) {
    const url = withApiV1('/menu/weekly');
    const params = {
        classId,
        startDate: typeof startDate === 'string' ? startDate : toYMD(startDate),
        endDate: typeof endDate === 'string' ? endDate : toYMD(endDate)
    };
    try {
        const res = await http.get(url, { params });
        return res?.data?.data || res?.data || null;
    } catch (e) {
        if (e?.response?.status === 404) return null;
        throw new Error(e?.response?.data?.message || 'Lỗi lấy thực đơn tuần');
    }
}

/**
 * PUT /menu/weekly/{menuId}
 */
export async function updateWeeklyMenu(menuId, payload) {
    const url = withApiV1(`/menu/weekly/${menuId}`);
    const body = {
        classId: payload.classId,
        startDate: typeof payload.startDate === 'string' ? payload.startDate : toYMD(payload.startDate),
        endDate: typeof payload.endDate === 'string' ? payload.endDate : toYMD(payload.endDate),
        createdBy: payload.createdBy || 'system',
        items: (payload.items || []).map((i) => ({
            dayOfWeek: i.dayOfWeek,
            mealType: i.mealType,
            dishIds: Array.isArray(i.dishIds) ? i.dishIds : []
        }))
    };
    try {
        const res = await http.put(url, body, { headers: { Accept: 'application/json' } });
        return res?.data?.data || res?.data;
    } catch (e) {
        throw new Error(e?.response?.data?.message || 'Cập nhật thực đơn thất bại');
    }
}
