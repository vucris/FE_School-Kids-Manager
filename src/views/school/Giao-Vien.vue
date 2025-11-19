<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import '@fortawesome/fontawesome-free/css/all.min.css';

import DataTable from 'primevue/datatable';
import Column from 'primevue/column';
import InputText from 'primevue/inputtext';
import Button from 'primevue/button';
import Avatar from 'primevue/avatar';
import Menu from 'primevue/menu';
import Paginator from 'primevue/paginator';
import Dialog from 'primevue/dialog';
import { useToast } from 'primevue/usetoast';
import Swal from 'sweetalert2';

import {
    fetchTeachers,
    exportTeachersExcel,
    importTeachersExcel,
    fetchTeacherById,
    updateTeacher,
    toggleTeacherStatus
} from '@/service/teacherService.js';
import CreateStaffModal from '@/components/staff/CreateStaffModal.vue';

const toast = useToast();

/* SweetAlert2 toast */
const swalToast = Swal.mixin({
    toast: true,
    position: 'top-end',
    showConfirmButton: false,
    timer: 2200,
    timerProgressBar: true
});

function showSuccess(message) {
    toast.add({ severity: 'success', summary: 'Thành công', detail: message, life: 2500 });
}
function showError(err, fallback) {
    const msg =
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        err?.message ||
        fallback ||
        'Có lỗi xảy ra';
    toast.add({ severity: 'error', summary: 'Lỗi', detail: msg, life: 3000 });
}

const showCreate = ref(false);

/* loadingInit & loadingList */
const loadingInit = ref(false);
const loadingList = ref(false);
const rows = ref([]);
const totalRecords = ref(0);

/* table state */
const selection = ref(null);
const page = ref(1);
const size = ref(10);
const sortField = ref('');
const sortOrder = ref(0);

/* filters */
const statusFilter = ref('all');

/* header inputs */
const fName = ref('');
const fPhone = ref('');

/* counters */
const allData = ref([]);
const counterAll = computed(() => allData.value.length);
const counterNever = computed(() => allData.value.filter((x) => x.status === 'neverLoggedIn').length);
const counterActive = computed(() => allData.value.filter((x) => x.status === 'active').length);
const counterLocked = computed(() => allData.value.filter((x) => x.status === 'locked').length);
const counterDeleted = computed(() => allData.value.filter((x) => x.status === 'deleted').length);

/* row menu */
const actionMenu = ref();
const actionTargetRow = ref(null);
function openRowMenu(event, row) {
    actionTargetRow.value = row;
    actionMenu.value.toggle(event);
}

/* modal xem / sửa giáo viên */
const showView = ref(false);
const showEdit = ref(false);
const currentTeacher = ref(null);
const editForm = ref({
    fullName: '',
    email: '',
    phone: '',
    gender: '',
    specialization: '',
    employeeCode: '',
    emergencyContact: '',
    dateOfBirth: ''
});

/* action menu items */
const actionItems = ref([
    {
        label: 'Xem thông tin',
        icon: 'fa-regular fa-eye',
        tone: 'primary',
        sub: 'Thông tin chi tiết giáo viên',
        command: () => onAction('view')
    },
    {
        label: 'Sửa giáo viên',
        icon: 'fa-regular fa-pen-to-square',
        tone: 'info',
        sub: 'Chỉnh sửa hồ sơ, liên hệ...',
        command: () => onAction('edit')
    },
    { separator: true },
    {
        label: 'Khóa / mở khóa tài khoản',
        icon: 'fa-solid fa-lock',
        tone: 'danger',
        sub: 'Yêu cầu xác nhận',
        command: () => onAction('lock')
    }
]);

