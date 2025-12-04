<script setup>
import { ref, computed, onMounted } from 'vue';
import '@fortawesome/fontawesome-free/css/all.min.css';
import Chart from 'primevue/chart';
import Dropdown from 'primevue/dropdown';
import { useRouter } from 'vue-router';

import { fetchDashboardStats, fetchBirthdaySummaryForMonth } from '@/service/dashboardService.js';
import { fetchAllMenuDishes } from '@/service/menuService.js';
import { fetchAttendanceSummary } from '@/service/attendanceService.js';
import { fetchClassOptions } from '@/service/classService.js';
import { fetchFeeSummary, fetchAvailableSemesters, fetchAvailableYears } from '@/service/fee.js';
import { fetchFeedbacksByStatus } from '@/service/feedback.js';

/* ========== STATE ========== */

const router = useRouter();

const schoolName = ref('Mầm non Canada Maple Bear');
const academicYear = ref('2024 - 2025');

/** 4 thẻ thống kê – KHÔNG còn số mẫu, khởi tạo 0 hết */
const stats = ref([
    { key: 'classes', label: 'Tổng số lớp', value: 0, icon: 'fa-solid fa-school', bg: 'bg-blue-100', fg: 'text-blue-600' },
    { key: 'students', label: 'Tổng số học sinh', value: 0, icon: 'fa-solid fa-children', bg: 'bg-emerald-100', fg: 'text-emerald-600' },
    { key: 'teachers', label: 'Tổng số giáo viên', value: 0, icon: 'fa-solid fa-person-chalkboard', bg: 'bg-amber-100', fg: 'text-amber-600' },
    { key: 'parents', label: 'Tổng số phụ huynh', value: 0, icon: 'fa-solid fa-people-group', bg: 'bg-cyan-100', fg: 'text-cyan-600' }
]);

/** Cache lớp để dùng cho điểm danh & học phí */
const classOptions = ref([]); // [{ id, name }]

/** Hoạt động: dùng state để có thể cập nhật từ API + gắn link */
const activities = ref([
    {
        key: 'menuToday',
        label: 'Thực đơn ngày',
        value: '0 món',
        icon: 'fa-solid fa-utensils',
        routeName: 'MenuFeature'
    },
    {
        key: 'newStudentsThisMonth',
        label: 'Học sinh mới trong tháng',
        value: '0',
        icon: 'fa-solid fa-user-graduate',
        routeName: 'QLHocSinh'
    }
    // Nếu sau này muốn thêm “Báo cáo điểm danh hôm nay” thì push thêm 1 object ở đây
]);

/** Bảng "Kiểm duyệt" – có gắn key + routeName để điều hướng */
const review = ref([
    {
        key: 'leavePending',
        label: 'Đơn xin nghỉ chưa duyệt',
        value: 0,
        accent: 'text-red-500',
        routeName: 'leaveRequest'
    },
    {
        key: 'feedbackPending',
        label: 'Góp ý chưa xử lý',
        value: 0,
        accent: 'text-yellow-600',
        routeName: 'feedbackInbox'
    },
    {
        key: 'albumPending',
        label: 'Album chưa kiểm duyệt',
        value: 0,
        accent: 'text-teal-600',
        routeName: 'AlbumManager'
    }
]);

/* ========== Helpers chung ========== */
const studentsCount = computed(() => stats.value.find((s) => s.key === 'students')?.value ?? 0);

