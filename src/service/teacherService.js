// src/service/teacherService.js
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

/* ================== MAPPING DỮ LIỆU ================== */
/**
 * Backend TeacherResponse (theo code bạn gửi):
 *  {
 *    id, fullName, email, phone, gender, specialization,
 *    employeeCode, dateOfBirth, joinDate, isBlocked, avatarUrl, emergencyContact?
 *  }
 *
 * FE đang dùng: name, status, role, ...
 */
function mapTeacher(raw) {
    if (!raw) return null;
    return {
        id: raw.id,
        name: raw.fullName,
        email: raw.email,
        phone: raw.phone,
        gender: raw.gender,
        specialization: raw.specialization,
        employeeCode: raw.employeeCode,
        emergencyContact: raw.emergencyContact,
        dateOfBirth: raw.dateOfBirth,
        joinDate: raw.joinDate,
        avatarUrl: raw.avatarUrl,

        // FE đang dùng status: 'active' | 'locked' | ... => map từ isBlocked
        status: raw.isBlocked === true ? 'locked' : 'active',
        role: 'Giáo viên'
    };
}

/* ================== HÀM DÙNG NỘI BỘ ================== */

async function fetchAllTeachersRaw() {
    const url = withApiV1('/teachers/all');
    try {
        const res = await http.get(url);
        // BE trả ApiResponse<List<TeacherResponse>>
        return res?.data?.data || res?.data || [];
    } catch (err) {
        throw new Error(getErrMsg(err, 'Lấy danh sách giáo viên thất bại'));
    }
}

/* =========================================================
 * 1. LIST GIÁO VIÊN (ADMIN) – dùng cho TeacherManagement.vue
 *    View đang gọi: fetchTeachers({ q, status, page, size, sort })
 *    → Mình xử lý filter/sort/paging ở FE từ /teachers/all
 * =======================================================*/

/**
 * fetchTeachers: trả về { items, total }
 * params:
 *   - q: chuỗi search (tên / email / phone)
 *   - status: 'all' | 'active' | 'locked' | ...
 *   - page: 1-based
 *   - size: số dòng / trang
 *   - sort: dạng 'name,asc' | 'phone,desc'...
 */
export async function fetchTeachers({
    q,
    status = 'all',
    page = 1,
    size = 10,
    sort
} = {}) {
    // 1. Lấy toàn bộ từ BE
    const rawList = await fetchAllTeachersRaw();
    let list = rawList.map(mapTeacher).filter(Boolean);

    // 2. Filter theo q
    if (q && String(q).trim()) {
        const keyword = String(q).toLowerCase().trim();
        list = list.filter((t) => {
            const name = t.name?.toLowerCase() || '';
            const email = t.email?.toLowerCase() || '';
            const phone = t.phone?.toLowerCase() || '';
            return (
                name.includes(keyword) ||
                email.includes(keyword) ||
                phone.includes(keyword)
            );
        });
    }

    // 3. Filter theo status
    if (status && status !== 'all') {
        list = list.filter((t) => t.status === status);
    }

    // 4. Sort
    if (sort) {
        const [field, dir] = String(sort).split(',');
        const factor = dir === 'desc' ? -1 : 1;
        list = list.slice().sort((a, b) => {
            const va = (a[field] ?? '').toString().toLowerCase();
            const vb = (b[field] ?? '').toString().toLowerCase();
            if (va < vb) return -1 * factor;
            if (va > vb) return 1 * factor;
            return 0;
        });
    }

    // 5. Paging
    const total = list.length;
    const start = (page - 1) * size;
    const end = start + size;
    const items = list.slice(start, end);

    return { items, total };
}

/* =========================================================
 * 2. CRUD GIÁO VIÊN (ADMIN)
 *    - fetchTeacherById
 *    - updateTeacher
 *    - toggleTeacherStatus
 *    - importTeachersExcel
 *    - exportTeachersExcel
 *    - downloadTeachersImportTemplate
 * =======================================================*/

/** Lấy chi tiết 1 giáo viên theo ID */
export async function fetchTeacherById(teacherId) {
    if (!teacherId) throw new Error('Thiếu teacherId');
    const url = withApiV1(`/teachers/find/${teacherId}`);
    try {
        const res = await http.get(url);
        const raw = res?.data?.data || res?.data || null;
        return mapTeacher(raw);
    } catch (err) {
        throw new Error(getErrMsg(err, 'Lấy thông tin giáo viên thất bại'));
    }
}

/** Cập nhật thông tin giáo viên (ADMIN)
 *
 *  body TeacherRequest (BE):
 *  {
 *    username,
 *    password,
 *    fullName,
 *    email,
 *    phone,
 *    dateOfBirth,
 *    gender,
 *    specialization,
 *    employeeCode,
 *    emergencyContact
 *  }
 *
 *  FE hiện đang gửi editForm: { fullName, email, phone, gender, specialization, employeeCode, emergencyContact, dateOfBirth }
 */
export async function updateTeacher(teacherId, payload) {
    if (!teacherId) throw new Error('Thiếu teacherId');
    const url = withApiV1(`/teachers/update/${teacherId}`);
    try {
        const res = await http.put(url, payload, {
            headers: {
                'Content-Type': 'application/json',
                Accept: 'application/json'
            }
        });
        // BE trả ApiResponse<String>
        return res?.data?.data ?? true;
    } catch (err) {
        throw new Error(getErrMsg(err, 'Cập nhật giáo viên thất bại'));
    }
}

