<template>
  <div class="prod-cal" :style="rootCssVars">
    <!-- ─── CALENDAR HEADER ─── -->
    <div class="cal-header">
      <button class="cal-nav-btn" @click="prevYear" title="Previous year">&laquo;</button>
      <button class="cal-nav-btn" @click="prevMonth" title="Previous month">&lsaquo;</button>
      <span class="cal-month-label">{{ monthLabel }} {{ currentYear }}</span>
      <button class="cal-nav-btn" @click="nextMonth" title="Next month">&rsaquo;</button>
      <button class="cal-nav-btn" @click="nextYear" title="Next year">&raquo;</button>
      <button class="cal-nav-btn cal-today-btn" @click="goToday">Today</button>
    </div>

    <!-- ─── DAY-OF-WEEK ROW ─── -->
    <div class="cal-dow-row">
      <div v-for="d in DOW" :key="d" class="cal-dow-cell">{{ d }}</div>
    </div>

    <!-- ─── CALENDAR GRID ─── -->
    <div class="cal-grid" ref="gridRef">
      <!-- Day cells -->
      <div
        v-for="day in calendarDays"
        :key="day.dateStr"
        class="cal-day-cell"
        :class="{
          'cal-day--outside': day.outside,
          'cal-day--weekend': day.isWeekend,
          'cal-day--today': day.isToday,
        }"
        :data-date="day.dateStr"
        @mouseenter="handleDayHover(day)"
        @mousedown="handleDayMousedown($event, day)"
      >
        <div class="cal-day-header">
          <span class="cal-day-num">{{ day.dayNum }}</span>
          <span v-if="day.dayNum === 1 || day.idx === 0" class="cal-day-month">{{ day.monthShort }}</span>
          <span class="cal-cap-badges">
            <span class="cal-cap-badge cal-cap--uv" :class="{ 'cal-cap--over': uvUsed(day) > uvTotal(day) }">
              UV {{ uvUsed(day) }}/{{ uvTotal(day) }}
            </span>
            <span class="cal-cap-badge cal-cap--laser" :class="{ 'cal-cap--over': laserUsed(day) > laserTotal(day) }">
              L {{ laserUsed(day) }}/{{ laserTotal(day) }}
            </span>
          </span>
        </div>
        <!-- capacity override indicator -->
        <div v-if="getCapacityOverrides(day.dateStr).length" class="cal-cap-overrides">
          <span v-for="ov in getCapacityOverrides(day.dateStr)" :key="ov.id" class="cal-cap-override-tag">
            {{ ov.title }}
          </span>
        </div>
      </div>

      <!-- Job bars overlay -->
      <div class="cal-jobs-layer" :style="jobsLayerStyle">
        <div
          v-for="seg in allSegments"
          :key="seg.key"
          class="cal-job-bar"
          :class="{
            'cal-job--selected': seg.jobId === selectedJobId,
            'cal-job--draft': seg.isDraft,
            'cal-job--faded': isDrafting && !seg.isDraft,
            'cal-job--uv': seg.type === 'uv',
            'cal-job--laser': seg.type === 'laser',
            'cal-job--first': seg.isFirst,
            'cal-job--last': seg.isLast,
          }"
          :style="segmentStyle(seg)"
          @click.stop="selectJob(seg.jobId, seg.isDraft)"
          @mousedown.stop="handleJobMousedown($event, seg)"
        >
          <div
            v-if="seg.isDraft && seg.isFirst"
            class="cal-resize-handle cal-resize--left"
            @mousedown.stop="handleResizeStart($event, 'left')"
          ></div>
          <span v-if="seg.isFirst" class="cal-job-title">{{ seg.title }}</span>
          <span v-if="seg.isLast" class="cal-job-qty">{{ seg.totalQty }}</span>
          <div
            v-if="seg.isDraft && seg.isLast"
            class="cal-resize-handle cal-resize--right"
            @mousedown.stop="handleResizeStart($event, 'right')"
          ></div>
        </div>
      </div>
    </div>

    <!-- ─── BOTTOM PANEL ─── -->
    <div class="cal-panel">
      <div class="cal-tab-bar">
        <button
          v-for="tab in TABS"
          :key="tab.key"
          class="cal-tab"
          :class="{ 'cal-tab--active': activeTab === tab.key }"
          @click="switchTab(tab.key)"
        >{{ tab.label }}</button>
      </div>

      <div class="cal-tab-body">
        <!-- ═══ MANAGE JOB ═══ -->
        <div v-if="activeTab === 'manage'" class="cal-tab-content">
          <div v-if="!selectedJobData" class="cal-empty-tab">
            Click a job on the calendar to view details.
          </div>
          <template v-else>
            <div class="cal-detail-grid">
              <div class="edit-field">
                <span class="edit-label">Title</span>
                <span class="edit-value">{{ selectedJobData.title }}</span>
              </div>
              <div class="edit-field">
                <span class="edit-label">Type</span>
                <span class="edit-value type-tag" :class="'type-tag--' + selectedJobData.type">
                  {{ selectedJobData.type === 'uv' ? 'UV' : 'Laser' }}
                </span>
              </div>
              <div class="edit-field">
                <span class="edit-label">Quantity</span>
                <span class="edit-value">{{ selectedJobData.quantity }}</span>
              </div>
              <div class="edit-field">
                <span class="edit-label">Start Date</span>
                <span class="edit-value">{{ formatDateDisplay(selectedJobData.startDate) }}</span>
              </div>
              <div class="edit-field">
                <span class="edit-label">End Date</span>
                <span class="edit-value">{{ formatDateDisplay(selectedJobData.endDate) }}</span>
              </div>
              <div class="edit-field">
                <span class="edit-label">Status</span>
                <span class="edit-value">{{ selectedJobData.status || 'Active' }}</span>
              </div>
            </div>

            <div class="section-heading">Milestones</div>
            <div class="cal-milestones">
              <div v-for="ms in MILESTONE_TYPES" :key="ms.key" class="cal-milestone-row">
                <span class="edit-label milestone-label">{{ ms.label }}</span>
                <input
                  type="date"
                  class="edit-input milestone-input"
                  :value="milestoneValues[ms.key] || ''"
                  @change="handleMilestoneChange(ms.key, $event.target.value)"
                />
              </div>
            </div>

            <div class="cal-detail-actions">
              <button class="btn-action btn-action--danger" @click="emitJobDelete">Delete Job</button>
            </div>
          </template>
        </div>

        <!-- ═══ NEW JOB ═══ -->
        <div v-if="activeTab === 'new'" class="cal-tab-content">
          <div class="cal-form-grid">
            <div class="edit-field">
              <label class="edit-label">Title</label>
              <input class="edit-input" v-model="draftJob.title" placeholder="Job title" />
            </div>
            <div class="edit-field">
              <label class="edit-label">Type</label>
              <select class="edit-select" v-model="draftJob.type">
                <option value="uv">UV</option>
                <option value="laser">Laser</option>
              </select>
            </div>
            <div class="edit-field">
              <label class="edit-label">Quantity</label>
              <input class="edit-input" type="number" v-model.number="draftJob.quantity" min="1" />
            </div>
            <div class="edit-field">
              <label class="edit-label">Start Date</label>
              <input class="edit-input" type="date" v-model="draftJob.startDate" />
            </div>
            <div class="edit-field">
              <label class="edit-label">Computed End Date</label>
              <span class="cal-computed-value">{{ draftEndDate || '–' }}</span>
            </div>
            <div class="edit-field">
              <label class="edit-label">Days Required</label>
              <span class="cal-computed-value">{{ draftDaysRequired }}</span>
            </div>
          </div>
          <div class="cal-draft-hint" v-if="draftJob.startDate">
            Drag the preview bar on the calendar to change start date. Resize edges to spread over more days.
          </div>
          <div class="cal-form-actions">
            <button class="btn-action btn-action--muted" @click="cancelDraft">Cancel</button>
            <button class="btn-action btn-action--submit" :disabled="!canSubmitDraft" @click="submitDraft">
              Create Job
            </button>
          </div>
        </div>

        <!-- ═══ MANAGE CAPACITY ═══ -->
        <div v-if="activeTab === 'capacity'" class="cal-tab-content">
          <div class="section-heading">Add Capacity Rule</div>
          <div class="cal-form-grid">
            <div class="edit-field">
              <label class="edit-label">Title</label>
              <input class="edit-input" v-model="capForm.title" placeholder="e.g. Ramadan Break" />
            </div>
            <div class="edit-field">
              <label class="edit-label">Rule Type</label>
              <select class="edit-select" v-model="capForm.ruleType">
                <option value="default">Default (Monthly)</option>
                <option value="general">General (Date Range)</option>
              </select>
            </div>
            <div class="edit-field">
              <label class="edit-label">Customization Type</label>
              <select class="edit-select" v-model="capForm.custType">
                <option value="uv">UV</option>
                <option value="laser">Laser</option>
              </select>
            </div>
            <div class="edit-field">
              <label class="edit-label">Capacity / Day</label>
              <input class="edit-input" type="number" v-model.number="capForm.quantity" min="0" />
            </div>
            <template v-if="capForm.ruleType === 'default'">
              <div class="edit-field">
                <label class="edit-label">Month</label>
                <input class="edit-input" type="month" v-model="capForm.month" />
              </div>
            </template>
            <template v-else>
              <div class="edit-field">
                <label class="edit-label">Start Date</label>
                <input class="edit-input" type="date" v-model="capForm.startDate" />
              </div>
              <div class="edit-field">
                <label class="edit-label">End Date</label>
                <input class="edit-input" type="date" v-model="capForm.endDate" />
              </div>
            </template>
          </div>
          <div class="cal-form-actions">
            <button class="btn-action btn-action--primary" :disabled="!canSubmitCapacity" @click="submitCapacity">
              Add Rule
            </button>
          </div>

          <div class="section-heading cap-list-heading">Existing Rules</div>
          <div v-if="!resolvedCapacity.length" class="cal-empty-tab">No capacity rules configured.</div>
          <div v-else class="cal-cap-list">
            <div v-for="rule in resolvedCapacity" :key="rule.id" class="cal-cap-item">
              <span class="cal-cap-title">{{ rule.title || '(untitled)' }}</span>
              <span class="cal-cap-type-tag" :class="'type-tag--' + (rule.custType || 'uv')">
                {{ (rule.custType || 'uv') === 'uv' ? 'UV' : 'Laser' }}
              </span>
              <span class="cal-cap-meta">
                {{ rule.ruleType === 'default' ? rule.month : formatDateDisplay(rule.startDate) + ' → ' + formatDateDisplay(rule.endDate) }}
              </span>
              <span class="cal-cap-qty">{{ rule.quantity }}/day</span>
              <button class="btn-icon btn-icon--danger" @click="emitCapacityDelete(rule.id)" title="Delete rule">×</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, reactive, computed, onBeforeUnmount } from 'vue';

