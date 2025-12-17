<script setup>
import { computed, reactive, ref, watch } from 'vue';
import '@fortawesome/fontawesome-free/css/all.min.css';

import Dialog from 'primevue/dialog';
import InputText from 'primevue/inputtext';
import Dropdown from 'primevue/dropdown';

import Swal from 'sweetalert2';
import { createTeacher, updateTeacher } from '@/service/teacherService.js';

/* ============= PROPS & EMITS ============= */
const props = defineProps({
    modelValue: {
        type: Boolean,
        default: false
    },
    // teacher từ view: mapTeacher(raw) → { id, name, email, phone, gender, specialization, employeeCode, ... }
    teacher: {
        type: Object,
        default: null
    }
});

const emit = defineEmits(['update:modelValue', 'saved']);

/* ============= DIALOG VISIBLE ============= */
const visible = computed({
    get: () => props.modelValue,
    set: (val) => emit('update:modelValue', val)
});

/* ============= STATE FORM ============= */
const isEdit = computed(() => !!props.teacher?.id);
const loading = ref(false);
const errorMsg = ref('');

/** ✅ NEW: username hiển thị dưới "Họ và tên" khi sửa */
const usernameDisplay = computed(() => {
    return props.teacher?.username || (props.teacher?.email ? String(props.teacher.email).split('@')[0] : '');
});

const form = reactive({
    username: '',
    password: '',
    fullName: '',
    email: '',
    phone: '',
    gender: '',
    specialization: '',
    employeeCode: '',
    emergencyContact: '',
    dateOfBirth: '' // string 'YYYY-MM-DD'
});

const genders = [
    { label: 'Nam', value: 'Nam' },
    { label: 'Nữ', value: 'Nữ' },
    { label: 'Khác', value: 'Khác' }
];

/* ============= TOAST ============= */
const swalToast = Swal.mixin({
    toast: true,
    position: 'top-end',
    showConfirmButton: false,
    timer: 2500,
    timerProgressBar: true
});

/* ============= INIT / RESET FORM ============= */
function resetForm() {
    form.username = '';
    form.password = '';
    form.fullName = '';
    form.email = '';
    form.phone = '';
    form.gender = '';
    form.specialization = '';
    form.employeeCode = '';
    form.emergencyContact = '';
    form.dateOfBirth = '';
    errorMsg.value = '';
}

function fillFormFromTeacher() {
    resetForm();
    if (!props.teacher) return;
    // mapTeacher đã đổi fullName -> name
    form.fullName = props.teacher.name || '';
    form.email = props.teacher.email || '';
    form.phone = props.teacher.phone || '';
    form.gender = props.teacher.gender || '';
    form.specialization = props.teacher.specialization || '';
    form.employeeCode = props.teacher.employeeCode || '';
    form.emergencyContact = props.teacher.emergencyContact || '';
    form.dateOfBirth = props.teacher.dateOfBirth || '';
}

/* Khi mở modal hoặc teacher thay đổi → load form */
watch(
    () => props.modelValue,
    (val) => {
        if (val) {
            if (isEdit.value) {
                fillFormFromTeacher();
            } else {
                resetForm();
            }
        }
    }
);

watch(
    () => props.teacher,
    () => {
        if (visible.value) {
            if (isEdit.value) {
                fillFormFromTeacher();
            } else {
                resetForm();
            }
        }
    }
);

/* ============= VALIDATION ============= */
function validate() {
    errorMsg.value = '';

    if (!isEdit.value && !form.username.trim()) {
        errorMsg.value = 'Vui lòng nhập tên đăng nhập';
        return false;
    }

    if (!isEdit.value && !form.password.trim()) {
        errorMsg.value = 'Vui lòng nhập mật khẩu';
        return false;
    }

    if (!form.fullName.trim()) {
        errorMsg.value = 'Vui lòng nhập họ và tên giáo viên';
        return false;
    }

    // dateOfBirth có thể để trống, nhưng nếu nhập thì kiểm tra format sơ sơ
    if (form.dateOfBirth && !/^\d{4}-\d{2}-\d{2}$/.test(form.dateOfBirth)) {
        errorMsg.value = 'Ngày sinh không đúng định dạng YYYY-MM-DD';
        return false;
    }

    return true;
}

