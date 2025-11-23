<script setup>
import { reactive, computed, watch, ref } from 'vue';
import Dialog from 'primevue/dialog';
import InputText from 'primevue/inputtext';
import Button from 'primevue/button';
import Dropdown from 'primevue/dropdown';
import Calendar from 'primevue/calendar';
import Swal from 'sweetalert2';

import { createParent } from '@/service/parentService.js';

const props = defineProps({
    modelValue: {
        type: Boolean,
        default: false
    },
    // có parent => chế độ xem thông tin (view only)
    parent: {
        type: Object,
        default: null
    }
});

const emit = defineEmits(['update:modelValue', 'saved']);
const submitting = ref(false);

/* combobox options */
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
    password: '', // 🔹 mật khẩu do admin nhập (tùy chọn)
    gender: null,
    dateOfBirth: null,
    occupation: '',
    relationship: null,
    emergencyContact: '',
    additionalPhone: ''
});

const isCreateMode = computed(() => !props.parent);

const dialogTitle = computed(() => (isCreateMode.value ? 'Thêm phụ huynh' : 'Thông tin phụ huynh'));

function resetForm() {
    form.fullName = '';
    form.email = '';
    form.phone = '';
    form.password = '';
    form.gender = null;
    form.dateOfBirth = null;
    form.occupation = '';
    form.relationship = null;
    form.emergencyContact = '';
    form.additionalPhone = '';
}

function fillFormFromParent() {
    if (!props.parent) {
        resetForm();
        return;
    }
    form.fullName = props.parent.name || '';
    form.email = props.parent.email || '';
    form.phone = props.parent.phone || '';
    form.gender = null; // BE chưa trả giới tính
    form.dateOfBirth = props.parent.dob ? new Date(props.parent.dob) : null;
    form.occupation = props.parent.occupation || '';
    form.relationship = props.parent.relationship || null;
    form.emergencyContact = props.parent.emergencyContact || '';
    form.additionalPhone = props.parent.additionalPhone || '';
    form.password = ''; // KHÔNG bao giờ hiển thị mật khẩu
}

watch(
    () => props.modelValue,
    (val) => {
        if (!val) return;
        if (isCreateMode.value) {
            resetForm();
        } else {
            fillFormFromParent();
        }
    }
);

