<script setup>
import { reactive, watch, ref, computed } from 'vue';
import Dialog from 'primevue/dialog';
import InputText from 'primevue/inputtext';
import Button from 'primevue/button';
import Dropdown from 'primevue/dropdown';
import Calendar from 'primevue/calendar';
import Swal from 'sweetalert2';

import { getParentById, updateParent } from '@/service/parentService.js';

const props = defineProps({
    modelValue: { type: Boolean, default: false },
    parent: { type: Object, default: null }
});
const emit = defineEmits(['update:modelValue', 'saved']);

const visible = computed({
    get: () => props.modelValue,
    set: (v) => emit('update:modelValue', v)
});

const loadingDetail = ref(false);
const submitting = ref(false);

const parentId = computed(() => props.parent?.id || null);
const usernameDisplay = ref('');
const statusDisplay = ref('');

const genderOptions = [
    { label: 'Nam', value: 'Nam' },
    { label: 'Nữ', value: 'Nữ' },
    { label: 'Khác', value: 'Khác' }
];

const relationshipOptions = [
    { label: 'Ba', value: 'Ba' },
    { label: 'Mẹ', value: 'Mẹ' },
    { label: 'Ông', value: 'Ông' },
    { label: 'Bà', value: 'Bà' },
    { label: 'Người giám hộ', value: 'Giám hộ' }
];

const form = reactive({
    fullName: '',
    email: '',
    phone: '',
    gender: null,
    dateOfBirth: null,
    occupation: '',
    relationship: null,
    emergencyContact: '',
    additionalPhone: '',
    address: '',
    note: ''
});

function resetForm() {
    form.fullName = '';
    form.email = '';
    form.phone = '';
    form.gender = null;
    form.dateOfBirth = null;
    form.occupation = '';
    form.relationship = null;
    form.emergencyContact = '';
    form.additionalPhone = '';
    form.address = '';
    form.note = '';

    usernameDisplay.value = props.parent?.username || '';
    statusDisplay.value = props.parent?.status || props.parent?.statusKey || '';
}

function pick(obj, keys, fallback = '') {
    for (const k of keys) {
        const v = obj?.[k];
        if (v !== undefined && v !== null && v !== '') return v;
    }
    return fallback;
}

function normalizeGender(v) {
    if (!v) return null;
    const s = String(v).trim().toUpperCase();
    // map các kiểu BE hay trả
    if (s === 'MALE' || s === 'M' || s === 'NAM') return 'Nam';
    if (s === 'FEMALE' || s === 'F' || s === 'NỮ' || s === 'NU') return 'Nữ';
    // nếu BE đã trả Nam/Nữ/Khác
    const vi = String(v).trim();
    if (vi === 'Nam' || vi === 'Nữ' || vi === 'Khác') return vi;
    return null;
}

function fillFromDetail(p) {
    form.fullName = pick(p, ['fullName', 'name']);
    form.email = pick(p, ['email']);
    form.phone = pick(p, ['phone']);

    const rawGender = pick(p, ['gender', 'sex'], null);
    form.gender = normalizeGender(rawGender);

    const dob = pick(p, ['dateOfBirth', 'dob', 'birthDate', 'birthday'], null);
    form.dateOfBirth = dob ? new Date(dob) : null;

    form.occupation = pick(p, ['occupation', 'job', 'career'], '');
    form.relationship = pick(p, ['relationship', 'relationShip', 'relation'], null);
    form.emergencyContact = pick(p, ['emergencyContact', 'emergency_contact', 'emergencyPhone', 'emergency_phone'], '');
    form.additionalPhone = pick(p, ['additionalPhone', 'additional_phone', 'secondaryPhone', 'secondPhone'], '');
    form.address = pick(p, ['address', 'homeAddress', 'home_address', 'currentAddress', 'current_address'], '');
    form.note = pick(p, ['note', 'notes', 'description'], '');

    usernameDisplay.value = pick(p, ['username'], props.parent?.username || '');
    statusDisplay.value = pick(p, ['status', 'statusKey'], props.parent?.status || props.parent?.statusKey || '');
}

async function loadDetail() {
    if (!parentId.value) return;

    loadingDetail.value = true;
    try {
        const detail = await getParentById(parentId.value);

        // ✅ debug để bạn xem BE trả field gì
        console.log('[ParentEditModal] getParentById detail =', detail);

        fillFromDetail(detail || {});
    } catch (e) {
        // fallback: nếu API detail lỗi thì vẫn fill từ row list
        fillFromDetail(props.parent || {});
    } finally {
        loadingDetail.value = false;
    }
}

watch(
    () => props.modelValue,
    async (open) => {
        if (!open) return;
        resetForm();
        await loadDetail();
    }
);

watch(
    () => props.parent,
    async () => {
        if (!props.modelValue) return;
        resetForm();
        await loadDetail();
    },
    { deep: true }
);