/* ============= SUBMIT ============= */
async function handleCreate() {
    if (!validate()) return;

    loading.value = true;
    try {
        const payload = {
            username: form.username.trim(),
            password: form.password.trim(),
            fullName: form.fullName.trim(),
            email: form.email.trim() || null,
            phone: form.phone.trim() || null,
            dateOfBirth: form.dateOfBirth || null,
            gender: form.gender || null,
            specialization: form.specialization.trim() || null,
            emergencyContact: form.emergencyContact.trim() || null
        };

        // Nếu người dùng không nhập mã GV → không gửi field, BE tự sinh
        const code = form.employeeCode.trim();
        if (code) {
            payload.employeeCode = code;
        }

        await createTeacher(payload);

        swalToast.fire({ icon: 'success', title: 'Tạo giáo viên thành công' });
        emit('saved');
        visible.value = false;
    } catch (err) {
        errorMsg.value = err?.message || 'Tạo giáo viên thất bại';
    } finally {
        loading.value = false;
    }
}

async function handleUpdate() {
    if (!validate()) return;
    if (!props.teacher?.id) {
        errorMsg.value = 'Thiếu ID giáo viên để cập nhật';
        return;
    }

    loading.value = true;
    try {
        const payload = {
            fullName: form.fullName.trim(),
            email: form.email.trim() || null,
            phone: form.phone.trim() || null,
            dateOfBirth: form.dateOfBirth || null,
            gender: form.gender || null,
            specialization: form.specialization.trim() || null,
            employeeCode: form.employeeCode.trim() || null,
            emergencyContact: form.emergencyContact.trim() || null
        };

        await updateTeacher(props.teacher.id, payload);

        swalToast.fire({ icon: 'success', title: 'Cập nhật giáo viên thành công' });
        emit('saved');
        visible.value = false;
    } catch (err) {
        errorMsg.value = err?.message || 'Cập nhật giáo viên thất bại';
    } finally {
        loading.value = false;
    }
}

async function onSubmit() {
    if (isEdit.value) {
        await handleUpdate();
    } else {
        await handleCreate();
    }
}

/* ============= HELPERS ============= */
const dialogTitle = computed(() => (isEdit.value ? 'Chỉnh sửa giáo viên' : 'Thêm giáo viên mới'));
</script>

