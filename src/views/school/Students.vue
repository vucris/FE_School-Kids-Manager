<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import '@fortawesome/fontawesome-free/css/all.min.css';

import InputText from 'primevue/inputtext';
import Dropdown from 'primevue/dropdown';
import Paginator from 'primevue/paginator';
import Checkbox from 'primevue/checkbox';

import Swal from 'sweetalert2';

import {
    fetchStudents,
    fetchStudentsByClass,
    fetchStudentStatusStatistics,
    exportStudentsExcel,
    deleteStudent,
    deleteStudents,
    changeStudentStatus,
    returnStudentFromReserve,
    downloadStudentsImportTemplateFromBackend
} from '@/service/studentService.js';

import { fetchClassOptions } from '@/service/classService.js';

import ImportStudentsModal from '@/components/staff/ImportStudentsModal.vue';
import CreateStudentModal from '@/components/staff/CreateStudentModal.vue';
import ChangeStudentClassModal from '@/components/staff/ChangeStudentClassModal.vue';
import StudentProfileModal from '@/components/staff/StudentProfileModal.vue';

/* =================== Toast & Dialog =================== */
const swalToast = Swal.mixin({
    toast: true,
    position: 'top-end',
    showConfirmButton: false,
    timer: 2500,
    timerProgressBar: true
});

function confirmDialog(title, text, options = {}) {
    return Swal.fire({
        title,
        text,
        icon: options.icon || 'warning',
        showCancelButton: true,
        confirmButtonText: options.confirmText || 'Xác nhận',
        cancelButtonText: 'Hủy',
        confirmButtonColor: options.color || '#6366f1',
        cancelButtonColor: '#64748b',
        reverseButtons: true
    });
}

function inputDialog(title, text, options = {}) {
    return Swal.fire({
        title,
        text,
        input: 'text',
        inputPlaceholder: options.placeholder || 'Nhập lý do...',
        showCancelButton: true,
        confirmButtonText: options.confirmText || 'Xác nhận',
        cancelButtonText: 'Hủy',
        confirmButtonColor: options.color || '#6366f1',
        cancelButtonColor: '#64748b',
        reverseButtons: true
    });
}

/* =================== STATE =================== */
const loading = ref(false);
const rows = ref([]);
const allData = ref([]);
const totalRecords = ref(0);
const page = ref(1);
const size = ref(20);
const sortField = ref('name');
const sortOrder = ref(1);

const keyword = ref('');
const currentStatus = ref('studying');
const statusStats = ref(null);

const selection = ref([]);
const selectAll = ref(false);
const isProcessing = ref(false);

/* =================== FILTERS =================== */
const years = [
    { label: 'Tất cả năm học', value: '' },
    { label: '2024 - 2025', value: '2024-2025' },
    { label: '2023 - 2024', value: '2023-2024' }
];
const selectedYear = ref(years[0]); // UI only

const classOptions = ref([]);
const gradeOptions = ref([{ label: 'Tất cả khối', value: '' }]);
const classFilters = ref([{ label: 'Tất cả lớp', value: '' }]);

const selectedGrade = ref(gradeOptions.value[0]); // UI only
const selectedClass = ref(classFilters.value[0]);

/* =================== STATUS TABS =================== */
const statusTabs = [
    { key: 'all', label: 'Tất cả', icon: 'fa-users', color: 'slate' },
    { key: 'studying', label: 'Đang học', icon: 'fa-user-graduate', color: 'blue' },
    { key: 'reserved', label: 'Bảo lưu', icon: 'fa-pause-circle', color: 'amber' },
    { key: 'graduated', label: 'Tốt nghiệp', icon: 'fa-award', color: 'green' },
    { key: 'dropped', label: 'Thôi học', icon: 'fa-user-minus', color: 'red' },
    { key: 'transferred', label: 'Chuyển trường', icon: 'fa-exchange-alt', color: 'purple' }
];

const counts = computed(() => {
    const stats = statusStats.value || {};
    const fromList = (key) => allData.value.filter((x) => x.status === key).length;

    return {
        all: stats.total ?? allData.value.length,
        studying: stats.studying ?? fromList('studying'),
        reserved: stats.reserved ?? fromList('reserved'),
        graduated: stats.graduated ?? fromList('graduated'),
        dropped: stats.dropout ?? stats.dropped ?? fromList('dropped'),
        transferred: stats.transferred ?? fromList('transferred')
    };
});

/* =================== MODALS =================== */
const showImport = ref(false);
const showCreate = ref(false);
const showChangeClass = ref(false);
const showProfile = ref(false);

const studentForChange = ref(null);
const studentIdForProfile = ref(null);

