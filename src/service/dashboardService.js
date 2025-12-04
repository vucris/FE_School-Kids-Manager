// src/service/dashboardService.js
import { fetchClasses } from '@/service/classService.js';
import { fetchStudents } from '@/service/studentService.js';
import { fetchTeachers } from '@/service/teacherService.js'; // 🔁 đúng tên file service giáo viên của bạn
import { fetchParents } from '@/service/parentService.js';

/** Lấy tháng (1..12) từ string ngày bất kỳ */
function getMonthFromDateStr(value) {
    if (!value) return null;
    const s = String(value).trim();

    // yyyy-MM-dd
    let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) return Number(m[2]);

    // dd-MM-yyyy hoặc dd/MM/yyyy
    m = s.match(/^(\d{2})[/-](\d{2})[/-](\d{4})/);
    if (m) return Number(m[2]);

    const d = new Date(s);
    return Number.isNaN(d.getTime()) ? null : d.getMonth() + 1;
}

/** 👉 Dùng cho Trang-Chu.vue */
export async function fetchDashboardStats() {
    // 1. Lấy lớp, học sinh, giáo viên song song
    const [classesRes, studentsRes, teachersRes] = await Promise.all([
        fetchClasses({ page: 1, size: 99999 }),
        fetchStudents({ page: 1, size: 99999, status: 'all' }),
        fetchTeachers({ page: 1, size: 99999 })
    ]);

    const classes = classesRes.items || [];
    const students = studentsRes.items || [];
    const teachers = teachersRes.items || [];

    const totalClasses = classesRes.total ?? classes.length;
    const totalStudents = studentsRes.total ?? students.length;
    const totalTeachers = teachersRes.total ?? teachers.length;

    // 2. Tổng phụ huynh: ưu tiên lấy từ parentService (fetchParents)
    let totalParents = 0;
    try {
        const parentsRes = await fetchParents({ page: 1, size: 99999 });
        const parents = parentsRes.items || [];
        totalParents = parentsRes.total ?? parentsRes.counts?.total ?? parents.length;
    } catch (err) {
        console.warn(
            '[dashboard] fetchParents lỗi, fallback từ danh sách học sinh:',
            err?.message || err
        );

        // Fallback: đếm parentId duy nhất trong mảng students (không làm văng lỗi)
        const set = new Set();
        for (const s of students) {
            const pid = s.parentId ?? s.parent_id ?? s.parent?.id ?? null;
            if (pid != null) set.add(pid);
        }
        totalParents = set.size;
    }

    // 3. Học sinh mới trong tháng hiện tại (nếu sau này bạn muốn dùng)
    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const newStudentsThisMonth = students.filter((s) => {
        if (!s.enrollmentDate) return false;
        return getMonthFromDateStr(s.enrollmentDate) === currentMonth;
    }).length;

    return {
        classes: totalClasses,
        students: totalStudents,
        teachers: totalTeachers,
        parents: totalParents,        // 👈 Trang-Chu.vue đang dùng giá trị này
        newStudentsThisMonth
    };
}

/** Dùng cho block "Sinh nhật tháng 10" */
export async function fetchBirthdaySummaryForMonth(month) {
    const targetMonth = Number(month);

    const [studentsRes, teachersRes] = await Promise.all([
        fetchStudents({ page: 1, size: 99999, status: 'all' }),
        fetchTeachers({ page: 1, size: 99999 })
    ]);

    const students = studentsRes.items || [];
    const teachers = teachersRes.items || [];

    const studentsCount = students.filter((s) =>
        getMonthFromDateStr(s.dob || s.dateOfBirth) === targetMonth
    ).length;

    // tạm coi "staff" = giáo viên có sinh nhật trong tháng
    const staffCount = teachers.filter((t) =>
        getMonthFromDateStr(t.dateOfBirth || t.dob) === targetMonth
    ).length;

    return {
        students: studentsCount,
        staff: staffCount
    };
}
