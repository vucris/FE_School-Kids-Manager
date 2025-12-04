<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import '@fortawesome/fontawesome-free/css/all.min.css';

import DataTable from 'primevue/datatable';
import Column from 'primevue/column';
import InputText from 'primevue/inputtext';
import Dropdown from 'primevue/dropdown';
import Button from 'primevue/button';
import Menu from 'primevue/menu';
import Paginator from 'primevue/paginator';
import Dialog from 'primevue/dialog';
import ConfirmDialog from 'primevue/confirmdialog';
import { useConfirm } from 'primevue/useconfirm';
import { useToast } from 'primevue/usetoast';

import {
    fetchClasses,
    exportClassesExcel,
    createClass,
    updateClass,
    deleteClass,
    fetchClassById,
    updateStudentCount // 💡 thêm hàm mới
} from '@/service/classService.js';
import { fetchTeachersLite } from '@/service/teacherService.js';

const toast = useToast();
const confirm = useConfirm();

/* =================== FILTER TOP & HEADER =================== */
const years = ref([
    { label: 'Tất cả năm học', value: '' },
    { label: '2025 - 2026', value: '2025-2026' },
    { label: '2024 - 2025', value: '2024-2025' },
    { label: '2023 - 2024', value: '2023-2024' }
]);
const selectedYear = ref(years.value[0]);

/* Header filters */
const fName = ref('');
const fRoom = ref('');
const fGrade = ref('');

/* =================== BẢNG LỚP =================== */
const loading = ref(false);
const rows = ref([]); // dữ liệu đang hiển thị theo trang
const totalRecords = ref(0);
const page = ref(1);
const size = ref(10);
const sortField = ref('');
const sortOrder = ref(1);

/* Danh sách full tất cả lớp để check trùng GV, tên lớp, phòng học */
const allClasses = ref([]);

/* =================== ROW MENU =================== */
const rowMenu = ref();
const activeRow = ref(null);
const rowMenuItems = ref([
    {
        label: 'Xem chi tiết lớp',
        icon: 'fa-regular fa-eye',
        tone: 'primary',
        sub: 'Thông tin chi tiết',
        command: () => onAction('view')
    },
    {
        label: 'Chỉnh sửa thông tin',
        icon: 'fa-regular fa-pen-to-square',
        tone: 'info',
        sub: 'Tên lớp, phòng, năm học...',
        command: () => onAction('edit')
    },
    {
        label: 'Cập nhật số học sinh',
        icon: 'fa-solid fa-children',
        tone: 'info',
        sub: 'Cập nhật sĩ số hiện tại',
        command: () => onAction('updateStudentCount')
    },
    { separator: true },
    {
        label: 'Xoá lớp học',
        icon: 'fa-regular fa-trash-can',
        tone: 'danger',
        sub: 'Không thể hoàn tác',
        command: () => onAction('delete')
    }
]);

function openRowMenu(e, row) {
    activeRow.value = row;
    rowMenu.value.toggle(e);
}

/* =================== DIALOG STATE =================== */
const showCreate = ref(false);
const showEdit = ref(false);
const showView = ref(false);

/* 💡 Dialog cập nhật số học sinh */
const showUpdateStudentCount = ref(false);
const studentCountForm = ref({
    id: null,
    className: '',
    currentStudentCount: 0
});

/* Giáo viên cho dropdown */
const teacherOptions = ref([]);

/* Form tạo / sửa / xem */
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

const totalClasses = computed(() => totalRecords.value);

/* =================== CẤU HÌNH KHỐI + TÊN LỚP + PHÒNG =================== */
/* Khối lớp (chuẩn mầm non) */
const gradeOptions = [
    { label: 'Nhà trẻ', value: 'Nhà trẻ' },
    { label: 'Mầm', value: 'Mầm' },
    { label: 'Chồi', value: 'Chồi' },
    { label: 'Lá', value: 'Lá' }
];

/* Tên lớp gợi ý theo từng khối */
const baseClassNameOptions = {
    'Nhà trẻ': ['Nhà trẻ 1', 'Nhà trẻ 2'],
    Mầm: ['Mầm 1', 'Mầm 2', 'Mầm 3'],
    Chồi: ['Chồi 1', 'Chồi 2'],
    Lá: ['Lá 1', 'Lá 2']
};