/* =================== BUILD FILTERS =================== */
async function loadClassFilters() {
    try {
        const year = selectedYear.value?.value;
        const list = await fetchClassOptions(year ? { year } : {});
        classOptions.value = Array.isArray(list) ? list : [];
        buildFilters();
    } catch (e) {
        console.error('Load class filters failed:', e);
        classOptions.value = [];
        buildFilters();
    }
}

async function onDownloadImportTemplate() {
    try {
        await downloadStudentsImportTemplateFromBackend();
        swalToast.fire({ icon: 'success', title: 'Đang tải file mẫu Excel...' });
    } catch (e) {
        swalToast.fire({ icon: 'error', title: e?.message || 'Tải file mẫu thất bại' });
    }
}

function buildFilters() {
    const all = classOptions.value || [];

    const gradeSet = new Set();
    all.forEach((c) => {
        if (c.grade) gradeSet.add(c.grade);
    });

    gradeOptions.value = [
        { label: 'Tất cả khối', value: '' },
        ...Array.from(gradeSet)
            .sort()
            .map((g) => ({ label: g, value: g }))
    ];

    if (!gradeOptions.value.some((g) => g.value === selectedGrade.value?.value)) {
        selectedGrade.value = gradeOptions.value[0];
    }

    const currentGrade = selectedGrade.value?.value || '';
    const classesForGrade = currentGrade ? all.filter((c) => c.grade === currentGrade) : all;

    classFilters.value = [
        { label: 'Tất cả lớp', value: '' },
        ...classesForGrade.map((c) => ({
            label: c.label || c.className,
            value: c.value || c.id,
            className: c.label || c.className
        }))
    ];

    if (!classFilters.value.some((c) => c.value === selectedClass.value?.value)) {
        selectedClass.value = classFilters.value[0];
    }
}

/* =================== LOCAL FILTER =================== */
function applyLocalFilters(list) {
    let data = Array.isArray(list) ? [...list] : [];

    // tab status
    if (currentStatus.value && currentStatus.value !== 'all') {
        data = data.filter((x) => String(x.status || '').toLowerCase() === String(currentStatus.value).toLowerCase());
    }

    // keyword
    const kw = String(keyword.value || '').trim().toLowerCase();
    if (kw) {
        data = data.filter((x) => {
            const name = String(x.name || '').toLowerCase();
            const code = String(x.code || x.studentCode || '').toLowerCase();
            return name.includes(kw) || code.includes(kw);
        });
    }

    // sort
    if (sortField.value) {
        const field = sortField.value;
        const factor = sortOrder.value === -1 ? -1 : 1;
        data.sort((a, b) => {
            const va = String(a[field] ?? '').toLowerCase();
            const vb = String(b[field] ?? '').toLowerCase();
            if (va < vb) return -1 * factor;
            if (va > vb) return 1 * factor;
            return 0;
        });
    }

    return data;
}

/* =================== LOAD =================== */
async function load() {
    loading.value = true;
    try {
        // stats
        try {
            statusStats.value = await fetchStudentStatusStatistics();
        } catch (e) {
            console.warn('Load stats failed:', e);
        }

        // allData (counts fallback)
        try {
            const all = await fetchStudents({ status: 'all', page: 1, size: 99999 });
            allData.value = all.items || [];
        } catch (e) {
            console.warn('Load all data failed:', e);
        }

        // list
        const classId = selectedClass.value?.value || '';
        let list = [];

        if (classId) {
            list = await fetchStudentsByClass(classId);
        } else {
            const res = await fetchStudents({ status: 'all', page: 1, size: 99999 });
            list = res.items || [];
        }

        const filtered = applyLocalFilters(list);

        totalRecords.value = filtered.length;
        const start = (page.value - 1) * size.value;
        const end = start + size.value;
        rows.value = filtered.slice(start, end);

        selection.value = [];
        selectAll.value = false;
    } catch (e) {
        swalToast.fire({ icon: 'error', title: e?.message || 'Tải dữ liệu thất bại' });
    } finally {
        loading.value = false;
    }
}

function onPageChange(e) {
    page.value = e.page + 1;
    size.value = e.rows;
    load();
}

function switchStatus(key) {
    currentStatus.value = key;
    page.value = 1;
    load();
}

function onSort(field) {
    if (sortField.value === field) sortOrder.value = sortOrder.value === 1 ? -1 : 1;
    else {
        sortField.value = field;
        sortOrder.value = 1;
    }
    page.value = 1;
    load();
}

/* =================== SELECTION =================== */
function toggleSelectAll() {
    if (selectAll.value) selection.value = [...rows.value];
    else selection.value = [];
}

function toggleSelect(row) {
    const idx = selection.value.findIndex((r) => r.id === row.id);
    if (idx >= 0) selection.value.splice(idx, 1);
    else selection.value.push(row);

    selectAll.value = selection.value.length === rows.value.length && rows.value.length > 0;
}

