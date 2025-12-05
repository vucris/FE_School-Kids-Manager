<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import '@fortawesome/fontawesome-free/css/all.min.css';

import InputText from 'primevue/inputtext';
import Dropdown from 'primevue/dropdown';
import Dialog from 'primevue/dialog';
import Paginator from 'primevue/paginator';
import InputNumber from 'primevue/inputnumber';

import Swal from 'sweetalert2';

import {
    fetchClasses,
    exportClassesExcel,
    createClass,
    updateClass,
    deleteClass,
    fetchClassById,
    updateStudentCount
} from '@/service/classService.js';
import { fetchTeachersLite } from '@/service/teacherService.js';

/* =================== Toast =================== */
const swalToast = Swal.mixin({
    toast: true,
    position: 'top-end',
    showConfirmButton: false,
    timer: 2500,
    timerProgressBar: true
});

function confirmDialog(title, text) {
    return Swal.fire({
        title,
        text,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Xác nhận',
        cancelButtonText: 'Hủy',
        confirmButtonColor: '#dc2626',
        cancelButtonColor: '#6b7280',
        reverseButtons: true
    });
}

/* =================== FILTERS =================== */
const years = [
    { label: 'Tất cả năm học', value: '' },
    { label: '2025 - 2026', value: '2025-2026' },
    { label: '2024 - 2025', value: '2024-2025' },
    { label: '2023 - 2024', value: '2023-2024' }
];
const selectedYear = ref(years[0]);

const keyword = ref('');
const gradeFilter = ref('');

/* =================== DATA =================== */
const loading = ref(false);
const rows = ref([]);
const allClasses = ref([]);
const totalRecords = ref(0);
const page = ref(1);
const size = ref(10);
const sortField = ref('className');
const sortOrder = ref(1);

const teacherOptions = ref([]);

/* =================== DIALOGS =================== */
const showCreate = ref(false);
const showEdit = ref(false);
const showView = ref(false);
const showUpdateCount = ref(false);

const createForm = ref({
    className: '',
    grade: '',
    roomNumber: '',
    academicYear: '',
    teacherId: null
});

const editForm = ref({
    id: null,
    className: '',
    grade: '',
    roomNumber: '',
    academicYear: '',
    teacherId: null
});

const viewData = ref(null);

const countForm = ref({
    id: null,
    className: '',
    currentCount: 0
});

const saving = ref(false);

/* =================== CONFIG =================== */
const gradeOptions = [
    { label: 'Nhà trẻ', value: 'Nhà trẻ', icon: 'fa-baby', color: 'pink' },
    { label: 'Mầm', value: 'Mầm', icon: 'fa-seedling', color: 'green' },
    { label: 'Chồi', value: 'Chồi', icon: 'fa-leaf', color: 'teal' },
    { label: 'Lá', value: 'Lá', icon: 'fa-tree', color: 'emerald' }
];

const gradeColors = {
    'Nhà trẻ': { bg: 'bg-pink-50', text: 'text-pink-600', border: 'border-pink-200' },
    Mầm: { bg: 'bg-green-50', text: 'text-green-600', border: 'border-green-200' },
    Chồi: { bg: 'bg-teal-50', text: 'text-teal-600', border: 'border-teal-200' },
    Lá: { bg: 'bg-emerald-50', text: 'text-emerald-600', border: 'border-emerald-200' }
};

const classNameOptions = {
    'Nhà trẻ': ['Nhà trẻ 1', 'Nhà trẻ 2', 'Nhà trẻ 3'],
    Mầm: ['Mầm 1', 'Mầm 2', 'Mầm 3'],
    Chồi: ['Chồi 1', 'Chồi 2', 'Chồi 3'],
    Lá: ['Lá 1', 'Lá 2', 'Lá 3']
};

const roomOptions = {
    'Nhà trẻ': ['P.NT01', 'P.NT02', 'P.NT03'],
    Mầm: ['P.M01', 'P.M02', 'P.M03'],
    Chồi: ['P.C01', 'P.C02', 'P.C03'],
    Lá: ['P.L01', 'P.L02', 'P.L03']
};

/* ===== Sĩ số: mỗi lớp tối đa 20 học sinh ===== */
const DEFAULT_CAPACITY = 20;

/* =================== COMPUTED =================== */
const usedClassNames = computed(
    () => new Set(allClasses.value.map((c) => c.className).filter(Boolean))
);
const usedRooms = computed(
    () => new Set(allClasses.value.map((c) => c.roomNumber).filter(Boolean))
);
const usedTeachers = computed(
    () =>
        new Set(
            allClasses.value
                .filter((c) => c.teacherName && c.teacherName !== 'Chưa có giáo viên')
                .map((c) => c.teacherName)
        )
);

