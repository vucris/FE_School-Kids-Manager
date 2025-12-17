<script setup>
import { ref, reactive, computed, watch } from 'vue';
import Dialog from 'primevue/dialog';
import InputText from 'primevue/inputtext';
import Dropdown from 'primevue/dropdown';
import Calendar from 'primevue/calendar';
import Textarea from 'primevue/textarea';
import Button from 'primevue/button';

import { createStudent, fetchParentOptionsLikeStudentService } from '@/service/studentService.js';
import { fetchClassOptions } from '@/service/classService.js';

const props = defineProps({
    modelValue: { type: Boolean, default: false },
    classOptions: { type: Array, default: () => [] },
    parentOptions: { type: Array, default: () => [] },
    year: { type: String, default: '' },
    autoSuggest: { type: Boolean, default: true }
});
const emit = defineEmits(['update:modelValue', 'created']);

const visible = computed({
    get: () => props.modelValue,
    set: (v) => emit('update:modelValue', v)
});

/**
 * Nếu BE/DB bắt buộc phone/username/password/email khi tạo thủ công,
 * bật TRUE để FE gửi "tối thiểu" nhưng vẫn ẩn UI.
 * Khi BE đã tự sinh đầy đủ => đổi FALSE để payload sạch đúng chuẩn mầm non.
 */
const SEND_ACCOUNT_FIELDS = true;

/** Giới tính: đồng bộ BE import (NAM/NỮ) để tránh mismatch */
const genders = [
    { label: 'Nam', value: 'NAM' },
    { label: 'Nữ', value: 'NỮ' }
];

const form = reactive({
    fullName: '',
    gender: null, // 'NAM' | 'NỮ'
    dateOfBirth: null, // Date
    enrollmentDate: null, // DateTime (Date)
    address: '',
    healthNotes: '',
    classId: null,
    parentId: null
});

const errors = reactive({
    fullName: '',
    gender: '',
    dateOfBirth: '',
    enrollmentDate: '',
    classId: '',
    parentId: ''
});

const submitting = ref(false);
const serverError = ref('');

const remoteClassOptions = ref([]);
const remoteParentOptions = ref([]);
const refLoading = reactive({ classes: false, parents: false });
const refError = ref('');

const clsOptions = computed(() => (props.classOptions?.length ? props.classOptions : remoteClassOptions.value));
const prOptions = computed(() => (props.parentOptions?.length ? props.parentOptions : remoteParentOptions.value));

watch(
    () => visible.value,
    async (v) => {
        if (!v) return;
        resetForm();
        await loadReferenceData();
    }
);

async function loadReferenceData() {
    refError.value = '';
    const jobs = [];

    if (!props.classOptions?.length) {
        refLoading.classes = true;
        jobs.push(
            fetchClassOptions(props.year ? { year: props.year } : {})
                .then((list) => {
                    remoteClassOptions.value = Array.isArray(list) ? list : [];
                })
                .catch((e) => {
                    refError.value = e?.message || 'Không tải được danh sách lớp.';
                })
                .finally(() => {
                    refLoading.classes = false;
                })
        );
    }

    if (!props.parentOptions?.length) {
        refLoading.parents = true;
        jobs.push(
            fetchParentOptionsLikeStudentService()
                .then((list) => {
                    remoteParentOptions.value = Array.isArray(list) ? list : [];
                })
                .catch((e) => {
                    refError.value = e?.message || 'Không tải được danh sách phụ huynh.';
                })
                .finally(() => {
                    refLoading.parents = false;
                })
        );
    }

    await Promise.all(jobs);
}

function resetForm() {
    Object.assign(form, {
        fullName: '',
        gender: null,
        dateOfBirth: null,
        // default: “bây giờ” để khỏi phải chọn nếu không cần
        enrollmentDate: new Date(),
        address: '',
        healthNotes: '',
        classId: null,
        parentId: null
    });
    Object.keys(errors).forEach((k) => (errors[k] = ''));
    serverError.value = '';
    submitting.value = false;
}

