<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import { useRouter } from 'vue-router';
import '@fortawesome/fontawesome-free/css/all.min.css';

import DataTable from 'primevue/datatable';
import Column from 'primevue/column';
import InputText from 'primevue/inputtext';
import Dropdown from 'primevue/dropdown';
import Button from 'primevue/button';
import Avatar from 'primevue/avatar';
import Menu from 'primevue/menu';
import Paginator from 'primevue/paginator';

import Swal from 'sweetalert2';

import {
    fetchStudents,
    exportStudentsExcel,
    deleteStudent,
    deleteStudents
} from '@/service/studentService.js';
import { fetchClassOptions } from '@/service/classService.js';

import ImportStudentsModal from '@/components/staff/ImportStudentsModal.vue';
import CreateStudentModal from '@/components/staff/CreateStudentModal.vue';
import ChangeStudentClassModal from '@/components/staff/ChangeStudentClassModal.vue';
import StudentProfileModal from '@/components/staff/StudentProfileModal.vue';

const router = useRouter();

/* ================= TOP FILTERS ================= */

// Năm học (tạm thời fix cứng, sau này có thể lấy từ BE)
const years = ref([
    { label: '2024 - 2025', value: '2024-2025' },
    { label: '2023 - 2024', value: '2023-2024' }
]);
const selectedYear = ref(years.value[0]);

// Danh sách lớp lấy từ BE (Classes)
const classOptions = ref([]); // [{ value, label, grade, academicYear, ... }]

// Khối – sinh ra từ classOptions
const gradeFilters = ref([{ label: 'Tất cả khối', value: '' }]);
const selectedGrade = ref(gradeFilters.value[0]);

// Lớp – sinh ra từ classOptions & khối
const classFilters = ref([{ label: 'Tất cả lớp', value: '' }]);
const selectedClassFilter = ref(classFilters.value[0]);

/* ================= STATUS TABS ================= */

const status = ref('studying');
const statusDefs = [
    { key: 'studying', label: 'Đang đi học', color: 'text-primary', bg: 'tab--blue' },
    { key: 'waiting', label: 'Chờ phân lớp', color: 'text-amber-600', bg: 'tab--amber' },
    { key: 'reserved', label: 'Đã bảo lưu', color: 'text-orange-600', bg: 'tab--orange' },
    { key: 'dropped', label: 'Đã thôi học', color: 'text-rose-600', bg: 'tab--rose' },
    { key: 'graduated', label: 'Đã tốt nghiệp', color: 'text-emerald-600', bg: 'tab--green' },
    { key: 'deleted', label: 'Đã xóa', color: 'text-rose-600', bg: 'tab--red' }
];

/* ================= FILTER TRONG HEADER BẢNG ================= */

const fCode = ref('');
const fName = ref('');
const fClass = ref('');
const fParent = ref('');

/* ================= PAGINATION / SORT ================= */

const page = ref(1);
const size = ref(10);
const sortField = ref('');
const sortOrder = ref(0);

/* ================= DATA ================= */

const loadingInit = ref(false);
const loadingList = ref(false);
const rows = ref([]);
const totalRecords = ref(0);
const selection = ref([]);

const allData = ref([]);
const counts = computed(() => ({
    studying: allData.value.filter((x) => x.status === 'studying').length,
    waiting: allData.value.filter((x) => x.status === 'waiting').length,
    reserved: allData.value.filter((x) => x.status === 'reserved').length,
    dropped: allData.value.filter((x) => x.status === 'dropped').length,
    graduated: allData.value.filter((x) => x.status === 'graduated').length,
    deleted: allData.value.filter((x) => x.status === 'deleted').length,
    total: allData.value.length
}));

/* ================= SWEETALERT ================= */

const swalToast = Swal.mixin({
    toast: true,
    position: 'top-end',
    showConfirmButton: false,
    timer: 2400,
    timerProgressBar: true
});

/* disable actions while deleting to avoid duplicate clicks */
const isDeleting = ref(false);

