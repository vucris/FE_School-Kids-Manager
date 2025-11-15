<template>
    <div id="app">
        <GlobalLoadingBar />
        <router-view />
    </div>
</template>

<script setup>
import GlobalLoadingBar from '@/components/GlobalLoadingBar.vue';
</script>

<style>
/* giữ style cũ của bạn nếu có */
</style>
