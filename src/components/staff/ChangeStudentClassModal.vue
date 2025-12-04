<script setup>
import { ref, computed, watch } from 'vue';
import Dialog from 'primevue/dialog';
import Dropdown from 'primevue/dropdown';
import Button from 'primevue/button';
import Swal from 'sweetalert2';

import { changeStudentClass } from '@/service/studentService.js';
import { fetchClassOptions } from '@/service/classService.js';

const props = defineProps({
    modelValue: { type: Boolean, default: false },
    student: { type: Object, default: null } // học sinh cần chuyển lớp
});
const emit = defineEmits(['update:modelValue', 'changed']);

const visible = computed({
    get: () => props.modelValue,
    set: (v) => emit('update:modelValue', v)
});

const classOptions = ref([]);
const selectedClassId = ref(null);
const loading = ref(false);
const errorMsg = ref('');

// Khi mở modal -> load danh sách lớp
watch(
    () => visible.value,
    async (v) => {
        if (v) {
            errorMsg.value = '';
            selectedClassId.value = null;
            try {
                let opts = await fetchClassOptions(); // [{ value, label }]

                // 🔹 Nếu có thông tin lớp hiện tại, lọc bỏ option tương ứng
                if (props.student?.className) {
                    const currentName = String(props.student.className).trim().toLowerCase();
                    opts = opts.filter(
                        (o) =>
                            !String(o.label || '')
                                .toLowerCase()
                                .includes(currentName)
                    );
                }

                classOptions.value = opts;
            } catch (e) {
                errorMsg.value = e?.message || 'Không tải được danh sách lớp';
            }
        }
    }
);

async function onConfirm() {
    if (!props.student?.id) {
        errorMsg.value = 'Thiếu thông tin học sinh';
        return;
    }
    if (!selectedClassId.value) {
        errorMsg.value = 'Vui lòng chọn lớp chuyển đến';
        return;
    }

    loading.value = true;
    errorMsg.value = '';

    try {
        await changeStudentClass(props.student.id, selectedClassId.value);

        const target = classOptions.value.find((o) => o.value === selectedClassId.value);
        const classLabel = target?.label || 'lớp mới';

        // Đóng modal trước khi show SweetAlert để không bị đè modal
        visible.value = false;
        emit('changed');

        setTimeout(() => {
            Swal.fire({
                icon: 'success',
                title: 'Chuyển lớp thành công',
                text: `${props.student.name || props.student.fullName || 'Học sinh'} đã được chuyển sang ${classLabel}`
            });
        }, 50);
    } catch (e) {
        errorMsg.value = e?.message || 'Chuyển lớp thất bại';
    } finally {
        loading.value = false;
    }
}
</script>

<template>
    <Dialog v-model:visible="visible" modal :draggable="false" :style="{ width: '480px' }">
        <template #header>
            <div class="text-lg font-semibold text-slate-800">Chuyển lớp cho học sinh</div>
        </template>

        <div class="space-y-3">
            <div class="text-sm text-slate-600">
                Học sinh:
                <span class="font-semibold text-slate-800">
                    {{ student?.name || student?.fullName || 'Không rõ' }}
                </span>
                <span v-if="student?.className" class="text-xs text-slate-500"> (Lớp hiện tại: {{ student.className }}) </span>
            </div>

            <div>
                <label class="block text-sm font-medium text-slate-700 mb-1"> Chọn lớp mới </label>
                <Dropdown v-model="selectedClassId" :options="classOptions" optionLabel="label" optionValue="value" class="w-full" placeholder="Chọn lớp" />
            </div>

            <div v-if="errorMsg" class="text-sm text-rose-600">
                {{ errorMsg }}
            </div>
        </div>

        <template #footer>
            <div class="flex justify-end gap-2 w-full">
                <Button class="!bg-slate-200 !text-slate-800 !border-0" label="Hủy" :disabled="loading" @click="visible = false" />
                <Button class="!bg-primary !text-white !border-0" :label="loading ? 'Đang xử lý...' : 'Xác nhận chuyển lớp'" :disabled="loading" @click="onConfirm" />
            </div>
        </template>
    </Dialog>
</template>