const availableClassNames = computed(() => {
    const grade = createForm.value.grade;
    if (!grade) return [];
    return (classNameOptions[grade] || [])
        .filter((name) => !usedClassNames.value.has(name))
        .map((name) => ({ label: name, value: name }));
});

const availableRooms = computed(() => {
    const grade = createForm.value.grade;
    if (!grade) return [];
    return (roomOptions[grade] || [])
        .filter((room) => !usedRooms.value.has(room))
        .map((room) => ({ label: room, value: room }));
});

const availableTeachersForCreate = computed(() =>
    teacherOptions.value.filter((t) => !usedTeachers.value.has(t.label))
);

const availableTeachersForEdit = computed(() => {
    const currentClass = allClasses.value.find((c) => c.id === editForm.value.id);
    const currentTeacher = currentClass?.teacherName;
    return teacherOptions.value.filter(
        (t) => !usedTeachers.value.has(t.label) || t.label === currentTeacher
    );
});

const filteredRows = computed(() => {
    let list = [...rows.value];

    if (gradeFilter.value) {
        list = list.filter((r) => r.grade === gradeFilter.value);
    }

    const kw = keyword.value.trim().toLowerCase();
    if (kw) {
        list = list.filter(
            (r) =>
                (r.className || '').toLowerCase().includes(kw) ||
                (r.teacherName || '').toLowerCase().includes(kw) ||
                (r.roomNumber || '').toLowerCase().includes(kw)
        );
    }

    return list;
});

const stats = computed(() => ({
    total: allClasses.value.length,
    byGrade: gradeOptions.reduce((acc, g) => {
        acc[g.value] = allClasses.value.filter((c) => c.grade === g.value).length;
        return acc;
    }, {}),
    totalStudents: allClasses.value.reduce(
        (sum, c) => sum + (c.studentCurrent || 0),
        0
    ),
    withTeacher: allClasses.value.filter(
        (c) => c.teacherName && c.teacherName !== 'Chưa có giáo viên'
    ).length
}));

/* =================== LOAD =================== */
async function loadTeachers() {
    try {
        teacherOptions.value = await fetchTeachersLite();
    } catch (e) {
        console.warn('Load teachers failed:', e);
    }
}

async function loadAllClasses() {
    try {
        const { items } = await fetchClasses({ page: 1, size: 100000 });
        allClasses.value = items;
    } catch (e) {
        console.warn('Load all classes failed:', e);
    }
}

async function load() {
    loading.value = true;
    try {
        const sort = sortField.value
            ? `${sortField.value},${sortOrder.value === -1 ? 'desc' : 'asc'}`
            : undefined;

        const { items, total } = await fetchClasses({
            year: selectedYear.value?.value || undefined,
            page: page.value,
            size: size.value,
            sort
        });
        rows.value = items;
        totalRecords.value = total;
    } catch (e) {
        swalToast.fire({
            icon: 'error',
            title: e.message || 'Không tải được danh sách lớp'
        });
    } finally {
        loading.value = false;
    }
}

function onPageChange(e) {
    page.value = e.page + 1;
    size.value = e.rows;
    load();
}

/* =================== ACTIONS =================== */
function openCreate() {
    createForm.value = {
        className: '',
        grade: '',
        roomNumber: '',
        academicYear: selectedYear.value?.value || '2024-2025',
        teacherId: null
    };
    showCreate.value = true;
}

async function saveCreate() {
    if (!createForm.value.grade || !createForm.value.className || !createForm.value.roomNumber) {
        swalToast.fire({
            icon: 'warning',
            title: 'Vui lòng điền đầy đủ thông tin bắt buộc'
        });
        return;
    }

    saving.value = true;
    try {
        await createClass(createForm.value);
        swalToast.fire({ icon: 'success', title: 'Tạo lớp học thành công' });
        showCreate.value = false;
        await Promise.all([load(), loadAllClasses()]);
    } catch (e) {
        swalToast.fire({ icon: 'error', title: e.message || 'Tạo lớp thất bại' });
    } finally {
        saving.value = false;
    }
}

async function openEdit(row) {
    try {
        const c = await fetchClassById(row.id);
        const teacher = teacherOptions.value.find((t) => t.label === c.teacherName);
        editForm.value = {
            id: c.id,
            className: c.className,
            grade: c.grade,
            roomNumber: c.roomNumber,
            academicYear: c.academicYear,
            teacherId: teacher?.value || null
        };
        showEdit.value = true;
    } catch (e) {
        swalToast.fire({ icon: 'error', title: 'Không lấy được thông tin lớp' });
    }
}