const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const MONTH_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const DOW = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
const TABS = [
  { key: 'manage', label: 'Manage Job' },
  { key: 'new', label: 'New Job' },
  { key: 'capacity', label: 'Manage Capacity' },
];
const MILESTONE_TYPES = [
  { key: 'job_created', label: 'Job Created' },
  { key: 'stock_arrived', label: 'Stock Arrived' },
  { key: 'production_start', label: 'Production Start' },
];

// ─── Date Utilities ───
function parseDate(str) {
  if (!str) return null;
  const [y, m, d] = str.split('-').map(Number);
  return new Date(y, m - 1, d);
}
function toDateStr(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function isWeekend(d) {
  const dow = d.getDay();
  return dow === 0 || dow === 6;
}
function nextDay(d) {
  const n = new Date(d);
  n.setDate(n.getDate() + 1);
  return n;
}
function nextWorkday(d) {
  let c = nextDay(d);
  while (isWeekend(c)) c = nextDay(c);
  return c;
}
function prevWorkday(d) {
  let c = new Date(d);
  c.setDate(c.getDate() - 1);
  while (isWeekend(c)) c.setDate(c.getDate() - 1);
  return c;
}
function countWorkdays(from, to) {
  let count = 0;
  let c = new Date(from);
  while (c <= to) {
    if (!isWeekend(c)) count++;
    c = nextDay(c);
  }
  return count;
}
function formatDateNice(str) {
  if (!str) return '–';
  const d = parseDate(str);
  if (!d) return '–';
  return `${d.getDate()} ${MONTH_SHORT[d.getMonth()]} ${d.getFullYear()}`;
}

// Default job colors (cycle through if no color set)
const JOB_COLORS_UV = ['#3b82f6', '#2563eb', '#1d4ed8', '#60a5fa', '#93c5fd'];
const JOB_COLORS_LASER = ['#7c3aed', '#6d28d9', '#5b21b6', '#8b5cf6', '#a78bfa'];

export default {
  props: {
    content: { type: Object, required: true },
    uid: { type: String, required: true },
    /* wwEditor:start */
    wwEditorState: { type: Object, required: true },
    /* wwEditor:end */
  },
  emits: ['trigger-event'],
  setup(props, { emit }) {
    // ─── DATA RESOLUTION ───
    const resolvedJobs = computed(() => {
      const raw = wwLib.wwUtils.getDataFromCollection(props.content?.jobsData);
      return Array.isArray(raw) ? raw : [];
    });
    const resolvedCapacity = computed(() => {
      const raw = wwLib.wwUtils.getDataFromCollection(props.content?.capacityData);
      return Array.isArray(raw) ? raw : [];
    });
    const defaultUvCap = computed(() => props.content?.defaultUvCapacity ?? 100);
    const defaultLaserCap = computed(() => props.content?.defaultLaserCapacity ?? 50);

    // ─── NAV STATE ───
    const now = new Date();
    const todayStr = toDateStr(now);
    const currentMonth = ref(now.getMonth());
    const currentYear = ref(now.getFullYear());
    const activeTab = ref('manage');
    const selectedJobId = ref(null);
    const gridRef = ref(null);

    const monthLabel = computed(() => MONTH_NAMES[currentMonth.value]);

    // ─── CALENDAR DAYS ───
    const calendarDays = computed(() => {
      const first = new Date(currentYear.value, currentMonth.value, 1);
      // Monday = 1, find offset. JS getDay: 0=Sun, 1=Mon...6=Sat
      let startDow = first.getDay();
      // Convert to Mon=0 system: Mon=0, Tue=1, ..., Sun=6
      startDow = (startDow + 6) % 7;
      const startDate = new Date(first);
      startDate.setDate(startDate.getDate() - startDow);

      const days = [];
      for (let i = 0; i < 42; i++) {
        const d = new Date(startDate);
        d.setDate(startDate.getDate() + i);
        const ds = toDateStr(d);
        const dow = d.getDay();
        days.push({
          date: new Date(d),
          dateStr: ds,
          dayNum: d.getDate(),
          monthShort: MONTH_SHORT[d.getMonth()],
          isWeekend: dow === 0 || dow === 6,
          isToday: ds === todayStr,
          outside: d.getMonth() !== currentMonth.value,
          weekIndex: Math.floor(i / 7),
          dayIndex: i % 7,
          idx: i,
        });
      }
      return days;
    });

    // ─── CAPACITY SYSTEM ───
    function getCapacityForDate(dateStr, type) {
      let cap = type === 'uv' ? defaultUvCap.value : defaultLaserCap.value;
      const monthStr = dateStr.substring(0, 7);

      for (const rule of resolvedCapacity.value) {
        if (rule.ruleType === 'default' && rule.month === monthStr && (rule.custType || 'uv') === type) {
          cap = Number(rule.quantity) || 0;
        }
      }
      for (const rule of resolvedCapacity.value) {
        if (rule.ruleType === 'general' && dateStr >= rule.startDate && dateStr <= rule.endDate && (rule.custType || 'uv') === type) {
          cap = Number(rule.quantity) || 0;
        }
      }
      return cap;
    }

    function getCapacityOverrides(dateStr) {
      return resolvedCapacity.value.filter(
        r => r.ruleType === 'general' && dateStr >= r.startDate && dateStr <= r.endDate
      );
    }

    function uvUsed(day) {
      return (allAllocations.value[day.dateStr] || [])
        .filter(a => a.type === 'uv')
        .reduce((s, a) => s + a.qty, 0);
    }
    function uvTotal(day) { return getCapacityForDate(day.dateStr, 'uv'); }
    function laserUsed(day) {
      return (allAllocations.value[day.dateStr] || [])
        .filter(a => a.type === 'laser')
        .reduce((s, a) => s + a.qty, 0);
    }
    function laserTotal(day) { return getCapacityForDate(day.dateStr, 'laser'); }

    // ─── JOB ALLOCATION ENGINE ───
    function allocateJobs(jobs, extraJob) {
      const allocMap = {};
      const jobEndDates = {};

      const sorted = [...jobs].sort((a, b) => (a.startDate || '').localeCompare(b.startDate || ''));
      if (extraJob) sorted.push(extraJob);

      for (const job of sorted) {
        if (!job.startDate || !job.quantity || job.quantity <= 0) continue;
        let remaining = Number(job.quantity);
        let current = parseDate(job.startDate);
        if (!current) continue;

        const maxDays = job._maxDays || 0;
        const totalQty = remaining;
        let dayCount = 0;
        let safety = 0;

        while (remaining > 0 && safety < 3650) {
          safety++;
          if (isWeekend(current)) { current = nextDay(current); continue; }

          const ds = toDateStr(current);
          const totalCap = getCapacityForDate(ds, job.type || 'uv');
          const used = (allocMap[ds] || [])
            .filter(a => a.type === (job.type || 'uv'))
            .reduce((s, a) => s + a.qty, 0);
          const available = Math.max(0, totalCap - used);

          if (available > 0) {
            dayCount++;
            let todayAlloc;
            if (maxDays > 0 && dayCount <= maxDays) {
              // Spread evenly: allocate ceil of remaining / remaining days
              const remainingDays = maxDays - dayCount + 1;
              todayAlloc = Math.min(available, Math.ceil(remaining / remainingDays));
            } else {
              todayAlloc = Math.min(remaining, available);
            }
            if (!allocMap[ds]) allocMap[ds] = [];
            allocMap[ds].push({ jobId: job.id || '__draft__', type: job.type || 'uv', qty: todayAlloc, title: job.title || '' });
            remaining -= todayAlloc;
          } else if (totalCap === 0) {
            // Skip zero-capacity days
          }

          current = nextDay(current);
        }

        // Find end date
        let endDate = job.startDate;
        for (const ds in allocMap) {
          if ((allocMap[ds] || []).some(a => a.jobId === (job.id || '__draft__'))) {
            if (ds > endDate) endDate = ds;
          }
        }
        jobEndDates[job.id || '__draft__'] = endDate;
      }

      return { allocMap, jobEndDates };
    }

    // Base allocations (existing jobs only)
    const baseResult = computed(() => allocateJobs(resolvedJobs.value, null));

    // ─── DRAFT JOB STATE ───
    const draftJob = reactive({
      title: '',
      type: 'uv',
      quantity: 100,
      startDate: '',
      _maxDays: 0,
    });
    const isDrafting = computed(() => activeTab.value === 'new');

    // Full allocations (existing + draft if applicable)
    const fullResult = computed(() => {
      if (!isDrafting.value || !draftJob.startDate || !draftJob.quantity) {
        return baseResult.value;
      }
      return allocateJobs(resolvedJobs.value, {
        id: '__draft__',
        title: draftJob.title || 'New Job',
        type: draftJob.type,
        quantity: draftJob.quantity,
        startDate: draftJob.startDate,
        _maxDays: draftJob._maxDays,
      });
    });

    const allAllocations = computed(() => fullResult.value.allocMap);
    const draftEndDate = computed(() => {
      const ed = fullResult.value.jobEndDates['__draft__'];
      return ed ? formatDateNice(ed) : '';
    });
    const draftEndDateRaw = computed(() => fullResult.value.jobEndDates['__draft__'] || '');
    const draftDaysRequired = computed(() => {
      if (!draftEndDateRaw.value || !draftJob.startDate) return '–';
      const s = parseDate(draftJob.startDate);
      const e = parseDate(draftEndDateRaw.value);
      if (!s || !e) return '–';
      return countWorkdays(s, e);
    });
    const canSubmitDraft = computed(() =>
      draftJob.title && draftJob.type && draftJob.quantity > 0 && draftJob.startDate
    );

    // ─── JOB SEGMENT RENDERING ───
    const allSegments = computed(() => {
      const allocMap = allAllocations.value;
      const days = calendarDays.value;
      const dateToPos = {};
      for (const day of days) {
        dateToPos[day.dateStr] = { weekIndex: day.weekIndex, dayIndex: day.dayIndex };
      }

      // Collect all job IDs that have allocations in visible range
      const jobSet = new Map();
      for (const day of days) {
        const allocs = allocMap[day.dateStr] || [];
        for (const a of allocs) {
          if (!jobSet.has(a.jobId)) {
            const job = resolvedJobs.value.find(j => j.id === a.jobId);
            jobSet.set(a.jobId, {
              id: a.jobId,
              title: a.title || job?.title || '',
              type: a.type,
              color: job?.color || '',
              totalQty: job?.quantity || draftJob.quantity || 0,
              isDraft: a.jobId === '__draft__',
            });
          }
        }
      }

      // For each job, find which visible days it occupies, group into continuous weekday runs per week row
      const segments = [];
      let segIdx = 0;

      // Row stacking: track used rows per week
      const weekRows = {}; // weekIndex -> array of { startCol, endCol, rowIdx }

      // Sort jobs: existing first (by start date), draft last
      const jobIds = [...jobSet.keys()].sort((a, b) => {
        if (a === '__draft__') return 1;
        if (b === '__draft__') return -1;
        return 0;
      });

      for (const jobId of jobIds) {
        const jobInfo = jobSet.get(jobId);
        // Find all visible day positions for this job
        const positions = [];
        for (const day of days) {
          const allocs = allocMap[day.dateStr] || [];
          const jobAlloc = allocs.find(a => a.jobId === jobId);
          if (jobAlloc && !day.isWeekend) {
            positions.push({
              dateStr: day.dateStr,
              weekIndex: day.weekIndex,
              dayIndex: day.dayIndex,
              qty: jobAlloc.qty,
            });
          }
        }

        if (!positions.length) continue;

        // Group into continuous runs within same week
        const runs = [];
        let currentRun = null;
        for (const pos of positions) {
          if (!currentRun || pos.weekIndex !== currentRun.weekIndex || pos.dayIndex !== currentRun.endCol + 1) {
            // Check for weekend gap within same week (e.g., Fri -> next week Mon is different weekIndex)
            if (currentRun) runs.push(currentRun);
            currentRun = {
              weekIndex: pos.weekIndex,
              startCol: pos.dayIndex,
              endCol: pos.dayIndex,
              dailyQtys: [pos.qty],
            };
          } else {
            currentRun.endCol = pos.dayIndex;
            currentRun.dailyQtys.push(pos.qty);
          }
        }
        if (currentRun) runs.push(currentRun);

        // Assign row indices per week (greedy stacking)
        for (const run of runs) {
          if (!weekRows[run.weekIndex]) weekRows[run.weekIndex] = [];
          let rowIdx = 0;
          while (true) {
            const conflict = weekRows[run.weekIndex].some(
              r => r.rowIdx === rowIdx && !(run.endCol < r.startCol || run.startCol > r.endCol)
            );
            if (!conflict) break;
            rowIdx++;
          }
          weekRows[run.weekIndex].push({ startCol: run.startCol, endCol: run.endCol, rowIdx });

          const isFirstRun = run === runs[0];
          const isLastRun = run === runs[runs.length - 1];
          const color = jobInfo.color || (jobInfo.type === 'laser'
            ? JOB_COLORS_LASER[segIdx % JOB_COLORS_LASER.length]
            : JOB_COLORS_UV[segIdx % JOB_COLORS_UV.length]);

          segments.push({
            key: `${jobId}-${run.weekIndex}-${run.startCol}`,
            jobId,
            title: jobInfo.title,
            type: jobInfo.type,
            totalQty: jobInfo.totalQty,
            color,
            isDraft: jobInfo.isDraft,
            isFirst: isFirstRun,
            isLast: isLastRun,
            weekIndex: run.weekIndex,
            startCol: run.startCol,
            endCol: run.endCol,
            rowIndex: rowIdx,
            dailyQtys: run.dailyQtys,
          });
        }
        segIdx++;
      }

      return segments;
    });

    // ─── SEGMENT POSITIONING ───
    const JOB_BAR_HEIGHT = 20;
    const JOB_BAR_GAP = 2;
    const DAY_HEADER_HEIGHT = 24;

    const jobsLayerStyle = computed(() => ({
      display: 'grid',
      gridTemplateColumns: 'repeat(7, 1fr)',
      gridTemplateRows: `repeat(${Math.max(1, Math.ceil(calendarDays.value.length / 7))}, 1fr)`,
    }));

    function segmentStyle(seg) {
      return {
        gridColumn: `${seg.startCol + 1} / ${seg.endCol + 2}`,
        gridRow: `${seg.weekIndex + 1}`,
        marginTop: `${DAY_HEADER_HEIGHT + seg.rowIndex * (JOB_BAR_HEIGHT + JOB_BAR_GAP)}px`,
        height: `${JOB_BAR_HEIGHT}px`,
        backgroundColor: seg.color,
        borderRadius: `${seg.isFirst ? '3px' : '0'} ${seg.isLast ? '3px' : '0'} ${seg.isLast ? '3px' : '0'} ${seg.isFirst ? '3px' : '0'}`,
      };
    }

    // ─── NAVIGATION ───
    function prevMonth() {
      if (currentMonth.value === 0) { currentMonth.value = 11; currentYear.value--; }
      else currentMonth.value--;
      emitMonthChange();
    }
    function nextMonth() {
      if (currentMonth.value === 11) { currentMonth.value = 0; currentYear.value++; }
      else currentMonth.value++;
      emitMonthChange();
    }
    function prevYear() { currentYear.value--; emitMonthChange(); }
    function nextYear() { currentYear.value++; emitMonthChange(); }
    function goToday() {
      const n = new Date();
      currentMonth.value = n.getMonth();
      currentYear.value = n.getFullYear();
      emitMonthChange();
    }
    function emitMonthChange() {
      emit('trigger-event', {
        name: 'onMonthChange',
        event: { value: { year: currentYear.value, month: currentMonth.value + 1 } },
      });
    }

    // ─── JOB SELECTION ───
    const selectedJobData = computed(() => {
      if (!selectedJobId.value) return null;
      return resolvedJobs.value.find(j => j.id === selectedJobId.value) || null;
    });

    const milestoneValues = reactive({});

    function selectJob(jobId, isDraft) {
      if (isDraft) return;
      selectedJobId.value = jobId;
      activeTab.value = 'manage';
      const job = resolvedJobs.value.find(j => j.id === jobId);
      // Load milestones
      for (const ms of MILESTONE_TYPES) {
        milestoneValues[ms.key] = job?.milestones?.[ms.key] || '';
      }
      emit('trigger-event', { name: 'onJobSelect', event: { value: { jobId } } });
    }

    function handleMilestoneChange(key, value) {
      milestoneValues[key] = value;
      emit('trigger-event', {
        name: 'onMilestoneUpdate',
        event: { value: { jobId: selectedJobId.value, milestoneType: key, date: value } },
      });
    }

    function emitJobDelete() {
      emit('trigger-event', { name: 'onJobDelete', event: { value: { jobId: selectedJobId.value } } });
      selectedJobId.value = null;
    }

    // ─── TAB SWITCHING ───
    function switchTab(key) {
      activeTab.value = key;
      if (key === 'new' && !draftJob.startDate) {
        // Default to next workday
        let d = new Date();
        while (isWeekend(d)) d = nextDay(d);
        draftJob.startDate = toDateStr(d);
      }
      if (key !== 'manage') {
        // Don't clear selection automatically
      }
    }

    // ─── DRAFT JOB METHODS ───
    function cancelDraft() {
      Object.assign(draftJob, { title: '', type: 'uv', quantity: 100, startDate: '', _maxDays: 0 });
      activeTab.value = 'manage';
    }

    function submitDraft() {
      if (!canSubmitDraft.value) return;
      const endDate = draftEndDateRaw.value;
      // Build daily allocation
      const dailyAllocation = [];
      const allocMap = allAllocations.value;
      for (const ds in allocMap) {
        const jobAlloc = (allocMap[ds] || []).find(a => a.jobId === '__draft__');
        if (jobAlloc) {
          dailyAllocation.push({ date: ds, quantity: jobAlloc.qty });
        }
      }
      dailyAllocation.sort((a, b) => a.date.localeCompare(b.date));

      emit('trigger-event', {
        name: 'onJobCreate',
        event: {
          value: {
            title: draftJob.title,
            type: draftJob.type,
            quantity: draftJob.quantity,
            startDate: draftJob.startDate,
            endDate,
            dailyAllocation,
          },
        },
      });
      cancelDraft();
    }

    // ─── DRAG & DROP ───
    const dragState = reactive({
      active: false,
      mode: null, // 'move' | 'resize-left' | 'resize-right'
      origStartDate: '',
      origMaxDays: 0,
    });

    function handleJobMousedown(event, seg) {
      if (!seg.isDraft) return;
      dragState.active = true;
      dragState.mode = 'move';
      dragState.origStartDate = draftJob.startDate;
      document.addEventListener('mousemove', onDragMove);
      document.addEventListener('mouseup', onDragEnd);
      event.preventDefault();
    }

    function handleResizeStart(event, direction) {
      dragState.active = true;
      dragState.mode = direction === 'left' ? 'resize-left' : 'resize-right';
      dragState.origStartDate = draftJob.startDate;
      dragState.origMaxDays = draftJob._maxDays;
      document.addEventListener('mousemove', onDragMove);
      document.addEventListener('mouseup', onDragEnd);
      event.preventDefault();
    }

    function handleDayHover(day) {
      // Visual feedback only during drag
    }

    function handleDayMousedown(event, day) {
      if (!isDrafting.value) return;
      if (day.isWeekend || day.outside) return;
      // Clicking a day sets the start date for new job
      draftJob.startDate = day.dateStr;
    }

    function onDragMove(event) {
      if (!dragState.active) return;
      const el = document.elementFromPoint(event.clientX, event.clientY);
      if (!el) return;
      const dayCell = el.closest('.cal-day-cell');
      if (!dayCell) return;
      const dateStr = dayCell.dataset.date;
      if (!dateStr) return;
      const d = parseDate(dateStr);
      if (!d || isWeekend(d)) return;

      if (dragState.mode === 'move') {
        draftJob.startDate = dateStr;
        draftJob._maxDays = 0; // Reset spread when moving
      } else if (dragState.mode === 'resize-right') {
        // Extend end: compute workdays between start and this date
        const start = parseDate(draftJob.startDate);
        if (dateStr >= draftJob.startDate) {
          const wd = countWorkdays(start, d);
          // Minimum days = what's needed at max capacity
          const minDays = computeMinDays(draftJob.quantity, draftJob.type, draftJob.startDate);
          draftJob._maxDays = Math.max(wd, minDays);
        }
      } else if (dragState.mode === 'resize-left') {
        // Move start date earlier/later
        if (dateStr <= draftEndDateRaw.value) {
          draftJob.startDate = dateStr;
          // Recompute max days to maintain same end
          const end = parseDate(draftEndDateRaw.value);
          if (end) {
            const wd = countWorkdays(d, end);
            const minDays = computeMinDays(draftJob.quantity, draftJob.type, dateStr);
            draftJob._maxDays = Math.max(wd, minDays);
          }
        }
      }
    }

    function onDragEnd() {
      dragState.active = false;
      document.removeEventListener('mousemove', onDragMove);
      document.removeEventListener('mouseup', onDragEnd);
    }

    function computeMinDays(quantity, type, startDate) {
      // Minimum days needed if filling to max capacity each day
      let remaining = quantity;
      let current = parseDate(startDate);
      if (!current) return 1;
      let days = 0;
      let safety = 0;
      while (remaining > 0 && safety < 3650) {
        safety++;
        if (isWeekend(current)) { current = nextDay(current); continue; }
        const ds = toDateStr(current);
        const totalCap = getCapacityForDate(ds, type);
        // For min days, assume only existing jobs, not the draft itself
        const used = (baseResult.value.allocMap[ds] || [])
          .filter(a => a.type === type)
          .reduce((s, a) => s + a.qty, 0);
        const available = Math.max(0, totalCap - used);
        if (available > 0) {
          remaining -= available;
          days++;
        }
        current = nextDay(current);
      }
      return Math.max(1, days);
    }

    // Cleanup
    onBeforeUnmount(() => {
      document.removeEventListener('mousemove', onDragMove);
      document.removeEventListener('mouseup', onDragEnd);
    });

    // ─── CAPACITY FORM ───
    const capForm = reactive({
      title: '',
      ruleType: 'default',
      custType: 'uv',
      quantity: 100,
      month: '',
      startDate: '',
      endDate: '',
    });

    const canSubmitCapacity = computed(() => {
      if (!capForm.custType || capForm.quantity < 0) return false;
      if (capForm.ruleType === 'default') return !!capForm.month;
      return !!(capForm.startDate && capForm.endDate && capForm.startDate <= capForm.endDate);
    });

    function submitCapacity() {
      if (!canSubmitCapacity.value) return;
      emit('trigger-event', {
        name: 'onCapacityCreate',
        event: {
          value: {
            title: capForm.title,
            ruleType: capForm.ruleType,
            custType: capForm.custType,
            quantity: capForm.quantity,
            startDate: capForm.ruleType === 'general' ? capForm.startDate : '',
            endDate: capForm.ruleType === 'general' ? capForm.endDate : '',
            month: capForm.ruleType === 'default' ? capForm.month : '',
          },
        },
      });
      Object.assign(capForm, { title: '', ruleType: 'default', custType: 'uv', quantity: 100, month: '', startDate: '', endDate: '' });
    }

    function emitCapacityDelete(capacityId) {
      emit('trigger-event', { name: 'onCapacityDelete', event: { value: { capacityId } } });
    }

    // ─── FORMATTING ───
    function formatDateDisplay(str) { return formatDateNice(str); }

    // ─── CSS VARS ───
    const rootCssVars = computed(() => ({
      '--cal-header-bg': props.content?.colorHeaderBg || '#1e293b',
      '--cal-weekend-bg': props.content?.colorWeekendBg || '#f9fafb',
      '--cal-accent': props.content?.colorAccent || '#3b82f6',
      '--cal-border': props.content?.colorGridBorder || '#e5e7eb',
      '--cal-uv-color': props.content?.colorUvDefault || '#3b82f6',
      '--cal-laser-color': props.content?.colorLaserDefault || '#7c3aed',
    }));

    return {
      // Constants
      DOW, TABS, MILESTONE_TYPES,
      // State
      currentMonth, currentYear, monthLabel, activeTab, selectedJobId,
      gridRef,
      // Calendar
      calendarDays,
      // Capacity
      resolvedCapacity,
      getCapacityOverrides,
      uvUsed, uvTotal, laserUsed, laserTotal,
      // Allocations
      allAllocations, allSegments,
      // Segments
      segmentStyle, jobsLayerStyle,
      JOB_BAR_HEIGHT, JOB_BAR_GAP,
      // Navigation
      prevMonth, nextMonth, prevYear, nextYear, goToday,
      // Selection
      selectedJobData, milestoneValues,
      selectJob, handleMilestoneChange, emitJobDelete,
      // Draft
      draftJob, isDrafting, draftEndDate, draftDaysRequired, canSubmitDraft,
      cancelDraft, submitDraft, switchTab,
      // Drag
      dragState,
      handleJobMousedown, handleResizeStart,
      handleDayHover, handleDayMousedown,
      // Capacity form
      capForm, canSubmitCapacity, submitCapacity, emitCapacityDelete,
      // Formatting
      formatDateDisplay,
      // CSS
      rootCssVars,
    };
  },
};
</script>

<style lang="scss" scoped>
// ─── DESIGN TOKENS ───
$blue: #3b82f6;
$blue-dark: #2563eb;
$blue-50: #eff6ff;
$purple: #7c3aed;
$purple-50: #f5f3ff;
$green: #059669;
$green-50: #ecfdf5;
$red: #ef4444;
$red-50: #fef2f2;
$amber: #f59e0b;
$amber-50: #fffbeb;
$gray-900: #111827;
$gray-800: #1f2937;
$gray-700: #374151;
$gray-600: #4b5563;
$gray-500: #6b7280;
$gray-400: #9ca3af;
$gray-300: #d1d5db;
$gray-200: #e5e7eb;
$gray-100: #f3f4f6;
$gray-50: #f9fafb;
$white: #ffffff;

// ─── ROOT ───
.prod-cal {
  display: flex;
  flex-direction: column;
  width: 100%;
  min-height: 100%;
  background: $gray-100;
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  font-size: 12px;
  color: $gray-900;
  box-sizing: border-box;
  line-height: 1.4;
  *, *::before, *::after { box-sizing: border-box; }
}

// ─── CALENDAR HEADER ───
.cal-header {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 8px 12px;
  background: var(--cal-header-bg, #1e293b);
  color: $white;
  user-select: none;
}
.cal-month-label {
  font-size: 13px;
  font-weight: 700;
  min-width: 140px;
  text-align: center;
}
.cal-nav-btn {
  padding: 4px 10px;
  font-size: 12px;
  font-weight: 600;
  font-family: inherit;
  background: rgba(255,255,255,0.08);
  border: 1px solid rgba(255,255,255,0.12);
  color: $white;
  cursor: pointer;
  border-radius: 3px;
  transition: background 0.12s;
  &:hover { background: rgba(255,255,255,0.18); }
}
.cal-today-btn { margin-left: auto; }

// ─── DAY-OF-WEEK ROW ───
.cal-dow-row {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  background: $gray-50;
  border-bottom: 1px solid var(--cal-border);
}
.cal-dow-cell {
  padding: 5px 8px;
  font-size: 9px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: $gray-500;
  text-align: center;
}

// ─── CALENDAR GRID ───
.cal-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  position: relative;
  background: $white;
  flex: 1;
}
.cal-day-cell {
  min-height: 80px;
  border-right: 1px solid var(--cal-border);
  border-bottom: 1px solid var(--cal-border);
  position: relative;
  cursor: default;
  &:nth-child(7n) { border-right: none; }
}
.cal-day--outside {
  opacity: 0.3;
  pointer-events: none;
}
.cal-day--weekend {
  background: var(--cal-weekend-bg, $gray-50);
}
.cal-day--today .cal-day-num {
  color: var(--cal-accent, $blue);
  font-weight: 800;
}

.cal-day-header {
  display: flex;
  align-items: center;
  gap: 3px;
  padding: 2px 5px;
  border-bottom: 1px solid $gray-100;
  min-height: 22px;
}
.cal-day-num {
  font-size: 11px;
  font-weight: 600;
  color: $gray-700;
}
.cal-day-month {
  font-size: 9px;
  font-weight: 600;
  color: $gray-400;
  text-transform: uppercase;
}
.cal-cap-badges {
  display: flex;
  gap: 3px;
  margin-left: auto;
}
.cal-cap-badge {
  font-size: 7px;
  font-weight: 700;
  padding: 1px 3px;
  border-radius: 2px;
  white-space: nowrap;
}
.cal-cap--uv {
  color: var(--cal-uv-color, $blue);
  background: $blue-50;
}
.cal-cap--laser {
  color: var(--cal-laser-color, $purple);
  background: $purple-50;
}
.cal-cap--over {
  color: $red;
  background: $red-50;
}
.cal-cap-overrides {
  padding: 1px 4px;
}
.cal-cap-override-tag {
  font-size: 7px;
  font-weight: 600;
  color: $amber;
  background: $amber-50;
  padding: 0 3px;
  border-radius: 2px;
  margin-right: 2px;
}

// ─── JOB BARS LAYER ───
.cal-jobs-layer {
  position: absolute;
  top: 0; left: 0; right: 0; bottom: 0;
  pointer-events: none;
  z-index: 2;
}
.cal-job-bar {
  display: flex;
  align-items: center;
  padding: 0 5px;
  font-size: 9px;
  font-weight: 600;
  color: $white;
  pointer-events: all;
  cursor: pointer;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  transition: opacity 0.15s ease, filter 0.15s ease;
  position: relative;
  z-index: 3;
  min-width: 0;
  &:hover {
    filter: brightness(1.1);
    z-index: 10;
  }
}
.cal-job--selected {
  outline: 2px solid $gray-900;
  outline-offset: -1px;
  z-index: 8;
}
.cal-job--draft {
  border: 1.5px dashed rgba(255,255,255,0.7);
  opacity: 0.9;
  cursor: grab;
  &:active { cursor: grabbing; }
}
.cal-job--faded {
  opacity: 0.25;
  filter: grayscale(0.5);
}
.cal-job-title {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  min-width: 0;
}
.cal-job-qty {
  font-size: 8px;
  opacity: 0.8;
  margin-left: 4px;
  flex-shrink: 0;
}

// ─── RESIZE HANDLES ───
.cal-resize-handle {
  position: absolute;
  top: 0; bottom: 0;
  width: 7px;
  cursor: ew-resize;
  z-index: 15;
  &::after {
    content: '';
    position: absolute;
    top: 50%;
    transform: translateY(-50%);
    width: 3px;
    height: 10px;
    border-radius: 1px;
    background: rgba(255,255,255,0.6);
  }
}
.cal-resize--left {
  left: 0;
  &::after { left: 2px; }
}
.cal-resize--right {
  right: 0;
  &::after { right: 2px; }
}

// ─── BOTTOM PANEL ───
.cal-panel {
  background: $white;
  border-top: 2px solid $gray-200;
  min-height: 120px;
  max-height: 320px;
  display: flex;
  flex-direction: column;
}
.cal-tab-bar {
  display: flex;
  gap: 0;
  border-bottom: 2px solid $gray-200;
  background: $gray-50;
  flex-shrink: 0;
}
.cal-tab {
  padding: 8px 16px;
  font-size: 11px;
  font-weight: 600;
  font-family: inherit;
  color: $gray-500;
  background: none;
  border: none;
  border-bottom: 2px solid transparent;
  margin-bottom: -2px;
  cursor: pointer;
  transition: color 0.12s, border-color 0.12s;
  &:hover { color: $gray-700; }
}
.cal-tab--active {
  color: var(--cal-accent, $blue);
  border-bottom-color: var(--cal-accent, $blue);
}
.cal-tab-body {
  flex: 1;
  overflow-y: auto;
}
.cal-tab-content {
  padding: 12px 16px;
}
.cal-empty-tab {
  padding: 20px;
  text-align: center;
  color: $gray-400;
  font-size: 11px;
  border: 1px dashed $gray-300;
  border-radius: 4px;
}

// ─── FORMS ───
.cal-form-grid {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 8px;
}
.cal-detail-grid {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 8px;
}
.edit-field {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.edit-label {
  font-size: 9px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: $gray-400;
}
.edit-value {
  font-size: 12px;
  font-weight: 500;
  color: $gray-800;
}
.edit-input {
  padding: 4px 8px;
  font-size: 11px;
  font-family: inherit;
  border: 1px solid $gray-300;
  border-radius: 3px;
  outline: none;
  color: $gray-900;
  background: $white;
  &:focus { border-color: var(--cal-accent, $blue); box-shadow: 0 0 0 1px var(--cal-accent, $blue); }
  &::placeholder { color: $gray-400; }
}
.edit-select {
  padding: 4px 8px;
  font-size: 11px;
  font-family: inherit;
  border: 1px solid $gray-300;
  border-radius: 3px;
  outline: none;
  color: $gray-900;
  background: $white;
  cursor: pointer;
  &:focus { border-color: var(--cal-accent, $blue); }
}

.cal-computed-value {
  font-size: 12px;
  font-weight: 700;
  color: $green;
  padding: 4px 0;
}
.cal-draft-hint {
  font-size: 10px;
  color: $gray-400;
  margin-top: 6px;
  font-style: italic;
}

.cal-form-actions {
  display: flex;
  gap: 6px;
  margin-top: 10px;
  justify-content: flex-end;
}

// ─── BUTTONS ───
.btn-action {
  padding: 5px 14px;
  font-size: 11px;
  font-weight: 600;
  font-family: inherit;
  border: 1px solid $gray-300;
  border-radius: 3px;
  cursor: pointer;
  transition: background 0.12s, color 0.12s;
  &:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
}
.btn-action--primary {
  background: $gray-800;
  color: $white;
  border-color: $gray-800;
  &:hover:not(:disabled) { background: $gray-900; }
}
.btn-action--submit {
  background: $green;
  color: $white;
  border-color: $green;
  &:hover:not(:disabled) { background: darken($green, 5%); }
}
.btn-action--muted {
  background: $gray-100;
  color: $gray-600;
  border-color: $gray-200;
  &:hover:not(:disabled) { background: $gray-200; }
}
.btn-action--danger {
  background: $red-50;
  color: $red;
  border-color: transparent;
  &:hover:not(:disabled) { background: $red; color: $white; }
}
.btn-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  background: none;
  border: none;
  border-radius: 3px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 700;
  color: $gray-400;
  transition: background 0.1s, color 0.1s;
  &:hover { background: $gray-100; color: $gray-600; }
}
.btn-icon--danger {
  &:hover { background: $red-50; color: $red; }
}

// ─── TYPE TAGS ───
.type-tag {
  display: inline-block;
  font-size: 10px;
  font-weight: 700;
  padding: 1px 6px;
  border-radius: 3px;
}
.type-tag--uv {
  color: var(--cal-uv-color, $blue);
  background: $blue-50;
}
.type-tag--laser {
  color: var(--cal-laser-color, $purple);
  background: $purple-50;
}

// ─── SECTION HEADING ───
.section-heading {
  font-size: 9px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: $gray-400;
  margin: 12px 0 6px;
}
.cap-list-heading { margin-top: 16px; }

// ─── MILESTONES ───
.cal-milestones {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.cal-milestone-row {
  display: flex;
  align-items: center;
  gap: 8px;
}
.milestone-label {
  min-width: 110px;
}
.milestone-input {
  max-width: 160px;
}

.cal-detail-actions {
  margin-top: 12px;
  display: flex;
  gap: 8px;
}

// ─── CAPACITY LIST ───
.cal-cap-list {
  display: flex;
  flex-direction: column;
  gap: 3px;
}
.cal-cap-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 5px 8px;
  background: $gray-50;
  border: 1px solid $gray-200;
  border-radius: 3px;
  font-size: 11px;
}
.cal-cap-title {
  font-weight: 600;
  color: $gray-800;
}
.cal-cap-type-tag {
  font-size: 9px;
  font-weight: 700;
  padding: 1px 5px;
  border-radius: 2px;
}
.cal-cap-meta {
  color: $gray-500;
  flex: 1;
}
.cal-cap-qty {
  font-weight: 600;
  color: $gray-700;
}

// ─── RESPONSIVE ───
@media (max-width: 900px) {
  .cal-form-grid, .cal-detail-grid {
    grid-template-columns: 1fr 1fr;
  }
}
@media (max-width: 600px) {
  .cal-form-grid, .cal-detail-grid {
    grid-template-columns: 1fr;
  }
  .cal-cap-badge { font-size: 6px; }
  .cal-header { padding: 6px 8px; }
  .cal-day-cell { min-height: 60px; }
}
</style>
