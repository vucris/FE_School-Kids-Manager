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

import { fetchClasses, exportClassesExcel, createClass, updateClass, deleteClass, fetchClassById } from '@/service/classService.js';
import { fetchTeachersLite } from '@/service/teacherService.js';

const toast = useToast();
const confirm = useConfirm();

/* Top filters */
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

/* Table state */
const loading = ref(false);
const rows = ref([]);
const totalRecords = ref(0);
const page = ref(1);
const size = ref(10);
const sortField = ref('');
const sortOrder = ref(1);

/* Row menu */
const rowMenu = ref();
const activeRow = ref(null);
const rowMenuItems = ref([
    { label: 'Xem chi tiết lớp', icon: 'fa-regular fa-eye', tone: 'primary', sub: 'Thông tin chi tiết', command: () => onAction('view') },
    { label: 'Chỉnh sửa thông tin', icon: 'fa-regular fa-pen-to-square', tone: 'info', sub: 'Tên lớp, phòng, năm học...', command: () => onAction('edit') },
    { separator: true },
    { label: 'Xoá lớp học', icon: 'fa-regular fa-trash-can', tone: 'danger', sub: 'Không thể hoàn tác', command: () => onAction('delete') }
]);
function openRowMenu(e, row) {
    activeRow.value = row;
    rowMenu.value.toggle(e);
}

/* Dialog state */
const showCreate = ref(false);
const showEdit = ref(false);
const showView = ref(false);

/* Teacher options for dropdown */
const teacherOptions = ref([]);

/* Create / Edit forms */
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

/* Load teachers for dropdown */
async function loadTeachers() {
    teacherOptions.value = await fetchTeachersLite();
}

/* Load classes */
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
        toast.add({ severity: 'error', summary: 'Lỗi', detail: e.message || 'Không tải được danh sách lớp', life: 3000 });
    } finally {
        loading.value = false;
    }
}

/* Sort & paging */
function onSort(field) {
    if (sortField.value === field) sortOrder.value = sortOrder.value === 1 ? -1 : 1;
    else {
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

/* Actions */
async function onAction(type) {
    const row = activeRow.value;
    if (!row) return;

    if (type === 'view') {
        try {
            const c = await fetchClassById(row.id);
            viewData.value = c;
            showView.value = true;
        } catch (e) {
            toast.add({ severity: 'error', summary: 'Lỗi', detail: e.message || 'Không lấy được thông tin lớp', life: 3000 });
        }
    } else if (type === 'edit') {
        try {
            const c = await fetchClassById(row.id);
            editForm.value = {
                id: c.id,
                className: c.className,
                grade: c.grade,
                roomNumber: c.roomNumber,
                academicYear: c.academicYear,
                teacherId: null // backend chỉ trả teacherName
            };
            showEdit.value = true;
        } catch (e) {
            toast.add({ severity: 'error', summary: 'Lỗi', detail: e.message || 'Không lấy được thông tin lớp', life: 3000 });
        }
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
                toast.add({ severity: 'success', summary: 'Thành công', detail: 'Đã xoá lớp học', life: 2500 });
                load();
            } catch (e) {
                toast.add({ severity: 'error', summary: 'Lỗi', detail: e.message || 'Không xoá được lớp', life: 3000 });
            }
        }
    });
}

/* Save create */
async function saveCreate() {
    if (!createForm.value.className) {
        toast.add({ severity: 'warn', summary: 'Thiếu thông tin', detail: 'Vui lòng nhập tên lớp', life: 2500 });
        return;
    }
    try {
        await createClass(createForm.value);
        toast.add({ severity: 'success', summary: 'Thành công', detail: 'Đã tạo lớp học', life: 2500 });
        showCreate.value = false;
        resetCreateForm();
        load();
    } catch (e) {
        toast.add({ severity: 'error', summary: 'Lỗi', detail: e.message || 'Không tạo được lớp', life: 3000 });
    }
}

/* Save edit */
async function saveEdit() {
    if (!editForm.value.id) return;
    try {
        await updateClass(editForm.value.id, editForm.value);
        toast.add({ severity: 'success', summary: 'Thành công', detail: 'Đã cập nhật lớp học', life: 2500 });
        showEdit.value = false;
        load();
    } catch (e) {
        toast.add({ severity: 'error', summary: 'Lỗi', detail: e.message || 'Không cập nhật được lớp', life: 3000 });
    }
}

/* Helpers */
function resetCreateForm() {
    createForm.value = {
        className: '',
        grade: '',
        roomNumber: '',
        academicYear: '',
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
});
</script>