// format Date -> yyyy-MM-dd (LocalDate)
function formatDateToIso(d) {
    if (!d) return null;
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function closeDialog() {
    emit('update:modelValue', false);
}

/* validate giống logic BE import: bắt buộc fullName + email + phone */
function validateForm() {
    if (!form.fullName.trim()) {
        return 'Vui lòng nhập họ và tên phụ huynh';
    }
    if (!form.email.trim()) {
        return 'Vui lòng nhập email';
    }
    if (!form.phone.trim()) {
        return 'Vui lòng nhập số điện thoại';
    }
    // mật khẩu: cho phép để trống, nhưng nếu nhập thì >= 6 ký tự
    if (form.password && form.password.trim().length < 6) {
        return 'Mật khẩu phải có ít nhất 6 ký tự, hoặc để trống để dùng mật khẩu mặc định 123456';
    }
    return null;
}

async function handleSubmit() {
    const err = validateForm();
    if (err) {
        await Swal.fire({
            icon: 'warning',
            title: 'Thiếu / sai thông tin',
            text: err
        });
        return;
    }

    submitting.value = true;
    try {
        // username giống import: lấy phần trước @ của email
        let username = '';
        if (form.email) {
            username = form.email.split('@')[0];
        }

        // Nếu admin không nhập mật khẩu → dùng 123456
        const passwordToSend = form.password && form.password.trim() ? form.password.trim() : '123456';

        const payload = {
            username,
            password: passwordToSend,
            fullName: form.fullName.trim(),
            email: form.email.trim(),
            phone: form.phone.trim(),
            dateOfBirth: form.dateOfBirth ? formatDateToIso(form.dateOfBirth) : null,
            gender: form.gender || null,
            occupation: form.occupation || null,
            relationship: form.relationship || null,
            emergencyContact: form.emergencyContact || null,
            additionalPhone: form.additionalPhone || null
        };

        const res = await createParent(payload);
        const msg = typeof res === 'string' ? res : res?.message || 'Đăng ký tài khoản phụ huynh thành công!';

        await Swal.fire({
            icon: 'success',
            title: 'Thành công',
            html: `
                <div style="text-align:left;font-size:14px;">
                    <div>${msg}</div>
                    <br/>
                    <div><strong>Tài khoản đăng nhập:</strong></div>
                    <div>Username: <code>${username}</code></div>
                    <div>Mật khẩu: <code>${passwordToSend}</code></div>
                </div>
            `
        });

        emit('saved'); // cho màn list reload
        closeDialog();
    } catch (e) {
        const msg = e?.response?.data?.message || e?.message || 'Không thể tạo phụ huynh, vui lòng thử lại';
        await Swal.fire({
            icon: 'error',
            title: 'Lỗi',
            text: msg
        });
    } finally {
        submitting.value = false;
    }
}
</script>

<template>
    <Dialog :visible="modelValue" modal :style="{ width: '640px', maxWidth: '95vw' }" :breakpoints="{ '960px': '95vw', '640px': '100vw' }" @update:visible="(v) => emit('update:modelValue', v)">
        <template #header>
            <div class="flex items-center gap-2">
                <span class="text-lg font-semibold text-slate-800">
                    {{ dialogTitle }}
                </span>
                <span v-if="!isCreateMode" class="px-2 py-0.5 rounded-full text-[11px] bg-slate-100 text-slate-600"> Xem thông tin (web hiện chỉ tạo mới, chưa sửa) </span>
            </div>
        </template>

        <div class="space-y-4">
            <!-- Họ tên + SĐT -->
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label class="form-label">Họ và tên *</label>
                    <InputText v-model="form.fullName" class="w-full" :disabled="!isCreateMode" placeholder="VD: Nguyễn Văn A" />
                </div>
                <div>
                    <label class="form-label">Số điện thoại *</label>
                    <InputText v-model="form.phone" class="w-full" :disabled="!isCreateMode" placeholder="VD: 0912345678" />
                </div>
            </div>

            <!-- Email + Giới tính -->
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label class="form-label">Email *</label>
                    <InputText v-model="form.email" class="w-full" :disabled="!isCreateMode" placeholder="VD: phuhuynh@example.com" />
                    <p v-if="isCreateMode" class="text-[11px] text-slate-500 mt-1">Username đăng nhập sẽ được sinh từ phần trước dấu <code>@</code> của email.</p>
                </div>
                <div>
                    <label class="form-label">Giới tính</label>
                    <Dropdown v-model="form.gender" :options="genderOptions" optionLabel="label" optionValue="value" class="w-full" :disabled="!isCreateMode" placeholder="Chọn giới tính" showClear />
                </div>
            </div>

            <!-- Mật khẩu -->
            <div>
                <label class="form-label">Mật khẩu (tùy chọn cho admin)</label>
                <InputText v-model="form.password" type="password" class="w-full" :disabled="!isCreateMode" placeholder="Nếu bỏ trống sẽ dùng mật khẩu mặc định 123456" />
                <p class="text-[11px] text-slate-500 mt-1">
                    - Nếu để trống: hệ thống sẽ tạo mật khẩu mặc định
                    <strong>123456</strong> cho phụ huynh.<br />
                    - Admin có thể in / gửi thông tin tài khoản (username + mật khẩu) cho phụ huynh, và khuyến khích phụ huynh đổi mật khẩu sau khi đăng nhập.
                </p>
            </div>

            <!-- Ngày sinh + Nghề nghiệp -->
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label class="form-label">Ngày sinh</label>
                    <Calendar v-model="form.dateOfBirth" dateFormat="dd/mm/yy" class="w-full" :disabled="!isCreateMode" :showIcon="true" />
                </div>
                <div>
                    <label class="form-label">Nghề nghiệp</label>
                    <InputText v-model="form.occupation" class="w-full" :disabled="!isCreateMode" placeholder="VD: Kinh doanh, Nhân viên văn phòng..." />
                </div>
            </div>

            <!-- Mối quan hệ + Liên hệ khẩn cấp -->
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label class="form-label">Mối quan hệ với bé</label>
                    <Dropdown v-model="form.relationship" :options="relationshipOptions" class="w-full" optionLabel="label" optionValue="value" :disabled="!isCreateMode" placeholder="Chọn mối quan hệ" showClear />
                </div>
                <div>
                    <label class="form-label">Liên hệ khẩn cấp</label>
                    <InputText v-model="form.emergencyContact" class="w-full" :disabled="!isCreateMode" placeholder="Tên + SĐT người liên hệ khẩn" />
                </div>
            </div>

            <!-- SĐT phụ -->
            <div>
                <label class="form-label">Số điện thoại phụ</label>
                <InputText v-model="form.additionalPhone" class="w-full" :disabled="!isCreateMode" placeholder="Số điện thoại khác (nếu có)" />
            </div>
        </div>

        <template #footer>
            <div class="flex justify-end gap-2">
                <Button class="!bg-slate-200 !border-0 !text-slate-700 px-4" label="Đóng" @click="closeDialog" :disabled="submitting" />
                <Button v-if="isCreateMode" class="!bg-primary !border-0 !text-white px-4" icon="fa-solid fa-floppy-disk mr-2" :label="submitting ? 'Đang lưu...' : 'Lưu phụ huynh'" :disabled="submitting" @click="handleSubmit" />
            </div>
        </template>
    </Dialog>
</template>

<style scoped>
.form-label {
    @apply block text-sm font-medium text-slate-700 mb-1;
}
</style>
