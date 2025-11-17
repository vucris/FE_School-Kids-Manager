<!-- src/views/school/HealthRecord.vue -->
<script setup>
import { ref, computed, onMounted } from 'vue';
import '@fortawesome/fontawesome-free/css/all.min.css';

import Dropdown from 'primevue/dropdown';
import InputText from 'primevue/inputtext';
import Button from 'primevue/button';
import Card from 'primevue/card';
import Paginator from 'primevue/paginator';
import Dialog from 'primevue/dialog';
import Calendar from 'primevue/calendar';

import { fetchHealthRecords, deleteHealthRecord, downloadHealthTemplateForClass, importHealthRecordsFromFile } from '@/service/HealthRecordService.js';
import { fetchClassOptions } from '@/service/classService.js';

/* ========== STATE ========== */

// filters
const classes = ref([]);
const selectedClass = ref(null);
const selectedYear = ref(null);
const selectedMonth = ref(null);
const keywordStudent = ref('');

// list data
const records = ref([]);
const loading = ref(false);
const errorMessage = ref('');

// pagination
const first = ref(0);
const rows = ref(10);

// dialog chi tiết
const detailVisible = ref(false);
const detailItem = ref(null);

// dialog upload
const uploadVisible = ref(false);
const uploadClass = ref(null);
const uploadDate = ref(null);
const uploadFile = ref(null);
const uploadError = ref('');
const uploadProgress = ref(0);
const uploadResult = ref(null);

// year & month options
const currentYear = new Date().getFullYear();
const yearOptions = Array.from({ length: 6 }, (_, i) => {
    const y = currentYear - 2 + i;
    return { label: `Năm ${y}`, value: y };
});
const monthOptions = Array.from({ length: 12 }, (_, i) => ({
    label: `Tháng ${i + 1}`,
    value: i + 1
}));

/* Nutrition / health view helpers */
function formatBmiStatus(bmi) {
    if (bmi == null || isNaN(Number(bmi))) return '—';
    const v = Number(bmi);
    if (v < 18.5) return 'Thiếu cân';
    if (v < 25) return 'Bình thường';
    if (v < 30) return 'Thừa cân';
    return 'Béo phì';
}

function nutritionChipClass(nutritionStatus, bmi) {
    const status = (nutritionStatus || formatBmiStatus(bmi)).toLowerCase();
    if (status.includes('thiếu') || status.includes('suy')) {
        return 'bg-amber-100 text-amber-700 border border-amber-200';
    }
    if (status.includes('béo') || status.includes('thừa')) {
        return 'bg-rose-100 text-rose-700 border border-rose-200';
    }
    if (status.includes('bình') || status.includes('chuẩn') || status.includes('normal')) {
        return 'bg-emerald-100 text-emerald-700 border border-emerald-200';
    }
    return 'bg-slate-100 text-slate-700 border border-slate-200';
}

/* ========== COMPUTED ========== */

const filteredRecords = computed(() => {
    let list = [...records.value];

    if (selectedClass.value?.id) {
        list = list.filter((r) => r.classId === selectedClass.value.id);
    }
    if (selectedYear.value) {
        list = list.filter((r) => r.recordYear === selectedYear.value);
    }
    if (selectedMonth.value) {
        list = list.filter((r) => r.recordMonth === selectedMonth.value);
    }

    const q = keywordStudent.value.toLowerCase().trim();
    if (q) {
        list = list.filter((r) => (r.studentName || '').toLowerCase().includes(q));
    }

    return list;
});

const pagedRecords = computed(() => {
    const start = first.value;
    const end = first.value + rows.value;
    return filteredRecords.value.slice(start, end);
});

/* ========== METHODS ========== */

function onPageChange(e) {
    first.value = e.first;
    rows.value = e.rows;
}

function formatDate(value) {
    if (!value) return '';
    const d = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleDateString('vi-VN');
}

function formatNumber(value, fractionDigits = 1) {
    if (value == null || isNaN(Number(value))) return '—';
    return Number(value).toFixed(fractionDigits);
}

/**
 * Load list hồ sơ sức khỏe từ BE
 */
async function loadRecords() {
    loading.value = true;
    errorMessage.value = '';
    try {
        const params = {
            classId: selectedClass.value?.id || null,
            year: selectedYear.value || null,
            month: selectedMonth.value || null
        };
        const data = await fetchHealthRecords(params);
        records.value = data || [];
        first.value = 0;
    } catch (e) {
        console.error(e);
        errorMessage.value = e.message || 'Không thể tải hồ sơ sức khỏe';
    } finally {
        loading.value = false;
    }
}

