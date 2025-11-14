import http from '@/service/http.js';

function withApiV1(path) {
  const base = (http?.defaults?.baseURL || '').toLowerCase();
  return base.includes('/api/v1') ? path : `/api/v1${path}`;
}

/**
 * Lấy danh sách bài viết / thông báo.
 * BE gợi ý endpoint:
 *   GET /api/v1/news
 * có thể hỗ trợ query param (classId, category, fromDate, toDate, keyword...)
 */
export async function fetchNews(params = {}) {
  const url = withApiV1('/news');
  try {
    const res = await http.get(url, { params });
    // Tuỳ BE, có thể là res.data.data hoặc res.data
    return res?.data?.data || res?.data || [];
  } catch (e) {
    throw new Error(e?.response?.data?.message || 'Không thể tải danh sách bài viết');
  }
}

/**
 * Đánh dấu 1 bài viết là đã đọc.
 * BE gợi ý:
 *   PATCH /api/v1/news/{id}/read
 */
export async function markNewsAsRead(id) {
  const url = withApiV1(`/news/${id}/read`);
  try {
    await http.patch(url);
    return true;
  } catch (e) {
    throw new Error(e?.response?.data?.message || 'Không thể cập nhật trạng thái đã đọc');
  }
}