const todayStr = computed(() => {
    const d = new Date();
    const weekdays = ['Chủ nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];
    return `${weekdays[d.getDay()]}, ${d.toLocaleDateString('vi-VN')}`;
});

function formatCurrency(value) {
    const n = Number(value || 0);
    return new Intl.NumberFormat('vi-VN').format(n) + ' đ';
}

/* ========== 1) Donut: Học sinh (trạng thái) ========== */
const studentStatusData = ref({
    labels: ['Đang đi học', 'Chờ phân lớp', 'Đã bảo lưu', 'Đã thôi học', 'Đã tốt nghiệp'],
    datasets: [
        {
            data: [0, 0, 0, 0, 0], // sẽ cập nhật từ API
            backgroundColor: ['#4C6EF5', '#8CE0FF', '#FFC857', '#EF4444', '#5AC8FA'],
            hoverBackgroundColor: ['#3B5BDB', '#74C7EC', '#FFB020', '#DC2626', '#38BDF8'],
            borderWidth: 0
        }
    ]
});

const doughnutOptionsRightLegend = {
    cutout: '60%',
    plugins: {
        legend: {
            position: 'right',
            labels: { usePointStyle: true, boxWidth: 10, padding: 16 }
        },
        tooltip: {
            callbacks: {
                label: (ctx) => `${ctx.label}: ${ctx.parsed}`
            }
        }
    },
    maintainAspectRatio: false,
    responsive: true
};

/* ========== 2) Điểm danh – tổng quan 1 lớp hôm nay ========== */

const attendanceData = ref({
    labels: ['Đi học', 'Nghỉ', 'Đi trễ', 'Về sớm', 'Chưa điểm danh'],
    datasets: [
        {
            data: [0, 0, 0, 0, 0],
            backgroundColor: ['#10b981', '#ef4444', '#f59e0b', '#0ea5e9', '#64748b'],
            hoverBackgroundColor: ['#059669', '#dc2626', '#d97706', '#0284c7', '#475569'],
            borderWidth: 0
        }
    ]
});

const attendanceSummary = ref(null);
const attendanceClass = ref(null);
const attendanceDate = ref(new Date());

/* ========== 3) Thu theo kỳ (học phí) ========== */

const feeOptions = ref([
    { label: 'Học phí Tháng 10', value: '2024-10' },
    { label: 'Học phí Tháng 9', value: '2024-09' }
]);
const selectedFee = ref(feeOptions.value[0]);

const feeData = ref({
    labels: ['Số đã thu', 'Số còn phải thu'],
    datasets: [{ data: [0, 0], backgroundColor: ['#3B82F6', '#BFDBFE'], borderWidth: 0 }]
});
const feeOptionsDonut = {
    cutout: '65%',
    plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: (ctx) => `${ctx.label}: ${formatCurrency(ctx.parsed)}` } }
    },
    maintainAspectRatio: false,
    responsive: true
};

const feeSummary = ref(null);
const feeTotalAmount = ref(0);
const feeCollectedAmount = ref(0);
const feeRemainingAmount = ref(0);
const feePercent = ref(0);

/* ========== 4) Sinh nhật tháng 10 ========== */
const birthdaysStudents = ref([]);
const birthdaysStaff = ref([]);

/* ========== Loading & Error ========== */
const loading = ref(false);
const errorMessage = ref(null);

/* ========== LOADERS RIÊNG ========== */

/** Lấy danh sách lớp (dùng chung cho điểm danh + học phí) */
async function ensureClassOptions() {
    if (classOptions.value.length) return;
    try {
        const opts = await fetchClassOptions(); // [{ value, label }]
        classOptions.value = (opts || []).map((o) => ({ id: o.value, name: o.label }));
    } catch (e) {
        console.warn('[Dashboard] Không tải được danh sách lớp:', e?.message || e);
    }
}

/** Hoạt động: Thực đơn ngày – tổng số món ăn */
async function loadMenuActivity() {
    try {
        const dishes = await fetchAllMenuDishes();
        const total = Array.isArray(dishes) ? dishes.length : 0;
        activities.value = activities.value.map((item) => (item.key === 'menuToday' ? { ...item, value: `${total} món` } : item));
    } catch (e) {
        console.warn('[Dashboard] loadMenuActivity lỗi:', e?.message || e);
    }
}