async function saveEdit() {
    if (!editForm.value.className) {
        swalToast.fire({
            icon: 'warning',
            title: 'Tên lớp không được để trống'
        });
        return;
    }

    saving.value = true;
    try {
        await updateClass(editForm.value.id, editForm.value);
        swalToast.fire({ icon: 'success', title: 'Cập nhật lớp học thành công' });
        showEdit.value = false;
        await Promise.all([load(), loadAllClasses()]);
    } catch (e) {
        swalToast.fire({ icon: 'error', title: e.message || 'Cập nhật thất bại' });
    } finally {
        saving.value = false;
    }
}

async function openView(row) {
    try {
        viewData.value = await fetchClassById(row.id);
        showView.value = true;
    } catch (e) {
        swalToast.fire({ icon: 'error', title: 'Không lấy được thông tin lớp' });
    }
}

function openUpdateCount(row) {
    countForm.value = {
        id: row.id,
        className: row.className,
        currentCount: row.studentCurrent || 0
    };
    showUpdateCount.value = true;
}

async function saveUpdateCount() {
    const count = Number(countForm.value.currentCount);
    if (!Number.isInteger(count) || count < 0) {
        swalToast.fire({
            icon: 'warning',
            title: 'Số học sinh phải là số nguyên không âm'
        });
        return;
    }

    saving.value = true;
    try {
        await updateStudentCount(countForm.value.id, count);
        swalToast.fire({ icon: 'success', title: 'Cập nhật sĩ số thành công' });
        showUpdateCount.value = false;
        await Promise.all([load(), loadAllClasses()]);
    } catch (e) {
        swalToast.fire({ icon: 'error', title: e.message || 'Cập nhật thất bại' });
    } finally {
        saving.value = false;
    }
}

async function onDelete(row) {
    const { isConfirmed } = await confirmDialog(
        'Xóa lớp học?',
        `Bạn có chắc muốn xóa lớp "${row.className}"? Hành động này không thể hoàn tác.`
    );
    if (!isConfirmed) return;

    try {
        await deleteClass(row.id);
        swalToast.fire({ icon: 'success', title: 'Đã xóa lớp học' });
        await Promise.all([load(), loadAllClasses()]);
    } catch (e) {
        swalToast.fire({ icon: 'error', title: e.message || 'Xóa lớp thất bại' });
    }
}

async function onExport() {
    try {
        await exportClassesExcel();
        swalToast.fire({ icon: 'success', title: 'Đã xuất file Excel' });
    } catch (e) {
        swalToast.fire({ icon: 'error', title: 'Xuất file thất bại' });
    }
}

/* =================== UTILS =================== */
function getGradeStyle(grade) {
    return gradeColors[grade] || {
        bg: 'bg-gray-50',
        text: 'text-gray-600',
        border: 'border-gray-200'
    };
}

function getCapacityPercent(current, capacity) {
    const cap = capacity || DEFAULT_CAPACITY;
    if (!cap) return 0;
    return Math.min(100, Math.round((current / cap) * 100));
}

/* =================== WATCH =================== */
let debounceTimer;
watch([keyword, gradeFilter, selectedYear], () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
        page.value = 1;
        load();
    }, 300);
});

/* =================== INIT =================== */
onMounted(async () => {
    await Promise.all([load(), loadTeachers(), loadAllClasses()]);
});
</script>