/* Helpers */
function toYMD(d) {
    if (!(d instanceof Date) || Number.isNaN(d.getTime())) return null;
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
}
function toISODateTime(d) {
    if (!(d instanceof Date) || Number.isNaN(d.getTime())) return null;
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const HH = String(d.getHours()).padStart(2, '0');
    const MM = String(d.getMinutes()).padStart(2, '0');
    const SS = String(d.getSeconds()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}T${HH}:${MM}:${SS}`;
}

function safeUsername() {
    return `hs${Date.now().toString().slice(-9)}`;
}
function safePassword() {
    return 'Student@123';
}
function safeEmail(username) {
    return `${username}@kindergarten.edu.vn`;
}
function generateVietnamPhoneUniqueish() {
    const tail = Date.now().toString().slice(-8);
    return `09${tail}`;
}

/* Validate */
function validate() {
    errors.fullName = form.fullName.trim() ? '' : 'Vui lòng nhập họ và tên';
    errors.gender = form.gender ? '' : 'Vui lòng chọn giới tính';
    errors.dateOfBirth = form.dateOfBirth ? '' : 'Vui lòng chọn ngày sinh';

    // “Ngày nhập học” để lại trong UI, nhưng không bắt buộc
    errors.enrollmentDate = '';

    errors.classId = form.classId ? '' : 'Vui lòng chọn lớp';
    errors.parentId = form.parentId ? '' : 'Vui lòng chọn phụ huynh';

    return !Object.values(errors).some(Boolean);
}

async function onSubmit() {
    serverError.value = '';
    if (!validate()) return;

    submitting.value = true;

    const payload = {
        fullName: form.fullName.trim(),
        gender: form.gender, // 'NAM' | 'NỮ'
        dateOfBirth: toYMD(form.dateOfBirth), // yyyy-MM-dd

        // giữ ngày nhập học
        // BE: enrollmentDate là LocalDateTime => gửi ISO "yyyy-MM-ddTHH:mm:ss"
        enrollmentDate: form.enrollmentDate ? toISODateTime(form.enrollmentDate) : null,

        address: form.address?.trim() || null,
        healthNotes: form.healthNotes?.trim() || null,
        classId: Number(form.classId),
        parentId: Number(form.parentId)
    };

    if (SEND_ACCOUNT_FIELDS) {
        const username = safeUsername();
        payload.username = username;
        payload.password = safePassword();
        payload.email = safeEmail(username);

        // SĐT học sinh: tự sinh để không bị lỗi "bắt buộc"
        payload.phone = generateVietnamPhoneUniqueish();

        payload.studentCode = null;
        payload.avatarUrl = null;
    }

    try {
        const created = await createStudent(payload);
        emit('created', created);
        visible.value = false;
    } catch (e) {
        serverError.value = e?.response?.data?.message || e?.message || 'Tạo học sinh thất bại';
    } finally {
        submitting.value = false;
    }
}
</script>

<template>
    <Dialog v-model:visible="visible" modal :draggable="false" :style="{ width: '760px', maxWidth: '95vw' }">
        <template #header>
            <div class="header">
                <div class="header__icon">
                    <i class="fa-solid fa-user-plus"></i>
                </div>
                <div>
                    <div class="header__title">Thêm học sinh</div>
                    <div class="header__sub">Nhập thông tin cơ bản cho học sinh mầm non</div>
                </div>
            </div>
        </template>

        <div class="card">
            <div class="card__title">Thông tin học sinh</div>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div class="field">
                    <label class="label">Họ và tên <span class="req">*</span></label>
                    <InputText v-model="form.fullName" class="w-full" placeholder="Ví dụ: Nguyễn Thị A" :class="{ 'p-invalid': !!errors.fullName }" />
                    <small v-if="errors.fullName" class="error">{{ errors.fullName }}</small>
                </div>

                <div class="field">
                    <label class="label">Giới tính <span class="req">*</span></label>
                    <Dropdown v-model="form.gender" :options="genders" optionLabel="label" optionValue="value" class="w-full" placeholder="Chọn giới tính" :class="{ 'p-invalid': !!errors.gender }" />
                    <small v-if="errors.gender" class="error">{{ errors.gender }}</small>
                </div>

                <div class="field">
                    <label class="label">Ngày sinh <span class="req">*</span></label>
                    <Calendar v-model="form.dateOfBirth" class="w-full" dateFormat="dd/mm/yy" placeholder="dd/mm/yyyy" showIcon :class="{ 'p-invalid': !!errors.dateOfBirth }" />
                    <small v-if="errors.dateOfBirth" class="error">{{ errors.dateOfBirth }}</small>
                </div>

                <div class="field">
                    <label class="label">Ngày nhập học</label>
                    <Calendar v-model="form.enrollmentDate" class="w-full" showTime hourFormat="24" dateFormat="dd/mm/yy" placeholder="dd/mm/yyyy HH:mm" />
                    <small class="hint">Nếu bỏ trống, hệ thống sẽ lấy thời điểm hiện tại.</small>
                </div>

                <div class="field md:col-span-2">
                    <label class="label">Địa chỉ</label>
                    <InputText v-model="form.address" class="w-full" placeholder="Ví dụ: 123 Đường ABC, Phường..., Quận..." />
                </div>

                <div class="field md:col-span-2">
                    <label class="label">Ghi chú sức khỏe</label>
                    <Textarea v-model="form.healthNotes" class="w-full" autoResize rows="2" placeholder="Ví dụ: dị ứng sữa, hen suyễn..." />
                </div>
            </div>
        </div>

        <div class="card">
            <div class="card__title">Liên kết lớp & phụ huynh</div>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div class="field">
                    <label class="label">Lớp <span class="req">*</span></label>
                    <Dropdown v-model="form.classId" :options="clsOptions" optionLabel="label" optionValue="value" class="w-full" placeholder="Chọn lớp" :filter="true" showClear :class="{ 'p-invalid': !!errors.classId }" />
                    <small v-if="errors.classId" class="error">{{ errors.classId }}</small>
                    <small v-if="refLoading.classes" class="hint">Đang tải danh sách lớp...</small>
                    <small v-else-if="!refLoading.classes && !clsOptions.length" class="error">Không có dữ liệu lớp</small>
                </div>

                <div class="field">
                    <label class="label">Phụ huynh <span class="req">*</span></label>
                    <Dropdown v-model="form.parentId" :options="prOptions" optionLabel="label" optionValue="value" class="w-full" placeholder="Chọn phụ huynh" :filter="true" showClear :class="{ 'p-invalid': !!errors.parentId }" />
                    <small v-if="errors.parentId" class="error">{{ errors.parentId }}</small>
                    <small v-if="refLoading.parents" class="hint">Đang tải danh sách phụ huynh...</small>
                    <small v-else-if="!refLoading.parents && !prOptions.length" class="error">Không có dữ liệu phụ huynh</small>
                </div>
            </div>

            <div v-if="refError" class="alert alert--warn">
                <i class="fa-solid fa-triangle-exclamation"></i>
                <span>{{ refError }}</span>
            </div>

            <p class="hint mt-2">Phụ huynh sẽ là người sử dụng ứng dụng để theo dõi học sinh.</p>
        </div>

        <div v-if="serverError" class="alert alert--error">
            <i class="fa-solid fa-circle-xmark"></i>
            <span>{{ serverError }}</span>
        </div>

        <template #footer>
            <div class="footer">
                <Button label="Đóng" class="p-button-text" :disabled="submitting" @click="visible = false" />
                <Button :label="submitting ? 'Đang tạo...' : 'Thêm học sinh'" class="!bg-primary !border-0 !text-white" :disabled="submitting" @click="onSubmit" />
            </div>
        </template>
    </Dialog>
</template>

<style scoped>
.header {
    display: flex;
    align-items: center;
    gap: 0.75rem;
}
.header__icon {
    width: 44px;
    height: 44px;
    border-radius: 12px;
    background: linear-gradient(135deg, #6366f1, #8b5cf6);
    color: #fff;
    display: flex;
    align-items: center;
    justify-content: center;
}
.header__title {
    font-size: 1.1rem;
    font-weight: 800;
    color: #0f172a;
    line-height: 1.2;
}
.header__sub {
    font-size: 0.8rem;
    color: #64748b;
}

.card {
    border: 1px solid #e2e8f0;
    background: #fff;
    border-radius: 14px;
    padding: 14px;
    margin-top: 12px;
}
.card__title {
    font-weight: 800;
    color: #0f172a;
    margin-bottom: 10px;
    font-size: 0.95rem;
}

.field .label {
    display: inline-block;
    margin-bottom: 6px;
    font-weight: 700;
    color: #334155;
    font-size: 0.9rem;
}
.req {
    color: #ef4444;
}
.error {
    color: #ef4444;
    font-size: 0.8rem;
}
.hint {
    color: #64748b;
    font-size: 0.78rem;
}

.alert {
    display: flex;
    align-items: flex-start;
    gap: 0.5rem;
    padding: 10px 12px;
    border-radius: 12px;
    margin-top: 10px;
    font-size: 0.875rem;
    border: 1px solid transparent;
}
.alert--info {
    background: #eff6ff;
    border-color: #bfdbfe;
    color: #1d4ed8;
}
.alert--warn {
    background: #fffbeb;
    border-color: #fde68a;
    color: #92400e;
}
.alert--error {
    background: #fef2f2;
    border-color: #fecaca;
    color: #dc2626;
}

.footer {
    display: flex;
    justify-content: flex-end;
    gap: 10px;
    width: 100%;
}

:deep(.p-inputtext.p-invalid),
:deep(.p-dropdown.p-invalid .p-dropdown-label),
:deep(.p-calendar.p-invalid input) {
    border-color: #ef4444 !important;
}
</style>