/** Điểm danh: lấy summary 1 lớp (lấy lớp đầu tiên) cho hôm nay */
async function loadAttendanceSummaryForDashboard() {
    try {
        await ensureClassOptions();
        const firstClass = classOptions.value[0];
        if (!firstClass) {
            console.warn('[Dashboard] Không có lớp để lấy báo cáo điểm danh');
            return;
        }
        attendanceClass.value = firstClass;

        const data = await fetchAttendanceSummary({
            classId: firstClass.id,
            date: attendanceDate.value
        });

        attendanceSummary.value = data || null;

        if (data) {
            attendanceData.value = {
                ...attendanceData.value,
                datasets: [
                    {
                        ...attendanceData.value.datasets[0],
                        data: [data.presentCount || 0, data.absentCount || 0, data.lateCount || 0, data.earlyLeaveCount || 0, data.undefinedCount || 0]
                    }
                ]
            };
        }
    } catch (e) {
        console.warn('[Dashboard] loadAttendanceSummaryForDashboard lỗi:', e?.message || e);
    }
}

/** Học phí: tổng hợp đã thu / còn phải thu cho 1 lớp, 1 kỳ, 1 năm */
async function loadFeeSummaryForDashboard() {
    try {
        await ensureClassOptions();
        const firstClass = classOptions.value[0];
        if (!firstClass) {
            console.warn('[Dashboard] Không có lớp để lấy tổng hợp học phí');
            return;
        }

        const [semesters, years] = await Promise.all([
            fetchAvailableSemesters().catch((e) => {
                console.warn('[Dashboard] fetchAvailableSemesters lỗi:', e?.message || e);
                return [];
            }),
            fetchAvailableYears().catch((e) => {
                console.warn('[Dashboard] fetchAvailableYears lỗi:', e?.message || e);
                return [];
            })
        ]);

        const semester = semesters?.[0];
        const year = years?.[0];

        if (!semester || !year) {
            console.warn('[Dashboard] Không có kỳ / năm để load học phí');
            return;
        }

        const summary = await fetchFeeSummary({
            classId: firstClass.id,
            semester,
            year
        });

        feeSummary.value = summary || null;

        if (summary) {
            const totalAmount = summary.totalAmount ?? summary.totalFee ?? 0;
            const collectedAmount = summary.collectedAmount ?? summary.paidAmount ?? 0;
            const remainingAmount = summary.remainingAmount ?? summary.unpaidAmount ?? Math.max(totalAmount - collectedAmount, 0);

            feeTotalAmount.value = totalAmount;
            feeCollectedAmount.value = collectedAmount;
            feeRemainingAmount.value = remainingAmount;
            feePercent.value = totalAmount > 0 ? Math.round((collectedAmount / totalAmount) * 100) : 0;

            feeData.value = {
                ...feeData.value,
                datasets: [
                    {
                        ...feeData.value.datasets[0],
                        data: [collectedAmount, remainingAmount]
                    }
                ]
            };
        }
    } catch (e) {
        console.warn('[Dashboard] loadFeeSummaryForDashboard lỗi:', e?.message || e);
    }
}

/** Kiểm duyệt: số góp ý PENDING */
async function loadFeedbackReview() {
    try {
        const pending = await fetchFeedbacksByStatus('PENDING');
        const count = Array.isArray(pending) ? pending.length : 0;
        review.value = review.value.map((item) => (item.key === 'feedbackPending' ? { ...item, value: count } : item));
    } catch (e) {
        console.warn('[Dashboard] loadFeedbackReview lỗi:', e?.message || e);
    }
}

/* ========== Load data từ API thực ========== */