<template>
    <div class="class-page">
        <!-- Header -->
        <header class="page-header">
            <div class="header-left">
                <div class="header-icon">
                    <i class="fa-solid fa-chalkboard-user"></i>
                </div>
                <div>
                    <h1 class="page-title">Quản lý lớp học</h1>
                    <p class="page-desc">Quản lý danh sách lớp, giáo viên chủ nhiệm và phòng học</p>
                </div>
            </div>
            <div class="header-actions">
                <button class="btn btn-outline" @click="onExport">
                    <i class="fa-solid fa-file-excel"></i>
                    <span>Xuất Excel</span>
                </button>
                <button class="btn btn-primary" @click="openCreate">
                    <i class="fa-solid fa-plus"></i>
                    <span>Tạo lớp mới</span>
                </button>
            </div>
        </header>

        <!-- Stats -->
        <div class="stats-grid">
            <div class="stat-card stat-total">
                <div class="stat-icon">
                    <i class="fa-solid fa-school"></i>
                </div>
                <div class="stat-content">
                    <span class="stat-value">{{ stats.total }}</span>
                    <span class="stat-label">Tổng số lớp</span>
                </div>
            </div>
            <div class="stat-card stat-students">
                <div class="stat-icon">
                    <i class="fa-solid fa-children"></i>
                </div>
                <div class="stat-content">
                    <span class="stat-value">{{ stats.totalStudents }}</span>
                    <span class="stat-label">Tổng học sinh</span>
                </div>
            </div>
            <div class="stat-card stat-teachers">
                <div class="stat-icon">
                    <i class="fa-solid fa-user-tie"></i>
                </div>
                <div class="stat-content">
                    <span class="stat-value">{{ stats.withTeacher }}/{{ stats.total }}</span>
                    <span class="stat-label">Lớp có GVCN</span>
                </div>
            </div>
            <div
                v-for="g in gradeOptions"
                :key="g.value"
                class="stat-card stat-grade"
                :class="`stat-${g.color}`"
            >
                <div class="stat-icon">
                    <i :class="['fa-solid', g.icon]"></i>
                </div>
                <div class="stat-content">
                    <span class="stat-value">{{ stats.byGrade[g.value] || 0 }}</span>
                    <span class="stat-label">{{ g.label }}</span>
                </div>
            </div>
        </div>

        <!-- Filters -->
        <div class="filter-bar">
            <div class="filter-item">
                <label>Năm học</label>
                <Dropdown
                    v-model="selectedYear"
                    :options="years"
                    optionLabel="label"
                    placeholder="Chọn năm học"
                    class="w-full"
                />
            </div>
            <div class="filter-item">
                <label>Khối lớp</label>
                <Dropdown
                    v-model="gradeFilter"
                    :options="[{ label: 'Tất cả khối', value: '' }, ...gradeOptions]"
                    optionLabel="label"
                    optionValue="value"
                    placeholder="Chọn khối"
                    class="w-full"
                />
            </div>
            <div class="filter-item filter-search">
                <label>Tìm kiếm</label>
                <div class="search-box">
                    <i class="fa-solid fa-search"></i>
                    <InputText
                        v-model="keyword"
                        placeholder="Tên lớp, giáo viên, phòng..."
                        class="w-full"
                    />
                </div>
            </div>
        </div>

        <!-- Table -->
        <div class="table-container">
            <div v-if="loading" class="loading-overlay">
                <i class="fa-solid fa-spinner fa-spin"></i>
                <span>Đang tải...</span>
            </div>

            <table class="data-table">
                <thead>
                    <tr>
                        <th style="width: 50px">#</th>
                        <th style="min-width: 180px">Lớp học</th>
                        <th style="min-width: 100px">Khối</th>
                        <th style="min-width: 100px">Phòng</th>
                        <th style="min-width: 120px">Năm học</th>
                        <th style="min-width: 180px">Giáo viên chủ nhiệm</th>
                        <th style="min-width: 140px">Sĩ số</th>
                        <th style="min-width: 100px">Trạng thái</th>
                        <th style="width: 140px" class="text-center">Thao tác</th>
                    </tr>
                </thead>
                <tbody>
                    <tr v-for="(row, idx) in filteredRows" :key="row.id">
                        <td>{{ (page - 1) * size + idx + 1 }}</td>
                        <td>
                            <div class="class-cell">
                                <span class="class-name">{{ row.className }}</span>
                                <span v-if="row.classCode" class="class-code">
                                    {{ row.classCode }}
                                </span>
                            </div>
                        </td>
                        <td>
                            <span
                                class="grade-badge"
                                :class="[
                                    getGradeStyle(row.grade).bg,
                                    getGradeStyle(row.grade).text
                                ]"
                            >
                                {{ row.grade || '—' }}
                            </span>
                        </td>
                        <td>
                            <span class="room-text">
                                <i class="fa-solid fa-door-open"></i>
                                {{ row.roomNumber || '—' }}
                            </span>
                        </td>
                        <td>{{ row.academicYear || '—' }}</td>
                        <td>
                            <div
                                v-if="row.teacherName && row.teacherName !== 'Chưa có giáo viên'"
                                class="teacher-cell"
                            >
                                <div class="teacher-avatar">
                                    {{ row.teacherName.charAt(0) }}
                                </div>
                                <span>{{ row.teacherName }}</span>
                            </div>
                            <span v-else class="no-teacher">Chưa phân công</span>
                        </td>
                        <td>
                            <div class="capacity-cell">
                                <div class="capacity-bar">
                                    <div
                                        class="capacity-fill"
                                        :style="{
                                            width:
                                                getCapacityPercent(
                                                    row.studentCurrent,
                                                    row.studentCapacity || DEFAULT_CAPACITY
                                                ) + '%'
                                        }"
                                        :class="{
                                            'fill-low':
                                                getCapacityPercent(
                                                    row.studentCurrent,
                                                    row.studentCapacity || DEFAULT_CAPACITY
                                                ) < 50,
                                            'fill-medium':
                                                getCapacityPercent(
                                                    row.studentCurrent,
                                                    row.studentCapacity || DEFAULT_CAPACITY
                                                ) >= 50 &&
                                                getCapacityPercent(
                                                    row.studentCurrent,
                                                    row.studentCapacity || DEFAULT_CAPACITY
                                                ) < 80,
                                            'fill-high':
                                                getCapacityPercent(
                                                    row.studentCurrent,
                                                    row.studentCapacity || DEFAULT_CAPACITY
                                                ) >= 80
                                        }"
                                    ></div>
                                </div>
                                <span class="capacity-text">
                                    {{ row.studentCurrent || 0 }}/{{ row.studentCapacity || DEFAULT_CAPACITY }}
                                </span>
                            </div>
                        </td>
                        <td>
                            <span class="status-badge active">
                                <i class="fa-solid fa-circle"></i>
                                Hoạt động
                            </span>
                        </td>
                        <td>
                            <div class="action-buttons">
                                <button
                                    class="action-btn"
                                    @click="openView(row)"
                                    title="Xem chi tiết"
                                >
                                    <i class="fa-solid fa-eye"></i>
                                </button>
                                <button
                                    class="action-btn"
                                    @click="openEdit(row)"
                                    title="Chỉnh sửa"
                                >
                                    <i class="fa-solid fa-pen"></i>
                                </button>
                                <button
                                    class="action-btn"
                                    @click="openUpdateCount(row)"
                                    title="Cập nhật sĩ số"
                                >
                                    <i class="fa-solid fa-users"></i>
                                </button>
                                <button
                                    class="action-btn danger"
                                    @click="onDelete(row)"
                                    title="Xóa"
                                >
                                    <i class="fa-solid fa-trash"></i>
                                </button>
                            </div>
                        </td>
                    </tr>
                    <tr v-if="!loading && !filteredRows.length">
                        <td colspan="9" class="empty-cell">
                            <i class="fa-solid fa-folder-open"></i>
                            <span>Không có dữ liệu lớp học</span>
                        </td>
                    </tr>
                </tbody>
            </table>
        </div>

        <!-- Pagination -->
        <div v-if="totalRecords > 0" class="pagination-wrapper">
            <span class="pagination-info">
                Hiển thị
                {{ (page - 1) * size + 1 }}
                -
                {{ Math.min(page * size, totalRecords) }}
                /
                {{ totalRecords }}
                lớp
            </span>
            <Paginator
                :rows="size"
                :totalRecords="totalRecords"
                :first="(page - 1) * size"
                @page="onPageChange"
                :rowsPerPageOptions="[10, 20, 50]"
            />
        </div>

        <!-- Dialog: Create -->
        <Dialog v-model:visible="showCreate" modal :style="{ width: '520px' }" :draggable="false">
            <template #header>
                <div class="dialog-header">
                    <i class="fa-solid fa-plus-circle"></i>
                    <span>Tạo lớp học mới</span>
                </div>
            </template>

            <div class="dialog-body">
                <div class="form-row">
                    <div class="form-field">
                        <label>Khối lớp <span class="required">*</span></label>
                        <Dropdown
                            v-model="createForm.grade"
                            :options="gradeOptions"
                            optionLabel="label"
                            optionValue="value"
                            placeholder="Chọn khối"
                            class="w-full"
                            @change="
                                () => {
                                    createForm.className = '';
                                    createForm.roomNumber = '';
                                }
                            "
                        />
                    </div>
                    <div class="form-field">
                        <label>Tên lớp <span class="required">*</span></label>
                        <Dropdown
                            v-model="createForm.className"
                            :options="availableClassNames"
                            optionLabel="label"
                            optionValue="value"
                            :disabled="!createForm.grade"
                            placeholder="Chọn tên lớp"
                            class="w-full"
                        />
                    </div>
                </div>

                <div class="form-row">
                    <div class="form-field">
                        <label>Phòng học <span class="required">*</span></label>
                        <Dropdown
                            v-model="createForm.roomNumber"
                            :options="availableRooms"
                            optionLabel="label"
                            optionValue="value"
                            :disabled="!createForm.grade"
                            placeholder="Chọn phòng"
                            class="w-full"
                        />
                    </div>
                    <div class="form-field">
                        <label>Năm học</label>
                        <InputText
                            v-model="createForm.academicYear"
                            placeholder="VD: 2024-2025"
                            class="w-full"
                        />
                    </div>
                </div>

                <div class="form-field">
                    <label>Giáo viên chủ nhiệm</label>
                    <Dropdown
                        v-model="createForm.teacherId"
                        :options="availableTeachersForCreate"
                        optionLabel="label"
                        optionValue="value"
                        showClear
                        placeholder="Chọn giáo viên (không bắt buộc)"
                        class="w-full"
                    />
                    <span class="field-hint">
                        Mỗi giáo viên chỉ có thể làm GVCN của 1 lớp
                    </span>
                </div>
            </div>

            <template #footer>
                <div class="dialog-footer">
                    <button class="btn btn-ghost" @click="showCreate = false">Hủy</button>
                    <button class="btn btn-primary" @click="saveCreate" :disabled="saving">
                        <i v-if="saving" class="fa-solid fa-spinner fa-spin"></i>
                        <i v-else class="fa-solid fa-check"></i>
                        <span>{{ saving ? 'Đang tạo...' : 'Tạo lớp' }}</span>
                    </button>
                </div>
            </template>
        </Dialog>

        <!-- Dialog: Edit -->
        <Dialog v-model:visible="showEdit" modal :style="{ width: '520px' }" :draggable="false">
            <template #header>
                <div class="dialog-header">
                    <i class="fa-solid fa-pen-to-square"></i>
                    <span>Chỉnh sửa lớp học</span>
                </div>
            </template>

            <div class="dialog-body">
                <div class="form-row">
                    <div class="form-field">
                        <label>Tên lớp <span class="required">*</span></label>
                        <InputText v-model="editForm.className" class="w-full" />
                    </div>
                    <div class="form-field">
                        <label>Khối lớp</label>
                        <InputText v-model="editForm.grade" class="w-full" />
                    </div>
                </div>

                <div class="form-row">
                    <div class="form-field">
                        <label>Phòng học</label>
                        <InputText v-model="editForm.roomNumber" class="w-full" />
                    </div>
                    <div class="form-field">
                        <label>Năm học</label>
                        <InputText v-model="editForm.academicYear" class="w-full" />
                    </div>
                </div>

                <div class="form-field">
                    <label>Giáo viên chủ nhiệm</label>
                    <Dropdown
                        v-model="editForm.teacherId"
                        :options="availableTeachersForEdit"
                        optionLabel="label"
                        optionValue="value"
                        showClear
                        placeholder="Chọn giáo viên"
                        class="w-full"
                    />
                </div>
            </div>

            <template #footer>
                <div class="dialog-footer">
                    <button class="btn btn-ghost" @click="showEdit = false">Hủy</button>
                    <button class="btn btn-primary" @click="saveEdit" :disabled="saving">
                        <i v-if="saving" class="fa-solid fa-spinner fa-spin"></i>
                        <i v-else class="fa-solid fa-save"></i>
                        <span>{{ saving ? 'Đang lưu...' : 'Lưu thay đổi' }}</span>
                    </button>
                </div>
            </template>
        </Dialog>

        <!-- Dialog: View -->
        <Dialog v-model:visible="showView" modal :style="{ width: '480px' }" :draggable="false">
            <template #header>
                <div class="dialog-header">
                    <i class="fa-solid fa-info-circle"></i>
                    <span>Thông tin lớp học</span>
                </div>
            </template>

            <div v-if="viewData" class="dialog-body">
                <div class="view-header">
                    <div class="view-icon" :class="getGradeStyle(viewData.grade).bg">
                        <i class="fa-solid fa-chalkboard"></i>
                    </div>
                    <div>
                        <h3 class="view-title">{{ viewData.className }}</h3>
                        <span v-if="viewData.classCode" class="view-code">
                            {{ viewData.classCode }}
                        </span>
                    </div>
                </div>

                <div class="view-grid">
                    <div class="view-item">
                        <span class="view-label">Khối lớp</span>
                        <span class="view-value">{{ viewData.grade || '—' }}</span>
                    </div>
                    <div class="view-item">
                        <span class="view-label">Phòng học</span>
                        <span class="view-value">{{ viewData.roomNumber || '—' }}</span>
                    </div>
                    <div class="view-item">
                        <span class="view-label">Năm học</span>
                        <span class="view-value">{{ viewData.academicYear || '—' }}</span>
                    </div>
                    <div class="view-item">
                        <span class="view-label">Sĩ số</span>
                        <span class="view-value">
                            {{ viewData.studentCurrent || 0 }}/{{ viewData.studentCapacity || DEFAULT_CAPACITY }}
                        </span>
                    </div>
                    <div class="view-item full">
                        <span class="view-label">Giáo viên chủ nhiệm</span>
                        <span class="view-value">
                            {{ viewData.teacherName || 'Chưa phân công' }}
                        </span>
                    </div>
                </div>
            </div>
        </Dialog>

        <!-- Dialog: Update Student Count -->
        <Dialog
            v-model:visible="showUpdateCount"
            modal
            :style="{ width: '400px' }"
            :draggable="false"
        >
            <template #header>
                <div class="dialog-header">
                    <i class="fa-solid fa-users"></i>
                    <span>Cập nhật sĩ số</span>
                </div>
            </template>

            <div class="dialog-body">
                <div class="count-info">
                    <span>Lớp:</span>
                    <strong>{{ countForm.className }}</strong>
                </div>

                <div class="form-field">
                    <label>Số học sinh hiện tại <span class="required">*</span></label>
                    <InputNumber v-model="countForm.currentCount" :min="0" class="w-full" />
                    <span class="field-hint">Nhập tổng số học sinh đang học trong lớp (tối đa 20)</span>
                </div>
            </div>

            <template #footer>
                <div class="dialog-footer">
                    <button class="btn btn-ghost" @click="showUpdateCount = false">Hủy</button>
                    <button class="btn btn-primary" @click="saveUpdateCount" :disabled="saving">
                        <i v-if="saving" class="fa-solid fa-spinner fa-spin"></i>
                        <i v-else class="fa-solid fa-check"></i>
                        <span>{{ saving ? 'Đang lưu...' : 'Cập nhật' }}</span>
                    </button>
                </div>
            </template>
        </Dialog>
    </div>
