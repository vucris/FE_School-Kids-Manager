<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import '@fortawesome/fontawesome-free/css/all.min.css';

import Dropdown from 'primevue/dropdown';
import InputText from 'primevue/inputtext';
import Button from 'primevue/button';
import Card from 'primevue/card';
import Tag from 'primevue/tag';
import Dialog from 'primevue/dialog';

import Swal from 'sweetalert2';

import { fetchClassesLite } from '@/service/classService.js';
import { fetchStudentsByClass } from '@/service/studentService.js';
import { downloadHealthRecordTemplate, importHealthRecordsFromExcel, exportHealthRecordsToExcel, fetchHealthRecordsByClassAndPeriodFE, deleteHealthRecord, updateHealthRecord, fetchHealthRecordById } from '@/service/healthRecordService.js';
import { useAuthStore } from '@/stores/auth.js';
import { getUsernameFromUser } from '@/service/authService.js';

/* Auth – chỉ show tên người thao tác */
const auth = useAuthStore();
const currentUser = computed(() => getUsernameFromUser(auth?.user) || 'system');

/* Combo lớp */
const classes = ref([]); // [{ id, name }]
const selectedClassId = ref(null);

/* Năm */
const today = new Date();
const year = ref(today.getFullYear());

/* Lọc theo tên HS */
const keyword = ref('');

/* Data */
const loading = ref(false);
const students = ref([]); // toàn bộ học sinh trong lớp
const healthRecords = ref([]); // hồ sơ sức khỏe theo NĂM

/* Import / Export */
const showImportModal = ref(false);
const fileInputRef = ref(null);
const selectedFile = ref(null);
const importing = ref(false);
const exporting = ref(false);
const downloadingTemplate = ref(false);
const lastImportResult = ref(null);

/* Xóa */
const deletingIds = ref(new Set());

/* Sửa */
const editVisible = ref(false);
const editing = ref(false);
const editForm = ref({
    id: null,
    studentName: '',
    className: '',
    recordYear: null,
    recordMonth: null,
    ageInMonths: null,
    weightKg: null,
    heightCm: null,
    bmi: null,
    nutritionStatus: '',
    bloodType: '',
    knowsSwimming: null,
    eyeIssue: '',
    dentalIssue: '',
    note: ''
});

/* Toast */
const swalToast = Swal.mixin({
    toast: true,
    position: 'top-end',
    showConfirmButton: false,
    timer: 2300,
    timerProgressBar: true
});

/* Lấy danh sách lớp */
async function loadClasses() {
    const lite = await fetchClassesLite(); // [{ value, label }]
    classes.value = lite.map((c) => ({ id: c.value, name: c.label }));
    if (!selectedClassId.value && classes.value.length) {
        selectedClassId.value = classes.value[0].id;
    }
}

/* Helper: tính tháng tuổi từ ngày sinh (dob: string) tại (year, month) */
function calcAgeInMonthsFromDob(dob, recordYear, recordMonth) {
    if (!dob || !recordYear || !recordMonth) return null;
    const d = new Date(dob);
    if (Number.isNaN(d.getTime())) return null;

    const y0 = d.getFullYear();
    const m0 = d.getMonth() + 1;

    const y1 = Number(recordYear);
    const m1 = Number(recordMonth);

    const total0 = y0 * 12 + m0;
    const total1 = y1 * 12 + m1;

    const diff = total1 - total0;
    return diff >= 0 ? diff : null;
}

/* Tải dữ liệu: học sinh + health records của CẢ NĂM */
async function loadData() {
    if (!selectedClassId.value) return;

    loading.value = true;
    try {
        const [stu, records] = await Promise.all([
            fetchStudentsByClass(selectedClassId.value),
            // chỉ lọc theo NĂM, không theo tháng
            fetchHealthRecordsByClassAndPeriodFE(selectedClassId.value, year.value, null)
        ]);

        students.value = stu || [];
        healthRecords.value = records || [];

        swalToast.fire({
            icon: 'success',
            title: 'Đã tải hồ sơ sức khỏe'
        });
    } catch (e) {
        swalToast.fire({
            icon: 'error',
            title: e?.message || 'Không tải được dữ liệu sức khỏe'
        });
    } finally {
        loading.value = false;
    }
}

