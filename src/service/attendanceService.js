import http from '@/service/http.js';

/* Helper: tự thêm /api/v1 nếu baseURL chưa có */
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

/* Map BE -> FE 1 dòng danh sách */
function mapRow(r) {
    return {
        studentId: r.studentId ?? r.id,
        studentName: r.studentName ?? r.fullName ?? r.name ?? '',
        className: r.className ?? r.classCode ?? r.clazz ?? '',
        status: r.status ?? null,
        checkedBy: r.checkedBy ?? r.checkBy ?? '',
        checkTime: r.checkTime ?? null,
        note: r.note ?? ''
    };
}

/**
 * GET /attendance/list?classId=&date=yyyy-MM-dd&status=&keyword=
 */
export async function fetchAttendanceList({ classId, date, status, keyword }) {
    const params = {
        classId,
        date: typeof date === 'string' ? date : toYMD(date)
    };
    if (status && status !== 'ALL') params.status = status;
    if (keyword) params.keyword = keyword;

    const url = withApiV1('/attendance/list');
    const res = await http.get(url, { params });
    const raw = Array.isArray(res?.data?.data) ? res.data.data : Array.isArray(res?.data) ? res.data : [];
    return raw.map(mapRow);
}

/**
 * Cập nhật trạng thái 1 học sinh trong ngày
 * BE Service có AttendanceUpdateStatusRequest:
 * { studentId, classId, date (LocalDate), status (enum), note, checkedBy }
 *
 * Controller chưa public endpoint trong snippet, giả định:
 * - Primary: POST /attendance/update
 * - Fallback: POST /attendance/update-status | /attendance/check | /attendance/status
 */
export async function updateAttendanceStatus({ studentId, classId, date, status, note, checkedBy }) {
    const body = {
        studentId,
        classId,
        date: typeof date === 'string' ? date : toYMD(date),
        status,
        note: note ?? '',
        checkedBy
    };

    const candidates = [withApiV1('/attendance/update'), withApiV1('/attendance/update-status'), withApiV1('/attendance/check'), withApiV1('/attendance/status')];

    let lastErr;
    for (const url of candidates) {
        try {
            const res = await http.post(url, body, { headers: { Accept: 'application/json' } });
            return res?.data?.data ?? true;
        } catch (e) {
            lastErr = e;
            if ([404, 405].includes(e?.response?.status)) continue; // thử endpoint khác nếu chưa khai báo controller
            break;
        }
    }
    const msg = lastErr?.response?.data?.message || lastErr?.response?.data?.error || lastErr?.message || 'Cập nhật điểm danh thất bại';
    throw new Error(msg);
}
