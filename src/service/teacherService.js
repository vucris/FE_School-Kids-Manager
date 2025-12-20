import http from '@/service/http.js';
import * as XLSX from 'xlsx'; // ✅ FE tự tạo Excel (template + export)

/* Helper thêm /api/v1 nếu baseURL chưa có */
function withApiV1(path) {
    const base = (http?.defaults?.baseURL || '').toLowerCase();
    return base.includes('/api/v1') ? path : `/api/v1${path}`;
}

/* Helper lấy message lỗi đẹp hơn */
function getErrMsg(err, fallback) {
    return err?.response?.data?.message || err?.response?.data?.error || err?.message || fallback;
}

/* ================== MAPPING DỮ LIỆU ================== */
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
        emergencyContact: raw.emergencyContact, // optional
        dateOfBirth: raw.dateOfBirth,
        joinDate: raw.joinDate,
        avatarUrl: raw.avatarUrl,
        status: raw.isBlocked === true ? 'locked' : 'active',
        role: 'Giáo viên'
    };
}

/* ================== HÀM DÙNG NỘI BỘ ================== */

async function fetchAllTeachersRaw() {
    const url = withApiV1('/teachers/all');
    try {
        const res = await http.get(url);
        return res?.data?.data || res?.data || [];
    } catch (err) {
        throw new Error(getErrMsg(err, 'Lấy danh sách giáo viên thất bại'));
    }
}

/**
 * Ghi chú: XLSX community không hỗ trợ styling màu ổn định như ExcelJS.
 * Tuy nhiên vẫn có thể set:
 *  - độ rộng cột (!cols)
 *  - freeze panes (!freeze)
 *  - autofilter (!autofilter)
 *  - comment vào cell (tùy viewer)
 */
function setSheetCols(ws, cols) {
    ws['!cols'] = cols;
}
function setFreeze(ws, row = 1, col = 0) {
    ws['!freeze'] = {
        xSplit: col,
        ySplit: row,
        topLeftCell: XLSX.utils.encode_cell({ r: row, c: col })
    };
}
function setAutoFilter(ws, rangeA1) {
    ws['!autofilter'] = { ref: rangeA1 };
}
function addCellComment(ws, r, c, text) {
    const addr = XLSX.utils.encode_cell({ r, c });
    ws[addr] = ws[addr] || { t: 's', v: '' };
    ws[addr].c = ws[addr].c || [];
    ws[addr].c.push({ a: 'Hệ thống', t: String(text) });
}

function normalizeHeaderCell(v) {
    return String(v || '')
        .trim()
        .toLowerCase()
        .replace(/\(\*\)/g, '')
        .replace(/\s+/g, ' ');
}

function sheetLooksLikeTeacherImport(ws) {
    const aoa = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false });
    if (!aoa?.length) return false;

    const headerRow = (aoa[0] || []).map(normalizeHeaderCell);

    // Chỉ cần chứa các keyword quan trọng (do header có thể dài)
    const mustContain = [
        'họ và tên',
        'email',
        'số điện thoại',
        'giới tính',
        'ngày sinh',
        'chuyên môn',
        'ngày vào làm',
        'liên hệ khẩn cấp'
    ];

    return mustContain.every((k) => headerRow.some((h) => h.includes(k)));
}

/**
 * ✅ Chuẩn hoá file import:
 * - BE chỉ đọc sheet 0 => FE phải đảm bảo sheet dữ liệu là sheet đầu tiên
 * - Nếu file user có nhiều sheet, FE sẽ tìm sheet "DuLieu" (ưu tiên) hoặc sheet có header đúng
 * - Tạo file .xlsx mới chỉ gồm 1 sheet tên "DuLieu" và gửi lên BE
 */
async function normalizeTeacherImportFile(file) {
    const ab = await file.arrayBuffer();
    const wb = XLSX.read(ab, { type: 'array' });

    // 1) Ưu tiên sheet tên DuLieu
    let dataSheetName =
        wb.SheetNames.find((n) => n.toLowerCase() === 'dulieu') ||
        wb.SheetNames.find((n) => n.toLowerCase().includes('dulieu'));

    // 2) Nếu không có, dò sheet có header phù hợp
    if (!dataSheetName) {
        for (const name of wb.SheetNames) {
            const ws = wb.Sheets[name];
            if (ws && sheetLooksLikeTeacherImport(ws)) {
                dataSheetName = name;
                break;
            }
        }
    }

    if (!dataSheetName) {
        throw new Error('Không tìm thấy sheet dữ liệu "DuLieu" trong file Excel.');
    }

    const dataWs = wb.Sheets[dataSheetName];
    const aoa = XLSX.utils.sheet_to_json(dataWs, { header: 1, raw: false });

    if (!aoa || aoa.length <= 1) {
        throw new Error('Sheet dữ liệu không có dòng dữ liệu để import.');
    }

    const newWb = XLSX.utils.book_new();
    const newWs = XLSX.utils.aoa_to_sheet(aoa);
    XLSX.utils.book_append_sheet(newWb, newWs, 'DuLieu');

    const out = XLSX.write(newWb, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([out], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    });

    return new File([blob], 'teachers_import.xlsx', { type: blob.type });
}