/**
 * Load danh sách lớp
 */
async function loadClasses() {
    try {
        const opts = await fetchClassOptions();
        classes.value = (opts || []).map((o) => ({
            id: o.value,
            name: o.label
        }));
    } catch (e) {
        console.warn('Không load được danh sách lớp:', e?.message || e);
        classes.value = [];
    }
}

/**
 * Xóa 1 hồ sơ
 */
async function removeRecord(item) {
    const ok = window.confirm(`Bạn có chắc chắn muốn xóa hồ sơ sức khỏe của ${item.studentName} (${item.recordMonth}/${item.recordYear})?`);
    if (!ok) return;
    try {
        await deleteHealthRecord(item.id);
        records.value = records.value.filter((r) => r.id !== item.id);
    } catch (e) {
        console.error(e);
        alert(e.message || 'Không thể xóa hồ sơ sức khỏe');
    }
}

/**
 * Dialog chi tiết
 */
function openDetail(item) {
    detailItem.value = item;
    detailVisible.value = true;
}
function closeDetail() {
    detailVisible.value = false;
    detailItem.value = null;
}

/**
 * Tải mẫu nhập cho lớp đang chọn
 */
async function handleDownloadTemplate() {
    const cls = selectedClass.value;
    if (!cls?.id) {
        alert('Vui lòng chọn lớp trước khi tải mẫu.');
        return;
    }
    try {
        await downloadHealthTemplateForClass(cls.id);
    } catch (e) {
        console.error(e);
        alert(e.message || 'Không thể tải mẫu nhập hồ sơ sức khỏe');
    }
}

/**
 * Upload dialog
 */
function openUploadDialog() {
    uploadVisible.value = true;
    uploadClass.value = selectedClass.value || null;
    uploadDate.value = null;
    uploadFile.value = null;
    uploadError.value = '';
    uploadProgress.value = 0;
    uploadResult.value = null;
}

function onUploadFileChange(e) {
    const f = e.target.files?.[0];
    uploadFile.value = f || null;
}

/**
 * Xử lý import từ file Excel
 */
async function handleUploadImport() {
    uploadError.value = '';
    uploadProgress.value = 0;
    uploadResult.value = null;

    const cls = uploadClass.value || selectedClass.value;

    if (!cls?.id) {
        uploadError.value = 'Vui lòng chọn lớp cần nhập.';
        return;
    }
    if (!uploadDate.value) {
        uploadError.value = 'Vui lòng chọn ngày đo.';
        return;
    }

    let dateObj = uploadDate.value instanceof Date ? uploadDate.value : new Date(uploadDate.value);
    if (Number.isNaN(dateObj.getTime())) {
        uploadError.value = 'Ngày đo không hợp lệ.';
        return;
    }

    if (!uploadFile.value) {
        uploadError.value = 'Vui lòng chọn file Excel cần nhập.';
        return;
    }

    try {
        const result = await importHealthRecordsFromFile(uploadFile.value, {
            classId: cls.id,
            recordDate: dateObj,
            onProgress: (percent) => {
                uploadProgress.value = percent;
            }
        });
        uploadResult.value = result;
        await loadRecords();
    } catch (e) {
        console.error(e);
        uploadError.value = e.message || 'Nhập dữ liệu thất bại';
    }
}

onMounted(() => {
    loadClasses();
    loadRecords();
});
</script>