/* Phòng học gợi ý theo từng khối */
const baseRoomOptions = {
    'Nhà trẻ': ['P.NT01', 'P.NT02'],
    Mầm: ['P.M01', 'P.M02', 'P.M03'],
    Chồi: ['P.C01', 'P.C02'],
    Lá: ['P.L01', 'P.L02']
};

/* =================== TÍNH CÁC GIÁ TRỊ ĐÃ DÙNG =================== */
const usedClassNames = computed(() => {
    const s = new Set();
    allClasses.value.forEach((c) => {
        if (c.className) s.add(c.className);
    });
    return s;
});

const usedRooms = computed(() => {
    const s = new Set();
    allClasses.value.forEach((c) => {
        if (c.roomNumber) s.add(c.roomNumber);
    });
    return s;
});

const usedTeacherNames = computed(() => {
    const s = new Set();
    allClasses.value.forEach((c) => {
        if (c.teacherName && c.teacherName !== 'Chưa có giáo viên') {
            s.add(c.teacherName);
        }
    });
    return s;
});

/* Options TÊN LỚP cho modal Tạo lớp */
const classNameOptions = computed(() => {
    const grade = createForm.value.grade;
    if (!grade) return [];
    const base = baseClassNameOptions[grade] || [];
    return base.filter((name) => !usedClassNames.value.has(name)).map((name) => ({ label: name, value: name }));
});

/* Options PHÒNG HỌC cho modal Tạo lớp */
const roomOptions = computed(() => {
    const grade = createForm.value.grade;
    if (!grade) return [];
    const base = baseRoomOptions[grade] || [];
    return base.filter((room) => !usedRooms.value.has(room)).map((room) => ({ label: room, value: room }));
});

/* Options giáo viên cho modal TẠO lớp */
const teacherOptionsForCreate = computed(() => {
    if (!teacherOptions.value?.length) return [];
    return teacherOptions.value.filter((t) => !usedTeacherNames.value.has(t.label));
});

/* Options giáo viên cho modal SỬA lớp */
const teacherOptionsForEdit = computed(() => {
    if (!teacherOptions.value?.length) return [];
    if (!editForm.value.id) {
        return teacherOptionsForCreate.value;
    }
    const usedExceptCurrent = new Set();
    allClasses.value.forEach((c) => {
        if (!c.teacherName || c.teacherName === 'Chưa có giáo viên') return;
        if (c.id === editForm.value.id) return;
        usedExceptCurrent.add(c.teacherName);
    });
    return teacherOptions.value.filter((t) => !usedExceptCurrent.has(t.label));
});

/* =================== LOAD DATA =================== */
async function loadTeachers() {
    teacherOptions.value = await fetchTeachersLite();
}

/* Lấy full danh sách lớp để check trùng */
async function reloadAllClasses() {
    try {
        const { items } = await fetchClasses({
            page: 1,
            size: 100000
        });
        allClasses.value = items;
    } catch (e) {
        console.warn('[Classes] Không tải được full danh sách lớp:', e?.message || e);
    }
}

/* Load danh sách lớp theo filter + phân trang */
async function load() {
    loading.value = true;
    try {
        const sort = sortField.value ? `${sortField.value},${sortOrder.value === -1 ? 'desc' : 'asc'}` : undefined;

        const { items, total } = await fetchClasses({
            year: selectedYear.value?.value || undefined,
            className: fName.value || undefined,
            roomNumber: fRoom.value || undefined,
            grade: fGrade.value || undefined,
            page: page.value,
            size: size.value,
            sort
        });
        rows.value = items;
        totalRecords.value = total;
    } catch (e) {
        toast.add({
            severity: 'error',
            summary: 'Lỗi',
            detail: e.message || 'Không tải được danh sách lớp',
            life: 3000
        });
    } finally {
        loading.value = false;
    }
}

/* Sort & paging */
function onSort(field) {
    if (sortField.value === field) {
        sortOrder.value = sortOrder.value === 1 ? -1 : 1;
    } else {
        sortField.value = field;
        sortOrder.value = 1;
    }
    page.value = 1;
    load();
}
function onChangePage(e) {
    page.value = e.page + 1;
    size.value = e.rows;
    load();
}

/* Export Excel */
async function onExport() {
    await exportClassesExcel();
}