function isSelected(row) {
    return selection.value.some((r) => r.id === row.id);
}

/* =================== VIEW / ACTIONS =================== */
function openProfile(row) {
    if (!row?.id) return;
    studentIdForProfile.value = row.id;
    showProfile.value = true;
}

function openChangeClass(row) {
    studentForChange.value = row;
    showChangeClass.value = true;
}

/* ----- Single actions ----- */
async function onDelete(row) {
    if (isProcessing.value) return;

    const { isConfirmed } = await confirmDialog('Xóa học sinh?', `Xóa "${row.name}"? Thao tác không thể hoàn tác.`, {
        confirmText: 'Xóa',
        color: '#dc2626'
    });
    if (!isConfirmed) return;

    isProcessing.value = true;
    try {
        await deleteStudent(row.id, { timeoutMs: 12000 });
        swalToast.fire({ icon: 'success', title: `Đã xóa "${row.name}"` });
        await load();
    } catch (e) {
        swalToast.fire({ icon: 'error', title: e?.message || 'Xóa thất bại' });
    } finally {
        isProcessing.value = false;
    }
}

async function onReturnFromReserve(row) {
    if (isProcessing.value) return;

    const { isConfirmed } = await confirmDialog('Cho học sinh quay lại học?', `"${row.name}" sẽ được chuyển về trạng thái đang học`, {
        confirmText: 'Xác nhận',
        color: '#10b981',
        icon: 'question'
    });
    if (!isConfirmed) return;

    isProcessing.value = true;
    try {
        await returnStudentFromReserve(row.id);
        swalToast.fire({ icon: 'success', title: `Đã cho "${row.name}" quay lại học` });
        await load();
    } catch (e) {
        swalToast.fire({ icon: 'error', title: e?.message || 'Thao tác thất bại' });
    } finally {
        isProcessing.value = false;
    }
}

async function onChangeStatus(row, statusCode) {
    if (isProcessing.value) return;

    const labels = {
        DROPOUT: 'thôi học',
        RESERVED: 'bảo lưu',
        GRADUATED: 'tốt nghiệp',
        TRANSFERRED: 'chuyển trường'
    };

    const { value: reason, isConfirmed } = await inputDialog(`Xác nhận ${labels[statusCode] || 'cập nhật'}`, `Cập nhật trạng thái cho "${row.name}"`, {
        placeholder: 'Lý do (không bắt buộc)',
        confirmText: 'Xác nhận'
    });
    if (!isConfirmed) return;

    isProcessing.value = true;
    try {
        await changeStudentStatus({
            studentId: row.id,
            newStatus: statusCode,
            reason: reason || ''
        });
        swalToast.fire({ icon: 'success', title: `Đã cập nhật trạng thái cho "${row.name}"` });
        await load();
    } catch (e) {
        swalToast.fire({ icon: 'error', title: e?.message || 'Cập nhật thất bại' });
    } finally {
        isProcessing.value = false;
    }
}

/* ----- Bulk actions ----- */
function bulkChangeClass() {
    if (!selection.value.length) {
        swalToast.fire({ icon: 'info', title: 'Chưa chọn học sinh nào' });
        return;
    }
    if (selection.value.length !== 1) {
        swalToast.fire({ icon: 'info', title: 'Chỉ có thể chuyển lớp từng học sinh' });
        return;
    }
    openChangeClass(selection.value[0]);
}

async function bulkChangeStatus(statusCode) {
    if (isProcessing.value) return;
    if (!selection.value.length) {
        swalToast.fire({ icon: 'info', title: 'Chưa chọn học sinh nào' });
        return;
    }

    const labels = {
        DROPOUT: 'thôi học',
        RESERVED: 'bảo lưu',
        GRADUATED: 'tốt nghiệp',
        TRANSFERRED: 'chuyển trường'
    };

    const { value: reason, isConfirmed } = await inputDialog(`Xác nhận ${labels[statusCode] || 'cập nhật'}`, `Áp dụng cho ${selection.value.length} học sinh`, {
        placeholder: 'Lý do chung (không bắt buộc)',
        confirmText: 'Thực hiện'
    });
    if (!isConfirmed) return;

    isProcessing.value = true;

    Swal.fire({
        title: 'Đang xử lý...',
        html: `<div class="progress-info">0/${selection.value.length}</div>`,
        allowOutsideClick: false,
        didOpen: () => Swal.showLoading()
    });

    let ok = 0;
    let fail = 0;

    for (let i = 0; i < selection.value.length; i++) {
        const row = selection.value[i];
        try {
            await changeStudentStatus({ studentId: row.id, newStatus: statusCode, reason: reason || '' });
            ok++;
        } catch {
            fail++;
        }
        Swal.update({ html: `<div class="progress-info">${i + 1}/${selection.value.length}</div>` });
    }

    Swal.close();
    swalToast.fire({
        icon: fail ? 'warning' : 'success',
        title: fail ? `Hoàn thành: ${ok}/${selection.value.length}. Lỗi: ${fail}` : `Đã cập nhật ${ok} học sinh`
    });

    await load();
    isProcessing.value = false;
}

