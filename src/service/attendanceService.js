// src/service/attendanceService.js
import http from '@/service/http.js';

/* Helper: tự thêm /api/v1 nếu baseURL chưa có */
function withApiV1(path) {
  const base = (http?.defaults?.baseURL || '').toLowerCase();
  return base.includes('/api/v1') ? path : `/api/v1${path}`;
}

/* dd-MM-yyyy (khớp @DateTimeFormat / @JsonFormat ở BE) */
function toDMY(d) {
  if (!d) return undefined;
  const dt = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(dt)) return undefined;
  const dd = String(dt.getDate()).padStart(2, '0');
  const mm = String(dt.getMonth() + 1).padStart(2, '0');
  const yyyy = dt.getFullYear();
  return `${dd}-${mm}-${yyyy}`;
}

/* Map BE -> FE 1 dòng danh sách */
function mapRow(r) {
  return {
    studentId: r.studentId ?? r.id,
    studentName: r.studentName ?? r.fullName ?? r.name ?? '',
    className: r.className ?? r.classCode ?? r.clazz ?? '',

    // Điểm danh đến
    status: r.status ?? null,
    checkedBy: r.checkedBy ?? r.checkBy ?? '',
    checkTime: r.checkTime ?? null,
    note: r.note ?? '',

    // Điểm danh về
    checkOutStatus: r.checkOutStatus ?? null,
    checkOutBy: r.checkOutBy ?? '',
    checkOutTime: r.checkOutTime ?? null,
    checkOutNote: r.checkOutNote ?? ''
  };
}

/**
 * GET /attendance/list?classId=&date=dd-MM-yyyy&status=&keyword=
 */
export async function fetchAttendanceList({ classId, date, status, keyword }) {
  const params = {
    classId,
    date: typeof date === 'string' ? date : toDMY(date)
  };
  if (status && status !== 'ALL') params.status = status;
  if (keyword) params.keyword = keyword;

  const url = withApiV1('/attendance/list');
  const res = await http.get(url, { params });

  const raw = Array.isArray(res?.data?.data)
    ? res.data.data
    : Array.isArray(res?.data)
    ? res.data
    : [];

  return raw.map(mapRow);
}

/**
 * Cập nhật điểm danh HÀNG LOẠT
 * POST /attendance/bulk-update
 *
 * body = {
 *   classId,
 *   date,
 *   checkedBy,
 *   items: [
 *     { studentId, status?, note?, checkOutStatus?, checkOutNote? }
 *   ]
 * }
 *
 * Với màn "điểm danh đến" chỉ set status + note.
 * Với màn "điểm danh về" chỉ set checkOutStatus + checkOutNote.
 */
export async function bulkUpdateAttendance({ classId, date, checkedBy, items }) {
  const body = {
    classId,
    date: typeof date === 'string' ? date : toDMY(date),
    checkedBy,
    items: (items || []).map((i) => ({
      studentId: i.studentId,
      status: i.status ?? null,
      checkOutStatus: i.checkOutStatus ?? null,
      note: i.note ?? '',
      checkOutNote: i.checkOutNote ?? ''
    }))
  };

  const url = withApiV1('/attendance/bulk-update');

  try {
    const res = await http.post(url, body, {
      headers: { Accept: 'application/json' }
    });

    if (res?.data?.status && res.data.status !== 200) {
      throw new Error(res.data.message || 'Cập nhật điểm danh thất bại');
    }

    return res?.data?.data ?? true;
  } catch (e) {
    const msg =
      e?.response?.data?.message ||
      e?.response?.data?.error ||
      e?.message ||
      'Cập nhật điểm danh thất bại';
    throw new Error(msg);
  }
}

/**
 * Điểm danh ĐẾN cho 1 học sinh – dùng riêng nếu cần
 * POST /attendance/check-in
 */
export async function updateAttendanceStatus({
  studentId,
  classId,
  date,
  status,
  note,
  checkedBy
}) {
  const body = {
    studentId,
    classId,
    date: typeof date === 'string' ? date : toDMY(date),
    status,
    note: note ?? '',
    checkedBy
  };

  const url = withApiV1('/attendance/check-in');

  try {
    const res = await http.post(url, body, {
      headers: { Accept: 'application/json' }
    });

    if (res?.data?.status && res.data.status !== 200) {
      throw new Error(res.data.message || 'Cập nhật điểm danh đến thất bại');
    }

    return res?.data?.data ?? true;
  } catch (e) {
    const msg =
      e?.response?.data?.message ||
      e?.response?.data?.error ||
      e?.message ||
      'Cập nhật điểm danh đến thất bại';
    throw new Error(msg);
  }
}

/**
 * Điểm danh VỀ cho 1 học sinh – nếu muốn gọi từng học sinh
 * POST /attendance/check-out
 */
export async function updateAttendanceCheckOut({
  studentId,
  classId,
  date,
  checkOutStatus,
  checkOutNote,
  checkedBy
}) {
  const body = {
    studentId,
    classId,
    date: typeof date === 'string' ? date : toDMY(date),
    checkOutStatus,
    checkOutNote: checkOutNote ?? '',
    checkedBy
  };

  const url = withApiV1('/attendance/check-out');

  try {
    const res = await http.post(url, body, {
      headers: { Accept: 'application/json' }
    });

    if (res?.data?.status && res.data.status !== 200) {
      throw new Error(res.data.message || 'Cập nhật điểm danh về thất bại');
    }

    return res?.data?.data ?? true;
  } catch (e) {
    const msg =
      e?.response?.data?.message ||
      e?.response?.data?.error ||
      e?.message ||
      'Cập nhật điểm danh về thất bại';
    throw new Error(msg);
  }
}

/** Thống kê lớp trong 1 ngày */
export async function fetchAttendanceSummary({ classId, date }) {
  const params = {
    classId,
    date: typeof date === 'string' ? date : toDMY(date)
  };
  const url = withApiV1('/attendance/summary');
  const res = await http.get(url, { params });
  return res?.data?.data ?? res?.data ?? null;
}

/** Lịch sử điểm danh 1 học sinh */
export async function fetchAttendanceHistory({ studentId, startDate, endDate }) {
  const params = {
    startDate: typeof startDate === 'string' ? startDate : toDMY(startDate),
    endDate: typeof endDate === 'string' ? endDate : toDMY(endDate)
  };
  const url = withApiV1(`/attendance/history/${studentId}`);
  const res = await http.get(url, { params });
  const raw = Array.isArray(res?.data?.data)
    ? res.data.data
    : Array.isArray(res?.data)
    ? res.data
    : [];
  return raw.map(mapRow);
}