</template>

<style scoped>
/* ===== Base ===== */
.class-page {
    padding: 1.5rem;
    max-width: 1400px;
    margin: 0 auto;
    background: #f8fafc;
    min-height: 100vh;
}

/* ===== Header ===== */
.page-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1.5rem;
    flex-wrap: wrap;
    gap: 1rem;
}

.header-left {
    display: flex;
    align-items: center;
    gap: 0.75rem;
}

.header-icon {
    width: 48px;
    height: 48px;
    background: linear-gradient(135deg, #6366f1, #8b5cf6);
    border-radius: 12px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: white;
    font-size: 1.25rem;
}

.page-title {
    font-size: 1.5rem;
    font-weight: 700;
    color: #1e293b;
    margin: 0;
}

.page-desc {
    font-size: 0.875rem;
    color: #64748b;
    margin: 0;
}

.header-actions {
    display: flex;
    gap: 0.5rem;
}

/* ===== Buttons ===== */
.btn {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 1rem;
    border-radius: 8px;
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
    border: none;
}

.btn-primary {
    background: #6366f1;
    color: white;
}
.btn-primary:hover {
    background: #4f46e5;
}

.btn-outline {
    background: white;
    color: #475569;
    border: 1px solid #e2e8f0;
}
.btn-outline:hover {
    background: #f8fafc;
}

.btn-ghost {
    background: transparent;
    color: #64748b;
}
.btn-ghost:hover {
    background: #f1f5f9;
}

.btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
}