/* =================== ACTIONS =================== */
async function onAction(type) {
    const row = activeRow.value;
    if (!row) return;

    if (type === 'view') {
        try {
            const c = await fetchClassById(row.id);
            viewData.value = c;
            showView.value = true;
        } catch (e) {
            toast.add({
                severity: 'error',
                summary: 'Lỗi',
                detail: e.message || 'Không lấy được thông tin lớp',
                life: 3000
            });
        }
    } else if (type === 'edit') {
        try {
            const c = await fetchClassById(row.id);
            let teacherId = null;
            if (c.teacherName && c.teacherName !== 'Chưa có giáo viên') {
                const opt = teacherOptions.value.find((t) => t.label === c.teacherName);
                teacherId = opt ? opt.value : null;
            }

            editForm.value = {
                id: c.id,
                className: c.className,
                grade: c.grade,
                roomNumber: c.roomNumber,
                academicYear: c.academicYear,
                teacherId
            };
            showEdit.value = true;
        } catch (e) {
            toast.add({
                severity: 'error',
                summary: 'Lỗi',
                detail: e.message || 'Không lấy được thông tin lớp',
                life: 3000
            });
        }
    } else if (type === 'updateStudentCount') {
        // 💡 Mở dialog cập nhật số HS
        studentCountForm.value = {
            id: row.id,
            className: row.className,
            currentStudentCount: row.studentCurrent ?? 0
        };
        showUpdateStudentCount.value = true;
    } else if (type === 'delete') {
        confirmDelete(row);
    }
}

/* Confirm delete */
function confirmDelete(row) {
    confirm.require({
        message: `Bạn có chắc chắn muốn xoá lớp "${row.className}"?`,
        header: 'Xác nhận xoá',
        icon: 'pi pi-exclamation-triangle',
        acceptClass: 'p-button-danger',
        acceptLabel: 'Xoá',
        rejectLabel: 'Huỷ',
        accept: async () => {
            try {
                await deleteClass(row.id);
                toast.add({
                    severity: 'success',
                    summary: 'Thành công',
                    detail: 'Đã xoá lớp học',
                    life: 2500
                });
                await Promise.all([load(), reloadAllClasses()]);
            } catch (e) {
                toast.add({
                    severity: 'error',
                    summary: 'Lỗi',
                    detail: e.message || 'Không xoá được lớp',
                    life: 3000
                });
            }
        }
    });
}

/* =================== SAVE CREATE / EDIT =================== */
async function saveCreate() {
    if (!createForm.value.grade || !createForm.value.className || !createForm.value.roomNumber) {
        toast.add({
            severity: 'warn',
            summary: 'Thiếu thông tin',
            detail: 'Vui lòng chọn khối lớp, tên lớp và phòng học',
            life: 2500
        });
        return;
    }

    if (usedClassNames.value.has(createForm.value.className)) {
        toast.add({
            severity: 'warn',
            summary: 'Tên lớp đã tồn tại',
            detail: `Lớp "${createForm.value.className}" đã tồn tại, vui lòng chọn tên khác`,
            life: 3000
        });
        return;
    }

    if (createForm.value.teacherId) {
        const opt = teacherOptions.value.find((t) => t.value === createForm.value.teacherId);
        const teacherName = opt?.label;
        if (teacherName && usedTeacherNames.value.has(teacherName)) {
            toast.add({
                severity: 'warn',
                summary: 'Giáo viên đã được phân lớp',
                detail: `Giáo viên "${teacherName}" đã là GVCN của một lớp khác.`,
                life: 3000
            });
            return;
        }
    }

    try {
        await createClass(createForm.value);
        toast.add({
            severity: 'success',
            summary: 'Thành công',
            detail: 'Đã tạo lớp học',
            life: 2500
        });
        showCreate.value = false;
        resetCreateForm();
        await Promise.all([load(), reloadAllClasses()]);
    } catch (e) {
        toast.add({
            severity: 'error',
            summary: 'Lỗi',
            detail: e.message || 'Không tạo được lớp',
            life: 3000
        });
    }
}