/* Gộp dữ liệu */
const rows = computed(() => {
    const q = keyword.value.trim().toLowerCase();

    const stuById = new Map((students.value || []).map((s) => [Number(s.id), s]));
    const result = [];

    (healthRecords.value || []).forEach((r, idx) => {
        const s = stuById.get(Number(r.studentId)) || {};

        const studentName = s.name || s.fullName || r.studentName || '';
        if (q && !studentName.toLowerCase().includes(q)) return;

        const studentCode = s.studentCode || s.code || r.studentCode || r.student_code || '';
        const className = s.className || r.className || '';

        const ageInMonths =
            r.ageInMonths ??
            calcAgeInMonthsFromDob(
                s.dob || s.dateOfBirth || s.date_of_birth,
                r.recordYear || year.value,
                // fallback nếu recordMonth không có thì lấy tháng 6 cho giữa năm
                r.recordMonth || 6
            );

        result.push({
            index: idx + 1,
            healthRecordId: r.id || null,
            studentId: r.studentId,
            studentCode,
            studentName,
            className,
            ageInMonths,
            weightKg: r.weightKg ?? null,
            heightCm: r.heightCm ?? null,
            bmi: r.bmi ?? null,
            nutritionStatus: r.nutritionStatus ?? '',
            bloodType: r.bloodType ?? '',
            knowsSwimming: r.knowsSwimming ?? null,
            eyeIssue: r.eyeIssue ?? '',
            dentalIssue: r.dentalIssue ?? '',
            note: r.note ?? '',
            hasRecord: true,
            recordMonth: r.recordMonth,
            recordYear: r.recordYear,
            createdAt: r.createdAt,
            updatedAt: r.updatedAt
        });
    });

    return result;
});

/* ====== Hành động: sửa / xóa ====== */

async function onEdit(row) {
    if (!row.healthRecordId) {
        swalToast.fire({
            icon: 'info',
            title: 'Học sinh này chưa có hồ sơ năm này'
        });
        return;
    }

    try {
        editing.value = true;
        const record = await fetchHealthRecordById(row.healthRecordId);
        const base = record || row;

        editForm.value = {
            id: base.id,
            studentName: base.studentName || row.studentName,
            className: base.className || row.className,
            recordYear: base.recordYear || year.value,
            recordMonth: base.recordMonth || row.recordMonth || 6, // vẫn cho phép chỉnh tháng trong hồ sơ
            ageInMonths: base.ageInMonths ?? row.ageInMonths ?? null,
            weightKg: base.weightKg ?? row.weightKg ?? null,
            heightCm: base.heightCm ?? row.heightCm ?? null,
            bmi: base.bmi ?? row.bmi ?? null,
            nutritionStatus: base.nutritionStatus ?? row.nutritionStatus ?? '',
            bloodType: base.bloodType ?? row.bloodType ?? '',
            knowsSwimming: base.knowsSwimming ?? row.knowsSwimming ?? null,
            eyeIssue: base.eyeIssue ?? row.eyeIssue ?? '',
            dentalIssue: base.dentalIssue ?? row.dentalIssue ?? '',
            note: base.note ?? row.note ?? ''
        };

        editVisible.value = true;
    } catch (e) {
        swalToast.fire({
            icon: 'error',
            title: e?.message || 'Không lấy được chi tiết hồ sơ'
        });
    } finally {
        editing.value = false;
    }
}