async function bulkDelete() {
    if (isProcessing.value) return;
    if (!selection.value.length) {
        swalToast.fire({ icon: 'info', title: 'Chưa chọn học sinh nào' });
        return;
    }

    const { isConfirmed } = await confirmDialog('Xóa học sinh đã chọn?', `Xóa ${selection.value.length} học sinh? Không thể hoàn tác.`, {
        confirmText: 'Xóa',
        color: '#dc2626'
    });
    if (!isConfirmed) return;

    isProcessing.value = true;

    Swal.fire({
        title: 'Đang xóa...',
        html: `<div class="progress-info">0/${selection.value.length}</div>`,
        allowOutsideClick: false,
        didOpen: () => Swal.showLoading()
    });

    try {
        const ids = selection.value.map((s) => s.id);
        const result = await deleteStudents(ids, { timeoutMs: 12000 });

        Swal.close();
        swalToast.fire({
            icon: result.fail ? 'warning' : 'success',
            title: result.fail ? `Xóa: ${result.ok}/${ids.length}. Lỗi: ${result.fail}` : `Đã xóa ${result.ok} học sinh`
        });
        await load();
    } catch (e) {
        Swal.close();
        swalToast.fire({ icon: 'error', title: e?.message || 'Xóa thất bại' });
    } finally {
        isProcessing.value = false;
    }
}

/* =================== EXPORT =================== */
async function onExport() {
    try {
        await exportStudentsExcel();
        swalToast.fire({ icon: 'success', title: 'Đang tải file Excel' });
    } catch (e) {
        swalToast.fire({ icon: 'error', title: e?.message || 'Xuất Excel thất bại' });
    }
}

/* =================== CALLBACKS =================== */
async function onImported() {
    showImport.value = false;
    await load();
    swalToast.fire({ icon: 'success', title: 'Import thành công' });
}
async function onStudentCreated() {
    showCreate.value = false;
    await load();
    swalToast.fire({ icon: 'success', title: 'Tạo học sinh thành công' });
}
async function onClassChanged() {
    showChangeClass.value = false;
    await load();
    swalToast.fire({ icon: 'success', title: 'Chuyển lớp thành công' });
}
async function onProfileUpdated() {
    await load();
}

/* =================== UTILS =================== */
function formatDate(d) {
    if (!d) return '—';
    try {
        const dt = new Date(d);
        if (Number.isNaN(dt.getTime())) return d;
        return dt.toLocaleDateString('vi-VN');
    } catch {
        return d;
    }
}

function getGenderConfig(g) {
    return g === 'F'
        ? { icon: 'fa-venus', color: 'text-pink-500', label: 'Nữ', bg: 'bg-pink-50' }
        : { icon: 'fa-mars', color: 'text-blue-500', label: 'Nam', bg: 'bg-blue-50' };
}

function getStatusConfig(status) {
    const configs = {
        studying: { bg: 'bg-blue-50', text: 'text-blue-600', icon: 'fa-user-graduate', label: 'Đang học' },
        reserved: { bg: 'bg-amber-50', text: 'text-amber-600', icon: 'fa-pause-circle', label: 'Bảo lưu' },
        graduated: { bg: 'bg-green-50', text: 'text-green-600', icon: 'fa-award', label: 'Tốt nghiệp' },
        dropped: { bg: 'bg-red-50', text: 'text-red-600', icon: 'fa-user-minus', label: 'Thôi học' },
        transferred: { bg: 'bg-purple-50', text: 'text-purple-600', icon: 'fa-exchange-alt', label: 'Chuyển trường' }
    };
    return configs[status] || { bg: 'bg-gray-50', text: 'text-gray-600', icon: 'fa-user', label: status };
}

function getAvatar(name) {
    if (!name) return '?';
    return name.charAt(0).toUpperCase();
}

function getAvatarColor(name) {
    if (!name) return 'from-gray-400 to-gray-500';
    const colors = [
        'from-blue-400 to-blue-600',
        'from-green-400 to-green-600',
        'from-purple-400 to-purple-600',
        'from-pink-400 to-pink-600',
        'from-indigo-400 to-indigo-600',
        'from-teal-400 to-teal-600'
    ];
    const index = name.charCodeAt(0) % colors.length;
    return colors[index];
}

/* =================== WATCH =================== */
let debounceTimer;
watch(keyword, () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
        page.value = 1;
        load();
    }, 300);
});