/* ================= ROW MENU + MODALS ================= */

const rowMenu = ref();
const activeRow = ref(null);

const showChangeClass = ref(false);
const studentForChange = ref(null);

const showProfile = ref(false);
const studentIdForProfile = ref(null);

function openRowMenu(e, row) {
    activeRow.value = row;
    rowMenu.value.toggle(e);
}

function openChangeClass(row) {
    studentForChange.value = row;
    showChangeClass.value = true;
}

function openProfile(row) {
    if (!row?.id) return;
    studentIdForProfile.value = row.id;
    showProfile.value = true;
}

async function onClassChanged() {
    await load(false);
}

async function onProfileUpdated() {
    await load(false);
}

const rowMenuItems = ref([
    {
        label: 'Xem hồ sơ',
        icon: 'fa-regular fa-id-card',
        tone: 'primary',
        sub: 'Xem và cập nhật thông tin',
        kb: '↵',
        command: () => {
            if (activeRow.value?.id) openProfile(activeRow.value);
        }
    },
    {
        label: 'Chuyển lớp',
        icon: 'fa-solid fa-right-left',
        tone: 'warn',
        sub: 'Đổi lớp hiện tại',
        command: () => {
            if (activeRow.value) {
                openChangeClass(activeRow.value);
            }
        }
    },

    { separator: true },
    {
        label: 'Thôi học',
        icon: 'fa-solid fa-user-minus',
        tone: 'warn',
        sub: 'Tạm dừng/hủy học',
        command: () => {}
    },
    {
        label: 'Bảo lưu',
        icon: 'fa-solid fa-tent-arrow-left-right',
        tone: 'info',
        sub: 'Giữ chỗ cho kỳ sau',
        command: () => {}
    },
    {
        label: 'Xóa học sinh',
        icon: 'fa-regular fa-trash-can',
        tone: 'danger',
        sub: 'Không thể hoàn tác',
        command: () => onDeleteRow(activeRow.value)
    }
]);

/* ================= HELPERS ================= */

function genderIcon(g) {
    return g === 'F' ? 'fa-solid fa-venus text-pink-500' : 'fa-solid fa-mars text-blue-500';
}
function formatDob(d) {
    if (!d) return '-';
    try {
        const dt = new Date(d);
        if (Number.isNaN(dt.getTime())) return d;
        const dd = dt.getDate().toString().padStart(2, '0');
        const mm = (dt.getMonth() + 1).toString().padStart(2, '0');
        const yyyy = dt.getFullYear();
        return `${dd}/${mm}/${yyyy}`;
    } catch {
        return d;
    }
}

/* ================= BUILD FILTERS TỪ DANH SÁCH LỚP ================= */

function buildFiltersFromClasses() {
    const all = classOptions.value || [];

    // ---- Khối (grade) ----
    const gradeSet = new Set();
    all.forEach((c) => {
        if (c.grade) gradeSet.add(c.grade);
    });

    const newGradeFilters = [
        { label: 'Tất cả khối', value: '' },
        ...Array.from(gradeSet).map((g) => ({ label: g, value: g }))
    ];
    gradeFilters.value = newGradeFilters;

    if (!newGradeFilters.some((g) => g.value === selectedGrade.value?.value)) {
        selectedGrade.value = newGradeFilters[0];
    }

    // ---- Lớp ----
    const currentGrade = selectedGrade.value?.value || '';

    const classesForGrade = currentGrade
        ? all.filter((c) => c.grade === currentGrade)
        : all;

    const newClassFilters = [
        { label: 'Tất cả lớp', value: '' },
        ...classesForGrade.map((c) => ({
            label: c.label || c.className,
            value: c.label || c.className
        }))
    ];

    classFilters.value = newClassFilters;

    if (!newClassFilters.some((c) => c.value === selectedClassFilter.value?.value)) {
        selectedClassFilter.value = newClassFilters[0];
    }
}

/* ================= LOAD DANH SÁCH LỚP CHO FILTER ================= */

