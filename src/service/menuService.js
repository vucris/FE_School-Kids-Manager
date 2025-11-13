import http from '@/service/http.js';

function withApiV1(path) {
    const base = (http?.defaults?.baseURL || '').toLowerCase();
    return base.includes('/api/v1') ? path : `/api/v1${path}`;
}

/* YYYY-MM-DD */
function toYMD(d) {
    if (!d) return undefined;
    const dd = d instanceof Date ? d : new Date(d);
    if (Number.isNaN(dd)) return undefined;
    const yyyy = dd.getFullYear();
    const mm = String(dd.getMonth() + 1).padStart(2, '0');
    const day = String(dd.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${day}`;
}

/* POST /menu/weekly/create */
export async function createWeeklyMenu(payload) {
    const url = withApiV1('/menu/weekly/create');
    const body = {
        classId: payload.classId,
        startDate: typeof payload.startDate === 'string' ? payload.startDate : toYMD(payload.startDate),
        endDate: typeof payload.endDate === 'string' ? payload.endDate : toYMD(payload.endDate),
        createdBy: payload.createdBy || 'system',
        items: (payload.items || []).map((i) => ({
            dayOfWeek: i.dayOfWeek,
            mealType: i.mealType,
            dishes: Array.isArray(i.dishes) ? i.dishes : []
        }))
    };
    const res = await http.post(url, body);
    return res?.data?.data || res?.data;
}

/* GET /menu/weekly?classId&startDate&endDate */
export async function getWeeklyMenu({ classId, startDate, endDate }) {
    const url = withApiV1('/menu/weekly');
    const params = {
        classId,
        startDate: typeof startDate === 'string' ? startDate : toYMD(startDate),
        endDate: typeof endDate === 'string' ? endDate : toYMD(endDate)
    };
    const res = await http.get(url, { params });
    return res?.data?.data || null; // 404 -> data=null theo BE
}

/* PUT /menu/update/{menuId} */
export async function updateWeeklyMenu(menuId, payload) {
    const url = withApiV1(`/menu/update/${menuId}`);
    const body = {
        classId: payload.classId,
        startDate: typeof payload.startDate === 'string' ? payload.startDate : toYMD(payload.startDate),
        endDate: typeof payload.endDate === 'string' ? payload.endDate : toYMD(payload.endDate),
        createdBy: payload.createdBy || 'system',
        items: (payload.items || []).map((i) => ({
            dayOfWeek: i.dayOfWeek,
            mealType: i.mealType,
            dishes: Array.isArray(i.dishes) ? i.dishes : []
        }))
    };
    const res = await http.put(url, body);
    return res?.data?.data || res?.data;
}

/* POST /menu/create (tạo 1 bữa đơn lẻ – item rời) */
export async function createMenuItem(item) {
    const url = withApiV1('/menu/create');
    const body = {
        dayOfWeek: item.dayOfWeek,
        mealType: item.mealType,
        dishes: Array.isArray(item.dishes) ? item.dishes : []
    };
    const res = await http.post(url, body);
    return res?.data?.data || res?.data;
}
