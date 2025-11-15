<script setup>
import { ref, computed, watch } from 'vue';
import Dialog from 'primevue/dialog';
import InputText from 'primevue/inputtext';
import Dropdown from 'primevue/dropdown';
import Calendar from 'primevue/calendar';
import Button from 'primevue/button';
import Swal from 'sweetalert2';

import { getStudentById, updateStudent, fetchParentOptionsLikeStudentService } from '@/service/studentService.js';
import { fetchClassOptions } from '@/service/classService.js';

const props = defineProps({
    modelValue: { type: Boolean, default: false },
    studentId: { type: Number, default: null }
});
const emit = defineEmits(['update:modelValue', 'updated']);

const visible = computed({
    get: () => props.modelValue,
    set: (v) => emit('update:modelValue', v)
});

const loading = ref(false);
const saving = ref(false);
const errorMsg = ref('');

const student = ref(null);
const form = ref({
    fullName: '',
    phone: '',
    gender: 'M',
    dateOfBirth: null,
    address: '',
    healthNotes: '',
    classId: null,
    parentId: null
});

const genderOptions = [
    { label: 'Nam', value: 'M' },
    { label: 'Nữ', value: 'F' }
];

const classOptions = ref([]);
const parentOptions = ref([]);

async function loadData() {
    if (!props.studentId) return;
    loading.value = true;
    errorMsg.value = '';
    try {
        const [s, classes, parents] = await Promise.all([getStudentById(props.studentId), fetchClassOptions(), fetchParentOptionsLikeStudentService()]);
        student.value = s;
        classOptions.value = classes;
        parentOptions.value = parents;

        form.value.fullName = s.fullName || s.name || '';
        form.value.phone = s.phone || '';
        form.value.gender = (s.gender || '').toUpperCase().startsWith('F') ? 'F' : 'M';
        form.value.address = s.address || '';
        form.value.healthNotes = s.healthNotes || '';
        form.value.dateOfBirth = s.dateOfBirth ? new Date(s.dateOfBirth) : null;

        // --- GÁN LỚP HIỆN TẠI ---
        // Nếu BE đã trả classId thì dùng luôn
        let classId = s.classId ?? null;
        if (!classId && s.className) {
            const currentName = String(s.className).trim().toLowerCase();
            const match = classes.find((c) =>
                String(c.label || c.name || c.className || '')
                    .toLowerCase()
                    .includes(currentName)
            );
            if (match) classId = match.value ?? match.id;
        }
        form.value.classId = classId || null;

        // --- GÁN PHỤ HUYNH HIỆN TẠI ---
        let parentId = s.parentId ?? null;
        if (!parentId && s.parentName) {
            const currentParent = String(s.parentName).trim().toLowerCase();
            const matchParent = parents.find((p) =>
                String(p.label || '')
                    .toLowerCase()
                    .includes(currentParent)
            );
            if (matchParent) parentId = matchParent.value ?? matchParent.id;
        }
        form.value.parentId = parentId || null;
    } catch (e) {
        errorMsg.value = e?.message || 'Không tải được hồ sơ học sinh';
    } finally {
        loading.value = false;
    }
}

watch(
    () => visible.value,
    (v) => {
        if (v && props.studentId) {
            loadData();
        } else if (!v) {
            student.value = null;
            errorMsg.value = '';
        }
    }
);

async function onSave() {
    if (!student.value?.id) return;
    saving.value = true;
    errorMsg.value = '';

    try {
        const payload = {
            fullName: form.value.fullName,
            phone: form.value.phone,
            gender: form.value.gender,
            address: form.value.address,
            healthNotes: form.value.healthNotes,
            classId: form.value.classId || null,
            parentId: form.value.parentId || null,
            dateOfBirth: form.value.dateOfBirth ? form.value.dateOfBirth.toISOString().substring(0, 10) : null
        };

        await updateStudent(student.value.id, payload);

        visible.value = false;
        emit('updated');

        setTimeout(() => {
            Swal.fire({
                icon: 'success',
                title: 'Cập nhật hồ sơ thành công'
            });
        }, 50);
    } catch (e) {
        errorMsg.value = e?.message || 'Cập nhật học sinh thất bại';
    } finally {
        saving.value = false;
    }
}
</script>

<template>
    <Dialog v-model:visible="visible" modal :draggable="false" :style="{ width: '720px' }">
        <template #header>
            <div class="text-lg font-semibold text-slate-800">Hồ sơ học sinh</div>
        </template>

        <div v-if="loading" class="py-8 text-center text-slate-500">Đang tải dữ liệu...</div>

        <div v-else class="space-y-4">
            <div v-if="student" class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <!-- Cột trái -->
                <div class="space-y-3">
                    <div>
                        <label class="block text-sm font-medium text-slate-700 mb-1">Họ tên</label>
                        <InputText v-model="form.fullName" class="w-full" />
                    </div>

                    <div class="grid grid-cols-2 gap-3">
                        <div>
                            <label class="block text-sm font-medium text-slate-700 mb-1">Giới tính</label>
                            <Dropdown v-model="form.gender" :options="genderOptions" optionLabel="label" optionValue="value" class="w-full" />
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-slate-700 mb-1">Ngày sinh</label>
                            <Calendar v-model="form.dateOfBirth" dateFormat="dd/mm/yy" class="w-full" showIcon />
                        </div>
                    </div>

                    <div>
                        <label class="block text-sm font-medium text-slate-700 mb-1">Số điện thoại</label>
                        <InputText v-model="form.phone" class="w-full" />
                    </div>

                    <div>
                        <label class="block text-sm font-medium text-slate-700 mb-1">Địa chỉ</label>
                        <InputText v-model="form.address" class="w-full" />
                    </div>
                </div>

                <!-- Cột phải -->
                <div class="space-y-3">
                    <div>
                        <label class="block text-sm font-medium text-slate-700 mb-1">Lớp</label>
                        <Dropdown v-model="form.classId" :options="classOptions" optionLabel="label" optionValue="value" class="w-full" placeholder="Chọn lớp" />
                    </div>

                    <div>
                        <label class="block text-sm font-medium text-slate-700 mb-1">Phụ huynh</label>
                        <Dropdown v-model="form.parentId" :options="parentOptions" optionLabel="label" optionValue="value" class="w-full" placeholder="Chọn phụ huynh" />
                    </div>

                    <div>
                        <label class="block text-sm font-medium text-slate-700 mb-1">Ghi chú sức khỏe</label>
                        <InputText v-model="form.healthNotes" class="w-full" />
                    </div>

                    <div class="text-xs text-slate-500 mt-3 space-y-1">
                        <div>
                            Mã học sinh: <b>{{ student.studentCode || student.code }}</b>
                        </div>
                        <div>
                            Tài khoản: <b>{{ student.username }}</b>
                        </div>
                        <div>
                            Email: <b>{{ student.email }}</b>
                        </div>
                    </div>
                </div>
            </div>

            <div v-else class="text-center text-slate-500 py-6">Không tìm thấy thông tin học sinh</div>

            <div v-if="errorMsg" class="text-sm text-rose-600">
                {{ errorMsg }}
            </div>
        </div>

        <template #footer>
            <div class="flex justify-end gap-2 w-full">
                <Button class="!bg-slate-200 !text-slate-800 !border-0" label="Đóng" :disabled="saving" @click="visible = false" />
                <Button class="!bg-primary !text-white !border-0" :label="saving ? 'Đang lưu...' : 'Lưu thay đổi'" :disabled="saving || loading" @click="onSave" />
            </div>
        </template>
    </Dialog>
</template>