/* =========================================================
 * 1) LIST GIÁO VIÊN (ADMIN)
 * =======================================================*/
export async function fetchTeachers({ q, status = 'all', page = 1, size = 10, sort } = {}) {
    const rawList = await fetchAllTeachersRaw();
    let list = rawList.map(mapTeacher).filter(Boolean);

    if (q && String(q).trim()) {
        const keyword = String(q).toLowerCase().trim();
        list = list.filter((t) => {
            const name = t.name?.toLowerCase() || '';
            const email = t.email?.toLowerCase() || '';
            const phone = t.phone?.toLowerCase() || '';
            return name.includes(keyword) || email.includes(keyword) || phone.includes(keyword);
        });
    }

    if (status && status !== 'all') {
        list = list.filter((t) => t.status === status);
    }

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

    const total = list.length;
    const start = (page - 1) * size;
    const end = start + size;
    const items = list.slice(start, end);

    return { items, total };
}

/* =========================================================
 * 2) CRUD GIÁO VIÊN (ADMIN)
 * =======================================================*/

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
        return res?.data?.data ?? true;
    } catch (err) {
        throw new Error(getErrMsg(err, 'Cập nhật giáo viên thất bại'));
    }
}

export async function toggleTeacherStatus(teacherId) {
    if (!teacherId) throw new Error('Thiếu teacherId');
    const url = withApiV1(`/teachers/${teacherId}/toggle-status`);
    try {
        const res = await http.patch(url);
        return res?.data?.data ?? true;
    } catch (err) {
        throw new Error(getErrMsg(err, 'Đổi trạng thái giáo viên thất bại'));
    }
}

export async function importTeachersExcel(file) {
    if (!file) throw new Error('Vui lòng chọn file Excel');

    const lower = String(file.name || '').toLowerCase();
    if (!lower.endsWith('.xlsx')) {
        throw new Error('Vui lòng chọn đúng file Excel .xlsx');
    }

    // ✅ FE chuẩn hoá: lấy đúng sheet dữ liệu rồi tạo file mới chỉ có 1 sheet (DuLieu)
    let normalizedFile = file;
    try {
        normalizedFile = await normalizeTeacherImportFile(file);
    } catch (e) {
        // Nếu muốn bắt buộc đúng chuẩn thì throw luôn.
        // Ở đây mình throw để user biết file sai cấu trúc.
        throw new Error(e?.message || 'File Excel không đúng cấu trúc sheet dữ liệu.');
    }

    const url = withApiV1('/teachers/import');
    const formData = new FormData();
    formData.append('file', normalizedFile);

    try {
        const res = await http.post(url, formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
        });
        return res?.data?.data || res?.data || null;
    } catch (err) {
        throw new Error(getErrMsg(err, 'Nhập giáo viên từ Excel thất bại'));
    }
}

/* =========================================================
 * 3) EXCEL (FE TỰ TẠO) - KHÔNG CẦN ENDPOINT BE
 * =======================================================*/

export async function exportTeachersExcel() {
    try {
        const { items } = await fetchTeachers({ status: 'all', page: 1, size: 100000 });

        const headers = [
            'Mã GV',
            'Họ và tên',
            'Email',
            'Số điện thoại',
            'Giới tính',
            'Ngày sinh',
            'Chuyên môn',
            'Ngày vào làm',
            'Trạng thái'
        ];

        const rows = (items || []).map((t) => [
            t.employeeCode || '',
            t.name || '',
            t.email || '',
            t.phone || '',
            t.gender || '',
            t.dateOfBirth || '',
            t.specialization || '',
            t.joinDate || '',
            t.status === 'locked' ? 'Đã khóa' : 'Đang dạy'
        ]);

        const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
        setSheetCols(ws, [
            { wch: 14 },
            { wch: 24 },
            { wch: 28 },
            { wch: 16 },
            { wch: 10 },
            { wch: 14 },
            { wch: 18 },
            { wch: 18 },
            { wch: 12 }
        ]);
        setFreeze(ws, 1, 0);
        setAutoFilter(ws, `A1:I${Math.max(2, rows.length + 1)}`);

        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Teachers');

        XLSX.writeFile(wb, 'teachers.xlsx');
        return true;
    } catch (err) {
        throw new Error(getErrMsg(err, 'Xuất Excel giáo viên thất bại'));
    }
}

/**
 * ✅ File mẫu import giáo viên (có sheet dữ liệu + sheet hướng dẫn + sheet ví dụ)
 *
 * QUAN TRỌNG:
 * - BE đang đọc workbook.getSheetAt(0)
 * - Vì vậy sheet "DuLieu" PHẢI là sheet đầu tiên!
 */