/* ===== Stats ===== */
.stats-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
    gap: 0.75rem;
    margin-bottom: 1.5rem;
}

.stat-card {
    background: white;
    border-radius: 12px;
    padding: 1rem;
    display: flex;
    align-items: center;
    gap: 0.75rem;
    border: 1px solid #e2e8f0;
}

.stat-icon {
    width: 40px;
    height: 40px;
    border-radius: 10px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1rem;
}

.stat-total .stat-icon {
    background: #eff6ff;
    color: #3b82f6;
}
.stat-students .stat-icon {
    background: #fef3c7;
    color: #f59e0b;
}
.stat-teachers .stat-icon {
    background: #f0fdf4;
    color: #22c55e;
}
.stat-pink .stat-icon {
    background: #fce7f3;
    color: #ec4899;
}
.stat-green .stat-icon {
    background: #dcfce7;
    color: #22c55e;
}
.stat-teal .stat-icon {
    background: #ccfbf1;
    color: #14b8a6;
}
.stat-emerald .stat-icon {
    background: #d1fae5;
    color: #10b981;
}

.stat-content {
    display: flex;
    flex-direction: column;
}

.stat-value {
    font-size: 1.25rem;
    font-weight: 700;
    color: #1e293b;
}

.stat-label {
    font-size: 0.75rem;
    color: #64748b;
}

