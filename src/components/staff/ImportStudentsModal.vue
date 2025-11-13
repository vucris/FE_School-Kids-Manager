<script setup>
import { ref, computed, watch } from 'vue';
import Dialog from 'primevue/dialog';
import Button from 'primevue/button';
import { importStudentsExcel, downloadStudentsImportTemplate } from '@/service/studentService.js';

const props = defineProps({
    modelValue: { type: Boolean, default: false },
    // Nếu BE có endpoint template riêng, có thể thay bằng gọi thẳng BE; hiện tại dùng FE generator
    hasTemplate: { type: Boolean, default: true }
});
const emit = defineEmits(['update:modelValue', 'imported']);

const visible = computed({
    get: () => props.modelValue,
    set: (v) => emit('update:modelValue', v)
});

const file = ref(null);
const dragging = ref(false);
const uploading = ref(false);
const errorMsg = ref('');
const infoMsg = ref('');
const progress = ref(0);

function reset() {
    file.value = null;
    uploading.value = false;
    progress.value = 0;
    errorMsg.value = '';
    infoMsg.value = '';
    dragging.value = false;
}
watch(
    () => visible.value,
    (v) => {
        if (v) reset();
    }
);

function onChooseFile(e) {
    const f = e.target.files?.[0];
    if (f) validateAndSet(f);
}
function onDrop(e) {
    e.preventDefault();
    dragging.value = false;
    const f = e.dataTransfer?.files?.[0];
    if (f) validateAndSet(f);
}
function onDragOver(e) {
    e.preventDefault();
    dragging.value = true;
}
function onDragLeave() {
    dragging.value = false;
}

function validateAndSet(f) {
    errorMsg.value = '';
    const ok = /\.(xlsx|xls)$/i.test(f.name);
    if (!ok) {
        errorMsg.value = 'Chỉ chấp nhận .xlsx hoặc .xls';
        return;
    }
    if (f.size > 25 * 1024 * 1024) {
        errorMsg.value = 'File quá lớn (>25MB). Vui lòng chia nhỏ.';
        return;
    }
    file.value = f;
}

async function onDownloadTemplate() {
    try {
        await downloadStudentsImportTemplate();
    } catch (e) {
        errorMsg.value = e?.message || 'Không tải được file mẫu';
    }
}

async function onUpload() {
    if (!file.value) {
        errorMsg.value = 'Vui lòng chọn file Excel trước khi tải lên';
        return;
    }
    uploading.value = true;
    progress.value = 0;
    errorMsg.value = '';
    infoMsg.value = '';

    try {
        const msg = await importStudentsExcel(file.value, {
            onProgress: (p) => (progress.value = p)
        });
        infoMsg.value = msg || 'Nhập dữ liệu thành công';
        emit('imported');
        setTimeout(() => {
            visible.value = false;
        }, 800);
    } catch (e) {
        errorMsg.value = e?.message || 'Import Excel thất bại';
    } finally {
        uploading.value = false;
    }
}
</script>

<template>
    <Dialog v-model:visible="visible" modal :draggable="false" :style="{ width: '720px' }" class="import-students-dialog">
        <template #header>
            <div class="text-lg font-semibold text-slate-800">Nhập danh sách học sinh</div>
        </template>

        <div class="dropzone" :class="{ 'dropzone--drag': dragging }" @dragover="onDragOver" @dragleave="onDragLeave" @drop="onDrop">
            <div class="dropzone__inner">
                <i class="fa-solid fa-cloud-arrow-up text-3xl text-slate-400 mb-2"></i>
                <div class="text-slate-600">
                    Kéo thả file Excel vào đây hoặc
                    <label class="link" for="student_import_input">chọn file từ hệ thống</label>
                </div>
                <input id="student_import_input" type="file" accept=".xlsx,.xls" class="hidden" @change="onChooseFile" />
                <div v-if="file" class="file-tag">
                    <i class="fa-regular fa-file-excel mr-2 text-emerald-600"></i>
                    <span class="font-medium">{{ file.name }}</span>
                    <span class="ml-2 text-slate-500 text-sm">({{ (file.size / 1024 / 1024).toFixed(2) }} MB)</span>
                </div>
            </div>
        </div>

        <div class="mt-3 text-sm text-slate-700">
            Thứ tự cột bắt buộc (hàng đầu tiên là tiêu đề):
            <div class="mt-1 font-mono text-slate-800 text-xs bg-slate-50 border border-slate-200 rounded px-2 py-1">username, password, fullName, email, phone, gender, dateOfBirth, address, healthNotes, classId, parentId</div>
            <ul class="list-disc pl-5 mt-2 space-y-1 text-slate-600">
                <li>gender: M | F | Nam | Nữ</li>
                <li>dateOfBirth: yyyy-MM-dd hoặc dd/MM/yyyy</li>
                <li>classId, parentId: số nguyên ID hợp lệ tồn tại trong hệ thống</li>
            </ul>
        </div>

        <div v-if="uploading" class="mt-3 text-sm text-slate-600">
            Đang tải lên... {{ progress }}%
            <div class="w-full h-2 bg-slate-200 rounded mt-1">
                <div class="h-2 bg-primary rounded" :style="{ width: progress + '%' }"></div>
            </div>
        </div>

        <div v-if="errorMsg" class="mt-3 text-sm text-rose-600 font-medium">{{ errorMsg }}</div>
        <div v-if="infoMsg" class="mt-3 text-sm text-emerald-600 font-medium">{{ infoMsg }}</div>

        <template #footer>
            <div class="flex items-center justify-between w-full">
                <Button class="!bg-slate-200 !text-slate-800 !border-0" label="Đóng" :disabled="uploading" @click="visible = false" />
                <div class="flex items-center gap-2">
                    <Button class="!bg-green-600 !border-0 !text-white" icon="fa-solid fa-file-arrow-down mr-2" label="Tải mẫu Excel Import" @click="onDownloadTemplate" />
                    <Button class="!bg-primary !border-0 !text-white" icon="fa-solid fa-cloud-arrow-up mr-2" :label="uploading ? 'Đang tải...' : 'Tải lên'" :disabled="uploading" @click="onUpload" />
                </div>
            </div>
        </template>
    </Dialog>
</template>

<style scoped>
.dropzone {
    border: 2px dashed #cbd5e1;
    border-radius: 12px;
    padding: 26px;
    text-align: center;
    transition: all 0.15s ease;
}
.dropzone--drag {
    background: #f8fafc;
    border-color: #94a3b8;
}
.dropzone__inner {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: 180px;
}
.link {
    color: #2563eb;
    cursor: pointer;
}
.file-tag {
    margin-top: 10px;
    display: inline-flex;
    align-items: center;
    padding: 6px 10px;
    border-radius: 10px;
    border: 1px solid #e2e8f0;
    background: #f8fafc;
}
</style>