async function loadClassFilters() {
    try {
        const year = selectedYear.value?.value;
        // tuỳ implement fetchClassOptions của bạn – chỉ cần trả về list [{ value, label, grade, academicYear }]
        const list = await fetchClassOptions(year ? { year } : {});
        classOptions.value = Array.isArray(list) ? list : [];
        buildFiltersFromClasses();
    } catch (e) {
        console.error('Không tải được danh sách lớp:', e?.message || e);
        classOptions.value = [];
        buildFiltersFromClasses();
    }
}

/* ================= LOAD DANH SÁCH HỌC SINH ================= */

async function load(isInit = false) {
    if (isInit) loadingInit.value = true;
    else loadingList.value = true;
    try {
        // Lấy tất cả để đếm số lượng theo status
        const all = await fetchStudents({ status: 'all', page: 1, size: 99999 });
        allData.value = all.items;

        const sort = sortField.value
            ? `${sortField.value},${sortOrder.value === -1 ? 'desc' : 'asc'}`
            : undefined;

        // ----- MAP filter Khối + Lớp -----
        let classNameFilter;

        // 1. Nếu chọn Lớp cụ thể -> lọc đúng lớp đó
        if (selectedClassFilter.value?.value) {
            classNameFilter = selectedClassFilter.value.value; // "Mầm 2"
        }
        // 2. Không chọn lớp nhưng chọn Khối -> lọc tất cả lớp thuộc khối đó
        else if (selectedGrade.value?.value) {
            classNameFilter = selectedGrade.value.value; // "Mầm" -> match "Mầm 1", "Mầm 2"
        }
        // 3. Nếu không chọn gì mà user gõ ô Lớp trong header
        else if (fClass.value) {
            classNameFilter = fClass.value;
        }

        const { items, total } = await fetchStudents({
            status: status.value,
            year: selectedYear.value?.value, // hiện FE-side chưa dùng, nhưng để đó sau mở rộng
            className: classNameFilter || undefined,
            code: fCode.value || undefined,
            name: fName.value || undefined,
            parentName: fParent.value || undefined,
            page: page.value,
            size: size.value,
            sort
        });

        rows.value = items;
        totalRecords.value = total;
    } finally {
        if (isInit) loadingInit.value = false;
        else loadingList.value = false;
    }
}

/* ================= SORT / PAGINATION ================= */

function onStatusChange(k) {
    status.value = k;
    page.value = 1;
    load(false);
}
function onSort(field) {
    if (sortField.value === field) sortOrder.value = sortOrder.value === 1 ? -1 : 1;
    else {
        sortField.value = field;
        sortOrder.value = 1;
    }
    load(false);
}
function onChangePage(e) {
    page.value = e.page + 1;
    size.value = e.rows;
    load(false);
}

/* ================= BULK ACTIONS ================= */

function onBulk(action) {
    if (action === 'delete') onBulkDelete();
}

/* ================= EXPORT ================= */

async function onExport() {
    try {
        await exportStudentsExcel();
        swalToast.fire({ icon: 'success', title: 'Đang tải file học sinh' });
    } catch (e) {
        swalToast.fire({ icon: 'error', title: e?.message || 'Xuất Excel thất bại' });
    }
}

/* ================= IMPORT MODAL ================= */

const showImport = ref(false);
function openImport() {
    showImport.value = true;
}
async function onImported() {
    await load(false);
}

/* ================= CREATE STUDENT MODAL ================= */

const showCreate = ref(false);
function openCreate() {
    showCreate.value = true;
}
async function onStudentCreated() {
    await load(false);
}

/* ================= XOÁ 1 HỌC SINH ================= */