watch(selectedYear, async () => {
    await loadClassFilters();
    page.value = 1;
    await load();
});

watch(selectedGrade, () => {
    buildFilters();
    page.value = 1;
    load();
});

watch(selectedClass, () => {
    page.value = 1;
    load();
});

/* =================== INIT =================== */
onMounted(async () => {
    await loadClassFilters();
    await load();
});
</script>

<template>
    <div class="student-page">
        <!-- ✅ Modals: chỉ render 1 lần (đã xóa block trùng ở cuối) -->
        <ImportStudentsModal v-model:modelValue="showImport" @imported="onImported" :useServerTemplate="true" />
        <CreateStudentModal v-model:modelValue="showCreate" @created="onStudentCreated" />
        <ChangeStudentClassModal v-model:modelValue="showChangeClass" :student="studentForChange" @changed="onClassChanged" />
        <StudentProfileModal v-model:modelValue="showProfile" :studentId="studentIdForProfile" @updated="onProfileUpdated" />

        <header class="page-header">
            <div class="header-left">
                <div class="header-icon">
                    <i class="fa-solid fa-user-graduate"></i>
                </div>
                <div>
                    <h1 class="page-title">Quản lý học sinh</h1>
                    <p class="page-desc">Quản lý thông tin học sinh theo lớp và năm học</p>
                </div>
            </div>
            <div class="header-stats">
                <div class="header-stat">
                    <i class="fa-solid fa-users"></i>
                    <span><strong>{{ counts.all }}</strong> học sinh</span>
                </div>
            </div>
            <div class="header-actions">
                <button class="btn btn-outline" @click="onDownloadImportTemplate">
                    <i class="fa-solid fa-download"></i>
                    <span>Tải file mẫu</span>
                </button>

                <button class="btn btn-outline" @click="showImport = true">
                    <i class="fa-solid fa-file-import"></i>
                    <span>Nhập Excel</span>
                </button>
                <button class="btn btn-outline" @click="onExport">
                    <i class="fa-solid fa-file-excel"></i>
                    <span>Xuất Excel</span>
                </button>
                <button class="btn btn-primary" @click="showCreate = true">
                    <i class="fa-solid fa-plus"></i>
                    <span>Thêm học sinh</span>
                </button>
            </div>
        </header>

        <div class="status-tabs">
            <button
                v-for="tab in statusTabs"
                :key="tab.key"
                class="status-tab"
                :class="{ active: currentStatus === tab.key, [`tab-${tab.color}`]: true }"
                @click="switchStatus(tab.key)"
            >
                <div class="tab-icon">
                    <i :class="['fa-solid', tab.icon]"></i>
                </div>
                <div class="tab-content">
                    <span class="tab-count">{{ counts[tab.key] || 0 }}</span>
                    <span class="tab-label">{{ tab.label }}</span>
                </div>
            </button>
        </div>

        <div class="filter-card">
            <div class="filter-grid">
                <div class="filter-item">
                    <label>Năm học</label>
                    <Dropdown v-model="selectedYear" :options="years" optionLabel="label" class="w-full" />
                </div>
                <div class="filter-item">
                    <label>Khối</label>
                    <Dropdown v-model="selectedGrade" :options="gradeOptions" optionLabel="label" class="w-full" />
                </div>
                <div class="filter-item">
                    <label>Lớp</label>
                    <Dropdown v-model="selectedClass" :options="classFilters" optionLabel="label" class="w-full" />
                </div>
                <div class="filter-item filter-search">
                    <label>Tìm kiếm</label>
                    <div class="search-box">
                        <i class="fa-solid fa-search"></i>
                        <InputText v-model="keyword" placeholder="Tên, mã học sinh..." class="w-full" />
                    </div>
                </div>
            </div>

            <div class="bulk-section">
                <div class="bulk-left">
                    <span v-if="selection.length" class="bulk-count">
                        <i class="fa-solid fa-check-circle"></i>
                        Đã chọn <strong>{{ selection.length }}</strong> học sinh
                    </span>
                </div>
                <div class="bulk-actions">
                    <button class="btn btn-sm btn-outline" @click="bulkChangeClass" :disabled="selection.length !== 1" title="Chọn 1 học sinh để chuyển lớp">
                        <i class="fa-solid fa-right-left"></i>
                        <span>Chuyển lớp</span>
                    </button>
                    <button class="btn btn-sm btn-amber" @click="bulkChangeStatus('RESERVED')" :disabled="!selection.length || isProcessing">
                        <i class="fa-solid fa-pause-circle"></i>
                        <span>Bảo lưu</span>
                    </button>
                    <button class="btn btn-sm btn-rose" @click="bulkChangeStatus('DROPOUT')" :disabled="!selection.length || isProcessing">
                        <i class="fa-solid fa-user-minus"></i>
                        <span>Thôi học</span>
                    </button>
                    <button class="btn btn-sm btn-green" @click="bulkChangeStatus('GRADUATED')" :disabled="!selection.length || isProcessing">
                        <i class="fa-solid fa-award"></i>
                        <span>Tốt nghiệp</span>
                    </button>
                    <button class="btn btn-sm btn-danger" @click="bulkDelete" :disabled="!selection.length || isProcessing">
                        <i class="fa-solid fa-trash"></i>
                        <span>Xóa</span>
                    </button>
                </div>
            </div>
        </div>

        <div class="table-container">
            <div v-if="loading" class="loading-overlay">
                <div class="loading-spinner">
                    <i class="fa-solid fa-spinner fa-spin"></i>
                </div>
                <span>Đang tải dữ liệu...</span>
            </div>

            <table class="data-table">
                <thead>
                    <tr>
                        <th class="col-checkbox">
                            <Checkbox v-model="selectAll" :binary="true" @change="toggleSelectAll" />
                        </th>
                        <th class="col-index">#</th>
                        <th class="col-code">
                            <div class="th-sortable" @click="onSort('code')">
                                <span>Mã HS</span>
                                <i v-if="sortField === 'code'" :class="sortOrder === 1 ? 'fa-solid fa-caret-up' : 'fa-solid fa-caret-down'"></i>
                            </div>
                        </th>
                        <th class="col-student">
                            <div class="th-sortable" @click="onSort('name')">
                                <span>Học sinh</span>
                                <i v-if="sortField === 'name'" :class="sortOrder === 1 ? 'fa-solid fa-caret-up' : 'fa-solid fa-caret-down'"></i>
                            </div>
                        </th>
                        <th class="col-class">
                            <div class="th-sortable" @click="onSort('className')">
                                <span>Lớp</span>
                                <i v-if="sortField === 'className'" :class="sortOrder === 1 ? 'fa-solid fa-caret-up' : 'fa-solid fa-caret-down'"></i>
                            </div>
                        </th>
                        <th class="col-parent">Phụ huynh</th>
                        <th class="col-status">Trạng thái</th>
                        <th class="col-actions">Thao tác</th>
                    </tr>
                </thead>
                <tbody>
                    <tr v-for="(row, idx) in rows" :key="row.id" :class="{ 'row-selected': isSelected(row) }">
                        <td class="col-checkbox">
                            <Checkbox :modelValue="isSelected(row)" :binary="true" @change="toggleSelect(row)" />
                        </td>
                        <td class="col-index">{{ (page - 1) * size + idx + 1 }}</td>
                        <td class="col-code">
                            <span class="code-badge">{{ row.code || row.studentCode || '—' }}</span>
                        </td>
                        <td class="col-student">
                            <div class="student-cell" @click="openProfile(row)">
                                <div class="student-avatar" :class="getAvatarColor(row.name)">
                                    {{ getAvatar(row.name) }}
                                </div>
                                <div class="student-info">
                                    <span class="student-name">{{ row.name }}</span>
                                    <div class="student-meta">
                                        <span class="meta-item">
                                            <i class="fa-regular fa-calendar"></i>
                                            {{ formatDate(row.dob) }}
                                        </span>
                                        <span class="meta-item" :class="getGenderConfig(row.gender).color">
                                            <i :class="['fa-solid', getGenderConfig(row.gender).icon]"></i>
                                            {{ getGenderConfig(row.gender).label }}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </td>
                        <td class="col-class">
                            <span class="class-badge">
                                <i class="fa-solid fa-chalkboard"></i>
                                {{ row.className || '—' }}
                            </span>
                        </td>
                        <td class="col-parent">
                            <div class="parent-cell">
                                <span class="parent-name">{{ row.parentName || '—' }}</span>
                                <span class="parent-phone">
                                    <i class="fa-solid fa-phone"></i>
                                    {{ row.parentPhone || row.phone || '—' }}
                                </span>
                            </div>
                        </td>
                        <td class="col-status">
                            <span class="status-badge" :class="[getStatusConfig(row.status).bg, getStatusConfig(row.status).text]">
                                <i :class="['fa-solid', getStatusConfig(row.status).icon]"></i>
                                {{ getStatusConfig(row.status).label }}
                            </span>
                        </td>
                        <td class="col-actions">
                            <div class="action-group">
                                <button class="action-btn" @click="openProfile(row)" title="Xem hồ sơ">
                                    <i class="fa-solid fa-eye"></i>
                                </button>
                                <button class="action-btn" @click="openChangeClass(row)" title="Chuyển lớp">
                                    <i class="fa-solid fa-right-left"></i>
                                </button>

                                <button v-if="row.status === 'reserved'" class="action-btn success" @click="onReturnFromReserve(row)" title="Quay lại học">
                                    <i class="fa-solid fa-rotate-left"></i>
                                </button>
                                <button v-else-if="row.status === 'studying'" class="action-btn warning" @click="onChangeStatus(row, 'RESERVED')" title="Bảo lưu">
                                    <i class="fa-solid fa-pause-circle"></i>
                                </button>

                                <button class="action-btn danger" @click="onDelete(row)" title="Xóa" :disabled="isProcessing">
                                    <i class="fa-solid fa-trash"></i>
                                </button>
                            </div>
                        </td>
                    </tr>

                    <tr v-if="!loading && !rows.length">
                        <td colspan="8" class="empty-cell">
                            <div class="empty-state">
                                <i class="fa-solid fa-user-slash"></i>
                                <h3>Không có học sinh nào</h3>
                                <p>Thử thay đổi bộ lọc hoặc thêm học sinh mới</p>
                                <button class="btn btn-primary" @click="showCreate = true">
                                    <i class="fa-solid fa-plus"></i>
                                    Thêm học sinh
                                </button>
                            </div>
                        </td>
                    </tr>
                </tbody>
            </table>
        </div>

        <div v-if="totalRecords > 0" class="pagination-section">
            <div class="pagination-info">
                Hiển thị <strong>{{ (page - 1) * size + 1 }}</strong> - <strong>{{ Math.min(page * size, totalRecords) }}</strong> / <strong>{{ totalRecords }}</strong> học sinh
            </div>
            <Paginator :rows="size" :totalRecords="totalRecords" :first="(page - 1) * size" @page="onPageChange" :rowsPerPageOptions="[20, 50, 100]" />
        </div>
    </div>