/* ===== Filter ===== */
.filter-bar {
    display: grid;
    grid-template-columns: 180px 150px 1fr;
    gap: 1rem;
    padding: 1rem;
    background: white;
    border-radius: 12px;
    border: 1px solid #e2e8f0;
    margin-bottom: 1rem;
}

@media (max-width: 768px) {
    .filter-bar {
        grid-template-columns: 1fr;
    }
}

.filter-item {
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
}

.filter-item label {
    font-size: 0.75rem;
    font-weight: 600;
    color: #64748b;
    text-transform: uppercase;
}

.search-box {
    position: relative;
}

.search-box i {
    position: absolute;
    left: 0.75rem;
    top: 50%;
    transform: translateY(-50%);
    color: #94a3b8;
}

.search-box input {
    padding-left: 2.25rem !important;
}

/* ===== Table ===== */
.table-container {
    background: white;
    border-radius: 12px;
    border: 1px solid #e2e8f0;
    overflow: hidden;
    position: relative;
}

.loading-overlay {
    position: absolute;
    inset: 0;
    background: rgba(255, 255, 255, 0.9);
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    color: #64748b;
    z-index: 10;
}

.data-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.875rem;
}

.data-table th {
    padding: 0.75rem 1rem;
    text-align: left;
    font-weight: 600;
    color: #475569;
    background: #f8fafc;
    border-bottom: 1px solid #e2e8f0;
    white-space: nowrap;
}