/** Bật / tắt trạng thái hoạt động giáo viên (ADMIN)
 *  PATCH /teachers/{id}/toggle-status
 */
export async function toggleTeacherStatus(teacherId) {
    if (!teacherId) throw new Error('Thiếu teacherId');
    const url = withApiV1(`/teachers/${teacherId}/toggle-status`);
    try {
        const res = await http.patch(url);
        // BE trả ApiResponse<String>
        return res?.data?.data ?? true;
    } catch (err) {
        throw new Error(getErrMsg(err, 'Đổi trạng thái giáo viên thất bại'));
    }
}

/** Import giáo viên từ file Excel (ADMIN)
 *  POST /teachers/import
 *  formData field: "file"
 */
export async function importTeachersExcel(file) {
    if (!file) throw new Error('Vui lòng chọn file Excel');
    const url = withApiV1('/teachers/import');

    const formData = new FormData();
    formData.append('file', file);

    try {
        const res = await http.post(url, formData, {
            headers: {
                'Content-Type': 'multipart/form-data'
            }
        });
        // BE trả ApiResponse<ImportResultResponse>
        return res?.data?.data || res?.data || null;
    } catch (err) {
        throw new Error(getErrMsg(err, 'Nhập giáo viên từ Excel thất bại'));
    }
}

/** Xuất Excel danh sách giáo viên
 *  ⚠️ Cần BE có endpoint: GET /teachers/export
 */
export async function exportTeachersExcel() {
    const url = withApiV1('/teachers/export');
    try {
        const res = await http.get(url, { responseType: 'blob' });
        const blob = res.data;
        const downloadUrl = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = downloadUrl;
        a.download = 'teachers.xlsx';
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(downloadUrl);
        return true;
    } catch (err) {
        throw new Error(getErrMsg(err, 'Xuất Excel giáo viên thất bại'));
    }
}

/** Tải file Excel mẫu import giáo viên
 *  ⚠️ Cần BE có endpoint: GET /teachers/import-template
 */
export async function downloadTeachersImportTemplate() {
    const url = withApiV1('/teachers/import-template');
    try {
        const res = await http.get(url, { responseType: 'blob' });
        const blob = res.data;
        const downloadUrl = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = downloadUrl;
        a.download = 'teachers_import_template.xlsx';
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(downloadUrl);
        return true;
    } catch (err) {
        throw new Error(getErrMsg(err, 'Tải file mẫu import giáo viên thất bại'));
    }
}

/* =========================================================
 * 3. API DÀNH CHO GIÁO VIÊN (ROLE TEACHER)
 *    - GET /teachers/my-classes
 *    - GET /teachers/my-classes/{classId}
 *    Dùng cho màn đơn xin nghỉ, điểm danh,... để GIÁO VIÊN
 *    chỉ thấy lớp của chính mình.
 * =======================================================*/

/** Lấy danh sách lớp mà giáo viên đang đăng nhập phụ trách */
export async function fetchMyTeacherClasses() {
    const url = withApiV1('/teachers/my-classes');
    try {
        const res = await http.get(url);
        // BE trả ApiResponse<List<ClassResponse>>
        return res?.data?.data || res?.data || [];
    } catch (err) {
        throw new Error(
            getErrMsg(
                err,
                'Không lấy được danh sách lớp của giáo viên. Có thể phiên đăng nhập đã hết hạn.'
            )
        );
    }
}
export async function createTeacher(payload) {
    const url = withApiV1('/auth/register/teacher');
    try {
        const res = await http.post(url, payload, {
            headers: {
                'Content-Type': 'application/json',
                Accept: 'application/json'
            }
        });
        // AuthController trả String, nên lấy res.data là đủ
        return res?.data ?? true;
    } catch (err) {
        throw new Error(getErrMsg(err, 'Tạo giáo viên thất bại'));
    }
}
export async function fetchTeacherClasses() {
    const raw = await fetchMyTeacherClasses();
    return raw.map((c) => ({
        id: c.id,
        className: c.className || c.name || c.class_code || '',
        grade: c.grade || c.gradeName || ''
    }));
}

/** Lấy chi tiết 1 lớp của giáo viên đang đăng nhập */
export async function fetchMyTeacherClassDetail(classId) {
    if (!classId) throw new Error('Thiếu classId');
    const url = withApiV1(`/teachers/my-classes/${classId}`);
    try {
        const res = await http.get(url);
        // BE trả ApiResponse<ClassResponse>
        return res?.data?.data || res?.data || null;
    } catch (err) {
        throw new Error(
            getErrMsg(err, 'Không lấy được thông tin chi tiết lớp cho giáo viên')
        );
    }
}
export async function fetchTeachersLite() {
    // Lấy tối đa 10k GV, trường mầm non là đủ
    const { items } = await fetchTeachers({
        status: 'all',
        page: 1,
        size: 10000
    });

    return (items || []).map((t) => ({
        value: t.id,
        label: t.employeeCode
            ? `${t.name} (${t.employeeCode})`
            : t.name
    }));
}
export default {
    fetchTeachers,
    fetchTeacherById,
    updateTeacher,
    toggleTeacherStatus,
    importTeachersExcel,
    exportTeachersExcel,
    downloadTeachersImportTemplate,
    fetchMyTeacherClasses,
    fetchTeacherClasses,
    fetchMyTeacherClassDetail,
    fetchTeachersLite,
       createTeacher
};