</template>

<style scoped>
/* ===== Base ===== */
.student-page {
    padding: 1.5rem;
    max-width: 1500px;
    margin: 0 auto;
    background: #f8fafc;
    min-height: 100vh;
}

/* ===== Header ===== */
.page-header {
    display: flex;
    align-items: center;
    gap: 1rem;
    margin-bottom: 1.5rem;
    flex-wrap: wrap;
}

.header-left {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    flex: 1;
    min-width: 250px;
}

.header-icon {
    width: 52px;
    height: 52px;
    background: linear-gradient(135deg, #6366f1, #8b5cf6);
    border-radius: 14px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: white;
    font-size: 1.375rem;
    box-shadow: 0 4px 12px rgba(99, 102, 241, 0.3);
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

.header-stats {
    display: flex;
    gap: 1rem;
}

.header-stat {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 1rem;
    background: white;
    border-radius: 10px;
    border: 1px solid #e2e8f0;
    font-size: 0.875rem;
    color: #475569;
}

.header-stat i {
    color: #6366f1;
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
    white-space: nowrap;
}

.btn-sm {
    padding: 0.375rem 0.75rem;
    font-size: 0.8125rem;
}

.btn-primary {
    background: #6366f1;
    color: white;
}
.btn-primary:hover {
    background: #4f46e5;
}

.btn-amber {
    background: #f59e0b;
    color: white;
}
.btn-rose {
    background: #f43f5e;
    color: white;
}
.btn-green {
    background: #10b981;
    color: white;
}

.btn-danger {
    background: #ef4444;
    color: white;
}
.btn-danger:hover {
    background: #dc2626;
}

.btn-outline {
    background: white;
    color: #475569;
    border: 1px solid #e2e8f0;
}
.btn-outline:hover {
    background: #f8fafc;
    border-color: #cbd5e1;
}

.btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
}

/* ===== Status Tabs ===== */
.status-tabs {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));
    gap: 0.75rem;
    margin-bottom: 1rem;
}