export async function downloadTeachersImportTemplate() {
    try {
        // ========= Sheet HUONG_DAN =========
        const guide = [
            ['HƯỚNG DẪN IMPORT GIÁO VIÊN (FILE .XLSX)'],
            [''],
            ['1) File bắt buộc là .xlsx (Excel Workbook).'],
            ['2) Vui lòng nhập dữ liệu tại sheet "DuLieu". Không đổi thứ tự cột.'],
            ['3) Cột bắt buộc: Họ và tên, Email, Số điện thoại.'],
            ['4) Định dạng ngày hỗ trợ: dd-MM-yyyy hoặc dd/MM/yyyy hoặc yyyy-MM-dd hoặc ô Date của Excel.'],
            ['5) Username/Password được hệ thống tự tạo:'],
            ['   - Username = phần trước dấu @ của Email'],
            ['   - Password mặc định = 123456'],
            ['6) Mã nhân viên (employeeCode) tự sinh, không cần nhập trong Excel.'],
            ['7) Không trùng Email / Số điện thoại / Username.']
        ];
        const wsGuide = XLSX.utils.aoa_to_sheet(guide);
        setSheetCols(wsGuide, [{ wch: 90 }]);
        setFreeze(wsGuide, 1, 0);

        // ========= Sheet DuLieu (để nhập) =========
        const headers = [
            'Họ và tên (*)',
            'Email (*)',
            'Số điện thoại (*)',
            'Giới tính (Nam/Nữ)',
            'Ngày sinh (dd-MM-yyyy)',
            'Chuyên môn',
            'Ngày vào làm (dd-MM-yyyy)',
            'Liên hệ khẩn cấp'
        ];
        const wsData = XLSX.utils.aoa_to_sheet([headers]);
        setSheetCols(wsData, [
            { wch: 24 },
            { wch: 28 },
            { wch: 16 },
            { wch: 16 },
            { wch: 18 },
            { wch: 20 },
            { wch: 18 },
            { wch: 18 }
        ]);
        setFreeze(wsData, 1, 0);
        setAutoFilter(wsData, 'A1:H1');

        const exampleRows = [
            headers,
            [
                'Nguyễn Thị Lan',
                'lan.gv01@test.com',
                '0912345678',
                'Nữ',
                '15-03-1992',
                'Giáo viên Mầm',
                '01-08-2024',
                '0987654321'
            ],
            [
                'Trần Văn Minh',
                'minh.gv02@test.com',
                '0987654322',
                'Nam',
                '22-11-1990',
                'Giáo viên Chồi',
                '15-08-2023',
                '0909090909'
            ]
        ];
        const wsExample = XLSX.utils.aoa_to_sheet(exampleRows);
        setSheetCols(wsExample, wsData['!cols']);
        setFreeze(wsExample, 1, 0);
        setAutoFilter(wsExample, `A1:H${exampleRows.length}`);

        // ========= Workbook =========
        const wb = XLSX.utils.book_new();

        // ✅ QUAN TRỌNG: sheet DuLieu phải là sheet đầu tiên
        XLSX.utils.book_append_sheet(wb, wsData, 'DuLieu');
        XLSX.utils.book_append_sheet(wb, wsGuide, 'HUONG_DAN');
        XLSX.utils.book_append_sheet(wb, wsExample, 'ViDu');

        XLSX.writeFile(wb, 'mau_import_giao_vien.xlsx');
        return true;
    } catch (err) {
        throw new Error(getErrMsg(err, 'Tải file mẫu import giáo viên thất bại'));
    }
}

/* =========================================================
 * 4) API DÀNH CHO GIÁO VIÊN (ROLE TEACHER)
 * =======================================================*/

export async function fetchMyTeacherClasses() {
    const url = withApiV1('/teachers/my-classes');
    try {
        const res = await http.get(url);
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

export async function fetchTeacherClasses() {
    const raw = await fetchMyTeacherClasses();
    return raw.map((c) => ({
        id: c.id,
        className: c.className || c.name || c.class_code || '',
        grade: c.grade || c.gradeName || ''
    }));
}

export async function fetchMyTeacherClassDetail(classId) {
    if (!classId) throw new Error('Thiếu classId');
    const url = withApiV1(`/teachers/my-classes/${classId}`);
    try {
        const res = await http.get(url);
        return res?.data?.data || res?.data || null;
    } catch (err) {
        throw new Error(getErrMsg(err, 'Không lấy được thông tin chi tiết lớp cho giáo viên'));
    }
}

export async function fetchTeachersLite() {
    const { items } = await fetchTeachers({
        status: 'all',
        page: 1,
        size: 10000
    });

    return (items || []).map((t) => ({
        value: t.id,
        label: t.employeeCode ? `${t.name} (${t.employeeCode})` : t.name
    }));
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
        return res?.data ?? true;
    } catch (err) {
        throw new Error(getErrMsg(err, 'Tạo giáo viên thất bại'));
    }
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
