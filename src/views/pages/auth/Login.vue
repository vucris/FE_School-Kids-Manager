<script setup>
import FloatingConfigurator from '@/components/FloatingConfigurator.vue';
import { ref, nextTick } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import '@fortawesome/fontawesome-free/css/all.min.css';

import loginBg from '@/assets/abc.jpg';
import { useAuthStore } from '@/stores/auth.js';

const router = useRouter();
const route = useRoute();
const auth = useAuthStore();

const username = ref('');
const password = ref('');
const rememberMe = ref(false);
const loading = ref(false);
const errorMsg = ref('');
const showPassword = ref(false);

// Focus states
const usernameFocused = ref(false);
const passwordFocused = ref(false);

async function onSubmit() {
    errorMsg.value = '';

    if (!username.value.trim()) {
        errorMsg.value = 'Vui lòng nhập tên đăng nhập';
        return;
    }

    if (!password.value) {
        errorMsg.value = 'Vui lòng nhập mật khẩu';
        return;
    }

    loading.value = true;

    try {
        const data = await auth.login({
            username: username.value.trim(),
            password: password.value
        });

        await nextTick();

        // Lấy role và chuẩn hóa về UPPERCASE
        const rawRole = data.role || data.user?.role;
        const role = typeof rawRole === 'string' ? rawRole.toUpperCase() : rawRole;

        // ❌ CHẶN PHỤ HUYNH ĐĂNG NHẬP
        if (role === 'PARENT' || role === 'ROLE_PARENT') {
            errorMsg.value = 'Sai tài khoản hoặc mật khẩu.';
            // Nếu store có hàm logout thì gọi để xoá token/session
            if (typeof auth.logout === 'function') {
                await auth.logout();
            }
            loading.value = false;
            return;
        }

        const redirect = typeof route.query.redirect === 'string' ? route.query.redirect : null;

        if (redirect) {
            await router.replace(redirect);
        } else {
            // Điều hướng theo role (không còn PARENT vì đã chặn ở trên)
            if (role === 'TEACHER' || role === 'ROLE_TEACHER') {
                await router.replace('/school/Trang-Chu');
            } else if (role === 'ADMIN' || role === 'ROLE_ADMIN') {
                await router.replace('/school/Trang-Chu');
            } else {
                await router.replace({ name: 'dashboard' });
            }
        }
    } catch (err) {
        errorMsg.value =
            err?.response?.data?.message ||
            'Đăng nhập thất bại. Vui lòng kiểm tra lại thông tin.';
    } finally {
        loading.value = false;
    }
}

function togglePassword() {
    showPassword.value = !showPassword.value;
}
</script>



<template>
    <FloatingConfigurator />

    <div class="login-page" :style="{ backgroundImage: `url(${loginBg})` }">
        <!-- Overlay -->
        <div class="login-overlay"></div>

        <!-- Content -->
        <div class="login-container">
            <div class="login-card">
                <!-- Logo & Header -->
                <div class="login-header">
                    <div class="logo-wrapper">
                        <img src="@/assets/logo-vcnkids.jpg" alt="Logo" class="logo" />
                    </div>
                    <h1 class="app-name">Health Tracking Kids</h1>
                    <p class="welcome-text">Chào mừng bạn trở lại!</p>
                </div>

                <!-- Login Form -->
                <form @submit.prevent="onSubmit" class="login-form">
                    <!-- Username -->
                    <div class="input-group" :class="{ focused: usernameFocused, filled: username }">
                        <label for="username">
                            <i class="fa-solid fa-user"></i>
                            <span>Tên đăng nhập</span>
                        </label>
                        <input id="username" v-model="username" type="text" placeholder="Nhập tên đăng nhập" autocomplete="username" @focus="usernameFocused = true" @blur="usernameFocused = false" />
                    </div>

                    <!-- Password -->
                    <div class="input-group" :class="{ focused: passwordFocused, filled: password }">
                        <label for="password">
                            <i class="fa-solid fa-lock"></i>
                            <span>Mật khẩu</span>
                        </label>
                        <div class="password-wrapper">
                            <input id="password" v-model="password" :type="showPassword ? 'text' : 'password'" placeholder="Nhập mật khẩu" autocomplete="current-password" @focus="passwordFocused = true" @blur="passwordFocused = false" />
                            <button type="button" class="toggle-password" @click="togglePassword">
                                <i :class="showPassword ? 'fa-solid fa-eye-slash' : 'fa-solid fa-eye'"></i>
                            </button>
                        </div>
                    </div>

                    <!-- Error Message -->
                    <div v-if="errorMsg" class="error-message">
                        <i class="fa-solid fa-circle-exclamation"></i>
                        <span>{{ errorMsg }}</span>
                    </div>

                    <!-- Options -->
                    <!-- Options -->
                    <div class="login-options">
                        <label class="remember-me">
                            <input type="checkbox" v-model="rememberMe" />
                            <span class="checkmark"></span>
                            <span class="label-text">Ghi nhớ đăng nhập</span>
                        </label>

                        <RouterLink :to="{ name: 'ForgotPassword' }" class="forgot-password"> Quên mật khẩu? </RouterLink>
                    </div>

                    <!-- Submit Button -->
                    <button type="submit" class="login-button" :disabled="loading">
                        <span v-if="loading" class="loading-spinner">
                            <i class="fa-solid fa-spinner fa-spin"></i>
                        </span>
                        <span v-else>
                            <i class="fa-solid fa-right-to-bracket"></i>
                            Đăng nhập
                        </span>
                    </button>
                </form>

                <!-- Footer -->
                <div class="login-footer">
                    <p class="footer-text">Hệ thống quản lý sức khỏe trẻ em</p>
                    <div class="footer-divider"></div>
                </div>
            </div>

            <!-- Decorative elements -->
            <div class="decorative-circle circle-1"></div>
            <div class="decorative-circle circle-2"></div>
        </div>
    </div>
