<script setup>
import FloatingConfigurator from '@/components/FloatingConfigurator.vue';
import { ref } from 'vue';

// Ảnh nền (đặt vào src/assets/login-bg.jpg hoặc đổi đường dẫn tùy bạn)
import loginBg from '@/assets/abc.jpg';

const email = ref('');
const password = ref('');
const checked = ref(false);
</script>

<template>
    <FloatingConfigurator />

    <!-- Nền toàn màn hình + ảnh -->
    <div class="relative min-h-screen w-screen overflow-hidden bg-cover bg-center bg-no-repeat" :style="{ backgroundImage: `url(${loginBg})` }">
        <!-- Overlay gradient để tăng độ tương phản -->
        <div class="absolute inset-0 bg-gradient-to-b from-black/30 via-black/20 to-black/40"></div>

        <!-- Nội dung -->
        <div class="relative z-10 container mx-auto px-4 py-10">
            <div class="mx-auto max-w-md">
                <!-- Viền gradient mỏng + bóng đổ -->
                <div class="p-[1px] rounded-3xl bg-gradient-to-b from-primary/70 to-transparent shadow-2xl">
                    <!-- Thẻ glassmorphism -->
                    <div class="rounded-3xl border border-white/20 dark:border-white/10 bg-white/70 dark:bg-surface-900/60 backdrop-blur-xl px-8 py-10">
                        <!-- Header -->
                        <div class="text-center mb-8">
                            <img src="@/assets/logo-vcnkids.jpg" alt="Logo" class="w-14 h-14 rounded-xl shadow-lg mx-auto mb-4" />
                            <h1 class="text-surface-900 dark:text-surface-0 text-3xl font-semibold">Health Tracking Kids</h1>
                            <p class="text-muted-color mt-2">Sign in to continue</p>
                        </div>
                        <!-- Form -->
                        <div>
                            <!-- Email -->
                            <InputGroup class="mb-6">
                                <InputGroupAddon>
                                    <i class="pi pi-user"></i>
                                </InputGroupAddon>
                                <InputText v-model="username" placeholder="Tên đăng nhập" />
                            </InputGroup>
                            <InputGroup class="mb-6">
                                <InputGroupAddon>
                                    <i class="pi pi-lock"></i>
                                </InputGroupAddon>
                                <Password v-model="password" :feedback="false" :toggleMask="true" placeholder="Nhập mật khẩu" />
                            </InputGroup>
                            <!-- Options -->
                            <div class="flex items-center justify-between mt-3 mb-8 gap-6">
                                <div class="flex items-center">
                                    <Checkbox v-model="checked" id="rememberme1" binary class="mr-2" />
                                    <label for="rememberme1" class="text-surface-700 dark:text-surface-200"> Remember me </label>
                                </div>
                                <button type="button" class="font-medium text-primary hover:opacity-90 transition-opacity">Forgot password?</button>
                            </div>
                            <!-- Submit -->
                            <Button
                                label="Đăng Nhập"
                                class="w-full h-12 rounded-xl border-0 shadow-lg bg-gradient-to-r from-primary to-primary-400 hover:from-primary-500 hover:to-primary-400 text-white focus:ring-2 focus:ring-offset-2 focus:ring-primary/40"
                                as="router-link"
                                to="/"
                            />
                            <!-- Divider -->
                            <div class="flex items-center my-8">
                                <div class="h-px flex-1 bg-surface-200 dark:bg-surface-700"></div>
                                <span class="px-4 text-muted-color">OR</span>
                                <div class="h-px flex-1 bg-surface-200 dark:bg-surface-700"></div>
                            </div>

                            <!-- Social (tùy chọn) -->
                            <div class="grid grid-cols-1 gap-3">
                                <button
                                    type="button"
                                    class="h-11 rounded-xl border border-surface-200 dark:border-surface-700 bg-surface-0/70 dark:bg-surface-800/70 hover:bg-surface-0/90 dark:hover:bg-surface-800/90 transition-colors flex items-center justify-center gap-3"
                                >
                                    <img src="https://www.svgrepo.com/show/475656/google-color.svg" class="w-5 h-5" alt="Google" />
                                    <span class="text-surface-900 dark:text-surface-0">Continue with Google</span>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

<style scoped>
/* Tăng kích thước icon toggle mắt của PrimeVue Password một chút */
.pi-eye,
.pi-eye-slash {
    transform: scale(1.25);
}
</style>