async function loadDashboardBasic() {
    try {
        loading.value = true;
        errorMessage.value = null;

        const [statsRes, birthdayRes] = await Promise.all([
            fetchDashboardStats(),
            fetchBirthdaySummaryForMonth(10) // "Chúc mừng sinh nhật tháng 10"
        ]);

        console.log('Dashboard stats >>>', statsRes);
        console.log('Birthday summary >>>', birthdayRes);

        // Cập nhật 4 card: lớp, học sinh, giáo viên, phụ huynh
        stats.value = stats.value.map((card) => {
            if (card.key === 'classes') return { ...card, value: statsRes.classes ?? 0 };
            if (card.key === 'students') return { ...card, value: statsRes.students ?? 0 };
            if (card.key === 'teachers') return { ...card, value: statsRes.teachers ?? 0 };
            if (card.key === 'parents') return { ...card, value: statsRes.parents ?? 0 };
            return card;
        });

        // Donut trạng thái học sinh
        if (statsRes.studentStatusCounts) {
            const c = statsRes.studentStatusCounts;
            studentStatusData.value = {
                ...studentStatusData.value,
                datasets: [
                    {
                        ...studentStatusData.value.datasets[0],
                        data: [c.studying ?? 0, c.waiting ?? 0, c.reserved ?? 0, c.left ?? 0, c.graduated ?? 0]
                    }
                ]
            };
        } else {
            // fallback: chỉ cập nhật "Đang đi học" = tổng HS
            studentStatusData.value = {
                ...studentStatusData.value,
                datasets: [
                    {
                        ...studentStatusData.value.datasets[0],
                        data: [statsRes.students ?? 0, 0, 0, 0, 0]
                    }
                ]
            };
        }

        // Học sinh mới trong tháng ở block Hoạt động
        activities.value = activities.value.map((item) => {
            if (item.key === 'newStudentsThisMonth') {
                return { ...item, value: String(statsRes.newStudentsThisMonth ?? 0) };
            }
            return item;
        });

        // Sinh nhật tháng 10
        birthdaysStudents.value = Array.from({ length: birthdayRes.students }, (_, i) => ({ id: i + 1 }));
        birthdaysStaff.value = Array.from({ length: birthdayRes.staff }, (_, i) => ({ id: i + 100 }));

        // Load thêm các khối khác (không ảnh hưởng tới stats cơ bản nếu lỗi)
        await Promise.all([loadMenuActivity(), loadAttendanceSummaryForDashboard(), loadFeeSummaryForDashboard(), loadFeedbackReview()]);
    } catch (e) {
        console.error(e);
        errorMessage.value = e?.message || 'Không tải được dữ liệu trang chủ.';
    } finally {
        loading.value = false;
    }
}

/* ========== HANDLERS CLICK ========== */

function handleActivityClick(item) {
    if (item.routeName) {
        router.push({ name: item.routeName });
    }
}

function handleReviewClick(item) {
    if (item.routeName) {
        router.push({ name: item.routeName });
    }
}

onMounted(() => {
    loadDashboardBasic();
});
</script>