</template>

<style scoped>
/* ===== Base ===== */
.login-page {
    min-height: 100vh;
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    background-size: cover;
    background-position: center;
    background-repeat: no-repeat;
    position: relative;
    overflow: hidden;
}

.login-overlay {
    position: absolute;
    inset: 0;
    background: linear-gradient(135deg, rgba(122, 27, 111, 0.15) 0%, rgba(0, 0, 0, 0.4) 50%, rgba(16, 185, 129, 0.1) 100%);
    backdrop-filter: blur(2px);
}

/* ===== Container ===== */
.login-container {
    position: relative;
    z-index: 10;
    width: 100%;
    max-width: 420px;
    padding: 1rem;
}

/* ===== Card ===== */
.login-card {
    /* nền trắng 100% thay vì kính mờ */
    background: #ffffff;
    backdrop-filter: none; /* bỏ blur nếu muốn phẳng hoàn toàn */
    border-radius: 24px;
    padding: 2.5rem 2rem;
    box-shadow:
        0 25px 50px -12px rgba(15, 23, 42, 0.25),
        0 0 0 1px rgba(15, 23, 42, 0.03); /* viền nhẹ đẹp hơn */
    position: relative;
    overflow: hidden;
}

.login-card::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 4px;
    background: linear-gradient(90deg, #6366f1, #10b981, #6366f1);
    background-size: 200% 100%;
    animation: shimmer 3s ease-in-out infinite;
}

@keyframes shimmer {
    0%,
    100% {
        background-position: 0% 0%;
    }
    50% {
        background-position: 100% 0%;
    }
}

/* ===== Header ===== */
.login-header {
    text-align: center;
    margin-bottom: 2rem;
}

