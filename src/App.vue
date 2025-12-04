<script setup>
import { onMounted } from 'vue';
import { useToast } from 'primevue/usetoast';
import { setToastImpl } from '@/service/notify';

const toast = useToast();

onMounted(() => {
    // cho helper notify.js mượn hàm toast.add
    setToastImpl((opts) => toast.add(opts));
});
</script>

<template>
    <!-- Nếu chưa có thì thêm Toast ở đây -->
    <Toast />
    <!-- phần còn lại layout -->
    <router-view />
</template>