async function saveEdit() {
    if (!editForm.value.id) return;

    const nameClash = allClasses.value.some((c) => c.id !== editForm.value.id && c.className === editForm.value.className);
    if (nameClash) {
        toast.add({
            severity: 'warn',
            summary: 'Tên lớp đã tồn tại',
            detail: `Lớp "${editForm.value.className}" đã tồn tại, vui lòng chọn tên khác`,
            life: 3000
        });
        return;
    }

    if (editForm.value.teacherId) {
        const opt = teacherOptions.value.find((t) => t.value === editForm.value.teacherId);
        const teacherName = opt?.label;
        if (teacherName) {
            const usedExceptCurrent = new Set();
            allClasses.value.forEach((c) => {
                if (!c.teacherName || c.teacherName === 'Chưa có giáo viên') return;
                if (c.id === editForm.value.id) return;
                usedExceptCurrent.add(c.teacherName);
            });

            if (usedExceptCurrent.has(teacherName)) {
                toast.add({
                    severity: 'warn',
                    summary: 'Giáo viên đã được phân lớp',
                    detail: `Giáo viên "${teacherName}" đã là GVCN của một lớp khác.`,
                    life: 3000
                });
                return;
            }
        }
    }

    try {
        await updateClass(editForm.value.id, editForm.value);
        toast.add({
            severity: 'success',
            summary: 'Thành công',
            detail: 'Đã cập nhật lớp học',
            life: 2500
        });
        showEdit.value = false;
        await Promise.all([load(), reloadAllClasses()]);
    } catch (e) {
        toast.add({
            severity: 'error',
            summary: 'Lỗi',
            detail: e.message || 'Không cập nhật được lớp',
            life: 3000
        });
    }
}

/* 💡 SAVE UPDATE STUDENT COUNT */
async function saveUpdateStudentCount() {
    const id = studentCountForm.value.id;
    const count = Number(studentCountForm.value.currentStudentCount);

    if (!id) return;

    if (!Number.isInteger(count) || count < 0) {
        toast.add({
            severity: 'warn',
            summary: 'Giá trị không hợp lệ',
            detail: 'Số học sinh phải là số nguyên không âm',
            life: 2500
        });
        return;
    }

    try {
        await updateStudentCount(id, count);
        toast.add({
            severity: 'success',
            summary: 'Thành công',
            detail: 'Đã cập nhật số học sinh trong lớp',
            life: 2500
        });
        showUpdateStudentCount.value = false;
        await Promise.all([load(), reloadAllClasses()]);
    } catch (e) {
        toast.add({
            severity: 'error',
            summary: 'Lỗi',
            detail: e.message || 'Không cập nhật được số học sinh',
            life: 3000
        });
    }
}

/* =================== HELPERS =================== */
function resetCreateForm() {
    createForm.value = {
        className: '',
        grade: '',
        roomNumber: '',
        academicYear: selectedYear.value?.value || '',
        teacherId: null
    };
}

/* debounce filters */
let t;
function debounce(fn, ms = 250) {
    clearTimeout(t);
    t = setTimeout(fn, ms);
}
watch([fName, fRoom, fGrade, selectedYear], () =>
    debounce(() => {
        page.value = 1;
        load();
    }, 300)
);

onMounted(async () => {
    await Promise.all([load(), loadTeachers()]);
    await reloadAllClasses();
});
</script>

