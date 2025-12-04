<script setup>
import { ref, onMounted, watch } from 'vue';
import '@fortawesome/fontawesome-free/css/all.min.css';

import DataTable from 'primevue/datatable';
import Column from 'primevue/column';
import Dropdown from 'primevue/dropdown';
import InputText from 'primevue/inputtext';
import Button from 'primevue/button';
import Paginator from 'primevue/paginator';
import Avatar from 'primevue/avatar';

import Swal from 'sweetalert2';

import { fetchTeacherClasses } from '@/service/teacherService.js';
import { fetchStudentsOfMyClass } from '@/service/studentService.js';

/* ========== STATE ========== */

const classes = ref([]);          // [{ label, value }]
const selectedClassId = ref(null);

const fCode = ref('');
const fName = ref('');
const fParent = ref('');
const page = ref(1);
const size = ref(10);

const rows = ref([]);
const totalRecords = ref(0);
const loading = ref(false);

/* ========== SWEETALERT TOAST ========== */

const swalToast = Swal.mixin({
    toast: true,
    position: 'top-end',
    showConfirmButton: false,
    timer: 2400,
    timerProgressBar: true
});

/* ========== HELPERS ========== */

function genderIcon(g) {
    return g === 'F'
        ? 'fa-solid fa-venus text-pink-500'
        : 'fa-solid fa-mars text-blue-500';
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

/* ========== LOAD LỚP CỦA GIÁO VIÊN ========== */

async function loadClasses() {
    try {
        const list = await fetchTeacherClasses();
        classes.value = list.map((c) => ({
            label: c.className,
            value: c.id
        }));
        if (!selectedClassId.value && classes.value.length) {
            selectedClassId.value = classes.value[0].value;
        }
    } catch (e) {
        console.error(e);
        swalToast.fire({
            icon: 'error',
            title: e.message || 'Không tải được danh sách lớp'
        });
    }
}

/* ========== LOAD HỌC SINH TRONG LỚP ========== */

async function load() {
    if (!selectedClassId.value) {
        rows.value = [];
        totalRecords.value = 0;
        return;
    }
    loading.value = true;
    try {
        const { items, total } = await fetchStudentsOfMyClass(selectedClassId.value, {
            code: fCode.value || undefined,
            name: fName.value || undefined,
            parentName: fParent.value || undefined,
            page: page.value,
            size: size.value
        });
        rows.value = items;
        totalRecords.value = total;
    } catch (e) {
        swalToast.fire({
            icon: 'error',
            title: e.message || 'Không tải được học sinh'
        });
    } finally {
        loading.value = false;
    }
}

/* ========== PAGINATION ========== */

function onChangePage(e) {
    page.value = e.page + 1;
    size.value = e.rows;
    load();
}

/* ========== DEBOUNCE FILTER ========== */

let t;
function debounce(fn, ms = 300) {
    clearTimeout(t);
    t = setTimeout(fn, ms);
}

watch([fCode, fName, fParent], () =>
    debounce(() => {
        page.value = 1;
        load();
    }, 300)
);

/* Đổi lớp -> load lại */

watch(selectedClassId, () => {
    page.value = 1;
    load();
});

/* ========== LIFECYCLE ========== */

onMounted(async () => {
    await loadClasses();
    await load();
});
</script>

<template>
    <div class="px-4 md:px-6 lg:px-8 py-5 space-y-4">
        <!-- Header -->
        <div class="flex flex-wrap items-center justify-between gap-3">
            <div>
                <h1 class="text-xl font-semibold text-slate-800">
                    Học sinh lớp tôi
                </h1>
                <p class="text-slate-500 text-sm">
                    Giáo viên chỉ xem được danh sách học sinh trong các lớp mình phụ trách
                </p>
            </div>

            <div class="flex items-center gap-2">
                <div
                    class="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 text-slate-700"
                >
                    <i class="fa-regular fa-clipboard"></i>
                    <span class="font-semibold"
                        >Tổng: {{ totalRecords }} học sinh</span
                    >
                </div>
            </div>
        </div>

        <!-- Chọn lớp -->
        <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
            <Dropdown
                v-model="selectedClassId"
                :options="classes"
                optionLabel="label"
                optionValue="value"
                class="w-full"
                placeholder="Chọn lớp"
            />
        </div>

        <!-- Bộ lọc -->
        <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
                <label class="filter-label">Mã học sinh</label>
                <InputText
                    v-model="fCode"
                    class="w-full"
                    placeholder="Nhập mã học sinh"
                />
            </div>
            <div>
                <label class="filter-label">Tên học sinh</label>
                <InputText
                    v-model="fName"
                    class="w-full"
                    placeholder="Nhập tên học sinh"
                />
            </div>
            <div>
                <label class="filter-label">Tên phụ huynh</label>
                <InputText
                    v-model="fParent"
                    class="w-full"
                    placeholder="Nhập tên phụ huynh"
                />
            </div>
        </div>

        <!-- Bảng -->
        <div class="rounded-xl border border-slate-200 overflow-hidden bg-white relative">
            <!-- Loading overlay -->
            <div
                v-if="loading"
                class="absolute inset-0 bg-white/70 flex items-center justify-center z-10 text-slate-500 text-sm"
            >
                <i class="fa-solid fa-spinner fa-spin mr-2"></i> Đang tải dữ liệu...
            </div>

            <DataTable
                :value="rows"
                dataKey="id"
                :rows="size"
                responsiveLayout="scroll"
                :rowHover="true"
                class="p-datatable-sm"
            >
                <Column
                    header="#"
                    :body="(_, opt) => opt.rowIndex + 1 + (page - 1) * size"
                    headerStyle="width: 4rem"
                />

                <!-- Mã HS -->
                <Column header="Mã HS">
                    <template #body="{ data }">
                        <span class="font-medium text-slate-900">
                            {{ data.code || '-' }}
                        </span>
                    </template>
                </Column>

                <!-- Tên HS -->
                <Column header="Học sinh">
                    <template #body="{ data }">
                        <div class="flex items-center gap-3">
                            <Avatar
                                :label="(data.name?.[0] ?? 'H').toUpperCase()"
                                class="!bg-slate-100 !text-slate-700"
                            />
                            <div class="min-w-0">
                                <div class="font-semibold text-slate-900 truncate">
                                    {{ data.name }}
                                </div>
                                <div class="text-slate-500 text-xs flex items-center gap-3">
                                    <span>
                                        <i class="fa-regular fa-calendar"></i>
                                        {{ formatDob(data.dob) }}
                                    </span>
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
                    <template #body="{ data }">
                        <span class="font-medium text-slate-800">
                            {{ data.className || '-' }}
                        </span>
                    </template>
                </Column>

                <!-- Phụ huynh -->
                <Column header="Phụ huynh">
                    <template #body="{ data }">
                        <div class="text-slate-900">{{ data.parentName || '-' }}</div>
                        <div class="text-slate-500 text-xs">
                            <i class="fa-solid fa-phone"></i>
                            {{ data.parentPhone || data.phone || '-' }}
                        </div>
                    </template>
                </Column>
            </DataTable>
        </div>

        <div class="border-t border-slate-200 mt-2 flex justify-end">
            <Paginator
                :rows="size"
                :totalRecords="totalRecords"
                :rowsPerPageOptions="[5, 10, 20, 50]"
                @page="onChangePage"
            />
        </div>
    </div>
</template>

<style scoped>
.filter-label {
    display: block;
    font-size: 13px;
    color: #6b7280;
    margin-bottom: 4px;
}
</style>