async function onAction(type) {
    const row = actionTargetRow.value;
    if (!row) return;

    try {
        if (type === 'view') {
            const t = await fetchTeacherById(row.id);
            currentTeacher.value = t;
            showView.value = true;
        } else if (type === 'edit') {
            const t = await fetchTeacherById(row.id);
            currentTeacher.value = t;
            editForm.value = {
                fullName: t.name || '',
                email: t.email || '',
                phone: t.phone || '',
                gender: t.gender || '',
                specialization: t.specialization || '',
                employeeCode: t.employeeCode || '',
                emergencyContact: t.emergencyContact || '',
                dateOfBirth: t.dateOfBirth || ''
            };
            showEdit.value = true;
        } else if (type === 'lock') {
            await confirmToggleLock(row);
        }
    } catch (e) {
        console.error(e);
        showError(e, 'Có lỗi xảy ra');
    }
}

/* SweetAlert confirm cho khóa/mở khóa */
async function confirmToggleLock(row) {
    const locking = row.status === 'active';
    const result = await Swal.fire({
        title: locking ? 'Khóa tài khoản giáo viên?' : 'Mở khóa tài khoản giáo viên?',
        text: `${row.name || ''} (${row.email || row.phone || 'không có liên hệ'})`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: locking ? 'Khóa' : 'Mở khóa',
        cancelButtonText: 'Hủy',
        confirmButtonColor: locking ? '#dc2626' : '#16a34a'
    });
    if (!result.isConfirmed) return;

    try {
        await toggleTeacherStatus(row.id);
        swalToast.fire({
            icon: 'success',
            title: locking ? 'Đã khóa tài khoản' : 'Đã mở khóa tài khoản'
        });
        await load(false);
    } catch (e) {
        console.error(e);
        swalToast.fire({
            icon: 'error',
            title: e?.response?.data?.message || e?.message || 'Cập nhật trạng thái thất bại'
        });
    }
}

/* lưu sửa giáo viên */
async function saveEdit() {
    if (!currentTeacher.value) return;
    try {
        await updateTeacher(currentTeacher.value.id, editForm.value);
        showSuccess('Cập nhật giáo viên thành công');
        showEdit.value = false;
        await load(false);
    } catch (e) {
        console.error(e);
        showError(e, 'Có lỗi xảy ra khi cập nhật');
    }
}

/* helpers */
function roleLabel(role) {
    return role || 'Giáo viên';
}
function statusLabel(s) {
    if (s === 'active') return 'Đang hoạt động';
    if (s === 'locked') return 'Tạm khóa';
    if (s === 'deleted') return 'Đã xóa';
    return 'Chưa đăng nhập';
}
function statusClass(s) {
    return s === 'active' ? 'status--active' : s === 'locked' ? 'status--locked' : s === 'deleted' ? 'status--deleted' : 'status--never';
}
function genderLabel(g) {
    if (!g) return '-';
    const s = String(g).toLowerCase();
    if (s === 'nu' || s === 'nữ' || s === 'female' || s === 'f') return 'Nữ';
    return 'Nam';
}
function genderIconClass(g) {
    const s = String(g || '').toLowerCase();
    return s === 'nu' || s === 'nữ' || s === 'female' || s === 'f' ? 'fa-solid fa-venus text-pink-500' : 'fa-solid fa-mars text-blue-500';
}
function formatDate(d) {
    if (!d) return '-';
    const dt = new Date(d);
    if (isNaN(dt)) return '-';
    const dd = String(dt.getDate()).padStart(2, '0');
    const mm = String(dt.getMonth() + 1).padStart(2, '0');
    const yyyy = dt.getFullYear();
    return `${dd}/${mm}/${yyyy}`;
}

/* excel import/export */
const fileInput = ref(null);
function triggerImport() {
    fileInput.value?.click();
}
async function onImportChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
        await importTeachersExcel(file);
        swalToast.fire({ icon: 'success', title: 'Đã nhập danh sách giáo viên' });
        await load(false);
    } catch (e2) {
        swalToast.fire({ icon: 'error', title: e2?.response?.data?.message || e2?.message || 'Nhập excel thất bại' });
    } finally {
        if (fileInput.value) fileInput.value.value = '';
    }
}
async function onExport() {
    try {
        await exportTeachersExcel();
        swalToast.fire({ icon: 'success', title: 'Đang tải file Excel' });
    } catch (e) {
        swalToast.fire({ icon: 'error', title: e?.response?.data?.message || e?.message || 'Xuất Excel thất bại' });
    }
}

