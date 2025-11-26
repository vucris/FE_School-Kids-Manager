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

const genders = [
    { label: 'Nam', value: 'MALE' },
    { label: 'Nữ', value: 'FEMALE' }
];

/* Form: vẫn giữ các field account để gửi cho BE, nhưng ẩn UI */
const form = reactive({
    fullName: '',
    gender: null,
    dateOfBirth: null,
    studentCode: '',
    enrollmentDate: null,
    address: '',
    healthNotes: '',
    avatarUrl: '',
    phone: '',
    classId: null,
    parentId: null,
    username: '',
    email: '',
    password: ''
});

/* Error: chỉ validate những thứ cần người dùng nhập (học sinh mầm non không đụng tới tài khoản) */
const errors = reactive({
    fullName: '',
    gender: '',
    dateOfBirth: '',
    studentCode: '',
    classId: '',
    parentId: ''
});

const submitting = ref(false);
const serverError = ref('');

const remoteClassOptions = ref([]);
const remoteParentOptions = ref([]);
const refLoading = reactive({ classes: false, parents: false });
const refError = ref('');

/* Option lớp / phụ huynh */
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

/* Helpers ngày giờ + gợi ý account ẩn */
function toYMD(d) {
    if (!(d instanceof Date) || isNaN(d)) return null;
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
}
function toISODateTime(d) {
    if (!(d instanceof Date) || isNaN(d)) return null;
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const HH = String(d.getHours()).padStart(2, '0');
    const MM = String(d.getMinutes()).padStart(2, '0');
    const SS = String(d.getSeconds()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}T${HH}:${MM}:${SS}`;
}
function slugifyUsername(s) {
    return String(s || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '')
        .slice(0, 16);
}
function randomDigits(n = 3) {
    return Array.from({ length: n }, () => Math.floor(Math.random() * 10)).join('');
}
function suggestUsername() {
    const base = slugifyUsername(form.fullName);
    if (!base) return '';
    return base + randomDigits(3);
}
function suggestPassword() {
    const tail = (form.studentCode || '').replace(/\D/g, '').slice(-4) || randomDigits(4);
    return `Hs@${tail}`;
}
function suggestEmail() {
    const code = (form.studentCode || '').toLowerCase() || `hs${randomDigits(6)}`;
    return `${code}@school.local`;
}

async function loadReferenceData() {
    refError.value = '';
    const jobs = [];
    if (!props.classOptions?.length) {
        refLoading.classes = true;
        jobs.push(
            fetchClassOptions(props.year ? { year: props.year } : {})
                .then((list) => {
                    remoteClassOptions.value = list;
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
                    remoteParentOptions.value = list;
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
        studentCode: '',
        enrollmentDate: null,
        address: '',
        healthNotes: '',
        avatarUrl: '',
        phone: '',
        classId: null,
        parentId: null,
        username: '',
        email: '',
        password: ''
    });
    Object.keys(errors).forEach((k) => (errors[k] = ''));
    serverError.value = '';
    submitting.value = false;
}

/* Auto gợi ý code/username/password/email nhưng ẩn khỏi UI */
watch(
    () => form.fullName,
    () => {
        if (!props.autoSuggest) return;
        if (form.fullName && !form.studentCode) {
            form.studentCode = 'HS' + Date.now().toString().slice(-6);
        }
        if (form.fullName && !form.username) {
            form.username = suggestUsername();
        }
        if (!form.password) {
            form.password = suggestPassword();
        }
        if (!form.email) {
            form.email = suggestEmail();
        }
    }
);
watch(
    () => form.studentCode,
    () => {
        if (!props.autoSuggest) return;
        if (!form.username) form.username = suggestUsername();
        if (!form.password) form.password = suggestPassword();
        if (!form.email) form.email = suggestEmail();
    }
);

/* Validate: chỉ kiểm tra phần thông tin cần nhập cho mầm non */
function validate() {
    errors.fullName = form.fullName.trim() ? '' : 'Bắt buộc';
    errors.gender = form.gender ? '' : 'Bắt buộc';
    errors.dateOfBirth = form.dateOfBirth ? '' : 'Bắt buộc';
    errors.studentCode = form.studentCode.trim() ? '' : 'Bắt buộc';
    errors.classId = form.classId ? '' : 'Bắt buộc';
    errors.parentId = form.parentId ? '' : 'Bắt buộc';

    return !Object.values(errors).some(Boolean);
}

async function onSubmit() {
    serverError.value = '';

    // đảm bảo luôn có mã HS + account ẩn trước khi validate / gửi
    if (!form.studentCode) {
        form.studentCode = 'HS' + Date.now().toString().slice(-6);
    }
    if (!form.username) {
        form.username = suggestUsername() || `hs${randomDigits(5)}`;
    }
    if (!form.password) {
        form.password = suggestPassword();
    }
    if (!form.email) {
        form.email = suggestEmail();
    }

    if (!validate()) return;

    submitting.value = true;

    const payload = {
        // account ẩn – chỉ phục vụ BE, học sinh mầm non không dùng để đăng nhập
        username: form.username.trim(),
        email: form.email?.trim() || null,
        password: form.password.trim(),

        // thông tin học sinh
        fullName: form.fullName.trim(),
        phone: form.phone?.trim() || null,
        gender: form.gender, // 'MALE' | 'FEMALE'
        dateOfBirth: toYMD(form.dateOfBirth), // yyyy-MM-dd
        avatarUrl: form.avatarUrl || null,
        studentCode: form.studentCode.trim(),
        enrollmentDate: form.enrollmentDate ? toISODateTime(form.enrollmentDate) : null,
        healthNotes: form.healthNotes || null,
        address: form.address || null,
        classId: Number(form.classId),
        parentId: Number(form.parentId)
    };

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
    <Dialog v-model:visible="visible" modal :draggable="false" :style="{ width: '820px', maxWidth: '95vw' }">
        <template #header>
            <div class="text-lg font-semibold text-slate-800">Tạo học sinh</div>
        </template>

        <!-- THÔNG TIN HỌC SINH -->
        <div class="section">
            <div class="section__title">Thông tin học sinh</div>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                    <label class="label"> Họ và tên <span class="req">*</span> </label>
                    <InputText v-model="form.fullName" class="w-full" :class="{ 'p-invalid': !!errors.fullName }" />
                    <small v-if="errors.fullName" class="error">{{ errors.fullName }}</small>
                </div>

                <div>
                    <label class="label"> Giới tính <span class="req">*</span> </label>
                    <Dropdown v-model="form.gender" :options="genders" optionLabel="label" optionValue="value" class="w-full" placeholder="Chọn giới tính" :class="{ 'p-invalid': !!errors.gender }" />
                    <small v-if="errors.gender" class="error">{{ errors.gender }}</small>
                </div>

                <div>
                    <label class="label"> Ngày sinh <span class="req">*</span> </label>
                    <Calendar v-model="form.dateOfBirth" class="w-full" dateFormat="dd/mm/yy" placeholder="dd/mm/yyyy" :class="{ 'p-invalid': !!errors.dateOfBirth }" />
                    <small v-if="errors.dateOfBirth" class="error">{{ errors.dateOfBirth }}</small>
                </div>

                <div>
                    <label class="label"> Mã học sinh <span class="req">*</span> </label>
                    <InputText v-model="form.studentCode" class="w-full" :class="{ 'p-invalid': !!errors.studentCode }" placeholder="HS0007" />
                    <small v-if="errors.studentCode" class="error">{{ errors.studentCode }}</small>
                    <small class="hint">Không nhập cũng được, hệ thống sẽ tự sinh mã.</small>
                </div>

                <div>
                    <label class="label">Ngày nhập học</label>
                    <Calendar v-model="form.enrollmentDate" class="w-full" showTime hourFormat="24" placeholder="yyyy-MM-dd HH:mm" />
                </div>

                <div>
                    <label class="label">Số điện thoại</label>
                    <InputText v-model="form.phone" class="w-full" placeholder="0987xxxxxx" />
                </div>

                <div class="md:col-span-2">
                    <label class="label">Địa chỉ</label>
                    <InputText v-model="form.address" class="w-full" placeholder="Địa chỉ" />
                </div>

                <div class="md:col-span-2">
                    <label class="label">Ghi chú sức khỏe</label>
                    <Textarea v-model="form.healthNotes" class="w-full" autoResize rows="2" placeholder="Dị ứng, tiền sử bệnh..." />
                </div>

                <div class="md:col-span-2">
                    <label class="label">Avatar URL</label>
                    <InputText v-model="form.avatarUrl" class="w-full" placeholder="https://example.com/avatar.png" />
                </div>
            </div>
        </div>

        <!-- LIÊN KẾT LỚP & PHỤ HUYNH -->
        <div class="section">
            <div class="section__title">Liên kết lớp & phụ huynh</div>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                    <label class="label"> Lớp <span class="req">*</span> </label>
                    <Dropdown v-model="form.classId" :options="clsOptions" optionLabel="label" optionValue="value" class="w-full" placeholder="Chọn lớp" :class="{ 'p-invalid': !!errors.classId }" :filter="true" showClear />
                    <small v-if="errors.classId" class="error">{{ errors.classId }}</small>
                    <small v-if="refLoading.classes" class="hint">Đang tải danh sách lớp...</small>
                    <small v-else-if="!refLoading.classes && !clsOptions.length" class="error">Không có dữ liệu lớp</small>
                </div>

                <div>
                    <label class="label"> Phụ huynh <span class="req">*</span> </label>
                    <Dropdown v-model="form.parentId" :options="prOptions" optionLabel="label" optionValue="value" class="w-full" placeholder="Chọn phụ huynh" :class="{ 'p-invalid': !!errors.parentId }" :filter="true" showClear />
                    <small v-if="errors.parentId" class="error">{{ errors.parentId }}</small>
                    <small v-if="refLoading.parents" class="hint">Đang tải danh sách phụ huynh...</small>
                    <small v-else-if="!refLoading.parents && !prOptions.length" class="error">Không có dữ liệu phụ huynh</small>
                </div>
            </div>

            <div v-if="refError" class="mt-2 text-sm text-rose-600 font-medium">
                {{ refError }}
            </div>

            <p class="hint mt-2">Tài khoản đăng nhập sẽ do phụ huynh sử dụng. Tài khoản nội bộ của học sinh được hệ thống tự sinh và <b>không hiển thị</b> ở đây.</p>
        </div>

        <div v-if="serverError" class="mt-2 text-sm text-rose-600 font-medium">
            {{ serverError }}
        </div>

        <template #footer>
            <div class="flex items-center justify-end gap-2 w-full">
                <Button label="Đóng" class="!bg-slate-200 !text-slate-800 !border-0" :disabled="submitting" @click="visible = false" />
                <Button :label="submitting ? 'Đang tạo...' : 'Tạo học sinh'" class="!bg-primary !border-0 !text-white" :disabled="submitting" @click="onSubmit" />
            </div>
        </template>
    </Dialog>
</template>

<style scoped>
.section {
    margin-top: 14px;
}
.section__title {
    margin: 4px 0 10px;
    font-weight: 700;
    color: #0f172a;
}
.label {
    display: inline-block;
    margin-bottom: 6px;
    font-weight: 600;
    color: #334155;
    font-size: 0.93rem;
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
:deep(.p-inputtext.p-invalid),
:deep(.p-dropdown.p-invalid .p-dropdown-label) {
    border-color: #ef4444;
}
</style>