async function onDeleteRow(row) {
    if (isDeleting.value || !row?.id) return;
    const { isConfirmed } = await Swal.fire({
        title: 'Xóa học sinh?',
        text: `Bạn có chắc muốn xóa "${row.name}"? Thao tác không thể hoàn tác.`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Xóa',
        cancelButtonText: 'Hủy',
        confirmButtonColor: '#dc2626',
        cancelButtonColor: '#64748b',
        reverseButtons: true
    });
    if (!isConfirmed) return;

    isDeleting.value = true;
    Swal.fire({
        toast: true,
        position: 'top-end',
        title: 'Đang xóa...',
        showConfirmButton: false,
        timer: 900,
        timerProgressBar: true,
        didOpen: () => Swal.showLoading()
    });

    try {
        await deleteStudent(row.id, { timeoutMs: 12000 });
        await swalToast.fire({ icon: 'success', title: `Đã xóa "${row.name}"` });
        await load(false);
    } catch (e) {
        await swalToast.fire({ icon: 'error', title: e?.message || 'Xóa học sinh thất bại' });
    } finally {
        isDeleting.value = false;
    }
}

/* ================= XOÁ NHIỀU HỌC SINH ================= */

async function onBulkDelete() {
    if (isDeleting.value) return;
    const ids = selection.value.map((s) => s.id);
    if (!ids.length) {
        await swalToast.fire({ icon: 'info', title: 'Chưa chọn học sinh nào' });
        return;
    }
    const { isConfirmed } = await Swal.fire({
        title: 'Xóa học sinh đã chọn?',
        text: `Sẽ xóa ${ids.length} học sinh. Thao tác không thể hoàn tác.`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Xóa',
        cancelButtonText: 'Hủy',
        confirmButtonColor: '#dc2626',
        cancelButtonColor: '#64748b',
        reverseButtons: true
    });
    if (!isConfirmed) return;

    isDeleting.value = true;
    Swal.fire({
        toast: true,
        position: 'top-end',
        title: `Đang xóa ${ids.length} học sinh...`,
        showConfirmButton: false,
        timer: 1200,
        timerProgressBar: true,
        didOpen: () => Swal.showLoading()
    });

    try {
        const result = await deleteStudents(ids, { timeoutMs: 12000 });
        const msg = result.fail
            ? `Xóa xong: ${result.ok}/${ids.length}. Lỗi: ${result.fail}`
            : `Đã xóa ${result.ok}/${ids.length} học sinh`;
        await swalToast.fire({ icon: result.fail ? 'warning' : 'success', title: msg });
        selection.value = [];
        await load(false);
    } catch (e) {
        await swalToast.fire({
            icon: 'error',
            title: e?.message || 'Xóa danh sách học sinh thất bại'
        });
    } finally {
        isDeleting.value = false;
    }
}

/* ================= DEBOUNCE FILTER HEADER ================= */

let t;
function debounce(fn, ms = 250) {
    clearTimeout(t);
    t = setTimeout(fn, ms);
}
watch([fCode, fName, fClass, fParent], () =>
    debounce(() => {
        page.value = 1;
        load(false);
    }, 300)
);

/* ================= WATCH TOP FILTERS ================= */

// Đổi năm học -> load lại danh sách lớp & học sinh
watch(
    () => selectedYear.value,
    async () => {
        await loadClassFilters();
        page.value = 1;
        await load(false);
    }
);

// Đổi khối -> rebuild list lớp + load học sinh
watch(
    () => selectedGrade.value,
    () => {
        buildFiltersFromClasses();
        page.value = 1;
        load(false);
    }
);

// Đổi lớp -> load học sinh
watch(
    () => selectedClassFilter.value,
    () => {
        page.value = 1;
        load(false);
    }
);

/* ================= LIFECYCLE ================= */

onMounted(async () => {
    await loadClassFilters();
    await load(true);
});
</script>