/* debounce */
let t;
function debounce(fn, ms = 250) {
    clearTimeout(t);
    t = setTimeout(fn, ms);
}

/* load */
async function load(isInit = false) {
    if (isInit) loadingInit.value = true;
    else loadingList.value = true;
    try {
        const q = [fName.value, fPhone.value].filter(Boolean).join(' ');

        const all = await fetchTeachers({ page: 1, size: 9999 });
        allData.value = all.items;

        const { items, total } = await fetchTeachers({
            q: q || undefined,
            status: statusFilter.value,
            page: page.value,
            size: size.value,
            sort: sortField.value ? `${sortField.value},${sortOrder.value === -1 ? 'desc' : 'asc'}` : undefined
        });

        rows.value = items;
        totalRecords.value = total;
    } finally {
        if (isInit) loadingInit.value = false;
        else loadingList.value = false;
    }
}
function onChangePage(e) {
    page.value = e.page + 1;
    size.value = e.rows;
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
function setStatusFilter(s) {
    statusFilter.value = s;
    page.value = 1;
    load(false);
}

/* after create -> reload */
function onStaffCreated() {
    showCreate.value = false;
    load(false);
}

watch([fName, fPhone], () =>
    debounce(() => {
        page.value = 1;
        load(false);
    }, 300)
);
onMounted(() => load(true));
</script>

<template>
    <div class="px-4 md:px-6 lg:px-8 py-5 space-y-5">
        <div class="rounded-xl bg-slate-50 border border-slate-200 px-4 py-3">
            <div class="flex items-center justify-between">
                <h1 class="text-xl font-semibold text-slate-800">Giáo Viên</h1>
                <div class="flex items-center gap-2">
                    <Button class="!bg-primary !border-0 !text-white" icon="fa-solid fa-plus mr-2" label="Tạo giáo viên" @click="showCreate = true" />
                    <Button class="!bg-emerald-600 !border-0 !text-white" icon="fa-solid fa-file-arrow-up mr-2" label="Nhập excel" @click="triggerImport" />
                    <input ref="fileInput" type="file" accept=".xlsx,.xls,.csv" class="hidden" @change="onImportChange" />
                    <Button class="!bg-green-600 !border-0 !text-white" icon="fa-solid fa-file-arrow-down mr-2" label="Xuất excel" @click="onExport" />
                </div>
            </div>
        </div>

        <div class="flex flex-wrap items-center gap-3 justify-between">
            <div class="flex flex-wrap items-center gap-2">
                <button class="chip chip--soft" :class="{ 'chip--active': statusFilter === 'all' }" @click="setStatusFilter('all')">
                    <span class="chip__icon"><i class="fa-regular fa-clock"></i></span>
                    <span class="font-medium">{{ counterAll }} Giáo viên</span>
                </button>
                <button class="chip chip--gray" :class="{ 'chip--active': statusFilter === 'neverLoggedIn' }" @click="setStatusFilter('neverLoggedIn')">Chưa đăng nhập - {{ counterNever }}</button>
                <button class="chip chip--blue" :class="{ 'chip--active': statusFilter === 'active' }" @click="setStatusFilter('active')">Hoạt động - {{ counterActive }}</button>
                <button class="chip chip--amber" :class="{ 'chip--active': statusFilter === 'locked' }" @click="setStatusFilter('locked')">Tạm khóa - {{ counterLocked }}</button>
                <button class="chip chip--red" :class="{ 'chip--active': statusFilter === 'deleted' }" @click="setStatusFilter('deleted')">Đã bị xóa - {{ counterDeleted }}</button>
            </div>
        </div>

        <div class="rounded-xl border border-slate-200 overflow-hidden bg-white relative">
            <!-- loading overlay -->
            <div v-if="loadingInit || loadingList" class="absolute inset-0 bg-white/70 flex items-center justify-center z-10 text-slate-500 text-sm">
                <i class="fa-solid fa-spinner fa-spin mr-2"></i> Đang tải danh sách giáo viên...
            </div>

            <DataTable :value="rows" dataKey="id" v-model:selection="selection" :rows="size" responsiveLayout="scroll" :rowHover="true" class="p-datatable-sm staff-table">
                <Column selectionMode="multiple" headerStyle="width: 3rem" />
                <Column header="#" :body="(_, opt) => opt.rowIndex + 1" headerStyle="width: 4rem" />

                <!-- Tên + Email -->
                <Column>
                    <template #header>
                        <div class="header-filter nowrap">
                            <InputText v-model="fName" class="w-full" placeholder="Tên giáo viên" />
                            <button class="sort-btn" @click="onSort('name')" :aria-label="'Sắp xếp tên'">
                                <i class="fa-solid fa-up-down"></i>
                            </button>
                        </div>
                    </template>
                    <template #body="{ data }">
                        <div class="flex items-center gap-3">
                            <Avatar v-if="data.avatarUrl" :image="data.avatarUrl" shape="circle" />
                            <Avatar v-else :label="(data.name?.[0] ?? 'N').toUpperCase()" class="!bg-slate-100 !text-slate-700" shape="circle" />
                            <div class="min-w-0 leading-tight">
                                <div class="font-medium text-slate-900 break-any">{{ data.name || '-' }}</div>
                                <div class="text-xs text-slate-500 truncate">{{ data.email || '-' }}</div>
                            </div>
                        </div>
                    </template>
                </Column>

                <!-- Ngày sinh -->
                <Column headerClass="th-nowrap" bodyClass="td-nowrap" headerStyle="min-width: 130px">
                    <template #header>
                        <div class="header-filter nowrap">
                            <span class="font-semibold">Ngày sinh</span>
                            <button class="sort-btn" @click="onSort('dateOfBirth')" :aria-label="'Sắp xếp ngày sinh'">
                                <i class="fa-solid fa-up-down"></i>
                            </button>
                        </div>
                    </template>
                    <template #body="{ data }">
                        <span class="td-ellipsis">{{ formatDate(data.dateOfBirth) }}</span>
                    </template>
                </Column>

                <!-- Giới tính -->
                <Column headerClass="th-nowrap" bodyClass="td-nowrap" headerStyle="min-width: 110px">
                    <template #header>
                        <div class="header-filter nowrap">
                            <span class="font-semibold">Giới tính</span>
                            <button class="sort-btn" @click="onSort('gender')" :aria-label="'Sắp xếp giới tính'">
                                <i class="fa-solid fa-up-down"></i>
                            </button>
                        </div>
                    </template>
                    <template #body="{ data }">
                        <span class="inline-flex items-center gap-1">
                            <i :class="genderIconClass(data.gender)"></i>
                            {{ genderLabel(data.gender) }}
                        </span>
                    </template>
                </Column>

                <!-- Số điện thoại -->
                <Column headerClass="th-nowrap" bodyClass="td-nowrap" headerStyle="min-width: 140px">
                    <template #header>
                        <div class="header-filter nowrap">
                            <InputText v-model="fPhone" class="w-full" placeholder="Số điện thoại" />
                            <button class="sort-btn" @click="onSort('phone')" :aria-label="'Sắp xếp số điện thoại'">
                                <i class="fa-solid fa-up-down"></i>
                            </button>
                        </div>
                    </template>
                    <template #body="{ data }">
                        <span>{{ data.phone || '-' }}</span>
                    </template>
                </Column>

                <!-- Chức vụ -->
                <Column header="Chức vụ" headerClass="th-nowrap" headerStyle="width: 160px" bodyStyle="width: 160px" bodyClass="cell-tight">
                    <template #body="{ data }">
                        <span class="pill pill--role">
                            <span class="pill__text">{{ roleLabel(data.role) }}</span>
                        </span>
                    </template>
                </Column>

                <!-- Trạng thái -->
                <Column header="Trạng thái" headerClass="th-nowrap" headerStyle="width: 160px" bodyStyle="width: 160px" bodyClass="cell-tight">
                    <template #body="{ data }">
                        <span class="pill pill--status" :class="statusClass(data.status)">
                            <span class="pill__text">{{ statusLabel(data.status) }}</span>
                        </span>
                    </template>
                </Column>

                <!-- Hành động -->
                <Column header="Hành động" headerClass="th-nowrap" headerStyle="width: 6rem; text-align: right;" bodyStyle="text-align: right;">
                    <template #body="{ data }">
                        <Button
                            icon="fa-solid fa-ellipsis-vertical"
                            class="!bg-transparent !border-0 !text-slate-600 hover:!bg-slate-100"
                            @click="(e) => openRowMenu(e, data)"
                            aria-haspopup="true"
                            aria-controls="row_actions_menu"
                        />
                    </template>
                </Column>
            </DataTable>

            <div class="border-top">
                <Paginator :rows="size" :totalRecords="totalRecords" :rowsPerPageOptions="[10, 20, 50]" @page="onChangePage" />
            </div>
        </div>

        <!-- Menu hành động -->
        <Menu ref="actionMenu" id="row_actions_menu" :model="actionItems" :popup="true" appendTo="body" :pt="{ menu: { class: 'rowmenu-panel' } }">
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

        <CreateStaffModal v-model:modelValue="showCreate" @created="onStaffCreated" />

        <!-- Dialog xem thông tin giáo viên -->
        <Dialog v-model:visible="showView" modal header="Thông tin giáo viên" :style="{ width: '500px' }">
            <div v-if="currentTeacher" class="space-y-2">
                <div class="flex items-center gap-3 mb-3">
                    <Avatar v-if="currentTeacher.avatarUrl" :image="currentTeacher.avatarUrl" shape="circle" size="large" />
                    <Avatar v-else :label="(currentTeacher.name?.[0] ?? 'N').toUpperCase()" shape="circle" class="!bg-slate-100 !text-slate-700" size="large" />
                    <div>
                        <div class="font-semibold text-lg">{{ currentTeacher.name }}</div>
                        <div class="text-sm text-slate-500">{{ currentTeacher.email || '-' }}</div>
                    </div>
                </div>

                <div><span class="font-semibold">SĐT:</span> {{ currentTeacher.phone || '-' }}</div>
                <div>
                    <span class="font-semibold">Giới tính:</span>
                    {{ genderLabel(currentTeacher.gender) }}
                </div>
                <div>
                    <span class="font-semibold">Ngày sinh:</span>
                    {{ formatDate(currentTeacher.dateOfBirth) }}
                </div>
                <div>
                    <span class="font-semibold">Chuyên môn:</span>
                    {{ currentTeacher.specialization || '-' }}
                </div>
                <div>
                    <span class="font-semibold">Mã nhân viên:</span>
                    {{ currentTeacher.employeeCode || '-' }}
                </div>
                <div>
                    <span class="font-semibold">Liên hệ khẩn cấp:</span>
                    {{ currentTeacher.emergencyContact || '-' }}
                </div>
                <div>
                    <span class="font-semibold">Ngày vào làm:</span>
                    {{ formatDate(currentTeacher.joinDate) }}
                </div>
                <div>
                    <span class="font-semibold">Trạng thái:</span>
                    {{ statusLabel(currentTeacher.status) }}
                </div>
            </div>
        </Dialog>

        <!-- Dialog sửa giáo viên -->
        <Dialog v-model:visible="showEdit" modal header="Sửa thông tin giáo viên" :style="{ width: '500px' }">
            <div class="space-y-3">
                <div>
                    <label class="block text-sm font-medium mb-1">Họ tên</label>
                    <InputText v-model="editForm.fullName" class="w-full" />
                </div>
                <div>
                    <label class="block text-sm font-medium mb-1">Email</label>
                    <InputText v-model="editForm.email" class="w-full" />
                </div>
                <div>
                    <label class="block text-sm font-medium mb-1">Số điện thoại</label>
                    <InputText v-model="editForm.phone" class="w-full" />
                </div>
                <div>
                    <label class="block text-sm font-medium mb-1">Giới tính (nam/nu)</label>
                    <InputText v-model="editForm.gender" class="w-full" />
                </div>
                <div>
                    <label class="block text-sm font-medium mb-1">Chuyên môn</label>
                    <InputText v-model="editForm.specialization" class="w-full" />
                </div>
                <div>
                    <label class="block text-sm font-medium mb-1">Mã nhân viên</label>
                    <InputText v-model="editForm.employeeCode" class="w-full" />
                </div>
                <div>
                    <label class="block text-sm font-medium mb-1">Liên hệ khẩn cấp</label>
                    <InputText v-model="editForm.emergencyContact" class="w-full" />
                </div>
                <div>
                    <label class="block text-sm font-medium mb-1">Ngày sinh (yyyy-MM-dd)</label>
                    <InputText v-model="editForm.dateOfBirth" class="w-full" />
                </div>

                <div class="flex justify-end gap-2 mt-3">
                    <Button label="Hủy" class="p-button-text" @click="showEdit = false" />
                    <Button label="Lưu" class="!bg-primary !border-0 !text-white" @click="saveEdit" />
                </div>
            </div>
        </Dialog>
    </div>
</template>

<style scoped>
/* Không cho header wrap, chữ ngang */
:deep(.p-datatable .p-datatable-thead > tr > th.th-nowrap) {
    white-space: nowrap;
}

/* Header filter container cũng không wrap */
.header-filter.nowrap {
    white-space: nowrap;
}

/* Body cell: 1 dòng, cắt ... nếu dài */
.td-nowrap {
    white-space: nowrap;
}
.td-ellipsis {
    display: inline-block;
    max-width: 100%;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.break-any {
    white-space: normal;
    overflow-wrap: anywhere;
    word-break: break-word;
}

/* Chips */
.chip {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    background: #f1f5f9;
    color: #0f172a;
    border: 1px solid #e2e8f0;
    border-radius: 9999px;
    font-size: 14px;
    line-height: 1;
}
.chip--soft {
    background: #eef2ff;
    border-color: #dbeafe;
}
.chip--gray {
    background: #f8fafc;
    border-color: #e2e8f0;
}
.chip--blue {
    background: #e0efff;
    border-color: #bfdbfe;
}
.chip--amber {
    background: #fff7ed;
    border-color: #fed7aa;
}
.chip--red {
    background: #fef2f2;
    border-color: #fecaca;
}
.chip--active {
    border-color: #94a3b8;
}
.chip__icon {
    width: 22px;
    height: 22px;
    border-radius: 9999px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    background: #fff;
    color: #2563eb;
    border: 1px solid #bfdbfe;
}

/* Pills */
.cell-tight {
    display: table-cell;
    vertical-align: middle;
}
.pill {
    display: inline-flex;
    align-items: center;
    max-width: 100%;
    height: 28px;
    padding: 0 10px;
    border-radius: 9999px;
    font-size: 13px;
    font-weight: 600;
    line-height: 1;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    gap: 6px;
}
.pill--role {
    background: #eef2f7;
    color: #0f172a;
    border: 1px solid #e2e8f0;
}
.pill--status {
    border: 1px solid transparent;
}
.pill--status.status--active {
    background: #e6f0ff;
    color: #1d4ed8;
    border-color: #bfdbfe;
}
.pill--status.status--locked {
    background: #e7f7ef;
    color: #047857;
    border-color: #a7f3d0;
}
.pill--status.status--deleted {
    background: #fee2e2;
    color: #b91c1c;
    border-color: #fecaca;
}
.pill--status.status--never {
    background: #eef2f7;
    color: #334155;
    border-color: #e2e8f0;
}
.pill__text {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
}

/* Header filter controls */
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

.border-top {
    border-top: 1px solid #e5e7eb;
}
:deep(.p-datatable .p-datatable-thead > tr > th) {
    background: #fff;
}

/* Menu hành động */
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
</style>