.data-table td {
    padding: 0.75rem 1rem;
    border-bottom: 1px solid #f1f5f9;
    color: #334155;
}

.data-table tbody tr:hover {
    background: #f8fafc;
}

/* Class cell */
.class-cell {
    display: flex;
    flex-direction: column;
}

.class-name {
    font-weight: 600;
    color: #1e293b;
}

.class-code {
    font-size: 0.75rem;
    color: #94a3b8;
}

/* Grade badge */
.grade-badge {
    display: inline-flex;
    padding: 0.25rem 0.75rem;
    border-radius: 20px;
    font-size: 0.75rem;
    font-weight: 500;
}

/* Room */
.room-text {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    color: #64748b;
}

.room-text i {
    font-size: 0.75rem;
}

/* Teacher */
.teacher-cell {
    display: flex;
    align-items: center;
    gap: 0.5rem;
}

.teacher-avatar {
    width: 28px;
    height: 28px;
    border-radius: 50%;
    background: linear-gradient(135deg, #a5b4fc, #818cf8);
    color: white;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 600;
    font-size: 0.75rem;
}

.no-teacher {
    color: #94a3b8;
    font-style: italic;
}

/* Capacity */
.capacity-cell {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
}

.capacity-bar {
    width: 80px;
    height: 6px;
    background: #e2e8f0;
    border-radius: 3px;
    overflow: hidden;
}

.capacity-fill {
    height: 100%;
    border-radius: 3px;
    transition: width 0.3s;
}

.fill-low {
    background: #22c55e;
}
.fill-medium {
    background: #f59e0b;
}
.fill-high {
    background: #ef4444;
}

.capacity-text {
    font-size: 0.75rem;
    color: #64748b;
}

/* Status */
.status-badge {
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
    padding: 0.25rem 0.75rem;
    border-radius: 20px;
    font-size: 0.75rem;
    font-weight: 500;
}

.status-badge.active {
    background: #dcfce7;
    color: #16a34a;
}

.status-badge i {
    font-size: 0.5rem;
}

/* Actions */
.action-buttons {
    display: flex;
    gap: 0.25rem;
    justify-content: center;
}

.action-btn {
    width: 32px;
    height: 32px;
    border-radius: 8px;
    border: none;
    background: #f1f5f9;
    color: #64748b;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s;
}

.action-btn:hover {
    background: #e2e8f0;
    color: #475569;
}

.action-btn.danger {
    color: #ef4444;
}
.action-btn.danger:hover {
    background: #fee2e2;
    color: #dc2626;
}

/* Empty */
.empty-cell {
    text-align: center;
    padding: 3rem !important;
    color: #94a3b8;
}

.empty-cell i {
    font-size: 2rem;
    margin-bottom: 0.5rem;
    display: block;
}

/* ===== Pagination ===== */
.pagination-wrapper {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1rem;
    background: white;
    border-radius: 12px;
    border: 1px solid #e2e8f0;
    margin-top: 1rem;
    flex-wrap: wrap;
    gap: 1rem;
}

.pagination-info {
    font-size: 0.875rem;
    color: #64748b;
}

/* ===== Dialog ===== */
.dialog-header {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-weight: 600;
    color: #1e293b;
}

.dialog-body {
    display: flex;
    flex-direction: column;
    gap: 1rem;
}

.dialog-footer {
    display: flex;
    justify-content: flex-end;
    gap: 0.5rem;
}

.form-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1rem;
}

.form-field {
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
}

.form-field label {
    font-size: 0.875rem;
    font-weight: 500;
    color: #475569;
}

.required {
    color: #ef4444;
}

.field-hint {
    font-size: 0.75rem;
    color: #94a3b8;
}

/* View dialog */
.view-header {
    display: flex;
    align-items: center;
    gap: 1rem;
    padding-bottom: 1rem;
    border-bottom: 1px solid #f1f5f9;
}

.view-icon {
    width: 48px;
    height: 48px;
    border-radius: 12px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1.25rem;
    color: #6366f1;
}

.view-title {
    font-size: 1.125rem;
    font-weight: 600;
    color: #1e293b;
    margin: 0;
}

.view-code {
    font-size: 0.875rem;
    color: #64748b;
}

.view-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1rem;
}

.view-item {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
}

.view-item.full {
    grid-column: span 2;
}

.view-label {
    font-size: 0.75rem;
    font-weight: 500;
    color: #94a3b8;
    text-transform: uppercase;
}

.view-value {
    font-size: 0.875rem;
    color: #1e293b;
}

/* Count dialog */
.count-info {
    padding: 0.75rem;
    background: #f8fafc;
    border-radius: 8px;
    display: flex;
    gap: 0.5rem;
    font-size: 0.875rem;
}
</style>