async function saveEdit() {
    const f = editForm.value;
    if (!f.id) {
        swalToast.fire({
            icon: 'error',
            title: 'Thiếu ID hồ sơ'
        });
        return;
    }

    editing.value = true;
    try {
        const payload = {
            recordYear: f.recordYear,
            recordMonth: f.recordMonth, // vẫn gửi tháng cho BE nếu có
            ageInMonths: f.ageInMonths,
            weightKg: f.weightKg,
            heightCm: f.heightCm,
            bmi: f.bmi,
            nutritionStatus: f.nutritionStatus,
            bloodType: f.bloodType,
            knowsSwimming: f.knowsSwimming,
            eyeIssue: f.eyeIssue,
            dentalIssue: f.dentalIssue,
            note: f.note
        };

        await updateHealthRecord(f.id, payload);

        swalToast.fire({
            icon: 'success',
            title: 'Đã cập nhật hồ sơ'
        });

        editVisible.value = false;
        await loadData();
    } catch (e) {
        swalToast.fire({
            icon: 'error',
            title: e?.message || 'Cập nhật hồ sơ thất bại'
        });
    } finally {
        editing.value = false;
    }
}

async function onDelete(row) {
    if (!row.healthRecordId) {
        swalToast.fire({
            icon: 'info',
            title: 'Không có hồ sơ để xóa'
        });
        return;
    }

    const confirm = await Swal.fire({
        title: 'Xóa hồ sơ sức khỏe?',
        text: `Học sinh: ${row.studentName || ''} (ID hồ sơ: ${row.healthRecordId})`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Xóa',
        cancelButtonText: 'Hủy',
        confirmButtonColor: '#dc2626',
        cancelButtonColor: '#6b7280'
    });

    if (!confirm.isConfirmed) return;

    deletingIds.value = new Set(deletingIds.value);
    deletingIds.value.add(row.healthRecordId);

    try {
        await deleteHealthRecord(row.healthRecordId);
        swalToast.fire({
            icon: 'success',
            title: 'Đã xóa hồ sơ'
        });
        await loadData();
    } catch (e) {
        swalToast.fire({
            icon: 'error',
            title: e?.message || 'Xóa hồ sơ thất bại'
        });
    } finally {
        deletingIds.value.delete(row.healthRecordId);
    }
}

/* ==== Import / Export ==== */
function onChooseFile() {
    if (!fileInputRef.value) return;
    fileInputRef.value.value = '';
    fileInputRef.value.click();
}

function onFileChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    selectedFile.value = file;
    swalToast.fire({
        icon: 'info',
        title: `Đã chọn file: ${file.name}`
    });
}

async function onDownloadTemplate() {
    if (!selectedClassId.value) {
        swalToast.fire({ icon: 'info', title: 'Vui lòng chọn lớp' });
        return;
    }
    downloadingTemplate.value = true;
    try {
        const blob = await downloadHealthRecordTemplate(selectedClassId.value);
        const url = window.URL.createObjectURL(new Blob([blob]));
        const a = document.createElement('a');
        a.href = url;
        a.download = `mau_ho_so_suc_khoe_lop_${selectedClassId.value}.xlsx`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(url);
    } catch (e) {
        swalToast.fire({
            icon: 'error',
            title: e?.message || 'Không tải được file mẫu'
        });
    } finally {
        downloadingTemplate.value = false;
    }
}

async function onImport() {
    if (!selectedClassId.value) {
        swalToast.fire({ icon: 'info', title: 'Vui lòng chọn lớp' });
        return;
    }
    if (!selectedFile.value) {
        swalToast.fire({ icon: 'info', title: 'Chưa chọn file Excel' });
        return;
    }

    importing.value = true;
    try {
        const res = await importHealthRecordsFromExcel({
            file: selectedFile.value,
            classId: selectedClassId.value,
            recordYear: year.value // 🎯 chỉ đo theo NĂM
        });

        lastImportResult.value = res || null;

        swalToast.fire({
            icon: 'success',
            title: 'Import hoàn tất'
        });

        showImportModal.value = false;
        await loadData();
    } catch (e) {
        swalToast.fire({
            icon: 'error',
            title: e?.message || 'Import thất bại'
        });
    } finally {
        importing.value = false;
    }
}

