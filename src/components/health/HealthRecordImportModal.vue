<script setup>
import { ref, computed } from 'vue';
import Dialog from 'primevue/dialog';
import Button from 'primevue/button';
import Tag from 'primevue/tag';

import Swal from 'sweetalert2';

import {
  downloadHealthRecordTemplate,
  importHealthRecordsFromExcel
} from '@/service/healthRecordService.js';

/**
 * props:
 *  - v-model:modelValue : bật/tắt modal
 *  - classId, className : lớp đang chọn
 *  - year, month        : năm / tháng hồ sơ đang xem
 */
const props = defineProps({
  modelValue: { type: Boolean, default: false },
  classId: { type: [Number, String], required: true },
  className: { type: String, default: '' },
  year: { type: Number, required: true },
  month: { type: Number, required: true }
});

const emit = defineEmits(['update:modelValue', 'imported']);

const visible = computed({
  get: () => props.modelValue,
  set: (v) => emit('update:modelValue', v)
});

const file = ref(null);
const uploading = ref(false);
const results = ref([]); // List<HealthRecordExcelDTO>

const swalToast = Swal.mixin({
  toast: true,
  position: 'top-end',
  showConfirmButton: false,
  timer: 2200,
  timerProgressBar: true
});

function onClose() {
  visible.value = false;
  file.value = null;
  results.value = [];
}

function onFileChange(e) {
  const f = e.target?.files?.[0];
  file.value = f || null;
  results.value = [];
}

async function onDownloadTemplate() {
  if (!props.classId) {
    swalToast.fire({ icon: 'info', title: 'Vui lòng chọn lớp trước' });
    return;
  }
  try {
    const blob = await downloadHealthRecordTemplate(props.classId);

    const url = URL.createObjectURL(new Blob([blob]));
    const a = document.createElement('a');
    a.href = url;
    a.download = `mau_suc_khoe_lop_${props.classId}.xlsx`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  } catch (e) {
    swalToast.fire({
      icon: 'error',
      title: e?.message || 'Tải file mẫu thất bại'
    });
  }
}

async function onImport() {
  if (!props.classId) {
    swalToast.fire({ icon: 'info', title: 'Chưa chọn lớp' });
    return;
  }
  if (!props.year || !props.month) {
    swalToast.fire({ icon: 'info', title: 'Thiếu năm / tháng' });
    return;
  }
  if (!file.value) {
    swalToast.fire({ icon: 'info', title: 'Vui lòng chọn file Excel' });
    return;
  }

  uploading.value = true;
  try {
    const data = await importHealthRecordsFromExcel({
      file: file.value,
      classId: props.classId,
      recordYear: props.year,
      recordMonth: props.month
    });

    results.value = data || [];
    emit('imported', results.value);

    const ok = results.value.filter((r) => r.importStatus === 'SUCCESS').length;
    const fail = results.value.length - ok;

    swalToast.fire({
      icon: fail ? 'warning' : 'success',
      title: `Import xong. Thành công: ${ok}, Lỗi: ${fail}`
    });
  } catch (e) {
    swalToast.fire({
      icon: 'error',
      title: e?.message || 'Import hồ sơ sức khỏe thất bại'
    });
  } finally {
    uploading.value = false;
  }
}

function statusSeverity(row) {
  if (row.importStatus === 'SUCCESS') return 'success';
  if (row.importStatus === 'FAILED') return 'danger';
  return 'info';
}
</script>