<template>
    <div class="space-y-4 px-4 md:px-6 lg:px-8 py-5 relative">
        <!-- Loading overlay -->
        <div v-if="loading" class="absolute inset-0 bg-white/70 flex items-center justify-center z-10 text-slate-500 text-sm">
            <i class="fa-solid fa-spinner fa-spin mr-2"></i>
            Đang tải dữ liệu lớp...
        </div>

        <ConfirmDialog />

        <!-- Header -->
        <div class="rounded-xl bg-slate-50 border border-slate-200 px-4 py-3 flex flex-wrap items-center justify-between gap-3">
            <div>
                <h1 class="text-xl font-semibold text-slate-800">Lớp học</h1>
                <p class="text-sm text-slate-500 mt-1">Quản lý danh sách lớp, giáo viên chủ nhiệm và phòng học trong năm học.</p>
            </div>
            <div class="flex items-center gap-2">
                <Dropdown v-model="selectedYear" :options="years" optionLabel="label" placeholder="Năm học" class="w-44" />
                <Button
                    class="!bg-primary !border-0 !text-white"
                    icon="fa-solid fa-plus mr-2"
                    label="Tạo lớp"
                    @click="
                        () => {
                            resetCreateForm();
                            showCreate = true;
                        }
                    "
                />
                <Button class="!bg-emerald-600 !border-0 !text-white" icon="fa-solid fa-file-arrow-down mr-2" label="Xuất Excel" @click="onExport" />
            </div>
        </div>

        <!-- Small stats -->
        <div class="flex flex-wrap gap-3">
            <div class="stat-card">
                <div class="stat-label">Tổng số lớp</div>
                <div class="stat-value">
                    {{ totalClasses }}
                </div>
            </div>
        </div>

        <!-- Table -->
        <div class="rounded-xl border border-slate-200 overflow-hidden bg-white relative">
            <DataTable :value="rows" :loading="false" dataKey="id" responsiveLayout="scroll" :rowHover="true" class="p-datatable-sm">
                <Column header="#" :body="(_, opt) => opt.rowIndex + 1" headerStyle="width: 4rem" />

                <!-- Tên lớp + mã -->
                <Column>
                    <template #header>
                        <div class="header-filter nowrap">
                            <InputText v-model="fName" class="w-full" placeholder="Tìm theo tên lớp" />
                            <button class="sort-btn" @click="onSort('className')" title="Sắp xếp theo tên">
                                <i class="fa-solid fa-up-down"></i>
                            </button>
                        </div>
                    </template>
                    <template #body="{ data }">
                        <div class="class-cell">
                            <div class="class-title" :title="data.className">
                                {{ data.className || '-' }}
                            </div>
                            <div v-if="data.classCode" class="class-code" :title="data.classCode">
                                {{ data.classCode }}
                            </div>
                        </div>
                    </template>
                </Column>

                <!-- Phòng học (chỉ hiển thị, không filter) -->
                <Column header="Phòng học" headerStyle="min-width: 120px">
                    <template #body="{ data }">
                        <span class="ellipsis" :title="data.roomNumber">
                            {{ data.roomNumber || '-' }}
                        </span>
                    </template>
                </Column>

                <!-- Khối lớp -->
                <Column headerStyle="min-width: 120px">
                    <template #header>
                        <div class="header-filter nowrap">
                            <InputText v-model="fGrade" class="w-full" placeholder="Khối lớp" />
                            <button class="sort-btn" @click="onSort('grade')" title="Sắp xếp theo khối">
                                <i class="fa-solid fa-up-down"></i>
                            </button>
                        </div>
                    </template>
                    <template #body="{ data }">
                        <span class="ellipsis" :title="data.grade">
                            {{ data.grade || '-' }}
                        </span>
                    </template>
                </Column>

                <!-- Năm học -->
                <Column header="Năm học" headerStyle="min-width: 110px">
                    <template #body="{ data }">
                        <span class="ellipsis" :title="data.academicYear">
                            {{ data.academicYear || '-' }}
                        </span>
                    </template>
                </Column>

                <!-- Giáo viên -->
                <Column header="Giáo viên chủ nhiệm" headerStyle="min-width: 160px">
                    <template #body="{ data }">
                        <span class="ellipsis" :title="data.teacherName">
                            {{ data.teacherName || 'Chưa có giáo viên' }}
                        </span>
                    </template>
                </Column>

                <!-- Số HS -->
                <Column header="Học sinh" headerStyle="width:120px">
                    <template #body="{ data }">
                        <span class="font-semibold">{{ data.studentCurrent }}</span>
                        <span v-if="data.studentCapacity !== null"> /{{ data.studentCapacity }} </span>
                    </template>
                </Column>

                <!-- Trạng thái -->
                <Column header="Trạng thái" headerStyle="width:160px">
                    <template #body>
                        <span class="status-badge status--active">Đang hoạt động</span>
                    </template>
                </Column>

                <!-- Hành động -->
                <Column header="Hành động" headerStyle="width:64px; text-align:right;" bodyStyle="text-align:right;">
                    <template #body="{ data }">
                        <Button icon="fa-solid fa-ellipsis-vertical" class="!bg-transparent !border-0 !text-slate-600 hover:!bg-slate-100" @click="(e) => openRowMenu(e, data)" />
                    </template>
                </Column>
            </DataTable>

            <div class="border-t border-slate-200">
                <Paginator :rows="size" :totalRecords="totalRecords" :rowsPerPageOptions="[10, 20, 50]" @page="onChangePage" />
            </div>
        </div>

        <!-- Row menu -->
        <Menu ref="rowMenu" :model="rowMenuItems" :popup="true" appendTo="body" :pt="{ menu: { class: 'rowmenu-panel' } }">
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
                        <div class="menu-item__label truncate">
                            {{ item.label }}
                        </div>
                        <div v-if="item.sub" class="menu-item__sub truncate">
                            {{ item.sub }}
                        </div>
                    </div>
                </button>
            </template>
        </Menu>

        <!-- Dialog tạo lớp -->
        <!-- (giữ nguyên như bạn đang có, không đổi) -->

        <!-- Dialog tạo lớp -->
        <Dialog v-model:visible="showCreate" header="Tạo lớp học mới" modal :style="{ width: '520px' }">
            <div class="space-y-3">
                <!-- Khối lớp + Tên lớp -->
                <div class="grid grid-cols-2 gap-3">
                    <div>
                        <label class="field-label"> Khối lớp <span class="text-red-500">*</span> </label>
                        <Dropdown v-model="createForm.grade" :options="gradeOptions" optionLabel="label" optionValue="value" placeholder="Chọn khối lớp" class="w-full" />
                    </div>
                    <div>
                        <label class="field-label"> Tên lớp <span class="text-red-500">*</span> </label>
                        <Dropdown v-model="createForm.className" :options="classNameOptions" optionLabel="label" optionValue="value" :disabled="!createForm.grade" placeholder="Chọn tên lớp" class="w-full" />
                    </div>
                </div>

                <!-- Phòng học + Năm học -->
                <div class="grid grid-cols-2 gap-3">
                    <div>
                        <label class="field-label"> Phòng học <span class="text-red-500">*</span> </label>
                        <Dropdown v-model="createForm.roomNumber" :options="roomOptions" optionLabel="label" optionValue="value" :disabled="!createForm.grade" placeholder="Chọn phòng học" class="w-full" />
                    </div>
                    <div>
                        <label class="field-label">Năm học</label>
                        <InputText v-model="createForm.academicYear" placeholder="VD: 2025-2026" class="w-full" />
                    </div>
                </div>

                <p class="text-xs text-slate-500">Gợi ý tên lớp và phòng học theo chuẩn trường mầm non. Những tên lớp / phòng đã dùng sẽ được ẩn khỏi danh sách.</p>

                <!-- GVCN -->
                <div>
                    <label class="field-label">Giáo viên chủ nhiệm</label>
                    <Dropdown v-model="createForm.teacherId" :options="teacherOptionsForCreate" optionLabel="label" optionValue="value" showClear placeholder="Chọn giáo viên" class="w-full" />
                    <p class="text-xs text-slate-500 mt-1">Một giáo viên chỉ được làm GVCN của tối đa <b>1 lớp</b>.</p>
                </div>

                <div class="flex justify-end gap-2 pt-2">
                    <Button label="Huỷ" class="p-button-text" @click="showCreate = false" />
                    <Button label="Lưu" class="!bg-primary !border-0 !text-white" @click="saveCreate" />
                </div>
            </div>
        </Dialog>

        <!-- Dialog sửa lớp -->
        <Dialog v-model:visible="showEdit" header="Chỉnh sửa lớp học" modal :style="{ width: '520px' }">
            <div v-if="editForm.id" class="space-y-3">
                <div>
                    <label class="field-label">Tên lớp</label>
                    <InputText v-model="editForm.className" class="w-full" />
                </div>
                <div class="grid grid-cols-2 gap-3">
                    <div>
                        <label class="field-label">Khối lớp</label>
                        <InputText v-model="editForm.grade" class="w-full" />
                    </div>
                    <div>
                        <label class="field-label">Phòng học</label>
                        <InputText v-model="editForm.roomNumber" class="w-full" />
                    </div>
                </div>
                <div>
                    <label class="field-label">Năm học</label>
                    <InputText v-model="editForm.academicYear" class="w-full" />
                </div>
                <div>
                    <label class="field-label">Giáo viên chủ nhiệm</label>
                    <Dropdown v-model="editForm.teacherId" :options="teacherOptionsForEdit" optionLabel="label" optionValue="value" showClear placeholder="Chọn giáo viên" class="w-full" />
                    <p class="text-xs text-slate-500 mt-1">Không cho phép chọn giáo viên đã là GVCN lớp khác.</p>
                </div>
                <div class="flex justify-end gap-2 pt-2">
                    <Button label="Huỷ" class="p-button-text" @click="showEdit = false" />
                    <Button label="Lưu" class="!bg-primary !border-0 !text-white" @click="saveEdit" />
                </div>
            </div>
        </Dialog>

        <!-- Dialog xem lớp -->
        <Dialog v-model:visible="showView" header="Thông tin lớp học" modal :style="{ width: '480px' }">
            <div v-if="viewData" class="space-y-2">
                <div class="mb-2">
                    <div class="text-lg font-semibold text-slate-800">
                        {{ viewData.className }}
                    </div>
                    <div v-if="viewData.classCode" class="text-sm text-slate-500">Mã lớp: {{ viewData.classCode }}</div>
                </div>
                <div><span class="font-medium">Khối lớp:</span> {{ viewData.grade || '-' }}</div>
                <div><span class="font-medium">Phòng học:</span> {{ viewData.roomNumber || '-' }}</div>
                <div><span class="font-medium">Năm học:</span> {{ viewData.academicYear || '-' }}</div>
                <div>
                    <span class="font-medium">Giáo viên chủ nhiệm:</span>
                    {{ viewData.teacherName }}
                </div>
                <div>
                    <span class="font-medium">Số học sinh:</span>
                    {{ viewData.studentCurrent }}
                    <span v-if="viewData.studentCapacity !== null"> / {{ viewData.studentCapacity }} </span>
                </div>
            </div>
        </Dialog>

        <!-- 💡 Dialog cập nhật số học sinh -->
        <Dialog v-model:visible="showUpdateStudentCount" header="Cập nhật số học sinh" modal :style="{ width: '360px' }">
            <div class="space-y-3">
                <div class="text-sm text-slate-600">
                    Lớp:
                    <span class="font-semibold text-slate-800">
                        {{ studentCountForm.className || '-' }}
                    </span>
                </div>
                <div>
                    <label class="field-label">Số học sinh hiện tại</label>
                    <InputText v-model.number="studentCountForm.currentStudentCount" type="number" min="0" class="w-full" />
                    <p class="text-xs text-slate-500 mt-1">Nhập tổng số học sinh đang học trong lớp này.</p>
                </div>
                <div class="flex justify-end gap-2 pt-2">
                    <Button label="Huỷ" class="p-button-text" @click="showUpdateStudentCount = false" />
                    <Button label="Lưu" class="!bg-primary !border-0 !text-white" @click="saveUpdateStudentCount" />
                </div>
            </div>
        </Dialog>
    </div>