.status-tab {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.875rem 1rem;
    background: white;
    border: 2px solid transparent;
    border-radius: 12px;
    cursor: pointer;
    transition: all 0.2s;
}

.status-tab:hover {
    border-color: #e2e8f0;
}

.status-tab.active {
    border-color: #6366f1;
    box-shadow: 0 2px 8px rgba(99, 102, 241, 0.15);
}

.status-tab.tab-blue.active {
    border-color: #3b82f6;
}
.status-tab.tab-amber.active {
    border-color: #f59e0b;
}
.status-tab.tab-green.active {
    border-color: #10b981;
}
.status-tab.tab-red.active {
    border-color: #ef4444;
}
.status-tab.tab-purple.active {
    border-color: #8b5cf6;
}

.tab-icon {
    width: 36px;
    height: 36px;
    border-radius: 10px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: #f1f5f9;
    color: #64748b;
    font-size: 0.875rem;
}

.status-tab.active .tab-icon {
    background: #6366f1;
    color: white;
}
.status-tab.tab-blue.active .tab-icon {
    background: #3b82f6;
}
.status-tab.tab-amber.active .tab-icon {
    background: #f59e0b;
}
.status-tab.tab-green.active .tab-icon {
    background: #10b981;
}
.status-tab.tab-red.active .tab-icon {
    background: #ef4444;
}
.status-tab.tab-purple.active .tab-icon {
    background: #8b5cf6;
}