<template>
  <Dialog
    v-model:visible="visible"
    modal
    :style="{ width: '900px', maxWidth: '95vw' }"
    :draggable="false"
    header="Import hồ sơ sức khỏe từ Excel"
    @hide="onClose"
  >
    <div class="space-y-4">
      <!-- Thông tin lớp / kỳ -->
      <div class="p-3 rounded-xl bg-slate-50 flex flex-wrap items-center gap-3 text-sm">
        <div>
          <div class="font-semibold text-slate-700">
            Lớp:
            <span class="text-primary">
              {{ className || classId }}
            </span>
          </div>
          <div class="text-slate-500">
            Kỳ:
            <span class="font-semibold">
              Tháng {{ month }}/{{ year }}
            </span>
          </div>
        </div>
        <div class="text-xs text-slate-500">
          • Hệ thống sẽ tự tính
          <b>Tháng tuổi</b> và
          <b>BMI</b> từ ngày sinh, cân nặng, chiều cao của học sinh.
        </div>
      </div>

      <!-- Chọn file + nút -->
      <div class="flex flex-wrap items-center gap-3">
        <input
          type="file"
          accept=".xlsx,.xls"
          @change="onFileChange"
          class="border border-slate-300 rounded-lg px-3 py-2 text-sm w-full md:w-auto"
        />

        <Button
          icon="fa-solid fa-cloud-arrow-down mr-2"
          severity="secondary"
          label="Tải file mẫu"
          @click="onDownloadTemplate"
        />

        <Button
          :label="uploading ? 'Đang import...' : 'Import'"
          icon="fa-solid fa-file-import mr-2"
          :disabled="uploading || !file"
          class="btn-primary"
          @click="onImport"
        />
      </div>

      <div class="text-xs text-slate-500">
        • Dòng DEMO trong file mẫu chỉ dùng minh họa, dữ liệu không hợp lệ nên backend sẽ
        <b>không lưu vào DB</b>.<br />
        • Vui lòng đảm bảo <b>Mã học sinh</b> và <b>Lớp</b> khớp với dữ liệu hệ thống.
      </div>

      <!-- Kết quả import -->
      <div v-if="results.length" class="mt-3">
        <div class="flex items-center justify-between mb-2 text-sm">
          <div class="font-semibold text-slate-700">
            Kết quả import ({{ results.length }} dòng)
          </div>
        </div>

        <div class="overflow-auto max-h-[360px] rounded-xl border border-slate-200">
          <table class="min-w-full text-xs">
            <thead class="bg-slate-50 text-slate-600 sticky top-0 z-10">
              <tr>
                <th class="th">#</th>
                <th class="th">Mã HS</th>
                <th class="th">Họ và tên</th>
                <th class="th">Lớp</th>
                <th class="th">Cân nặng</th>
                <th class="th">Chiều cao</th>
                <th class="th">BMI</th>
                <th class="th">Tình trạng</th>
                <th class="th">Trạng thái import</th>
                <th class="th">Lỗi</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="(r, idx) in results"
                :key="idx"
                :class="r.importStatus === 'FAILED' ? 'bg-rose-50/60' : ''"
              >
                <td class="td text-slate-500">{{ idx + 1 }}</td>
                <td class="td font-mono text-xs">{{ r.studentCode }}</td>
                <td class="td">{{ r.studentName }}</td>
                <td class="td">{{ r.className }}</td>
                <td class="td text-right">{{ r.weightKg ?? '' }}</td>
                <td class="td text-right">{{ r.heightCm ?? '' }}</td>
                <td class="td text-right">{{ r.bmi ?? '' }}</td>
                <td class="td">{{ r.nutritionStatus }}</td>
                <td class="td">
                  <Tag
                    :value="r.importStatus || 'N/A'"
                    :severity="statusSeverity(r)"
                  />
                </td>
                <td class="td text-rose-600">
                  {{ r.errorMessage }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Footer -->
      <div class="flex justify-end gap-2 pt-2">
        <Button label="Đóng" severity="secondary" @click="onClose" />
      </div>
    </div>
  </Dialog>
</template>

<style scoped>
.btn-primary {
  background: linear-gradient(135deg, #2563eb, #3b82f6);
  border: 0;
  color: #fff;
}
.th {
  padding: 8px 10px;
  text-align: left;
  font-weight: 600;
  border-bottom: 1px solid #e5e7eb;
  white-space: nowrap;
}
.td {
  padding: 8px 10px;
  border-bottom: 1px solid #e5e7eb;
}
</style>