<template>
    <div class="space-y-4 px-4 md:px-6 lg:px-8 py-5">
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
        <div class="rounded-xl border border-slate-200 overflow-hidden bg-white">
            <DataTable :value="rows" :loading="loading" dataKey="id" responsiveLayout="scroll" :rowHover="true" class="p-datatable-sm">
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
                            <div class="class-title" :title="data.className">{{ data.className || '-' }}</div>
                            <div v-if="data.classCode" class="class-code" :title="data.classCode">{{ data.classCode }}</div>
                        </div>
                    </template>
                </Column>

                <!-- Phòng học -->
                <Column headerStyle="min-width: 120px">
                    <template #header>
                        <div class="header-filter nowrap">
                            <InputText v-model="fRoom" class="w-full" placeholder="Phòng học" />
                        </div>
                    </template>
                    <template #body="{ data }">
                        <span class="ellipsis" :title="data.roomNumber">{{ data.roomNumber || '-' }}</span>
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
                        <span class="ellipsis" :title="data.grade">{{ data.grade || '-' }}</span>
                    </template>
                </Column>

                <!-- Năm học -->
                <Column header="Năm học" headerStyle="min-width: 110px">
                    <template #body="{ data }">
                        <span class="ellipsis" :title="data.academicYear">{{ data.academicYear || '-' }}</span>
                    </template>
                </Column>

                <!-- Giáo viên -->
                <Column header="Giáo viên chủ nhiệm" headerStyle="min-width: 160px">
                    <template #body="{ data }">
                        <span class="ellipsis" :title="data.teacherName">{{ data.teacherName || 'Chưa có giáo viên' }}</span>
                    </template>
                </Column>

                <!-- Số HS -->
                <Column header="Số HS" headerStyle="width:120px">
                    <template #body="{ data }">
                        <span class="font-semibold">{{ data.studentCurrent }}</span
                        ><span v-if="data.studentCapacity !== null">/{{ data.studentCapacity }}</span>
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

        <!-- Row menu đẹp -->
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
                        <div class="menu-item__label truncate">{{ item.label }}</div>
                        <div v-if="item.sub" class="menu-item__sub truncate">{{ item.sub }}</div>
                    </div>
                </button>
            </template>
        </Menu>

        <!-- Dialog tạo lớp -->
        <Dialog v-model:visible="showCreate" header="Tạo lớp học mới" modal :style="{ width: '520px' }">
            <div class="space-y-3">
                <div>
                    <label class="field-label">Tên lớp <span class="text-red-500">*</span></label>
                    <InputText v-model="createForm.className" class="w-full" />
                </div>
                <div class="grid grid-cols-2 gap-3">
                    <div>
                        <label class="field-label">Khối lớp</label>
                        <InputText v-model="createForm.grade" class="w-full" />
                    </div>
                    <div>
                        <label class="field-label">Phòng học</label>
                        <InputText v-model="createForm.roomNumber" class="w-full" />
                    </div>
                </div>
                <div>
                    <label class="field-label">Năm học</label>
                    <InputText v-model="createForm.academicYear" placeholder="VD: 2025-2026" class="w-full" />
                </div>
                <div>
                    <label class="field-label">Giáo viên chủ nhiệm</label>
                    <Dropdown v-model="createForm.teacherId" :options="teacherOptions" optionLabel="label" optionValue="value" showClear placeholder="Chọn giáo viên" class="w-full" />
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
                    <Dropdown v-model="editForm.teacherId" :options="teacherOptions" optionLabel="label" optionValue="value" showClear placeholder="Chọn giáo viên" class="w-full" />
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
                    <div class="text-lg font-semibold text-slate-800">{{ viewData.className }}</div>
                    <div class="text-sm text-slate-500" v-if="viewData.classCode">Mã lớp: {{ viewData.classCode }}</div>
                </div>
                <div><span class="font-medium">Khối lớp:</span> {{ viewData.grade || '-' }}</div>
                <div><span class="font-medium">Phòng học:</span> {{ viewData.roomNumber || '-' }}</div>
                <div><span class="font-medium">Năm học:</span> {{ viewData.academicYear || '-' }}</div>
                <div><span class="font-medium">Giáo viên chủ nhiệm:</span> {{ viewData.teacherName }}</div>
                <div>
                    <span class="font-medium">Số học sinh:</span>
                    {{ viewData.studentCurrent }}
                    <span v-if="viewData.studentCapacity !== null">/ {{ viewData.studentCapacity }}</span>
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