<template>
    <div class="px-4 md:px-6 lg:px-8 py-5 space-y-4">
        <!-- Header -->
        <div class="flex flex-wrap items-center justify-between gap-3">
            <h1 class="text-xl font-semibold text-slate-800">Học sinh</h1>
            <div class="flex items-center gap-2">
                <div
                    class="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 text-slate-700"
                >
                    <i class="fa-regular fa-clock text-primary"></i>
                    <span class="font-semibold">{{ counts.total }} học sinh</span>
                </div>
                <Button
                    class="!bg-emerald-600 !border-0 !text-white"
                    icon="fa-solid fa-file-arrow-up mr-2"
                    label="Nhập excel"
                    @click="openImport"
                />
                <Button
                    class="!bg-green-600 !border-0 !text-white"
                    icon="fa-solid fa-file-arrow-down mr-2"
                    label="Xuất excel"
                    @click="onExport"
                />
                <Button
                    class="!bg-primary !border-0 !text-white"
                    icon="fa-solid fa-plus mr-2"
                    label="Tạo học sinh"
                    @click="openCreate"
                />
            </div>
        </div>

        <!-- Top filters: Năm học / Khối / Lớp -->
        <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
            <Dropdown
                v-model="selectedYear"
                :options="years"
                optionLabel="label"
                class="w-full"
                placeholder="Năm học"
            />
            <Dropdown
                v-model="selectedGrade"
                :options="gradeFilters"
                optionLabel="label"
                class="w-full"
                placeholder="Chọn khối"
            />
            <Dropdown
                v-model="selectedClassFilter"
                :options="classFilters"
                optionLabel="label"
                class="w-full"
                placeholder="Chọn lớp"
            />
        </div>

        <!-- Status tabs -->
        <div class="flex flex-wrap items-center gap-4 border-b border-slate-200">
            <button
                v-for="s in statusDefs"
                :key="s.key"
                class="tab"
                :class="[status === s.key ? 'tab--active' : '', s.bg]"
                @click="onStatusChange(s.key)"
            >
                <span>{{ s.label }}</span>
                <span class="tab__badge">{{ counts[s.key] || 0 }}</span>
            </button>
        </div>

        <!-- Bulk actions -->
        <div class="flex flex-wrap items-center gap-2">
            <Button
                class="!bg-amber-500 !border-0 !text-white"
                icon="fa-solid fa-right-left mr-2"
                label="Chuyển lớp"
                @click="onBulk('class')"
            />
            <Button
                class="!bg-rose-500 !border-0 !text-white"
                icon="fa-solid fa-user-minus mr-2"
                label="Thôi học"
                @click="onBulk('drop')"
            />
            <Button
                class="!bg-orange-500 !border-0 !text-white"
                icon="fa-solid fa-tent-arrow-left-right mr-2"
                label="Bảo lưu"
                @click="onBulk('reserve')"
            />
            <Button
                class="!bg-red-600 !border-0 !text-white"
                :class="{ 'opacity-60 pointer-events-none': isDeleting }"
                :disabled="isDeleting"
                icon="fa-regular fa-trash-can mr-2"
                label="Xóa học sinh"
                @click="onBulk('delete')"
            />
        </div>

        <!-- Table -->
        <div
            class="rounded-xl border border-slate-200 overflow-hidden bg-white relative"
        >
            <!-- Loading overlay -->
            <div
                v-if="loadingInit || loadingList"
                class="absolute inset-0 bg-white/70 flex items-center justify-center z-10 text-slate-500 text-sm"
            >
                <i class="fa-solid fa-spinner fa-spin mr-2"></i> Đang tải dữ liệu học sinh...
            </div>

            <DataTable
                :value="rows"
                v-model:selection="selection"
                dataKey="id"
                :rows="size"
                responsiveLayout="scroll"
                :rowHover="true"
                class="p-datatable-sm"
            >
                <Column selectionMode="multiple" headerStyle="width: 3rem" />
                <Column
                    header="#"
                    :body="(_, opt) => opt.rowIndex + 1"
                    headerStyle="width: 4rem"
                />

                <!-- Mã học sinh -->
                <Column>
                    <template #header>
                        <div class="header-filter">
                            <InputText
                                v-model="fCode"
                                class="w-full"
                                placeholder="Mã học sinh"
                            />
                            <button
                                class="sort-btn"
                                @click="onSort('code')"
                                title="Sắp xếp theo mã"
                            >
                                <i class="fa-solid fa-up-down"></i>
                            </button>
                        </div>
                    </template>
                    <template #body="{ data }">
                        <span class="font-medium">{{ data.code || '-' }}</span>
                    </template>
                </Column>

                <!-- Tên học sinh -->
                <Column>
                    <template #header>
                        <div class="header-filter">
                            <InputText
                                v-model="fName"
                                class="w-full"
                                placeholder="Tên học sinh"
                            />
                            <button
                                class="sort-btn"
                                @click="onSort('name')"
                                title="Sắp xếp theo tên"
                            >
                                <i class="fa-solid fa-up-down"></i>
                            </button>
                        </div>
                    </template>
                    <template #body="{ data }">
                        <div class="flex items-center gap-3">
                            <Avatar
                                :label="(data.name?.[0] ?? 'H').toUpperCase()"
                                class="!bg-slate-100 !text-slate-700"
                            />
                            <div class="min-w-0">
                                <div
                                    class="font-semibold text-slate-900 truncate hover:underline cursor-pointer"
                                    @click="openProfile(data)"
                                >
                                    {{ data.name }}
                                </div>
                                <div
                                    class="text-slate-500 text-sm flex items-center gap-3"
                                >
                                    <span
                                        ><i class="fa-regular fa-calendar"></i>
                                        {{ formatDob(data.dob) }}</span
                                    >
                                    <span class="flex items-center gap-1">
                                        <i :class="genderIcon(data.gender)"></i>
                                        {{ data.gender === 'F' ? 'Nữ' : 'Nam' }}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </template>
                </Column>

                <!-- Lớp -->
                <Column header="Lớp">
                    <template #header>
                        <div class="header-filter">
                            <InputText v-model="fClass" class="w-full" placeholder="Lớp" />
                            <button
                                class="sort-btn"
                                @click="onSort('className')"
                                title="Sắp xếp theo lớp"
                            >
                                <i class="fa-solid fa-up-down"></i>
                            </button>
                        </div>
                    </template>
                    <template #body="{ data }">
                        <span class="font-medium">{{ data.className || '-' }}</span>
                    </template>
                </Column>

                <!-- Phụ huynh -->
                <Column>
                    <template #header>
                        <div class="header-filter">
                            <InputText
                                v-model="fParent"
                                class="w-full"
                                placeholder="Tên phụ huynh"
                            />
                            <button
                                class="sort-btn"
                                @click="onSort('parentName')"
                                title="Sắp xếp theo phụ huynh"
                            >
                                <i class="fa-solid fa-up-down"></i>
                            </button>
                        </div>
                    </template>
                    <template #body="{ data }">
                        <div class="text-slate-900">{{ data.parentName || '-' }}</div>
                        <div class="text-slate-500 text-sm">
                            <i class="fa-solid fa-phone"></i> {{ data.phone || '-' }}
                        </div>
                    </template>
                </Column>

                <!-- Hành động -->
                <Column
                    header="Hành động"
                    headerStyle="width: 6rem; text-align: right;"
                    bodyStyle="text-align: right;"
                >
                    <template #body="{ data }">
                        <Button
                            icon="fa-solid fa-ellipsis-vertical"
                            class="!bg-transparent !border-0 !text-slate-600 hover:!bg-slate-100"
                            @click="(e) => !isDeleting && openRowMenu(e, data)"
                        />
                    </template>
                </Column>
            </DataTable>
        </div>

        <div class="border-t border-slate-200 mt-2 flex justify-end">
            <Paginator :rows="size" :totalRecords="totalRecords" @page="onChangePage" />
        </div>

        <!-- Row menu + modals -->
        <Menu
            ref="rowMenu"
            :model="rowMenuItems"
            :popup="true"
            appendTo="body"
            :pt="{ menu: { class: 'rowmenu-panel' } }"
        >
            <template #item="{ item, props }">
                <div v-if="item.separator" class="rowmenu-sep"></div>
                <button
                    v-else
                    type="button"
                    v-bind="props.action"
                    class="menu-item"
                    :class="{
                        'menu-item--danger': item.tone === 'danger',
                        'menu-item--warn': item.tone === 'warn',
                        'menu-item--info': item.tone === 'info',
                        'menu-item--primary': item.tone === 'primary'
                    }"
                    @click="item.command && item.command()"
                >
                    <span class="menu-item__icon">
                        <i :class="item.icon"></i>
                    </span>
                    <div class="flex-1 min-w-0 text-left">
                        <div class="menu-item__label truncate">{{ item.label }}</div>
                        <div v-if="item.sub" class="menu-item__sub truncate">
                            {{ item.sub }}
                        </div>
                        <span v-if="item.kb" class="menu-item__kbd">{{ item.kb }}</span>
                    </div>
                </button>
            </template>
        </Menu>

        <ImportStudentsModal
            v-model:modelValue="showImport"
            @imported="onImported"
            :useServerTemplate="true"
        />
        <CreateStudentModal v-model:modelValue="showCreate" @created="onStudentCreated" />
        <ChangeStudentClassModal
            v-model:modelValue="showChangeClass"
            :student="studentForChange"
            @changed="onClassChanged"
        />
        <StudentProfileModal
            v-model:modelValue="showProfile"
            :studentId="studentIdForProfile"
            @updated="onProfileUpdated"
        />
    </div>
