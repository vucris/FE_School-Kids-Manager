<script setup>
import { useRoute, useRouter } from 'vue-router';

const route = useRoute();
const router = useRouter();

const tabs = [
    {
        label: 'Điểm danh đến',
        name: 'AttendanceCheckIn',
        to: { name: 'AttendanceCheckIn' }
    },
    {
        label: 'Điểm danh về',
        name: 'AttendanceCheckOut',
        to: { name: 'AttendanceCheckOut' }
    },
    {
        label: 'Đơn xin nghỉ',
        name: 'AttendanceLeave', // nếu chưa có view thì tạm thời comment tab này
        to: { name: 'AttendanceLeave' }
    }
];

function isActive(tab) {
    return route.name === tab.name;
}
function go(tab) {
    if (!isActive(tab)) {
        router.push(tab.to);
    }
}
</script>

<template>
    <div class="attendance-tabs">
        <button v-for="tab in tabs" :key="tab.name" type="button" class="tab" :class="{ active: isActive(tab) }" @click="go(tab)">
            {{ tab.label }}
        </button>
    </div>
</template>

<style scoped>
.attendance-tabs {
    display: flex;
    gap: 32px;
    border-bottom: 1px solid #e5e7eb;
    margin-bottom: 16px;
}
.tab {
    padding: 8px 0;
    font-weight: 600;
    font-size: 15px;
    color: #374151;
    border: none;
    background: transparent;
    cursor: pointer;
    position: relative;
}
.tab.active {
    color: #2563eb;
}
.tab.active::after {
    content: '';
    position: absolute;
    left: 0;
    right: 0;
    bottom: -1px;
    height: 2px;
    background: #2563eb;
}
</style>