.tab-content {
    display: flex;
    flex-direction: column;
}

.tab-count {
    font-size: 1.25rem;
    font-weight: 700;
    color: #1e293b;
    line-height: 1.2;
}

.tab-label {
    font-size: 0.75rem;
    color: #64748b;
}

/* ===== Filter Card ===== */
.filter-card {
    background: white;
    border-radius: 12px;
    border: 1px solid #e2e8f0;
    padding: 1rem;
    margin-bottom: 1rem;
}

.filter-grid {
    display: grid;
    grid-template-columns: 160px 140px 160px 1fr;
    gap: 1rem;
    margin-bottom: 1rem;
}

@media (max-width: 900px) {
    .filter-grid {
        grid-template-columns: 1fr 1fr;
    }
}

@media (max-width: 600px) {
    .filter-grid {
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
    letter-spacing: 0.025em;
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
    font-size: 0.875rem;
}

.search-box input {
    padding-left: 2.25rem !important;
}

.bulk-section {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding-top: 1rem;
    border-top: 1px solid #f1f5f9;
    flex-wrap: wrap;
    gap: 0.75rem;
}

.bulk-count {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.875rem;
    color: #6366f1;
}

.bulk-actions {
    display: flex;
    gap: 0.5rem;
    flex-wrap: wrap;
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
    background: rgba(255, 255, 255, 0.95);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.75rem;
    z-index: 10;
}

.loading-spinner {
    width: 48px;
    height: 48px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1.5rem;
    color: #6366f1;
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
    vertical-align: middle;
}

.data-table tbody tr:hover {
    background: #f8fafc;
}

.row-selected {
    background: #eef2ff !important;
}

.col-checkbox {
    width: 40px;
}
.col-index {
    width: 50px;
}
.col-code {
    width: 100px;
}
.col-student {
    min-width: 220px;
}
.col-class {
    min-width: 120px;
}
.col-parent {
    min-width: 180px;
}
.col-status {
    min-width: 120px;
}
.col-actions {
    width: 160px;
    text-align: center;
}

.th-sortable {
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
    cursor: pointer;
    user-select: none;
}

.code-badge {
    display: inline-flex;
    padding: 0.25rem 0.5rem;
    background: #f1f5f9;
    color: #475569;
    border-radius: 4px;
    font-size: 0.8125rem;
    font-family: 'SF Mono', 'Consolas', monospace;
}

.student-cell {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    cursor: pointer;
}

.student-avatar {
    width: 42px;
    height: 42px;
    border-radius: 50%;
    background: linear-gradient(135deg, var(--tw-gradient-stops));
    color: white;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 600;
    font-size: 0.9375rem;
    flex-shrink: 0;
}

.student-info {
    display: flex;
    flex-direction: column;
    min-width: 0;
}

.student-name {
    font-weight: 600;
    color: #1e293b;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.student-meta {
    display: flex;
    gap: 0.75rem;
    font-size: 0.75rem;
    color: #64748b;
    margin-top: 0.125rem;
}

.meta-item {
    display: flex;
    align-items: center;
    gap: 0.25rem;
}

.class-badge {
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
    padding: 0.25rem 0.75rem;
    background: #dbeafe;
    color: #1d4ed8;
    border-radius: 20px;
    font-size: 0.8125rem;
    font-weight: 500;
}

.parent-cell {
    display: flex;
    flex-direction: column;
}

.parent-name {
    color: #1e293b;
    font-weight: 500;
}

.parent-phone {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    font-size: 0.75rem;
    color: #64748b;
    margin-top: 0.125rem;
}

.status-badge {
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
    padding: 0.25rem 0.75rem;
    border-radius: 20px;
    font-size: 0.75rem;
    font-weight: 500;
}

.action-group {
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
    font-size: 0.8125rem;
}

.action-btn.success:hover {
    background: #dcfce7;
    color: #16a34a;
}
.action-btn.warning:hover {
    background: #fef3c7;
    color: #d97706;
}
.action-btn.danger:hover {
    background: #fee2e2;
    color: #dc2626;
}

.empty-cell {
    padding: 0 !important;
}

.empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 4rem 2rem;
    text-align: center;
}

.pagination-section {
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

/* responsive helpers */
.table-container {
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
}
.data-table {
    min-width: 980px;
}
</style>