</template>

<style scoped>
.tab {
    position: relative;
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 10px 12px;
    color: #0f172a;
    border-bottom: 2px solid transparent;
    border-radius: 8px 8px 0 0;
    background: transparent;
}
.tab--active {
    border-color: #2563eb;
    color: #1d4ed8;
    background: #eef2ff;
}
.tab__badge {
    display: inline-flex;
    min-width: 22px;
    height: 22px;
    padding: 0 8px;
    border-radius: 9999px;
    align-items: center;
    justify-content: center;
    font-weight: 700;
    background: #e5e7eb;
}

/* Header filter */
.header-filter {
    display: flex;
    align-items: center;
    gap: 8px;
}
.sort-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 34px;
    height: 34px;
    border-radius: 8px;
    color: #64748b;
    background: #f8fafc;
    border: 1px solid #e2e8f0;
}
.sort-btn:hover {
    background: #f1f5f9;
}

/* Row menu panel – đồng bộ với Class/Teacher */
:deep(.rowmenu-panel) {
    padding: 6px;
    background: #fff;
    border-radius: 12px;
    border: 1px solid #e5e7eb;
    box-shadow:
        0 10px 15px -3px rgba(15, 23, 42, 0.15),
        0 4px 6px -4px rgba(15, 23, 42, 0.1);
    min-width: 240px;
}
.rowmenu-sep {
    height: 1px;
    background: #e5e7eb;
    margin: 6px 4px;
}
.menu-item {
    width: 100%;
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 10px;
    border-radius: 10px;
    border: none;
    background: transparent;
    cursor: pointer;
}
.menu-item:hover {
    background: #f8fafc;
}
.menu-item__icon {
    width: 26px;
    height: 26px;
    border-radius: 9999px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    background: #e5e7eb;
    color: #0f172a;
    flex-shrink: 0;
}
.menu-item--primary .menu-item__icon {
    background: #eff6ff;
    color: #2563eb;
}
.menu-item--info .menu-item__icon {
    background: #ecfeff;
    color: #0ea5e9;
}
.menu-item--warn .menu-item__icon {
    background: #fffbeb;
    color: #f59e0b;
}
.menu-item--danger .menu-item__icon {
    background: #fef2f2;
    color: #dc2626;
}
.menu-item__label {
    font-size: 14px;
    font-weight: 600;
    color: #0f172a;
}
.menu-item__sub {
    font-size: 12px;
    color: #64748b;
}7
.menu-item__kbd {
    margin-left: 10px;
    font-size: 11px;
    color: #334155;
    background: #f1f5f9;
    border: 1px solid #e2e8f0;
    padding: 0 6px;
    border-radius: 6px;
}
</style>
