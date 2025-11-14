import http from '@/service/http.js';

function withApiV1(path) {
  const base = (http?.defaults?.baseURL || '').toLowerCase();
  return base.includes('/api/v1') ? path : `/api/v1${path}`;
}

/**
 * Lấy danh sách góp ý từ BE.
 * Gợi ý endpoint: GET /api/v1/feedback
 * Có thể truyền params (classId, status, date...) nếu sau này bạn muốn filter server-side.
 */
export async function fetchFeedbacks(params = {}) {
  const url = withApiV1('/feedback');
  try {
    const res = await http.get(url, { params });
    // Nếu BE trả kiểu ApiResponse {status, message, data}
    return res?.data?.data || res?.data || [];
  } catch (e) {
    throw new Error(e?.response?.data?.message || 'Không thể tải danh sách góp ý');
  }
}

/**
 * Cập nhật trạng thái góp ý.
 * Gợi ý endpoint: PUT /api/v1/feedback/{id}/status
 * Body: { status: 'NEW' | 'PROCESSING' | 'CLOSED' }
 */
export async function updateFeedbackStatus(id, status) {
  const url = withApiV1(`/feedback/${id}/status`);
  try {
    await http.put(
      url,
      { status },
      { headers: { 'Content-Type': 'application/json', Accept: 'application/json' } }
    );
    return true;
  } catch (e) {
    throw new Error(e?.response?.data?.message || 'Không thể cập nhật trạng thái góp ý');
  }
}
