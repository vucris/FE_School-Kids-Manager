<template>
    <transition name="loading-bar-fade">
        <div v-if="isActive" class="loading-bar">
            <div class="loading-bar-inner"></div>
        </div>
    </transition>
</template>

<script setup>
import { storeToRefs } from 'pinia';
import { useLoadingBarStore } from '@/stores/loadingBar';

const loadingBarStore = useLoadingBarStore();
const { isActive } = storeToRefs(loadingBarStore);
</script>

<style scoped>
.loading-bar {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 3px; /* độ dày thanh */
    z-index: 9999;
    background: transparent;
    overflow: hidden;
}

/* THANH NẰM NGANG TĂNG DẦN TỪ TRÁI → PHẢI */
.loading-bar-inner {
    height: 100%;
    background: #047a47;
    box-shadow:
        0 0 10px #047a47,
        0 0 5px #047a47;
    width: 0%; /* bắt đầu từ 0 */
    animation: loading-bar-grow 1.2s ease-out forwards;
}

/* Animation: thanh dần dần dài ra, rồi giữ khoảng 80–90% chiều rộng */
@keyframes loading-bar-grow {
    0% {
        width: 0%;
    }
    50% {
        width: 60%;
    }
    80% {
        width: 85%;
    }
    100% {
        width: 90%;
    }
}

/* Hiệu ứng fade in/out tổng thể */
.loading-bar-fade-enter-active,
.loading-bar-fade-leave-active {
    transition: opacity 0.15s ease;
}

.loading-bar-fade-enter-from,
.loading-bar-fade-leave-to {
    opacity: 0;
}
</style>