</template>

<style scoped>
/* Stats nhỏ */
.stat-card {
    padding: 10px 14px;
    border-radius: 12px;
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    min-width: 140px;
}
.stat-label {
    font-size: 12px;
    color: #64748b;
}
.stat-value {
    font-size: 18px;
    font-weight: 700;
    color: #0f172a;
}

/* Header filter */
.header-filter {
    display: flex;
    align-items: center;
    gap: 8px;
}

/* Class name cell */
.class-cell {
    display: block;
    line-height: 1.25;
}
.class-title {
    font-weight: 600;
    color: #075985;
    white-space: normal !important;
    overflow-wrap: anywhere;
    word-break: break-word;
}
.class-code {
    font-size: 12px;
    color: #64748b;
    margin-top: 2px;
}

/* Sort button */
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

/* Text ellipsis */
.ellipsis {
    display: inline-block;
    max-width: 100%;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

/* Status badge */
.status-badge {
    display: inline-flex;
    align-items: center;
    height: 28px;
    padding: 0 10px;
    border-radius: 9999px;
    font-weight: 600;
    font-size: 13px;
    border: 1px solid transparent;
}
.status--active {
    background: #e6f0ff;
    color: #1d4ed8;
    border-color: #bfdbfe;
}

/* Row menu panel */
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
}

/* Field label */
.field-label {
    display: block;
    font-size: 13px;
    font-weight: 600;
    color: #4b5563;
    margin-bottom: 4px;
}

/* Fix header nowrap */
:deep(.p-datatable .p-datatable-thead > tr > th) {
    white-space: nowrap;
}
</style>