function formatDateToIso(d) {
    if (!d) return null;
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function validateForm() {
    if (!form.fullName.trim()) return 'Vui lòng nhập họ và tên phụ huynh';
    if (!form.email.trim()) return 'Vui lòng nhập email';
    if (!form.phone.trim()) return 'Vui lòng nhập số điện thoại';
    return null;
}

async function handleSave() {
    if (!parentId.value) {
        await Swal.fire({ icon: 'error', title: 'Lỗi', text: 'Thiếu parentId' });
        return;
    }

    const err = validateForm();
    if (err) {
        await Swal.fire({ icon: 'warning', title: 'Thiếu / sai thông tin', text: err });
        return;
    }

    submitting.value = true;
    try {
        const payload = {
            fullName: form.fullName.trim(),
            email: form.email.trim().toLowerCase(),
            phone: form.phone.trim(),
            dateOfBirth: form.dateOfBirth ? formatDateToIso(form.dateOfBirth) : null,

            // gửi đúng key phổ biến; nếu BE cần key khác bạn nói mình đổi
            gender: form.gender || null,
            occupation: form.occupation || null,
            relationship: form.relationship || null,
            emergencyContact: form.emergencyContact || null,
            additionalPhone: form.additionalPhone || null,
            address: form.address || null,
            note: form.note || null
        };

        const res = await updateParent(parentId.value, payload);
        const msg = typeof res === 'string' ? res : res?.message || 'Cập nhật phụ huynh thành công';

        await Swal.fire({ icon: 'success', title: 'Thành công', text: msg });
        emit('saved');
        visible.value = false;
    } catch (e) {
        const msg = e?.response?.data?.message || e?.message || 'Không thể cập nhật phụ huynh';
        await Swal.fire({ icon: 'error', title: 'Lỗi', text: msg });
    } finally {
        submitting.value = false;
    }
}
</script>

<template>
    <Dialog v-model:visible="visible" modal :draggable="false" :style="{ width: '760px', maxWidth: '95vw' }">
        <template #header>
            <div class="flex flex-col gap-1">
                <div class="text-lg font-semibold text-slate-800">Chỉnh sửa phụ huynh</div>
                <div class="text-sm text-slate-600">
                    <span v-if="parentId"
                        >ID: <b>{{ parentId }}</b></span
                    >
                    <span v-if="usernameDisplay" class="ml-3"
                        >Username: <b>{{ usernameDisplay }}</b></span
                    >
                    <span v-if="statusDisplay" class="ml-3"
                        >Trạng thái: <b>{{ statusDisplay }}</b></span
                    >
                </div>
            </div>
        </template>

        <div v-if="loadingDetail" class="text-sm text-slate-600">Đang tải thông tin phụ huynh...</div>

        <div v-else class="space-y-4">
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label class="form-label">Họ và tên *</label>
                    <InputText v-model="form.fullName" class="w-full" />
                </div>
                <div>
                    <label class="form-label">Số điện thoại *</label>
                    <InputText v-model="form.phone" class="w-full" />
                </div>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label class="form-label">Email *</label>
                    <InputText v-model="form.email" class="w-full" />
                </div>
                <div>
                    <label class="form-label">Giới tính</label>
                    <Dropdown v-model="form.gender" :options="genderOptions" optionLabel="label" optionValue="value" class="w-full" placeholder="Chọn giới tính" showClear />
                </div>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label class="form-label">Ngày sinh</label>
                    <Calendar v-model="form.dateOfBirth" dateFormat="dd/mm/yy" class="w-full" :showIcon="true" />
                </div>
                <div>
                    <label class="form-label">Nghề nghiệp</label>
                    <InputText v-model="form.occupation" class="w-full" />
                </div>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label class="form-label">Mối quan hệ với bé</label>
                    <Dropdown v-model="form.relationship" :options="relationshipOptions" class="w-full" optionLabel="label" optionValue="value" placeholder="Chọn mối quan hệ" showClear />
                </div>
                <div>
                    <label class="form-label">Liên hệ khẩn cấp</label>
                    <InputText v-model="form.emergencyContact" class="w-full" />
                </div>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label class="form-label">Số điện thoại phụ</label>
                    <InputText v-model="form.additionalPhone" class="w-full" />
                </div>
                <div>
                    <label class="form-label">Địa chỉ</label>
                    <InputText v-model="form.address" class="w-full" />
                </div>
            </div>

            <div>
                <label class="form-label">Ghi chú</label>
                <InputText v-model="form.note" class="w-full" />
            </div>
        </div>

        <template #footer>
            <div class="flex justify-end gap-2">
                <Button class="!bg-slate-200 !border-0 !text-slate-700 px-4" label="Đóng" :disabled="submitting" @click="visible = false" />
                <Button class="!bg-primary !border-0 !text-white px-4" icon="fa-solid fa-floppy-disk mr-2" :label="submitting ? 'Đang lưu...' : 'Lưu'" :disabled="submitting" @click="handleSave" />
            </div>
        </template>
    </Dialog>
</template>

<style scoped>
.form-label {
    @apply block text-sm font-medium text-slate-700 mb-1;
}
</style>
