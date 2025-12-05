<script setup>
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/auth';
import Swal from 'sweetalert2';

// PrimeVue components
import Card from 'primevue/card';
import InputText from 'primevue/inputtext';
import Password from 'primevue/password';
import Button from 'primevue/button';

const router = useRouter();
const authStore = useAuthStore();

const step = ref(1); // 1: nhập email, 2: nhập OTP + mk mới
const email = ref('');
const code = ref('');
const newPassword = ref('');
const confirmPassword = ref('');

const loadingSend = ref(false);
const loadingConfirm = ref(false);

/** Bước 1: gửi OTP */
async function handleSendOtp() {
    if (!email.value.trim()) {
        Swal.fire('Lỗi', 'Vui lòng nhập email đăng ký.', 'warning');
        return;
    }

    try {
        loadingSend.value = true;
        const msg = await authStore.requestChangePassword(email.value.trim());
        Swal.fire('Thành công', msg, 'success');
        step.value = 2;
    } catch (e) {
        Swal.fire('Lỗi', e?.response?.data || e.message, 'error');
    } finally {
        loadingSend.value = false;
    }
}

/** Bước 2: xác nhận OTP + đổi mật khẩu */
async function handleConfirmChange() {
    if (!code.value.trim() || !newPassword.value || !confirmPassword.value) {
        Swal.fire('Lỗi', 'Vui lòng nhập đầy đủ thông tin.', 'warning');
        return;
    }

    if (newPassword.value !== confirmPassword.value) {
        Swal.fire('Lỗi', 'Mật khẩu mới và xác nhận mật khẩu không khớp.', 'warning');
        return;
    }

    try {
        loadingConfirm.value = true;
        const msg = await authStore.changePassword({
            email: email.value.trim(),
            code: code.value.trim(),
            newPassword: newPassword.value
        });
        Swal.fire('Thành công', msg, 'success');
        router.push('/login'); // hoặc { name: 'login' } tùy router của anh
    } catch (e) {
        Swal.fire('Lỗi', e?.response?.data || e.message, 'error');
    } finally {
        loadingConfirm.value = false;
    }
}

/** Quay về màn login */
function goBackToLogin() {
    router.push('/login'); // chỉnh lại path nếu anh đặt khác
}
</script>

<template>
    <div class="forgot-page">
        <Card class="forgot-card">
            <template #title>
                <div class="title-wrap">
                    <h2 v-if="step === 1">Quên mật khẩu</h2>
                    <h2 v-else>Đặt lại mật khẩu</h2>
                    <p v-if="step === 1" class="subtitle">
                        Nhập email của bạn, hệ thống sẽ gửi mã OTP để đặt lại mật khẩu.
                    </p>
                    <p v-else class="subtitle">
                        Kiểm tra email để lấy mã OTP, sau đó nhập bên dưới cùng mật khẩu mới.
                    </p>
                </div>
            </template>

            <template #content>
                <div class="form-wrapper">
                    <!-- Email -->
                    <div class="form-group">
                        <label class="form-label">
                            Email đăng ký <span class="required">*</span>
                        </label>
                        <InputText
                            v-model="email"
                            placeholder="ví dụ: phuhuynh@gmail.com"
                            class="w-full"
                            type="email"
                            :disabled="step === 2"
                        />
                    </div>

                    <!-- Bước 2: Nhập OTP + mật khẩu -->
                    <template v-if="step === 2">
                        <div class="form-group">
                            <label class="form-label">
                                Mã OTP <span class="required">*</span>
                            </label>
                            <InputText
                                v-model="code"
                                maxlength="6"
                                placeholder="Nhập mã OTP gồm 6 ký tự"
                                class="w-full"
                            />
                            <small class="hint">Mã OTP có hiệu lực 10 phút.</small>
                        </div>

                        <div class="form-group">
                            <label class="form-label">
                                Mật khẩu mới <span class="required">*</span>
                            </label>
                            <Password
                                v-model="newPassword"
                                toggleMask
                                class="w-full"
                                inputClass="w-full"
                                placeholder="Nhập mật khẩu mới"
                                :feedback="false"
                            />
                        </div>

                        <div class="form-group">
                            <label class="form-label">
                                Nhập lại mật khẩu mới <span class="required">*</span>
                            </label>
                            <Password
                                v-model="confirmPassword"
                                toggleMask
                                class="w-full"
                                inputClass="w-full"
                                placeholder="Nhập lại mật khẩu mới"
                                :feedback="false"
                            />
                        </div>
                    </template>
                </div>
            </template>

            <template #footer>
                <div class="footer-row">
                    <Button
                        label="Quay lại đăng nhập"
                        class="p-button-text"
                        icon="pi pi-arrow-left"
                        @click="goBackToLogin"
                    />

                    <div class="footer-actions">
                        <Button
                            v-if="step === 1"
                            label="Gửi mã OTP"
                            icon="pi pi-send"
                            :loading="loadingSend"
                            @click="handleSendOtp"
                        />
                        <Button
                            v-else
                            label="Xác nhận đổi mật khẩu"
                            icon="pi pi-check"
                            :loading="loadingConfirm"
                            @click="handleConfirmChange"
                        />
                    </div>
                </div>
            </template>
        </Card>
    </div>
</template>

<style scoped>
.forgot-page {
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    background: radial-gradient(circle at top, #dbeafe 0, #eff6ff 35%, #f9fafb 100%);
    padding: 1rem;
}

.forgot-card {
    width: 100%;
    max-width: 460px;
    box-shadow: 0 20px 45px rgba(15, 23, 42, 0.15);
    border-radius: 16px;
}

.title-wrap h2 {
    margin: 0;
    font-size: 1.4rem;
    font-weight: 700;
    color: #0f172a;
}

.subtitle {
    margin-top: 0.35rem;
    font-size: 0.9rem;
    color: #6b7280;
}

.form-wrapper {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
}

.form-group {
    display: flex;
    flex-direction: column;
    gap: 0.3rem;
}

.form-label {
    font-size: 0.85rem;
    color: #4b5563;
    font-weight: 500;
}

.required {
    color: #ef4444;
}

.hint {
    font-size: 0.75rem;
    color: #9ca3af;
}

.footer-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
}

.footer-actions {
    display: flex;
    gap: 0.5rem;
}

/* PrimeVue card footer fix */
:deep(.p-card-footer) {
    padding-top: 0;
}
</style>