<template>
    <div class="px-4 md:px-6 lg:px-10 py-6 space-y-5">
        <!-- Header -->
        <div class="flex flex-wrap items-center justify-between gap-3">
            <div class="flex items-center gap-3">
                <i class="fa-solid fa-heart-pulse text-2xl text-rose-500"></i>
                <div>
                    <div class="text-2xl font-extrabold tracking-tight text-slate-800">Hồ sơ sức khỏe</div>
                    <div class="text-slate-500 text-sm">Theo dõi cân nặng, chiều cao, BMI và tình trạng dinh dưỡng của từng bé theo tháng</div>
                </div>
            </div>

            <!-- Buttons tải xuống / tải lên -->
            <div class="flex items-center gap-2">
                <Button class="btn-success text-xs" label="Tải mẫu nhập" icon="pi pi-download" @click="handleDownloadTemplate" />
                <Button class="btn-primary text-xs" label="Tải lên" icon="pi pi-upload" @click="openUploadDialog" />
            </div>
        </div>

        <!-- Error -->
        <div v-if="errorMessage" class="px-4 py-3 rounded-xl bg-red-50 text-red-700 text-sm border border-red-200">
            {{ errorMessage }}
        </div>

        <!-- Filters -->
        <Card class="card-soft ring-1 ring-slate-100">
            <template #content>
                <div class="grid grid-cols-1 md:grid-cols-5 gap-3 items-end">
                    <div>
                        <label class="label">Lớp học</label>
                        <Dropdown v-model="selectedClass" :options="classes" optionLabel="name" class="w-full" placeholder="Tất cả lớp" />
                    </div>
                    <div>
                        <label class="label">Năm</label>
                        <Dropdown v-model="selectedYear" :options="yearOptions" optionLabel="label" optionValue="value" class="w-full" placeholder="Tất cả năm" />
                    </div>
                    <div>
                        <label class="label">Tháng</label>
                        <Dropdown v-model="selectedMonth" :options="monthOptions" optionLabel="label" optionValue="value" class="w-full" placeholder="Tất cả tháng" />
                    </div>
                    <div>
                        <label class="label">Học sinh</label>
                        <InputText v-model="keywordStudent" placeholder="Tên học sinh..." class="w-full" />
                    </div>
                    <div class="flex gap-2 justify-end">
                        <Button
                            class="btn-ghost flex-1 md:flex-none"
                            label="Xóa lọc"
                            icon="pi pi-filter-slash"
                            @click="
                                selectedClass = null;
                                selectedYear = null;
                                selectedMonth = null;
                                keywordStudent = '';
                                loadRecords();
                            "
                        />
                        <Button class="btn-primary flex-1 md:flex-none" label="Lọc" icon="pi pi-search" @click="loadRecords" />
                    </div>
                </div>
            </template>
        </Card>

        <!-- Table -->
        <div class="overflow-x-auto rounded-2xl ring-1 ring-slate-200 bg-white relative">
            <!-- Loading overlay -->
            <div v-if="loading" class="absolute inset-0 bg-white/70 flex items-center justify-center z-10 text-slate-500 text-sm">
                <i class="fa-solid fa-spinner fa-spin mr-2"></i>
                Đang tải dữ liệu...
            </div>

            <table class="min-w-full text-sm">
                <thead class="bg-slate-50 border-b text-slate-600">
                    <tr>
                        <th class="px-3 py-3 text-left w-14">STT</th>
                        <th class="px-3 py-3 text-left min-w-[170px]">Học sinh</th>
                        <th class="px-3 py-3 text-left min-w-[120px]">Lớp</th>
                        <th class="px-3 py-3 text-left min-w-[100px]">Thời gian</th>
                        <th class="px-3 py-3 text-left min-w-[110px]">Cân nặng</th>
                        <th class="px-3 py-3 text-left min-w-[110px]">Chiều cao</th>
                        <th class="px-3 py-3 text-left min-w-[110px]">BMI</th>
                        <th class="px-3 py-3 text-left min-w-[150px]">Dinh dưỡng</th>
                        <th class="px-3 py-3 text-center min-w-[130px]">Vấn đề sức khỏe</th>
                        <th class="px-3 py-3 text-center w-32">Thao tác</th>
                    </tr>
                </thead>
                <tbody>
                    <tr v-for="(r, idx) in pagedRecords" :key="r.id" class="border-b last:border-0 hover:bg-slate-50 align-top">
                        <td class="px-3 py-3 text-slate-600">
                            {{ first + idx + 1 }}
                        </td>
                        <td class="px-3 py-3">
                            <div class="font-medium text-slate-900">
                                {{ r.studentName }}
                            </div>
                            <div class="text-xs text-slate-500">
                                Tuổi (tháng):
                                <span class="font-semibold">
                                    {{ r.ageInMonths ?? '—' }}
                                </span>
                            </div>
                        </td>
                        <td class="px-3 py-3">
                            <div class="text-slate-800">{{ r.className }}</div>
                        </td>
                        <td class="px-3 py-3">
                            <div class="text-slate-800">
                                {{ r.recordMonth ? `Tháng ${r.recordMonth}` : '—' }} /
                                {{ r.recordYear || '—' }}
                            </div>
                        </td>
                        <td class="px-3 py-3">
                            <span class="font-semibold text-slate-800">
                                {{ formatNumber(r.weightKg, 1) }}
                            </span>
                            <span class="text-xs text-slate-500 ml-1">kg</span>
                        </td>
                        <td class="px-3 py-3">
                            <span class="font-semibold text-slate-800">
                                {{ formatNumber(r.heightCm, 1) }}
                            </span>
                            <span class="text-xs text-slate-500 ml-1">cm</span>
                        </td>
                        <td class="px-3 py-3">
                            <span class="font-semibold text-sky-700">
                                {{ formatNumber(r.bmi, 1) }}
                            </span>
                        </td>
                        <td class="px-3 py-3">
                            <span class="inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold" :class="nutritionChipClass(r.nutritionStatus, r.bmi)">
                                <i class="fa-solid fa-utensils mr-1 text-[10px]"></i>
                                {{ r.nutritionStatus || formatBmiStatus(r.bmi) }}
                            </span>
                            <div v-if="r.bloodType" class="text-xs text-slate-500 mt-1">
                                Nhóm máu:
                                <span class="font-semibold">{{ r.bloodType }}</span>
                            </div>
                        </td>
                        <td class="px-3 py-3 text-center">
                            <div class="flex flex-col items-center gap-1 text-xs">
                                <div class="flex items-center gap-2">
                                    <span class="inline-flex items-center gap-1 rounded-full px-2 py-1" :class="r.knowsSwimming ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-50 text-slate-500'">
                                        <i class="fa-solid fa-person-swimming text-[10px]"></i>
                                        Bơi: {{ r.knowsSwimming ? 'Có' : 'Chưa' }}
                                    </span>
                                </div>
                                <div class="flex items-center gap-2">
                                    <span class="inline-flex items-center gap-1 rounded-full px-2 py-1" :class="r.eyeIssue ? 'bg-rose-50 text-rose-700' : 'bg-slate-50 text-slate-500'">
                                        <i class="fa-regular fa-eye text-[10px]"></i>
                                        Mắt: {{ r.eyeIssue ? 'Có vấn đề' : 'Ổn' }}
                                    </span>
                                    <span class="inline-flex items-center gap-1 rounded-full px-2 py-1" :class="r.dentalIssue ? 'bg-rose-50 text-rose-700' : 'bg-slate-50 text-slate-500'">
                                        <i class="fa-solid fa-tooth text-[10px]"></i>
                                        Răng: {{ r.dentalIssue ? 'Có vấn đề' : 'Ổn' }}
                                    </span>
                                </div>
                            </div>
                        </td>
                        <td class="px-3 py-3 text-center">
                            <div class="flex flex-col gap-1 items-stretch">
                                <Button class="btn-ghost text-xs" label="Chi tiết" icon="pi pi-search" @click.stop="openDetail(r)" />
                                <Button class="btn-ghost text-xs !text-red-600" label="Xóa" icon="pi pi-trash" @click.stop="removeRecord(r)" />
                            </div>
                        </td>
                    </tr>

                    <tr v-if="!loading && !filteredRecords.length">
                        <td colspan="10" class="px-3 py-4 text-center text-slate-500">Không có hồ sơ sức khỏe phù hợp với bộ lọc hiện tại.</td>
                    </tr>
                </tbody>
            </table>
        </div>

        <!-- Pagination -->
        <div class="flex justify-end">
            <Paginator :rows="rows" :totalRecords="filteredRecords.length" :first="first" @page="onPageChange" class="mt-3" />
        </div>

        <!-- Dialog chi tiết hồ sơ sức khỏe -->
        <Dialog
            v-model:visible="detailVisible"
            modal
            :closeOnEscape="true"
            :dismissableMask="true"
            :breakpoints="{ '960px': '60vw', '640px': '95vw' }"
            style="width: 640px"
            :header="detailItem ? `Chi tiết hồ sơ sức khỏe #${detailItem.id}` : 'Chi tiết hồ sơ sức khỏe'"
        >
            <div v-if="detailItem" class="space-y-4">
                <!-- Học sinh & lớp -->
                <div class="border-b pb-3">
                    <div class="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Học sinh & lớp</div>
                    <div class="flex justify-between text-sm text-slate-800">
                        <div>
                            <div class="font-semibold text-lg">
                                {{ detailItem.studentName || '—' }}
                            </div>
                            <div class="text-xs text-slate-500">
                                Lớp:
                                <span class="font-semibold">
                                    {{ detailItem.className || '—' }}
                                </span>
                                <span v-if="detailItem.ageInMonths != null" class="ml-2 text-slate-400"> • Tuổi (tháng): {{ detailItem.ageInMonths }} </span>
                            </div>
                        </div>
                        <div class="text-right text-xs text-slate-500">
                            <div>
                                Thời gian:
                                <span class="font-semibold text-slate-700">
                                    {{ detailItem.recordMonth ? `Tháng ${detailItem.recordMonth}` : '—' }}
                                    /
                                    {{ detailItem.recordYear || '—' }}
                                </span>
                            </div>
                            <div v-if="detailItem.createdAt">Tạo: {{ formatDate(detailItem.createdAt) }}</div>
                            <div v-if="detailItem.updatedAt">Cập nhật: {{ formatDate(detailItem.updatedAt) }}</div>
                        </div>
                    </div>
                </div>

                <!-- Chỉ số đo -->
                <div class="border-b pb-3 grid grid-cols-3 gap-3 text-sm">
                    <div class="p-3 rounded-xl bg-slate-50">
                        <div class="text-xs text-slate-500 mb-1">Cân nặng</div>
                        <div class="text-lg font-semibold text-slate-800">
                            {{ formatNumber(detailItem.weightKg, 1) }}
                            <span class="text-xs text-slate-500 ml-1">kg</span>
                        </div>
                    </div>
                    <div class="p-3 rounded-xl bg-slate-50">
                        <div class="text-xs text-slate-500 mb-1">Chiều cao</div>
                        <div class="text-lg font-semibold text-slate-800">
                            {{ formatNumber(detailItem.heightCm, 1) }}
                            <span class="text-xs text-slate-500 ml-1">cm</span>
                        </div>
                    </div>
                    <div class="p-3 rounded-xl bg-slate-50">
                        <div class="text-xs text-slate-500 mb-1">BMI</div>
                        <div class="text-lg font-semibold text-sky-700">
                            {{ formatNumber(detailItem.bmi, 1) }}
                        </div>
                    </div>
                </div>

                <!-- Dinh dưỡng & nhóm máu -->
                <div class="border-b pb-3 flex flex-wrap gap-3 items-center justify-between">
                    <div class="space-y-1 text-sm text-slate-700">
                        <div>
                            <span class="font-semibold"> Tình trạng dinh dưỡng: </span>
                            {{ detailItem.nutritionStatus || formatBmiStatus(detailItem.bmi) }}
                        </div>
                        <div v-if="detailItem.bloodType">
                            <span class="font-semibold">Nhóm máu: </span>
                            {{ detailItem.bloodType }}
                        </div>
                    </div>
                    <div>
                        <span class="inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold" :class="nutritionChipClass(detailItem.nutritionStatus, detailItem.bmi)">
                            <i class="fa-solid fa-utensils mr-1 text-[10px]"></i>
                            {{ detailItem.nutritionStatus || formatBmiStatus(detailItem.bmi) }}
                        </span>
                    </div>
                </div>

                <!-- Vấn đề sức khỏe -->
                <div class="border-b pb-3">
                    <div class="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Vấn đề sức khỏe</div>
                    <div class="flex flex-wrap gap-2 text-xs">
                        <span class="inline-flex items-center gap-1 rounded-full px-3 py-1" :class="detailItem.knowsSwimming ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-50 text-slate-500'">
                            <i class="fa-solid fa-person-swimming text-[10px]"></i>
                            Bơi:
                            {{ detailItem.knowsSwimming ? 'Có' : 'Chưa biết bơi' }}
                        </span>
                        <span class="inline-flex items-center gap-1 rounded-full px-3 py-1" :class="detailItem.eyeIssue ? 'bg-rose-50 text-rose-700' : 'bg-slate-50 text-slate-500'">
                            <i class="fa-regular fa-eye text-[10px]"></i>
                            Mắt:
                            {{ detailItem.eyeIssue ? 'Có vấn đề' : 'Không ghi nhận' }}
                        </span>
                        <span class="inline-flex items-center gap-1 rounded-full px-3 py-1" :class="detailItem.dentalIssue ? 'bg-rose-50 text-rose-700' : 'bg-slate-50 text-slate-500'">
                            <i class="fa-solid fa-tooth text-[10px]"></i>
                            Răng miệng:
                            {{ detailItem.dentalIssue ? 'Có vấn đề' : 'Không ghi nhận' }}
                        </span>
                    </div>
                </div>

                <!-- Ghi chú -->
                <div v-if="detailItem.note">
                    <div class="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Ghi chú bác sĩ / giáo viên</div>
                    <div class="text-sm leading-relaxed text-slate-800 whitespace-pre-line bg-slate-50 rounded-xl p-3">
                        {{ detailItem.note }}
                    </div>
                </div>

                <div class="flex justify-end mt-3">
                    <Button label="Đóng" class="btn-ghost text-xs" @click="closeDetail" />
                </div>
            </div>
        </Dialog>

        <!-- Dialog tải lên -->
        <Dialog v-model:visible="uploadVisible" modal :closeOnEscape="true" :dismissableMask="true" :breakpoints="{ '960px': '60vw', '640px': '95vw' }" style="width: 520px" header="Tải lên chiều cao - cân nặng">
            <div class="space-y-4 text-sm text-slate-700">
                <div class="grid grid-cols-1 gap-3">
                    <div>
                        <label class="label">Lớp học</label>
                        <Dropdown v-model="uploadClass" :options="classes" optionLabel="name" class="w-full" placeholder="Chọn lớp" />
                    </div>
                    <div>
                        <label class="label">Ngày đo</label>
                        <Calendar v-model="uploadDate" :manualInput="false" showIcon dateFormat="dd/mm/yy" class="w-full" />
                    </div>
                    <div>
                        <label class="label">Tệp thông tin</label>
                        <input type="file" accept=".xlsx,.xls" @change="onUploadFileChange" class="block w-full text-sm text-slate-700" />
                    </div>
                </div>

                <div class="text-xs text-slate-500 space-y-1">
                    <div class="font-semibold">Các ghi chú trong việc tải file chiều cao - cân nặng</div>
                    <ul class="list-disc pl-5 space-y-1">
                        <li>Sử dụng đúng tệp tin mẫu hệ thống tải xuống để đảm bảo chính xác.</li>
                        <li>Mã học sinh (studentId) không được sửa.</li>
                        <li>Chiều cao và cân nặng phải ở dạng số thập phân, phân cách bằng dấu chấm (ví dụ: 17.5).</li>
                        <li>Dữ liệu không hợp lệ sẽ bị bỏ qua, thông tin lỗi sẽ xuất hiện ở phần báo cáo.</li>
                    </ul>
                </div>

                <div v-if="uploadError" class="text-xs text-red-600">
                    {{ uploadError }}
                </div>

                <div v-if="uploadProgress > 0 && uploadProgress < 100" class="text-xs text-slate-500">Đang xử lý: {{ uploadProgress }}%</div>

                <div v-if="uploadResult" class="text-xs text-emerald-700 max-h-32 overflow-auto">
                    Đã xử lý {{ uploadResult.total }} dòng. Thành công: {{ uploadResult.success }}. Thất bại: {{ uploadResult.failed }}.
                    <div v-if="uploadResult.errors?.length" class="mt-1 text-[11px] text-rose-600">
                        <div v-for="(err, i) in uploadResult.errors" :key="i">- {{ err }}</div>
                    </div>
                </div>

                <div class="flex justify-end gap-2 pt-2">
                    <Button label="Đóng" class="btn-ghost text-xs" @click="uploadVisible = false" />
                    <Button label="Tải lên" class="btn-primary text-xs" icon="pi pi-upload" @click="handleUploadImport" />
                </div>
            </div>
        </Dialog>
    </div>
</template>

<style scoped>
.label {
    display: inline-block;
    margin-bottom: 6px;
    font-weight: 700;
    color: #334155;
}

.card-soft {
    border-radius: 16px;
    background: linear-gradient(180deg, #ffffff, #fafafa);
}

.btn-primary {
    background: linear-gradient(135deg, #4f46e5, #3b82f6);
    color: #fff;
    border: 0;
}

.btn-ghost {
    background: #f1f5f9;
    color: #334155;
    border: 0;
}

.btn-success {
    background: linear-gradient(135deg, #059669, #10b981);
    color: #fff;
    border: 0;
}
</style>