async function onExport() {
    if (!selectedClassId.value) {
        swalToast.fire({ icon: 'info', title: 'Vui lòng chọn lớp' });
        return;
    }
    exporting.value = true;
    try {
        const blob = await exportHealthRecordsToExcel({
            classId: selectedClassId.value,
            year: year.value // 🎯 export theo NĂM
        });
        const url = window.URL.createObjectURL(new Blob([blob]));
        const a = document.createElement('a');
        a.href = url;
        a.download = `ho_so_suc_khoe_lop_${selectedClassId.value}_nam_${year.value}.xlsx`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(url);
    } catch (e) {
        swalToast.fire({
            icon: 'error',
            title: e?.message || 'Xuất Excel thất bại'
        });
    } finally {
        exporting.value = false;
    }
}

/* Auto reload khi đổi lớp / năm */
watch([selectedClassId, year], () => {
    loadData();
});

onMounted(async () => {
    await loadClasses();
    await loadData();
});
</script>

<template>
    <div class="px-4 md:px-6 lg:px-10 py-6 space-y-5 relative">
        <!-- Loading overlay -->
        <div v-if="loading" class="absolute inset-0 bg-white/70 flex items-center justify-center z-10 text-slate-500 text-sm">
            <i class="fa-solid fa-spinner fa-spin mr-2" />
            Đang tải hồ sơ sức khỏe...
        </div>

        <!-- Header -->
        <div class="flex flex-wrap items-center justify-between gap-3">
            <div class="flex items-center gap-3">
                <div class="h-11 w-11 flex items-center justify-center rounded-2xl bg-rose-100 text-rose-500 shadow-sm">
                    <i class="fa-solid fa-heart-pulse text-xl"></i>
                </div>
                <div>
                    <div class="text-2xl font-extrabold tracking-tight text-slate-800">Hồ sơ sức khỏe</div>
                    <div class="text-slate-500 text-sm">
                        Năm {{ year }} • Người thao tác:
                        <span class="font-semibold text-slate-700">{{ currentUser }}</span>
                    </div>
                </div>
            </div>

            <div class="flex flex-wrap items-center gap-2">
                <Button class="btn-ghost" icon="fa-solid fa-file-arrow-down mr-2" label="Tải file mẫu" :disabled="downloadingTemplate || !selectedClassId" @click="onDownloadTemplate" />
                <Button class="btn-ghost" icon="fa-solid fa-file-import mr-2" label="Import từ Excel" :disabled="!selectedClassId" @click="showImportModal = true" />
                <Button class="btn-success" icon="fa-solid fa-file-excel mr-2" :label="exporting ? 'Đang xuất...' : 'Xuất Excel'" :disabled="exporting || !selectedClassId" @click="onExport" />
            </div>
        </div>

        <!-- Bộ lọc -->
        <Card class="card-soft ring-1 ring-slate-100">
            <template #content>
                <div class="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
                    <div class="md:col-span-2">
                        <label class="label">Chọn lớp</label>
                        <Dropdown v-model="selectedClassId" :options="classes" optionLabel="name" optionValue="id" class="w-full" placeholder="Chọn lớp" />
                    </div>
                    <div>
                        <label class="label">Năm</label>
                        <Dropdown v-model="year" class="w-full" :options="[year - 1, year, year + 1].map((y) => ({ label: String(y), value: y }))" optionLabel="label" optionValue="value" />
                    </div>
                    <div>
                        <label class="label">Tìm học sinh</label>
                        <InputText v-model="keyword" class="w-full" placeholder="Tên học sinh" />
                    </div>
                </div>
            </template>
        </Card>

        <!-- Bảng dữ liệu: có overflow-x để kéo ngang -->
        <div class="overflow-x-auto rounded-2xl ring-1 ring-slate-200 bg-white shadow-sm">
            <table class="min-w-full border-separate border-spacing-0">
                <thead>
                    <tr class="bg-gradient-to-r from-sky-50 via-slate-50 to-emerald-50 border-b border-slate-200/70">
                        <th class="th-first w-10">#</th>
                        <th class="th min-w-[120px]">Mã HS</th>
                        <th class="th min-w-[220px]">Học sinh</th>
                        <th class="th min-w-[160px]">Lớp</th>
                        <th class="th min-w-[100px] text-center">Tháng tuổi</th>
                        <th class="th min-w-[120px] text-center">Cân nặng (kg)</th>
                        <th class="th min-w-[120px] text-center">Chiều cao (cm)</th>
                        <th class="th min-w-[90px] text-center">BMI</th>
                        <th class="th min-w-[180px]">Tình trạng dinh dưỡng</th>
                        <th class="th min-w-[110px] text-center">Nhóm máu</th>
                        <th class="th min-w-[110px] text-center">Biết bơi</th>
                        <th class="th min-w-[150px]">Vấn đề về mắt</th>
                        <th class="th min-w-[150px]">Vấn đề về răng</th>
                        <th class="th min-w-[220px]">Ghi chú</th>
                        <th class="th min-w-[140px] text-center">Hành động</th>
                        <th class="th-last min-w-[130px] text-center">Trạng thái</th>
                    </tr>
                </thead>
                <tbody>
                    <tr v-for="r in rows" :key="r.studentId" class="group transition-all duration-150 hover:bg-sky-50/60 hover:-translate-y-[1px]">
                        <td class="td-first text-slate-400 group-hover:text-slate-500">
                            {{ r.index }}
                        </td>
                        <td class="td font-mono text-[14px] text-slate-700">
                            {{ r.studentCode || 'Không' }}
                        </td>
                        <td class="td">
                            <div class="font-semibold text-slate-900 text-[14px]">
                                {{ r.studentName }}
                            </div>
                            <div class="text-xs text-slate-500 mt-0.5">
                                Tuổi (tháng):
                                <span class="font-semibold text-sky-700">
                                    {{ r.ageInMonths ?? 'Không' }}
                                </span>
                            </div>
                        </td>
                        <td class="td text-[14px] text-slate-700">
                            {{ r.className || 'Không' }}
                        </td>

                        <td class="td text-center text-[14px] text-slate-700">
                            {{ r.ageInMonths ?? 'Không' }}
                        </td>
                        <td class="td text-center text-[14px]">
                            <span class="font-semibold text-emerald-700">
                                {{ r.weightKg ?? 'Không' }}
                            </span>
                        </td>
                        <td class="td text-center text-[14px]">
                            <span class="font-semibold text-indigo-700">
                                {{ r.heightCm ?? 'Không' }}
                            </span>
                        </td>
                        <td class="td text-center text-[14px]">
                            <span class="inline-flex items-center justify-center rounded-full px-3 py-1 text-xs font-semibold bg-sky-50 text-sky-700 border border-sky-100">
                                {{ r.bmi ?? 'Không' }}
                            </span>
                        </td>
                        <td class="td">
                            <span v-if="r.nutritionStatus" class="inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-100">
                                <i class="fa-solid fa-utensils mr-1 text-[10px]"></i>
                                {{ r.nutritionStatus }}
                            </span>
                            <span v-else class="inline-flex items-center text-xs text-slate-400 italic"> Không </span>
                        </td>
                        <td class="td text-center text-[14px]">
                            <span v-if="r.bloodType" class="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-100">
                                {{ r.bloodType }}
                            </span>
                            <span v-else class="text-slate-400 text-xs">Không</span>
                        </td>
                        <td class="td text-center text-[14px]">
                            <Tag v-if="r.knowsSwimming === true" severity="success" value="Có" />
                            <Tag v-else-if="r.knowsSwimming === false" severity="danger" value="Không" />
                            <span v-else class="text-slate-400 text-xs italic">Không</span>
                        </td>
                        <td class="td text-[14px]">
                            {{ r.eyeIssue || 'Không' }}
                        </td>
                        <td class="td text-[14px]">
                            {{ r.dentalIssue || 'Không' }}
                        </td>
                        <td class="td text-[14px]">
                            {{ r.note || 'Không' }}
                        </td>

                        <!-- Hành động -->
                        <td class="td text-center">
                            <div class="flex items-center justify-center gap-2">
                                <Button icon="fa-regular fa-pen-to-square" class="btn-ghost !px-2 !py-1" v-tooltip.top="'Sửa hồ sơ'" @click="onEdit(r)" />
                                <Button
                                    icon="fa-regular fa-trash-can"
                                    class="!bg-rose-500 !border-0 !text-white !px-2 !py-1"
                                    :loading="deletingIds.has(r.healthRecordId)"
                                    :disabled="!r.healthRecordId"
                                    v-tooltip.top="'Xóa hồ sơ'"
                                    @click="onDelete(r)"
                                />
                            </div>
                        </td>

                        <td class="td-last text-center">
                            <Tag v-if="r.hasRecord" severity="success" value="Đã cập nhật" />
                            <Tag v-else severity="secondary" value="Chưa cập nhật" />
                        </td>
                    </tr>

                    <tr v-if="!loading && !rows.length">
                        <td colspan="16" class="px-3 py-4 text-center text-slate-500">Không có hồ sơ sức khỏe phù hợp với bộ lọc hiện tại.</td>
                    </tr>
                </tbody>
            </table>
        </div>

        <div v-if="lastImportResult" class="text-xs text-slate-500 mt-2">
            <strong>Kết quả import:</strong>
            <span class="ml-2">Tổng dòng: {{ lastImportResult.length }}</span>
        </div>

        <!-- Modal import Excel -->
        <Dialog v-model:visible="showImportModal" modal :style="{ width: '720px', maxWidth: '95vw' }" :draggable="false" header="Import hồ sơ sức khỏe từ Excel">
            <div class="space-y-4">
                <div class="p-3 rounded-xl bg-slate-50 text-sm text-slate-700">
                    <div>
                        Lớp:
                        <span class="font-semibold text-primary">
                            {{ classes.find((c) => c.id === selectedClassId)?.name || selectedClassId }}
                        </span>
                    </div>
                    <div>
                        Kỳ:
                        <span class="font-semibold">Năm {{ year }}</span>
                    </div>
                    <div class="mt-1 text-xs text-slate-500">Hệ thống sẽ tự tính <b>Tháng tuổi</b> và <b>BMI</b> từ cân nặng / chiều cao, không cần nhập tay.</div>
                </div>

                <div class="flex flex-wrap items-center gap-3">
                    <Button class="btn-ghost" icon="fa-solid fa-file-arrow-down mr-2" label="Tải file mẫu" :disabled="downloadingTemplate || !selectedClassId" @click="onDownloadTemplate" />
                    <Button class="btn-ghost" icon="fa-solid fa-folder-open mr-2" label="Chọn file Excel" :disabled="importing" @click="onChooseFile" />
                    <input ref="fileInputRef" type="file" accept=".xlsx,.xls" class="hidden" @change="onFileChange" />
                    <Button class="btn-success" icon="fa-solid fa-file-import mr-2" :label="importing ? 'Đang import...' : 'Import'" :disabled="importing || !selectedFile" @click="onImport" />
                    <span v-if="selectedFile" class="text-xs text-slate-500">
                        Đã chọn: <b>{{ selectedFile.name }}</b>
                    </span>
                </div>

                <div class="text-xs text-slate-500">
                    • Dòng DEMO trong file mẫu chỉ minh hoạ, dữ liệu không hợp lệ nên backend sẽ
                    <b>không lưu vào DB</b>.<br />
                    • Vui lòng không đổi thứ tự các cột trong file.
                </div>
            </div>
        </Dialog>

        <!-- Dialog sửa hồ sơ -->
        <Dialog v-model:visible="editVisible" modal :style="{ width: '640px', maxWidth: '95vw' }" :draggable="false" :header="editForm.id ? `Cập nhật hồ sơ #${editForm.id}` : 'Cập nhật hồ sơ'">
            <div class="space-y-4 text-sm text-slate-700">
                <div class="border-b pb-3">
                    <div class="font-semibold text-slate-800 text-base">
                        {{ editForm.studentName || '—' }}
                    </div>
                    <div class="text-xs text-slate-500 mt-1">
                        Lớp:
                        <span class="font-semibold">{{ editForm.className || '—' }}</span>
                        <span class="ml-2">• Tháng {{ editForm.recordMonth }}/{{ editForm.recordYear }}</span>
                    </div>
                </div>

                <div class="grid grid-cols-2 gap-3">
                    <div>
                        <label class="label">Năm</label>
                        <InputText v-model.number="editForm.recordYear" class="w-full" type="number" />
                    </div>
                    <div>
                        <label class="label">Tháng</label>
                        <InputText v-model.number="editForm.recordMonth" class="w-full" type="number" />
                    </div>
                    <div>
                        <label class="label">Tuổi (tháng)</label>
                        <InputText v-model.number="editForm.ageInMonths" class="w-full" type="number" />
                    </div>
                    <div>
                        <label class="label">Cân nặng (kg)</label>
                        <InputText v-model.number="editForm.weightKg" class="w-full" type="number" />
                    </div>
                    <div>
                        <label class="label">Chiều cao (cm)</label>
                        <InputText v-model.number="editForm.heightCm" class="w-full" type="number" />
                    </div>
                    <div>
                        <label class="label">BMI</label>
                        <InputText v-model.number="editForm.bmi" class="w-full" type="number" />
                    </div>
                </div>

                <div class="grid grid-cols-2 gap-3">
                    <div>
                        <label class="label">Tình trạng dinh dưỡng</label>
                        <InputText v-model="editForm.nutritionStatus" class="w-full" />
                    </div>
                    <div>
                        <label class="label">Nhóm máu</label>
                        <InputText v-model="editForm.bloodType" class="w-full" />
                    </div>
                </div>

                <div class="grid grid-cols-2 gap-3">
                    <div>
                        <label class="label">Biết bơi</label>
                        <Dropdown
                            v-model="editForm.knowsSwimming"
                            class="w-full"
                            :options="[
                                { label: 'Không', value: false },
                                { label: 'Có', value: true },
                                { label: 'Chưa cập nhật', value: null }
                            ]"
                            optionLabel="label"
                            optionValue="value"
                        />
                    </div>
                    <div>
                        <label class="label">Vấn đề về mắt</label>
                        <InputText v-model="editForm.eyeIssue" class="w-full" placeholder="Không" />
                    </div>
                    <div>
                        <label class="label">Vấn đề về răng</label>
                        <InputText v-model="editForm.dentalIssue" class="w-full" placeholder="Không" />
                    </div>
                </div>

                <div>
                    <label class="label">Ghi chú</label>
                    <textarea
                        v-model="editForm.note"
                        rows="3"
                        class="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-sky-400/60 focus:border-sky-300"
                        placeholder="Ghi chú thêm của bác sĩ / giáo viên..."
                    />
                </div>

                <div class="flex justify-end gap-2 pt-2">
                    <Button label="Hủy" class="btn-ghost text-xs" :disabled="editing" @click="editVisible = false" />
                    <Button label="Lưu thay đổi" class="btn-success text-xs" icon="pi pi-check" :loading="editing" @click="saveEdit" />
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
    background: radial-gradient(circle at top left, #eff6ff, #ffffff);
}
.btn-success {
    background: linear-gradient(135deg, #059669, #10b981);
    color: #fff;
    border: 0;
}
.btn-ghost {
    background: #f1f5f9;
    color: #334155;
    border: 0;
}
.th,
.th-first,
.th-last {
    padding: 10px 12px;
    text-align: left;
    color: #334155;
    font-weight: 700;
    font-size: 13px;
    border-bottom: 1px solid #e5e7eb;
    white-space: nowrap;
}
.th-first {
    border-top-left-radius: 16px;
}
.th-last {
    border-top-right-radius: 16px;
}
.td,
.td-first,
.td-last {
    padding: 10px 12px;
    border-bottom: 1px solid #e5e7eb;
    font-size: 14px;
    background-color: #ffffff;
}
.td-first {
    border-left: 1px solid #e5e7eb;
}
.td-last {
    border-right: 1px solid #e5e7eb;
}
</style>