<template>
    <div class="p-6 space-y-6">
        <div v-if="loading" class="text-sm text-gray-500 mb-2">Đang tải dữ liệu tổng quan...</div>
        <div v-if="errorMessage" class="text-sm text-red-500 mb-2">{{ errorMessage }}</div>

        <!-- Tiêu đề -->
        <div class="flex flex-wrap justify-between items-center text-surface-900 dark:text-surface-0">
            <h1 class="text-2xl font-semibold">Dashboard</h1>
            <span class="text-primary font-medium text-lg">Năm học: {{ academicYear }}</span>
        </div>

        <!-- Thẻ thống kê -->
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-5">
            <div v-for="s in stats" :key="s.key" class="rounded-2xl bg-white dark:bg-surface-900 border border-surface-200 dark:border-surface-700 p-5 flex items-center gap-4 hover:shadow-md transition-all duration-200">
                <div :class="['w-14 h-14 flex items-center justify-center rounded-xl text-2xl', s.bg, s.fg]">
                    <i :class="s.icon"></i>
                </div>
                <div>
                    <p class="text-gray-500 dark:text-gray-400 text-sm">{{ s.label }}</p>
                    <h3 class="text-3xl font-semibold mt-1">{{ s.value }}</h3>
                </div>
            </div>
        </div>

        <!-- Bảng tin -->
        <div class="flex items-center gap-2 text-surface-700 dark:text-surface-300 mt-8">
            <i class="fa-solid fa-newspaper text-primary text-xl"></i>
            <h2 class="text-xl font-semibold">Bảng tin - {{ todayStr }}</h2>
        </div>

        <!-- Hai cột: Hoạt động | Kiểm duyệt -->
        <div class="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <!-- Hoạt động -->
            <section class="rounded-2xl bg-white dark:bg-surface-900 border border-surface-200 dark:border-surface-700 p-6 flex flex-col">
                <header class="flex items-center gap-2 mb-5 border-b border-surface-200 dark:border-surface-700 pb-3">
                    <i class="fa-solid fa-chart-line text-primary text-xl"></i>
                    <h3 class="text-xl font-semibold">Hoạt động</h3>
                </header>

                <ul class="flex-1 space-y-2">
                    <li
                        v-for="(item, idx) in activities"
                        :key="item.key || idx"
                        class="flex justify-between items-center bg-surface-50 dark:bg-surface-800 hover:bg-surface-100 dark:hover:bg-surface-700 rounded-xl px-4 py-3 cursor-pointer transition-all duration-200 shadow-sm hover:shadow-md"
                        @click="handleActivityClick(item)"
                    >
                        <div class="flex items-center gap-3">
                            <div class="w-9 h-9 flex items-center justify-center rounded-lg bg-primary-50 dark:bg-surface-700">
                                <i :class="[item.icon, 'text-primary-500 text-base']"></i>
                            </div>
                            <span class="text-sm font-medium text-gray-700 dark:text-gray-300">{{ item.label }}</span>
                        </div>
                        <div class="flex items-center gap-2">
                            <span class="font-semibold text-gray-900 dark:text-gray-100">{{ item.value }}</span>
                            <i class="fa-solid fa-chevron-right text-gray-400 text-xs"></i>
                        </div>
                    </li>
                </ul>
            </section>

            <!-- Kiểm duyệt -->
            <section class="rounded-2xl bg-white dark:bg-surface-900 border border-surface-200 dark:border-surface-700 p-6 flex flex-col">
                <header class="flex items-center gap-2 mb-5 border-b border-surface-200 dark:border-surface-700 pb-3">
                    <i class="fa-solid fa-list-check text-primary text-xl"></i>
                    <h3 class="text-xl font-semibold">Kiểm duyệt</h3>
                </header>

                <ul class="flex-1 divide-y divide-surface-200 dark:divide-surface-700">
                    <li
                        v-for="(r, idx) in review"
                        :key="r.key || idx"
                        class="flex justify-between items-center py-3 px-2 hover:bg-surface-100 dark:hover:bg-surface-800 rounded-lg transition-all duration-200 cursor-pointer"
                        @click="handleReviewClick(r)"
                    >
                        <span class="text-sm font-medium text-gray-700 dark:text-gray-300">{{ r.label }}</span>
                        <div class="flex items-center space-x-2">
                            <span :class="['font-semibold', r.accent]">{{ r.value }}</span>
                            <i class="fa-solid fa-angle-right text-gray-400 text-xs"></i>
                        </div>
                    </li>
                </ul>
            </section>
        </div>

        <!-- Cụm 1: Học sinh | Điểm danh -->
        <div class="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <section class="rounded-2xl bg-white dark:bg-surface-900 border border-surface-200 dark:border-surface-700 p-6">
                <header class="flex items-center justify-between mb-4">
                    <h3 class="text-xl font-semibold flex items-center gap-2">
                        <i class="fa-solid fa-user-graduate"></i>
                        {{ studentsCount }} Học sinh
                    </h3>
                    <i class="fa-solid fa-arrow-right text-primary"></i>
                </header>
                <div class="h-64">
                    <Chart type="doughnut" :data="studentStatusData" :options="doughnutOptionsRightLegend" />
                </div>
            </section>

            <section class="rounded-2xl bg-white dark:bg-surface-900 border border-surface-200 dark:border-surface-700 p-6">
                <header class="flex items-center justify-between mb-4">
                    <h3 class="text-xl font-semibold flex items-center gap-2">
                        <i class="fa-solid fa-calendar-check"></i>
                        <span v-if="attendanceSummary"> Điểm danh lớp {{ attendanceSummary.className }} ({{ attendanceSummary.totalStudents }} HS) </span>
                        <span v-else> Điểm danh {{ studentsCount }} học sinh </span>
                    </h3>
                    <i class="fa-solid fa-arrow-right text-primary"></i>
                </header>
                <div class="h-64">
                    <Chart type="doughnut" :data="attendanceData" :options="doughnutOptionsRightLegend" />
                </div>
            </section>
        </div>

        <!-- Cụm 3: Thu theo kỳ | Sinh nhật tháng 10 -->
        <div class="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <section class="rounded-2xl bg-white dark:bg-surface-900 border border-surface-200 dark:border-surface-700 p-6">
                <header class="flex items-center justify-between mb-4">
                    <h3 class="text-xl font-semibold flex items-center gap-2">
                        <i class="fa-solid fa-coins"></i>
                        Tình hình thực hiện thu theo kỳ
                    </h3>
                    <div class="w-48">
                        <Dropdown v-model="selectedFee" :options="feeOptions" optionLabel="label" class="w-full" />
                    </div>
                </header>

                <div class="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
                    <div class="md:col-span-1 h-48">
                        <Chart type="doughnut" :data="feeData" :options="feeOptionsDonut" />
                    </div>
                    <div class="md:col-span-2 space-y-6">
                        <div>
                            <div class="text-surface-500">Tổng số phải thu</div>
                            <div class="mt-2 h-px bg-surface-200 dark:bg-surface-700"></div>
                        </div>
                        <div class="flex items-center justify-between">
                            <div class="flex items-center gap-3">
                                <span class="inline-block w-4 h-4 rounded bg-blue-500"></span>
                                <span>Số đã thu</span>
                            </div>
                            <div class="font-semibold">{{ formatCurrency(feeCollectedAmount) }}</div>
                        </div>
                        <div class="flex items-center justify-between">
                            <div class="flex items-center gap-3">
                                <span class="inline-block w-4 h-4 rounded bg-blue-200"></span>
                                <span>Số còn phải thu</span>
                            </div>
                            <div class="font-semibold">{{ formatCurrency(feeRemainingAmount) }}</div>
                        </div>
                        <div class="font-semibold">Tỷ lệ thu {{ feePercent }}%</div>
                    </div>
                </div>
            </section>

            <section class="rounded-2xl bg-white dark:bg-surface-900 border border-surface-200 dark:border-surface-700 p-6">
                <header class="flex items-center justify-between mb-4">
                    <h3 class="text-xl font-semibold flex items-center gap-2">
                        <i class="fa-solid fa-cake-candles"></i>
                        Chúc mừng sinh nhật tháng 10
                    </h3>
                    <i class="fa-solid fa-arrow-right text-primary"></i>
                </header>

                <div class="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
                    <!-- Hai hàng avatar -->
                    <div class="md:col-span-2 grid grid-rows-2 gap-y-8">
                        <!-- Hàng 1 -->
                        <div class="flex flex-wrap gap-x-4 gap-y-4">
                            <div v-for="s in birthdaysStudents" :key="s.id" class="w-10 h-10 rounded-full bg-blue-200 flex items-center justify-center">
                                <i class="fa-solid fa-user text-blue-700"></i>
                            </div>
                        </div>
                        <!-- Hàng 2 -->
                        <div class="flex flex-wrap gap-x-4 gap-y-4">
                            <div v-for="s in birthdaysStaff" :key="s.id" class="w-10 h-10 rounded-full bg-blue-200 flex items-center justify-center">
                                <i class="fa-solid fa-user text-blue-700"></i>
                            </div>
                        </div>
                    </div>

                    <!-- Tổng bên phải -->
                    <div class="md:col-span-1 flex flex-col justify-start gap-8">
                        <div class="text-right">
                            <div class="text-surface-500">Học sinh:</div>
                            <div class="text-lg font-semibold">{{ birthdaysStudents.length }}</div>
                        </div>
                        <div class="text-right">
                            <div class="text-surface-500">Nhân viên:</div>
                            <div class="text-lg font-semibold">{{ birthdaysStaff.length }}</div>
                        </div>
                    </div>
                </div>
            </section>
        </div>
    </div>
</template>

<style scoped>
.text-surface-900 {
    color: #1e293b;
}
.dark .text-surface-900 {
    color: #f8fafc;
}
</style>