<template>
    <Dialog v-model:visible="visible" modal :style="{ width: '520px' }" :draggable="false">
        <template #header>
            <div class="dialog-header">
                <i :class="['fa-solid', isEdit ? 'fa-pen-to-square' : 'fa-plus-circle']"></i>
                <span>{{ dialogTitle }}</span>
            </div>
        </template>

        <div class="dialog-body">
            <!-- Error -->
            <div v-if="errorMsg" class="error-box">
                <i class="fa-solid fa-circle-exclamation"></i>
                <span>{{ errorMsg }}</span>
            </div>

            <!-- Tài khoản (chỉ khi tạo mới) -->
            <div v-if="!isEdit" class="form-row">
                <div class="form-field">
                    <label>
                        Tên đăng nhập
                        <span class="required">*</span>
                    </label>
                    <InputText v-model="form.username" placeholder="VD: giaovien001" class="w-full" autocomplete="off" />
                </div>
                <div class="form-field">
                    <label>
                        Mật khẩu
                        <span class="required">*</span>
                    </label>
                    <InputText v-model="form.password" type="password" placeholder="Tối thiểu 6 ký tự" class="w-full" autocomplete="new-password" />
                </div>
            </div>

            <!-- Thông tin chính -->
            <div class="form-row">
                <div class="form-field">
                    <label>
                        Họ và tên giáo viên
                        <span class="required">*</span>
                    </label>
                    <InputText v-model="form.fullName" placeholder="VD: Nguyễn Thị A" class="w-full" />

                    <!-- ✅ NEW: hiển thị username dưới họ tên khi sửa (giữ UI hint hiện có) -->
                    <span v-if="isEdit && usernameDisplay" class="field-hint">
                        Username: <b>{{ usernameDisplay }}</b>
                    </span>
                </div>

                <div class="form-field">
                    <label>Mã giáo viên / Mã nhân viên</label>
                    <InputText v-model="form.employeeCode" placeholder="Để trống nếu muốn hệ thống tự sinh" class="w-full" />
                    <span class="field-hint">Nếu để trống khi tạo mới, hệ thống sẽ tự sinh mã giáo viên.</span>
                </div>
            </div>

            <div class="form-row">
                <div class="form-field">
                    <label>Giới tính</label>
                    <Dropdown
                        v-model="form.gender"
                        :options="genders"
                        optionLabel="label"
                        optionValue="value"
                        placeholder="Chọn giới tính"
                        class="w-full"
                        showClear
                    />
                </div>
                <div class="form-field">
                    <label>Ngày sinh (YYYY-MM-DD)</label>
                    <InputText v-model="form.dateOfBirth" placeholder="VD: 1990-05-20" class="w-full" />
                </div>
            </div>

            <!-- Liên hệ -->
            <div class="form-row">
                <div class="form-field">
                    <label>Email</label>
                    <InputText v-model="form.email" placeholder="VD: giaovien@example.com" class="w-full" />
                </div>
                <div class="form-field">
                    <label>Số điện thoại</label>
                    <InputText v-model="form.phone" placeholder="VD: 0912345678" class="w-full" />
                </div>
            </div>

            <!-- Công tác -->
            <div class="form-field">
                <label>Chuyên môn / Bộ môn phụ trách</label>
                <InputText v-model="form.specialization" placeholder="VD: Giáo dục mầm non, Tiếng Anh, Âm nhạc..." class="w-full" />
            </div>

            <div class="form-field">
                <label>Liên hệ khẩn cấp</label>
                <InputText v-model="form.emergencyContact" placeholder="Số ĐT người thân / ghi chú liên hệ khẩn cấp" class="w-full" />
            </div>
        </div>

        <template #footer>
            <div class="dialog-footer">
                <button class="btn btn-ghost" @click="visible = false" :disabled="loading">Hủy</button>
                <button class="btn btn-primary" @click="onSubmit" :disabled="loading">
                    <i v-if="loading" class="fa-solid fa-spinner fa-spin"></i>
                    <i v-else :class="['fa-solid', isEdit ? 'fa-save' : 'fa-check']"></i>
                    <span>{{ loading ? 'Đang lưu...' : isEdit ? 'Lưu thay đổi' : 'Tạo giáo viên' }}</span>
                </button>
            </div>
        </template>
    </Dialog>
</template>

<style scoped>
.dialog-header {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-weight: 600;
    color: #1e293b;
}

.dialog-body {
    display: flex;
    flex-direction: column;
    gap: 1rem;
}

.dialog-footer {
    display: flex;
    justify-content: flex-end;
    gap: 0.5rem;
}

/* Form layout */
.form-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1rem;
}

.form-field {
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
}

.form-field label {
    font-size: 0.875rem;
    font-weight: 500;
    color: #475569;
}

.required {
    color: #ef4444;
}

.field-hint {
    font-size: 0.75rem;
    color: #94a3b8;
}

/* Error box */
.error-box {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.75rem 1rem;
    border-radius: 8px;
    background: #fef2f2;
    color: #b91c1c;
    font-size: 0.875rem;
}

/* Buttons */
.btn {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 1rem;
    border-radius: 8px;
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
    border: none;
}

.btn-primary {
    background: #6366f1;
    color: white;
}
.btn-primary:hover {
    background: #4f46e5;
}

.btn-ghost {
    background: transparent;
    color: #64748b;
}
.btn-ghost:hover {
    background: #f1f5f9;
}

.btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
}
</style>