.logo-wrapper {
    display: inline-block;
    padding: 4px;
    background: linear-gradient(135deg, #6366f1, #10b981);
    border-radius: 20px;
    margin-bottom: 1rem;
}

.logo {
    width: 80px;
    height: 80px;
    border-radius: 16px;
    object-fit: cover;
    display: block;
}

.app-name {
    font-size: 1.5rem;
    font-weight: 700;
    color: #1e293b;
    margin: 0 0 0.5rem;
    letter-spacing: -0.025em;
}

.welcome-text {
    font-size: 0.9375rem;
    color: #64748b;
    margin: 0;
}

/* ===== Form ===== */
.login-form {
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
}

/* Input Group */
.input-group {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
}

.input-group label {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.875rem;
    font-weight: 500;
    color: #475569;
    transition: color 0.2s;
}

.input-group label i {
    font-size: 0.875rem;
    color: #94a3b8;
    transition: color 0.2s;
}

.input-group.focused label,
.input-group.focused label i {
    color: #6366f1;
}

.input-group input {
    width: 100%;
    padding: 0.875rem 1rem;
    border: 2px solid #e2e8f0;
    border-radius: 12px;
    font-size: 0.9375rem;
    color: #1e293b;
    background: #ffffff; /* luôn trắng */
    transition: all 0.2s;
    outline: none;
}

.input-group input::placeholder {
    color: #94a3b8;
}

.input-group input:focus {
    border-color: #6366f1;
    background: white;
    box-shadow: 0 0 0 4px rgba(99, 102, 241, 0.1);
}

/* Password wrapper */
.password-wrapper {
    position: relative;
}

.password-wrapper input {
    padding-right: 3rem;
}

.toggle-password {
    position: absolute;
    right: 1rem;
    top: 50%;
    transform: translateY(-50%);
    background: none;
    border: none;
    color: #94a3b8;
    cursor: pointer;
    padding: 0.25rem;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: color 0.2s;
}

.toggle-password:hover {
    color: #6366f1;
}

/* Error Message */
.error-message {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.75rem 1rem;
    background: #fef2f2;
    border: 1px solid #fecaca;
    border-radius: 10px;
    color: #dc2626;
    font-size: 0.875rem;
}

.error-message i {
    flex-shrink: 0;
}

/* Options */
.login-options {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-top: 0.25rem;
}

.remember-me {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    cursor: pointer;
    font-size: 0.875rem;
    color: #475569;
}

.remember-me input {
    display: none;
}

.checkmark {
    width: 18px;
    height: 18px;
    border: 2px solid #cbd5e1;
    border-radius: 5px;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s;
    position: relative;
}

.remember-me input:checked + .checkmark {
    background: #6366f1;
    border-color: #6366f1;
}

.remember-me input:checked + .checkmark::after {
    content: '';
    width: 5px;
    height: 9px;
    border: solid white;
    border-width: 0 2px 2px 0;
    transform: rotate(45deg);
    position: absolute;
    top: 1px;
}

.label-text {
    font-size: 0.875rem;
}

.forgot-password {
    font-size: 0.875rem;
    color: #6366f1;
    text-decoration: none;
    font-weight: 500;
    transition: color 0.2s;
}

.forgot-password:hover {
    color: #4f46e5;
    text-decoration: underline;
}

/* Submit Button */
.login-button {
    width: 100%;
    padding: 0.9375rem 1.5rem;
    background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%);
    color: white;
    border: none;
    border-radius: 12px;
    font-size: 1rem;
    font-weight: 600;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    transition: all 0.3s;
    box-shadow: 0 4px 14px 0 rgba(99, 102, 241, 0.4);
    margin-top: 0.5rem;
}

.login-button:hover:not(:disabled) {
    transform: translateY(-2px);
    box-shadow: 0 6px 20px 0 rgba(99, 102, 241, 0.5);
}

.login-button:active:not(:disabled) {
    transform: translateY(0);
}

.login-button:disabled {
    opacity: 0.7;
    cursor: not-allowed;
}

.loading-spinner {
    display: flex;
    align-items: center;
    gap: 0.5rem;
}

/* ===== Footer ===== */
.login-footer {
    margin-top: 2rem;
    text-align: center;
}

.footer-text {
    font-size: 0.8125rem;
    color: #64748b;
    margin: 0;
}

.footer-divider {
    width: 40px;
    height: 2px;
    background: linear-gradient(90deg, transparent, #cbd5e1, transparent);
    margin: 0.75rem auto;
}

.copyright {
    font-size: 0.75rem;
    color: #94a3b8;
    margin: 0;
}

/* ===== Decorative ===== */
.decorative-circle {
    position: absolute;
    border-radius: 50%;
    pointer-events: none;
}

.circle-1 {
    width: 200px;
    height: 200px;
    background: linear-gradient(135deg, rgba(99, 102, 241, 0.2), transparent);
    top: -100px;
    right: -100px;
    filter: blur(40px);
}

.circle-2 {
    width: 150px;
    height: 150px;
    background: linear-gradient(135deg, rgba(16, 185, 129, 0.2), transparent);
    bottom: -75px;
    left: -75px;
    filter: blur(40px);
}

/* ===== Responsive ===== */
@media (max-width: 480px) {
    .login-card {
        padding: 2rem 1.5rem;
    }

    .app-name {
        font-size: 1.25rem;
    }

    .login-options {
        flex-direction: column;
        gap: 0.75rem;
        align-items: flex-start;
    }
}

/* ===== Dark mode support ===== */
@media (prefers-color-scheme: dark) {
    .login-card {
        background: rgba(30, 41, 59, 0.95);
    }

    .app-name {
        color: #f1f5f9;
    }

    .welcome-text,
    .footer-text {
        color: #94a3b8;
    }

    .input-group label {
        color: #cbd5e1;
    }

    .input-group input {
        background: #334155;
        border-color: #475569;
        color: #f1f5f9;
    }

    .input-group input:focus {
        background: #1e293b;
    }

    .remember-me .label-text {
        color: #cbd5e1;
    }

    .checkmark {
        border-color: #64748b;
    }
}
</style>
