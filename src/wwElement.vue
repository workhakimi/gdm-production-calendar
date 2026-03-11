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

    <!-- ─── CALENDAR SCROLL WRAPPER ─── -->
    <div class="cal-scroll">

    <!-- ─── DAY-OF-WEEK ROW ─── -->
    <div class="cal-dow-row">
      <div v-for="d in DOW" :key="d" class="cal-dow-cell">{{ d }}</div>
    </div>

    <!-- ─── CALENDAR GRID ─── -->
    <div class="cal-grid" :class="{ 'cal-grid--dragging': dragState.active }" :style="gridStyle" ref="gridRef">
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
          <span v-if="!day.isWeekend || hasWeekendCapacity(day.dateStr)" class="cal-cap-badges">
            <span class="cal-cap-badge cal-cap--uv" :class="{ 'cal-cap--over': uvUsed(day) > uvTotal(day) }">
              UV {{ uvUsed(day) }}/{{ uvTotal(day) }}
            </span>
            <span class="cal-cap-badge cal-cap--laser" :class="{ 'cal-cap--over': laserUsed(day) > laserTotal(day) }">
              L {{ laserUsed(day) }}/{{ laserTotal(day) }}
            </span>
          </span>
        </div>
        <div v-if="getCapacityOverrides(day.dateStr).length" class="cal-cap-overrides">
          <span v-for="ov in getCapacityOverrides(day.dateStr)" :key="ov.id" class="cal-cap-override-tag">{{ ov.title }}</span>
        </div>
      </div>

      <!-- Job bars overlay -->
      <div class="cal-jobs-layer">
        <div
          v-for="seg in allSegments"
          :key="seg.key"
          class="cal-job-bar"
          :class="{
            'cal-job--selected': !seg.isGap && seg.jobId === selectedJobId,
            'cal-job--draft': seg.isDraft && !seg.isGap,
            'cal-job--editable': !seg.isGap && !seg.isDelay && editMode && seg.jobId === selectedJobId,
            'cal-job--faded': (isDrafting || isRescheduling || (editMode && editLosesPriority)) && !seg.isDraft
              || (editMode && !editLosesPriority && !seg.isGap && !seg.isDelay && seg.jobId !== selectedJobId),
            'cal-job--gap': seg.isGap,
            'cal-job--delay': seg.isDelay,
          }"
          :style="segmentStyle(seg)"
          @click.stop="!seg.isGap && selectJob(seg.jobId, seg.isDraft)"
          @mousedown.stop="!seg.isGap && handleJobMousedown($event, seg)"
        >
          <div v-if="!seg.isGap && !seg.isDelay && (seg.isDraft || (editMode && seg.jobId === selectedJobId)) && seg.isFirst" class="cal-resize-handle cal-resize--left" @mousedown.stop="handleResizeStart($event, 'left')"></div>
          <span v-if="!seg.isGap && seg.showLabel" class="cal-job-title">{{ seg.title }}</span>
          <span v-if="!seg.isGap && (seg.isLast || seg.showLabel)" class="cal-job-qty">{{ seg.totalQty }}</span>
          <div v-if="!seg.isGap && !seg.isDelay && (seg.isDraft || (editMode && seg.jobId === selectedJobId)) && seg.isLast" class="cal-resize-handle cal-resize--right" @mousedown.stop="handleResizeStart($event, 'right')"></div>
          <div v-if="seg.isDelay && seg.isLast && delayMode && seg.jobId === selectedJobId" class="cal-resize-handle cal-resize--right" @mousedown.stop="startDelayStretch($event)"></div>
        </div>
      </div>
    </div>

    </div><!-- /cal-scroll -->

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
          <div v-if="!selectedJobData" class="cal-empty-tab">Click a job on the calendar to view details.</div>
          <template v-else>
            <!-- ── TIMELINE ── -->
            <div class="section-heading">Job Timeline</div>
            <div class="tl-track">
              <div v-for="(step, i) in STAGES" :key="step.key" class="tl-step"
                :class="[
                  'tl-step--' + stageStates[i],
                  { 'tl-step--picked': activeStageIdx === i && activeStageIdx !== jobStageIndex,
                    'tl-step--focus': activeStageIdx === i }
                ]"
                @click="selectStage(i)"
              >
                <div class="tl-bar">
                  <div class="tl-dot"></div>
                  <div v-if="i < STAGES.length - 1" class="tl-line" :class="{ 'tl-line--done': stageStates[i] === 'done' || stageStates[i] === 'warn' }"></div>
                </div>
                <span class="tl-label">{{ stageLabels[i] }}</span>
                <span v-if="stageDates[i]" class="tl-date">{{ stageDates[i] }}</span>
              </div>
            </div>

            <!-- ── STAGE ACTION PANEL ── -->
            <div class="stage-panel">
              <!-- Stage 1: Connected — BD -->
              <template v-if="activeStageIdx === 1">
                <div class="stage-action">
                  <!-- Read-only: show current BD if already connected -->
                  <div v-if="selectedJobData.bd_number && stageEditing !== 1" class="stage-inline">
                    <span class="stage-inline-label">BD#</span>
                    <span class="stage-inline-value">{{ selectedJobData.bd_number }}</span>
                    <button class="btn-action btn-action--muted btn-sm" @click="startStageEdit(1)">Edit</button>
                  </div>
                  <!-- Edit mode: BD search input -->
                  <div v-else class="stage-inline">
                    <span class="stage-inline-label">BD#</span>
                    <div class="bd-select-wrapper bd-select-wrapper--stage">
                      <input class="edit-input edit-input--sm" v-model="stageBdSearch" placeholder="Search..." @focus="stageBdOpen = true" @blur="closeStageBdDropdown" />
                      <div v-if="stageBdOpen && filteredStageBdOptions.length" class="bd-dropdown bd-dropdown--compact">
                        <div v-for="opt in filteredStageBdOptions" :key="opt.bd_number" class="bd-dropdown-item" @mousedown.prevent="selectStageBd(opt)">
                          <span class="bd-opt-num">{{ opt.bd_number }}</span>
                          <span class="bd-opt-cust type-tag type-tag--sm" :class="'type-tag--' + opt.custCategory">{{ opt.customization }}</span>
                          <span class="bd-opt-meta">{{ opt.opid }} · {{ opt.itemCount }} SKUs</span>
                        </div>
                      </div>
                    </div>
                    <span v-if="stageBdSelected" class="bd-pick">
                      {{ stageBdSelected.bd_number }}
                      <button class="bd-pick-x" @click="clearStageBd">×</button>
                    </span>
                    <button class="btn-action btn-action--primary btn-sm" :disabled="!stageBdSelected" @click="submitStageBd">Connect</button>
                    <button v-if="selectedJobData.bd_number" class="btn-action btn-action--muted btn-sm" @click="cancelStageEdit">Cancel</button>
                  </div>
                </div>
              </template>

              <!-- Stage 2: Arrival -->
              <template v-if="activeStageIdx === 2">
                <div class="stage-action">
                  <div v-if="selectedJobData.arrival_date && stageEditing !== 2" class="stage-inline">
                    <span class="stage-inline-label">Arrival</span>
                    <span class="stage-inline-value">{{ fmtDate(selectedJobData.arrival_date) }}</span>
                    <button class="btn-action btn-action--muted btn-sm" @click="startStageEdit(2)">Edit</button>
                  </div>
                  <div v-else class="stage-inline">
                    <span class="stage-inline-label">Arrival</span>
                    <input type="date" class="edit-input edit-input--sm" v-model="stageArrivalDate" />
                    <button class="btn-action btn-action--primary btn-sm" :disabled="!stageArrivalDate" @click="submitArrival">Set</button>
                    <button v-if="selectedJobData.arrival_date" class="btn-action btn-action--muted btn-sm" @click="cancelStageEdit">Cancel</button>
                  </div>
                </div>
              </template>

              <!-- Stage 3: Started -->
              <template v-if="activeStageIdx === 3">
                <div class="stage-action">
                  <div class="stage-inline">
                    <span v-if="!jobHasStarted" class="stage-inline-hint">Pending — starts {{ fmtDate(selectedJobData.startDate) }}</span>
                    <span v-else class="stage-inline-hint stage-inline-hint--active">In progress — ends {{ fmtDate((selectedJobData.endDate || '').split('T')[0]) }}</span>
                  </div>
                </div>
              </template>

              <!-- Stage 4: Complete -->
              <template v-if="activeStageIdx === 4">
                <div class="stage-action">
                  <!-- ── DELAY EXISTS: show delay info + delay time controls ── -->
                  <template v-if="selectedJobData.endDate_delay">
                    <div class="stage-inline">
                      <span class="stage-inline-hint">Computed end date — {{ fmtDate((selectedJobData.endDate || '').split('T')[0]) }}</span>
                    </div>
                    <div v-if="!delayMode" class="stage-inline" style="margin-top:4px">
                      <span class="stage-inline-label delay-tag">Delayed to</span>
                      <span class="stage-inline-value delay-value">{{ fmtDate((selectedJobData.endDate_delay || '').split('T')[0]) }}</span>
                      <span class="stage-inline-hint">{{ selectedJobData.delay_reason }}</span>
                      <button class="btn-action btn-action--muted btn-sm" @click="openDelayMode">Edit</button>
                      <button class="btn-action btn-action--danger btn-sm" @click="removeDelay">Remove</button>
                    </div>
                    <div v-else class="delay-form">
                      <span class="stage-inline-label">Delayed End Date</span>
                      <input type="date" class="edit-input edit-input--sm" v-model="delayDateInput" :min="(selectedJobData.endDate || '').split('T')[0]" />
                      <span class="stage-inline-label">Reason</span>
                      <input type="text" class="edit-input edit-input--sm delay-reason-input" v-model="delayReasonInput" placeholder="Reason for delay..." />
                      <button class="btn-action btn-action--primary btn-sm" :disabled="!delayDateInput || !delayReasonInput" @click="submitDelay">Set Delayed End Date</button>
                      <button class="btn-action btn-action--muted btn-sm" @click="cancelDelay">Cancel</button>
                    </div>
                    <!-- Delay end time controls (hidden when editing delay date) -->
                    <template v-if="!delayMode">
                      <div v-if="delayEndDateHasTime && stageEditing !== 4" class="stage-inline" style="margin-top:4px">
                        <span class="stage-inline-label">Delay End Time</span>
                        <span class="stage-inline-value">{{ selectedJobData.endDate_delay.split('T')[1] }}</span>
                        <button class="btn-action btn-action--muted btn-sm" @click="startStageEdit(4)">Edit</button>
                        <button class="btn-action btn-action--danger btn-sm" @click="removeDelayEndTime">Remove Time</button>
                      </div>
                      <div v-else-if="showDelayEndTimeInput || stageEditing === 4" class="stage-inline" style="margin-top:4px">
                        <span class="stage-inline-label">Set Time</span>
                        <input type="time" class="edit-input edit-input--sm" v-model="delayEndTimeOnly" />
                        <button class="btn-action btn-action--primary btn-sm" :disabled="!delayEndTimeOnly" @click="setDelayEndTime">Set</button>
                        <button class="btn-action btn-action--muted btn-sm" @click="cancelDelayEndTimeInput">Cancel</button>
                      </div>
                      <div v-else class="stage-inline" style="margin-top:4px">
                        <button class="btn-action btn-action--muted btn-sm" @click="showDelayEndTimeInput = true">Set Time</button>
                      </div>
                    </template>
                  </template>

                  <!-- ── NO DELAY: show end date + end time controls ── -->
                  <template v-else>
                    <div class="stage-inline">
                      <span class="stage-inline-hint">Computed end date — {{ fmtDate((selectedJobData.endDate || '').split('T')[0]) }}</span>
                    </div>
                    <!-- End time controls (hidden when delay form active) -->
                    <template v-if="!delayMode">
                      <div v-if="endDateHasTime && stageEditing !== 4" class="stage-inline" style="margin-top:4px">
                        <span class="stage-inline-label">End Time</span>
                        <span class="stage-inline-value">{{ selectedJobData.endDate.split('T')[1] }}</span>
                        <button class="btn-action btn-action--muted btn-sm" @click="startStageEdit(4)">Edit</button>
                        <button class="btn-action btn-action--danger btn-sm" @click="removeEndTime">Remove Time</button>
                      </div>
                      <div v-else-if="showEndTimeInput || stageEditing === 4" class="stage-inline" style="margin-top:4px">
                        <span class="stage-inline-label">Set Time</span>
                        <input type="time" class="edit-input edit-input--sm" v-model="endTimeOnly" />
                        <button class="btn-action btn-action--primary btn-sm" :disabled="!endTimeOnly" @click="setEndTime">Set</button>
                        <button class="btn-action btn-action--muted btn-sm" @click="cancelEndTimeInput">Cancel</button>
                      </div>
                      <div v-else class="stage-inline" style="margin-top:4px">
                        <button class="btn-action btn-action--muted btn-sm" @click="showEndTimeInput = true">Set Time</button>
                      </div>
                    </template>
                    <!-- Raise delay option -->
                    <template v-if="jobHasStarted">
                      <div v-if="!delayMode" class="stage-inline" style="margin-top:6px">
                        <button class="btn-action btn-action--warn btn-sm" @click="openDelayMode">Raise End Delay</button>
                      </div>
                      <div v-else class="delay-form">
                        <span class="stage-inline-label">Delayed End Date</span>
                        <input type="date" class="edit-input edit-input--sm" v-model="delayDateInput" :min="(selectedJobData.endDate || '').split('T')[0]" />
                        <span class="stage-inline-label">Reason</span>
                        <input type="text" class="edit-input edit-input--sm delay-reason-input" v-model="delayReasonInput" placeholder="Reason for delay..." />
                        <button class="btn-action btn-action--primary btn-sm" :disabled="!delayDateInput || !delayReasonInput" @click="submitDelay">Set Delayed End Date</button>
                        <button class="btn-action btn-action--muted btn-sm" @click="cancelDelay">Cancel</button>
                      </div>
                    </template>
                  </template>
                </div>
              </template>

              <!-- Stage 5: Checkout -->
              <template v-if="activeStageIdx === 5">
                <div class="stage-action">
                  <div v-if="selectedJobData.checkout_date && stageEditing !== 5" class="stage-inline">
                    <span class="stage-inline-label">Checkout</span>
                    <span class="stage-inline-value">{{ fmtDate(selectedJobData.checkout_date) }}</span>
                    <button class="btn-action btn-action--muted btn-sm" @click="startStageEdit(5)">Edit</button>
                  </div>
                  <div v-else class="stage-inline">
                    <span class="stage-inline-label">Checkout</span>
                    <input type="date" class="edit-input edit-input--sm" v-model="stageCheckoutDate" />
                    <button class="btn-action btn-action--primary btn-sm" :disabled="!stageCheckoutDate" @click="submitCheckout">Set</button>
                    <button v-if="selectedJobData.checkout_date" class="btn-action btn-action--muted btn-sm" @click="cancelStageEdit">Cancel</button>
                  </div>
                </div>
              </template>
            </div>

            <!-- ── JOB DETAILS (view / edit) ── -->
            <div class="section-heading detail-heading">
              Job Details
              <div class="detail-heading-actions">
                <template v-if="!editMode">
                  <button class="btn-action btn-action--muted btn-sm" @click="enterEditMode">Edit</button>
                  <button class="btn-action btn-action--danger btn-sm" @click="emitJobDelete">Delete</button>
                </template>
                <template v-else>
                  <button class="btn-action btn-action--muted btn-sm" @click="cancelEditMode">Cancel</button>
                  <button class="btn-action btn-action--primary btn-sm" @click="saveEditMode">Save</button>
                </template>
              </div>
            </div>

            <!-- View mode -->
            <div v-if="!editMode" class="cal-detail-table">
              <div class="detail-row">
                <div class="detail-cell"><span class="edit-label">Title</span><span class="edit-value">{{ selectedJobData.title }}</span></div>
                <div class="detail-cell"><span class="edit-label">Type</span><span class="edit-value type-tag" :class="'type-tag--' + selectedJobData.type">{{ selectedJobData.type === 'uv' ? 'UV' : 'Laser' }}</span></div>
                <div class="detail-cell"><span class="edit-label">Quantity</span><span class="edit-value">{{ selectedJobData.quantity }}</span></div>
                <div class="detail-cell"><span class="edit-label">PIC</span><span class="edit-value">{{ getTeammateName(selectedJobData.pic_id) || '–' }}</span></div>
              </div>
              <div class="detail-row">
                <div class="detail-cell"><span class="edit-label">Start Date</span><span class="edit-value">{{ fmtDate(selectedJobData.startDate) }}</span></div>
                <div class="detail-cell">
                  <span class="edit-label">End Date</span>
                  <span class="edit-value">
                    <span>Booking: {{ fmtDate((selectedJobData.endDate || '').split('T')[0]) }}</span>
                    <span v-if="selectedJobData.endDate_delay" class="edit-value--delay">Delay: {{ fmtDate((selectedJobData.endDate_delay || '').split('T')[0]) }}</span>
                  </span>
                </div>
                <div class="detail-cell"><span class="edit-label">BD Number</span><span class="edit-value">{{ selectedJobData.bd_number || '–' }}</span></div>
                <div class="detail-cell"><span class="edit-label">Created</span><span class="edit-value">{{ fmtDate(selectedJobData.created_at) || '–' }}</span></div>
              </div>
            </div>

            <!-- Edit mode -->
            <div v-else class="cal-detail-table">
              <div class="detail-row">
                <div class="detail-cell"><label class="edit-label">Title</label><input class="edit-input" v-model="editForm.title" /></div>
                <div class="detail-cell">
                  <label class="edit-label">Type</label>
                  <select class="edit-select" v-model="editForm.type"><option value="uv">UV</option><option value="laser">Laser</option></select>
                </div>
                <div class="detail-cell"><label class="edit-label">Quantity</label><input class="edit-input" type="number" v-model.number="editForm.quantity" min="1" /></div>
              </div>
              <div class="detail-row">
                <div class="detail-cell"><label class="edit-label">Start Date</label><input class="edit-input" type="date" v-model="editForm.startDate" /></div>
                <div class="detail-cell">
                  <label class="edit-label">End Date</label>
                  <span class="edit-value edit-value--computed">
                    <span>Booking: {{ fmtDate((editPreviewEndDate || editForm.endDate || '').split('T')[0]) }}</span>
                    <span v-if="selectedJobData.endDate_delay" class="edit-value--delay">Delay: {{ fmtDate((selectedJobData.endDate_delay || '').split('T')[0]) }}</span>
                  </span>
                </div>
                <div class="detail-cell"><label class="edit-label">Arrival Date</label><input class="edit-input" type="date" v-model="editForm.arrival_date" /></div>
                <div class="detail-cell"><label class="edit-label">Checkout Date</label><input class="edit-input" type="date" v-model="editForm.checkout_date" /></div>
              </div>
              <div class="edit-drag-hint">Drag the job bar on the calendar to change start date.</div>
              <div v-if="editLosesPriority" class="edit-warn-msg">Changing the start date or type will update the booking creation timestamp, causing you to lose your current booking priority.</div>
            </div>

            <!-- BD disconnected warning -->
            <div v-if="selectedJobData.bd_number && !selectedBdBatch" class="bd-warn">
              This BD Number ({{ selectedJobData.bd_number }}) is no longer connected to an order plan. Please reconnect.
            </div>

            <!-- BD Batch Details -->
            <template v-if="selectedBdBatch">
              <div class="section-heading">Order Details ({{ selectedJobData.bd_number }})</div>
              <div class="bd-batch-card">
                <div class="bd-batch-header">
                  <span class="bd-batch-opid">{{ selectedBdBatch.opid }}</span>
                  <span class="bd-batch-title">{{ selectedBdBatch.opTitle }}</span>
                  <span class="bd-batch-cust type-tag" :class="'type-tag--' + (selectedBdBatch.custCategory || 'uv')">{{ selectedBdBatch.customization }}</span>
                </div>
                <div class="bd-batch-table-scroll">
                  <table class="bd-batch-table">
                    <thead><tr><th>SKU</th><th>Model</th><th>Color</th><th>Qty</th><th>Status</th><th>Mockup</th></tr></thead>
                    <tbody>
                      <tr v-for="item in selectedBdBatch.items" :key="item.lineId">
                        <td class="td-sku">{{ item.sku }}</td>
                        <td>{{ item.model }}</td>
                        <td>{{ item.color }}</td>
                        <td class="td-qty">{{ item.qty }}</td>
                        <td><span class="status-pill" :class="'pill--' + statusKey(item.status)">{{ item.status }}</span></td>
                        <td>
                          <a v-if="item.mockupLink" :href="item.mockupLink" target="_blank" class="mockup-link">View</a>
                          <span v-else class="td-empty">–</span>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </template>

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
              <select class="edit-select" v-model="draftJob.type"><option value="uv">UV</option><option value="laser">Laser</option></select>
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
              <label class="edit-label">End Date</label>
              <span class="cal-computed-value">{{ draftEndDate || '–' }}</span>
            </div>
            <div class="edit-field">
              <label class="edit-label">Days</label>
              <span class="cal-computed-value">{{ draftDaysRequired }}</span>
            </div>
            <!-- PIC dropdown -->
            <div class="edit-field">
              <label class="edit-label">PIC (Person)</label>
              <div class="bd-select-wrapper">
                <input class="edit-input" v-model="picSearch" placeholder="Search name..." @focus="picDropdownOpen = true" @blur="closePicDropdown" />
                <div v-if="picDropdownOpen && filteredPicOptions.length" class="bd-dropdown">
                  <div v-for="tm in filteredPicOptions" :key="tm.id" class="bd-dropdown-item" :class="{ 'bd-dropdown-item--selected': draftJob.pic_id === tm.id }" @mousedown.prevent="selectPic(tm)">
                    <span class="bd-opt-num">{{ tm.name }}</span>
                    <span class="bd-opt-meta">{{ tm.type || '' }}</span>
                  </div>
                </div>
              </div>
              <span v-if="draftJob.pic_id" class="bd-selected-tag">
                {{ getTeammateName(draftJob.pic_id) }}
                <button class="bd-clear-btn" @click="clearDraftPic">×</button>
              </span>
            </div>
            <!-- BD Number dropdown -->
            <div class="edit-field edit-field--wide">
              <label class="edit-label">BD Number (optional)</label>
              <div class="bd-select-wrapper">
                <input class="edit-input bd-search-input" v-model="bdSearch" placeholder="Search BD#..." @focus="bdDropdownOpen = true" @blur="closeBdDropdown" />
                <div v-if="bdDropdownOpen && filteredBdOptions.length" class="bd-dropdown">
                  <div v-for="opt in filteredBdOptions" :key="opt.bd_number" class="bd-dropdown-item" :class="{ 'bd-dropdown-item--selected': draftJob.bd_number === opt.bd_number }" @mousedown.prevent="selectBdNumber(opt)">
                    <span class="bd-opt-num">{{ opt.bd_number }}</span>
                    <span class="bd-opt-cust type-tag" :class="'type-tag--' + opt.custCategory">{{ opt.customization }}</span>
                    <span class="bd-opt-meta">{{ opt.opid }} · {{ opt.itemCount }} SKUs</span>
                  </div>
                </div>
              </div>
              <span v-if="draftJob.bd_number" class="bd-selected-tag">
                {{ draftJob.bd_number }}
                <button class="bd-clear-btn" @click="clearDraftBd">×</button>
              </span>
            </div>
          </div>

          <!-- BD Preview -->
          <template v-if="draftBdBatch">
            <div class="section-heading">BD Preview ({{ draftJob.bd_number }})</div>
            <div class="bd-batch-card">
              <div class="bd-batch-header">
                <span class="bd-batch-opid">{{ draftBdBatch.opid }}</span>
                <span class="bd-batch-title">{{ draftBdBatch.opTitle }}</span>
                <span class="bd-batch-cust type-tag" :class="'type-tag--' + (draftBdBatch.custCategory || 'uv')">{{ draftBdBatch.customization }}</span>
              </div>
              <div class="bd-batch-table-scroll">
                <table class="bd-batch-table">
                  <thead><tr><th>SKU</th><th>Model</th><th>Color</th><th>Qty</th><th>Status</th><th>Mockup</th></tr></thead>
                  <tbody>
                    <tr v-for="item in draftBdBatch.items" :key="item.lineId">
                      <td class="td-sku">{{ item.sku }}</td><td>{{ item.model }}</td><td>{{ item.color }}</td>
                      <td class="td-qty">{{ item.qty }}</td>
                      <td><span class="status-pill" :class="'pill--' + statusKey(item.status)">{{ item.status }}</span></td>
                      <td><a v-if="item.mockupLink" :href="item.mockupLink" target="_blank" class="mockup-link">View</a><span v-else class="td-empty">–</span></td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </template>

          <div class="cal-draft-hint" v-if="draftJob.startDate">Drag the preview bar to change start date. Resize edges to spread over more days.</div>
          <div class="cal-form-actions">
            <button class="btn-action btn-action--muted" @click="cancelDraft">Cancel</button>
            <button class="btn-action btn-action--submit" :disabled="!canSubmitDraft" @click="submitDraft">Create Job</button>
          </div>
        </div>

        <!-- ═══ MANAGE CAPACITY ═══ -->
        <div v-if="activeTab === 'capacity'" class="cal-tab-content">
          <div class="section-heading">Add Capacity Rule</div>
          <div class="cal-form-grid">
            <div class="edit-field"><label class="edit-label">Title</label><input class="edit-input" v-model="capForm.title" placeholder="e.g. Ramadan Break" /></div>
            <div class="edit-field">
              <label class="edit-label">Rule Type</label>
              <select class="edit-select" v-model="capForm.ruleType"><option value="default">Default (Monthly)</option><option value="general">General (Date Range)</option></select>
            </div>
            <div class="edit-field">
              <label class="edit-label">Customization Type</label>
              <select class="edit-select" v-model="capForm.custType"><option value="uv">UV</option><option value="laser">Laser</option></select>
            </div>
            <div class="edit-field"><label class="edit-label">Capacity / Day</label><input class="edit-input" type="number" v-model.number="capForm.quantity" min="0" /></div>
            <template v-if="capForm.ruleType === 'default'">
              <div class="edit-field"><label class="edit-label">Month</label><input class="edit-input" type="month" v-model="capForm.month" /></div>
            </template>
            <template v-else>
              <div class="edit-field"><label class="edit-label">Start Date</label><input class="edit-input" type="date" v-model="capForm.startDate" /></div>
              <div class="edit-field"><label class="edit-label">End Date</label><input class="edit-input" type="date" v-model="capForm.endDate" /></div>
            </template>
          </div>
          <div class="cal-form-actions">
            <button class="btn-action btn-action--primary" :disabled="!canSubmitCapacity" @click="submitCapacity">Add Rule</button>
          </div>
          <div class="section-heading cap-list-heading">Existing Rules</div>
          <div v-if="!resolvedCapacity.length" class="cal-empty-tab">No capacity rules configured.</div>
          <div v-else class="cal-cap-list">
            <div v-for="rule in resolvedCapacity" :key="rule.id" class="cal-cap-item">
              <span class="cal-cap-title">{{ rule.title || '(untitled)' }}</span>
              <span class="cal-cap-type-tag" :class="'type-tag--' + (rule.custType || 'uv')">{{ (rule.custType || 'uv') === 'uv' ? 'UV' : 'Laser' }}</span>
              <span class="cal-cap-meta">{{ rule.ruleType === 'default' ? rule.month : fmtDate(rule.startDate) + ' → ' + fmtDate(rule.endDate) }}</span>
              <span class="cal-cap-qty">{{ rule.quantity }}/day</span>
              <button class="btn-icon btn-icon--danger" @click="emitCapacityDelete(rule.id)" title="Delete">×</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, reactive, computed, watch, onBeforeUnmount } from 'vue';

const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const MONTH_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const DOW = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
const TABS = [
  { key: 'manage', label: 'Manage Job' },
  { key: 'new', label: 'New Job' },
  { key: 'capacity', label: 'Manage Capacity' },
];
const STAGES = [
  { key: 'created', done: 'Created', pending: 'Created', warn: 'Created' },
  { key: 'connected', done: 'Connected', pending: 'Pending Connection', warn: 'Connection Lost' },
  { key: 'arrived', done: 'Arrived', pending: 'Pending Arrival', warn: 'Arrival Issue' },
  { key: 'started', done: 'Job Started', pending: 'Pending Start', warn: 'Start Issue' },
  { key: 'completed', done: 'Completed', pending: 'Pending Completion', warn: 'Completion Issue' },
  { key: 'checkout', done: 'Checked Out', pending: 'Pending Checkout', warn: 'Checkout Issue' },
];

function parseDate(str) {
  if (!str) return null;
  const s = str.length > 10 ? str.substring(0, 10) : str;
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}
function toDateStr(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function isWeekend(d) { const dow = d.getDay(); return dow === 0 || dow === 6; }
function nextDay(d) { const n = new Date(d); n.setDate(n.getDate() + 1); return n; }
function countWorkdays(from, to) {
  let count = 0, c = new Date(from);
  while (c <= to) { if (!isWeekend(c)) count++; c = nextDay(c); }
  return count;
}
function fmtDate(str) {
  if (!str) return '';
  const d = parseDate(str);
  return d ? `${d.getDate()} ${MONTH_SHORT[d.getMonth()]} ${d.getFullYear()}` : '';
}

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
    function resolve(key) {
      const raw = wwLib.wwUtils.getDataFromCollection(props.content?.[key]);
      return Array.isArray(raw) ? raw : [];
    }
    const resolvedJobs = computed(() => resolve('jobsData'));
    const resolvedCapacity = computed(() => resolve('capacityData'));
    const defaultUvCap = computed(() => props.content?.defaultUvCapacity ?? 100);
    const defaultLaserCap = computed(() => props.content?.defaultLaserCapacity ?? 50);
    const resolvedOpHeaders = computed(() => resolve('orderplanHeadersData'));
    const resolvedOpLines = computed(() => resolve('orderplanLinesData'));
    const resolvedBookingItems = computed(() => resolve('bookingItems'));
    const resolvedInventoryData = computed(() => resolve('inventoryData'));
    const resolvedTeammates = computed(() => resolve('teammatesList'));

    // ─── LOOKUP MAPS ───
    const opHeaderLookup = computed(() => { const m = {}; for (const h of resolvedOpHeaders.value) m[h.id] = h; return m; });
    const bookingItemLookup = computed(() => { const m = {}; for (const bi of resolvedBookingItems.value) m[bi.id] = bi; return m; });
    const inventoryLookup = computed(() => { const m = {}; for (const inv of resolvedInventoryData.value) m[inv.sku] = inv; return m; });
    const teammateLookup = computed(() => { const m = {}; for (const t of resolvedTeammates.value) m[t.id] = t; return m; });

    function getTeammateName(id) { return teammateLookup.value[id]?.name || ''; }

    // ─── BD BATCHES ───
    const bdBatches = computed(() => {
      const bm = {};
      for (const line of resolvedOpLines.value) {
        const bd = line.bd_number;
        if (!bd) continue;
        if (!bm[bd]) {
          const h = opHeaderLookup.value[line.headerid];
          const c = (line.customization || 'None').toLowerCase();
          bm[bd] = {
            bd_number: bd, customization: line.customization || 'None',
            custCategory: c.includes('laser') || c.includes('deboss') ? 'laser' : 'uv',
            headerid: line.headerid, opid: h?.opid || '–', opTitle: h?.title || '–',
            line_ids: [], items: [],
          };
        }
        bm[bd].line_ids.push(line.id);
        const bi = bookingItemLookup.value[line.bookingitems_headerid];
        const inv = bi ? inventoryLookup.value[bi.sku] : null;
        bm[bd].items.push({
          lineId: line.id, sku: bi?.sku || '–', model: inv?.model || '–', color: inv?.color || '–',
          qty: line.quantity_assigned || 0, status: bi?.status || 'Booked', mockupLink: line.mockup_link || '',
        });
      }
      return bm;
    });

    const bdOptions = computed(() => Object.values(bdBatches.value).map(b => ({
      bd_number: b.bd_number, customization: b.customization, custCategory: b.custCategory,
      opid: b.opid, opTitle: b.opTitle, itemCount: b.items.length,
      batch_key: `${b.headerid}::${b.customization}`, line_ids: b.line_ids,
    })));

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
      let sd = (first.getDay() + 6) % 7;
      const start = new Date(first); start.setDate(start.getDate() - sd);
      const days = [];
      for (let i = 0; i < 42; i++) {
        const d = new Date(start); d.setDate(start.getDate() + i);
        const ds = toDateStr(d), dow = d.getDay();
        days.push({
          date: new Date(d), dateStr: ds, dayNum: d.getDate(), monthShort: MONTH_SHORT[d.getMonth()],
          isWeekend: dow === 0 || dow === 6, isToday: ds === todayStr,
          outside: d.getMonth() !== currentMonth.value, weekIndex: Math.floor(i / 7), dayIndex: i % 7, idx: i,
        });
      }
      return days;
    });

    // ─── CAPACITY ───
    function getCapacityForDate(dateStr, type) {
      let cap = type === 'uv' ? defaultUvCap.value : defaultLaserCap.value;
      const ms = dateStr.substring(0, 7);
      for (const r of resolvedCapacity.value) { if (r.ruleType === 'default' && r.month === ms && (r.custType || 'uv') === type) cap = Number(r.quantity) || 0; }
      for (const r of resolvedCapacity.value) { if (r.ruleType === 'general' && dateStr >= r.startDate && dateStr <= r.endDate && (r.custType || 'uv') === type) cap = Number(r.quantity) || 0; }
      return cap;
    }
    function getCapacityOverrides(dateStr) { return resolvedCapacity.value.filter(r => r.ruleType === 'general' && dateStr >= r.startDate && dateStr <= r.endDate); }
    function hasWeekendCapacity(dateStr) { return resolvedCapacity.value.some(r => r.ruleType === 'general' && dateStr >= r.startDate && dateStr <= r.endDate); }
    function uvUsed(day) { return (allAllocations.value[day.dateStr] || []).filter(a => a.type === 'uv').reduce((s, a) => s + a.qty, 0); }
    function uvTotal(day) { return getCapacityForDate(day.dateStr, 'uv'); }
    function laserUsed(day) { return (allAllocations.value[day.dateStr] || []).filter(a => a.type === 'laser').reduce((s, a) => s + a.qty, 0); }
    function laserTotal(day) { return getCapacityForDate(day.dateStr, 'laser'); }

    // ─── ALLOCATION ENGINE ───
    function allocateJobs(jobs, extra) {
      const am = {}, ed = {};
      // Sort by created_at for stable priority (first-booked first-served), fallback to id
      const sorted = [...jobs].sort((a, b) => {
        const ca = a.created_at || '', cb = b.created_at || '';
        if (ca !== cb) return ca.localeCompare(cb);
        return String(a.id || '').localeCompare(String(b.id || ''));
      });
      if (extra) sorted.push(extra);
      for (const job of sorted) {
        if (!job.startDate || !job.quantity || job.quantity <= 0) continue;
        let rem = Number(job.quantity), cur = parseDate(job.startDate);
        if (!cur) continue;
        const mx = job._maxDays || 0; let dc = 0, sf = 0;
        while (rem > 0 && sf < 3650) {
          sf++;
          if (isWeekend(cur)) { cur = nextDay(cur); continue; }
          const ds = toDateStr(cur), tc = getCapacityForDate(ds, job.type || 'uv');
          const used = (am[ds] || []).filter(a => a.type === (job.type || 'uv')).reduce((s, a) => s + a.qty, 0);
          const avail = Math.max(0, tc - used);
          if (avail > 0) {
            dc++;
            let ta;
            if (mx > 0 && dc <= mx) { const rd = mx - dc + 1; ta = Math.min(avail, Math.ceil(rem / rd)); }
            else ta = Math.min(rem, avail);
            if (!am[ds]) am[ds] = [];
            am[ds].push({ jobId: job.id || '__draft__', type: job.type || 'uv', qty: ta, title: job.title || '' });
            rem -= ta;
          }
          cur = nextDay(cur);
        }
        let endD = job.startDate;
        for (const ds in am) { if ((am[ds] || []).some(a => a.jobId === (job.id || '__draft__')) && ds > endD) endD = ds; }
        ed[job.id || '__draft__'] = endD;
      }
      return { allocMap: am, jobEndDates: ed };
    }

    const baseResult = computed(() => allocateJobs(resolvedJobs.value, null));

    // ─── DRAFT JOB ───
    const draftJob = reactive({ title: '', type: 'uv', quantity: 100, startDate: '', _maxDays: 0, bd_number: '', pic_id: '' });
    const isDrafting = computed(() => activeTab.value === 'new');

    // ─── RESCHEDULE STATE ───
    const isRescheduling = ref(false);
    const rescheduleJob = reactive({ startDate: '', _maxDays: 0, quantity: 0, type: 'uv', id: '__draft__', title: '' });

    // The "extra" job for calendar preview (draft, reschedule, or edit ghost)
    const previewExtra = computed(() => {
      if (isDrafting.value && draftJob.startDate && draftJob.quantity > 0) {
        return { id: '__draft__', title: draftJob.title || 'New Job', type: draftJob.type, quantity: draftJob.quantity, startDate: draftJob.startDate, _maxDays: draftJob._maxDays };
      }
      if (isRescheduling.value && rescheduleJob.startDate && rescheduleJob.quantity > 0) {
        return { id: '__draft__', title: rescheduleJob.title || 'Reschedule', type: rescheduleJob.type, quantity: rescheduleJob.quantity, startDate: rescheduleJob.startDate, _maxDays: rescheduleJob._maxDays };
      }
      // Show edit preview when priority is lost (start date or type changed)
      if (editMode.value && editLosesPriority.value && editForm.startDate && editForm.quantity > 0) {
        return { id: '__draft__', title: editForm.title || 'Edit', type: editForm.type, quantity: editForm.quantity, startDate: editForm.startDate, _maxDays: editForm._maxDays };
      }
      return null;
    });

    // For reschedule or edit mode with changed start date, exclude the original job from the base list
    const jobsForAllocation = computed(() => {
      if (isRescheduling.value && selectedJobId.value) {
        return resolvedJobs.value.filter(j => j.id !== selectedJobId.value);
      }
      if (editMode.value && editLosesPriority.value && selectedJobId.value) {
        return resolvedJobs.value.filter(j => j.id !== selectedJobId.value);
      }
      return resolvedJobs.value;
    });

    const fullResult = computed(() => {
      if (!previewExtra.value) return allocateJobs(jobsForAllocation.value, null);
      return allocateJobs(jobsForAllocation.value, previewExtra.value);
    });

    const allAllocations = computed(() => fullResult.value.allocMap);
    const draftEndDate = computed(() => { const e = fullResult.value.jobEndDates['__draft__']; return e ? fmtDate(e) : ''; });
    const draftEndDateRaw = computed(() => fullResult.value.jobEndDates['__draft__'] || '');
    const rescheduleEndDate = computed(() => draftEndDate.value);
    const editPreviewEndDate = computed(() => {
      if (!editMode.value) return '';
      // If start date changed, use the __draft__ preview from full allocation
      if (editLosesPriority.value) return draftEndDateRaw.value;
      // If quantity or type changed (but not start date), compute expected end date in-place
      const j = selectedJobData.value;
      if (!j) return '';
      const qtyChanged = editForm.quantity !== Number(j.quantity);
      const typeChanged = editForm.type !== (j.type || 'uv');
      if (!qtyChanged && !typeChanged) return j.endDate ? j.endDate.split('T')[0] : '';
      // Run allocation with the edited job swapped in
      const edited = { ...j, quantity: editForm.quantity, type: editForm.type, id: j.id };
      const others = resolvedJobs.value.filter(jj => jj.id !== j.id);
      const result = allocateJobs(others, edited);
      return result.jobEndDates[j.id] || '';
    });
    const draftDaysRequired = computed(() => {
      if (!draftEndDateRaw.value || !draftJob.startDate) return '–';
      const s = parseDate(draftJob.startDate), e = parseDate(draftEndDateRaw.value);
      return (s && e) ? countWorkdays(s, e) : '–';
    });
    const canSubmitDraft = computed(() => draftJob.title && draftJob.type && draftJob.quantity > 0 && draftJob.startDate);

    // ─── BD SEARCH (new job) ───
    const bdSearch = ref('');
    const bdDropdownOpen = ref(false);
    const filteredBdOptions = computed(() => {
      const q = bdSearch.value.toLowerCase().trim();
      return q ? bdOptions.value.filter(o => o.bd_number.toLowerCase().includes(q) || o.opid.toLowerCase().includes(q) || o.opTitle.toLowerCase().includes(q)) : bdOptions.value;
    });
    function selectBdNumber(opt) { draftJob.bd_number = opt.bd_number; bdSearch.value = opt.bd_number; bdDropdownOpen.value = false; }
    function clearDraftBd() { draftJob.bd_number = ''; bdSearch.value = ''; }
    function closeBdDropdown() { setTimeout(() => { bdDropdownOpen.value = false; }, 150); }

    // ─── PIC SEARCH (new job) ───
    const picSearch = ref('');
    const picDropdownOpen = ref(false);
    const filteredPicOptions = computed(() => {
      const q = picSearch.value.toLowerCase().trim();
      return q ? resolvedTeammates.value.filter(t => t.name?.toLowerCase().includes(q)) : resolvedTeammates.value;
    });
    function selectPic(tm) { draftJob.pic_id = tm.id; picSearch.value = tm.name; picDropdownOpen.value = false; }
    function clearDraftPic() { draftJob.pic_id = ''; picSearch.value = ''; }
    function closePicDropdown() { setTimeout(() => { picDropdownOpen.value = false; }, 150); }

    const draftBdBatch = computed(() => draftJob.bd_number ? bdBatches.value[draftJob.bd_number] || null : null);

    // ─── STAGE BD SEARCH (manage tab, stage 1) ───
    const stageBdSearch = ref('');
    const stageBdOpen = ref(false);
    const stageBdSelected = ref(null);
    const filteredStageBdOptions = computed(() => {
      const q = stageBdSearch.value.toLowerCase().trim();
      return q ? bdOptions.value.filter(o => o.bd_number.toLowerCase().includes(q) || o.opid.toLowerCase().includes(q)) : bdOptions.value;
    });
    function closeStageBdDropdown() { setTimeout(() => { stageBdOpen.value = false; }, 150); }
    function selectStageBd(opt) {
      stageBdSelected.value = opt;
      stageBdSearch.value = opt.bd_number;
      stageBdOpen.value = false;
    }
    function clearStageBd() { stageBdSelected.value = null; stageBdSearch.value = ''; }
    function submitStageBd() {
      const opt = stageBdSelected.value;
      if (!opt) return;
      emit('trigger-event', {
        name: 'onJobConnectBd',
        event: { value: { jobId: selectedJobId.value, bd_number: opt.bd_number, batch_key: opt.batch_key, line_ids: opt.line_ids } },
      });
      stageBdSelected.value = null;
      stageBdSearch.value = '';
      stageEditing.value = null;
    }

    // ─── STAGE ACTIONS ───
    const stageEditing = ref(null); // which stage index is being edited (null = none)
    function startStageEdit(idx) { stageEditing.value = idx; }
    function cancelStageEdit() { stageEditing.value = null; stageBdSelected.value = null; stageBdSearch.value = ''; }
    // watches moved after activeStageIdx definition

    const stageArrivalDate = ref('');
    const stageCheckoutDate = ref('');

    function submitArrival() {
      if (!stageArrivalDate.value) return;
      emit('trigger-event', { name: 'onJobArrival', event: { value: { jobId: selectedJobId.value, arrival_date: stageArrivalDate.value } } });
      stageArrivalDate.value = ''; stageEditing.value = null;
    }
    // ─── END TIME (stage 4) ───
    const showEndTimeInput = ref(false);
    const endTimeOnly = ref('');
    const endDateHasTime = computed(() => {
      const j = selectedJobData.value;
      return j?.endDate && j.endDate.includes('T');
    });
    function setEndTime() {
      const j = selectedJobData.value;
      if (!j || !endTimeOnly.value) return;
      const datePart = (j.endDate || '').split('T')[0];
      if (!datePart) return;
      emit('trigger-event', { name: 'onJobSetEndTime', event: { value: { jobId: selectedJobId.value, endDate: datePart + 'T' + endTimeOnly.value } } });
      endTimeOnly.value = ''; showEndTimeInput.value = false; stageEditing.value = null;
    }
    function removeEndTime() {
      const j = selectedJobData.value;
      if (!j) return;
      const datePart = (j.endDate || '').split('T')[0];
      if (!datePart) return;
      emit('trigger-event', { name: 'onJobSetEndTime', event: { value: { jobId: selectedJobId.value, endDate: datePart } } });
      stageEditing.value = null;
    }
    function cancelEndTimeInput() { showEndTimeInput.value = false; endTimeOnly.value = ''; stageEditing.value = null; }

    // ─── DELAY END TIME (stage 4, when delay exists) ───
    const showDelayEndTimeInput = ref(false);
    const delayEndTimeOnly = ref('');
    const delayEndDateHasTime = computed(() => {
      const j = selectedJobData.value;
      return j?.endDate_delay && j.endDate_delay.includes('T');
    });
    function setDelayEndTime() {
      const j = selectedJobData.value;
      if (!j || !delayEndTimeOnly.value) return;
      const datePart = (j.endDate_delay || '').split('T')[0];
      if (!datePart) return;
      emit('trigger-event', { name: 'onJobSetDelayEndTime', event: { value: { jobId: selectedJobId.value, endDate_delay: datePart + 'T' + delayEndTimeOnly.value } } });
      delayEndTimeOnly.value = ''; showDelayEndTimeInput.value = false; stageEditing.value = null;
    }
    function removeDelayEndTime() {
      const j = selectedJobData.value;
      if (!j) return;
      const datePart = (j.endDate_delay || '').split('T')[0];
      if (!datePart) return;
      emit('trigger-event', { name: 'onJobSetDelayEndTime', event: { value: { jobId: selectedJobId.value, endDate_delay: datePart } } });
      stageEditing.value = null;
    }
    function cancelDelayEndTimeInput() { showDelayEndTimeInput.value = false; delayEndTimeOnly.value = ''; stageEditing.value = null; }

    // ─── END DELAY ───
    const delayMode = ref(false);
    const delayDateInput = ref('');
    const delayReasonInput = ref('');
    function openDelayMode() {
      const j = selectedJobData.value;
      delayDateInput.value = (j?.endDate_delay ? j.endDate_delay.split('T')[0] : '') || (j?.endDate ? j.endDate.split('T')[0] : '') || '';
      delayReasonInput.value = j?.delay_reason || '';
      delayMode.value = true;
    }
    function cancelDelay() { delayMode.value = false; delayDateInput.value = ''; delayReasonInput.value = ''; }
    function submitDelay() {
      if (!delayDateInput.value || !delayReasonInput.value) return;
      emit('trigger-event', { name: 'onJobEndDelay', event: { value: { jobId: selectedJobId.value, endDate_delay: delayDateInput.value, delay_reason: delayReasonInput.value } } });
      delayMode.value = false; delayDateInput.value = ''; delayReasonInput.value = '';
    }
    function removeDelay() {
      emit('trigger-event', { name: 'onJobEndDelayRemove', event: { value: { jobId: selectedJobId.value } } });
      delayMode.value = false;
    }
    watch(selectedJobId, () => { delayMode.value = false; showEndTimeInput.value = false; endTimeOnly.value = ''; showDelayEndTimeInput.value = false; delayEndTimeOnly.value = ''; });
    function submitCheckout() {
      if (!stageCheckoutDate.value) return;
      emit('trigger-event', { name: 'onJobCheckout', event: { value: { jobId: selectedJobId.value, checkout_date: stageCheckoutDate.value } } });
      stageCheckoutDate.value = ''; stageEditing.value = null;
    }

    // ─── RESCHEDULE ───
    function enterReschedule() {
      if (!selectedJobData.value) return;
      const j = selectedJobData.value;
      Object.assign(rescheduleJob, { startDate: j.startDate, _maxDays: 0, quantity: Number(j.quantity), type: j.type, id: '__draft__', title: j.title });
      isRescheduling.value = true;
    }
    function cancelReschedule() { isRescheduling.value = false; }
    function submitReschedule() {
      if (!rescheduleJob.startDate) return;
      const endDate = draftEndDateRaw.value;
      const j = selectedJobData.value;
      // Shift delay end date by the same offset as end date change
      let delayEnd = j?.endDate_delay || null;
      let delayReason = j?.delay_reason || null;
      if (delayEnd && endDate && j?.endDate) {
        const oldEnd = parseDate((j.endDate || '').split('T')[0]);
        const newEnd = parseDate((endDate || '').split('T')[0]);
        if (oldEnd && newEnd) {
          const diffMs = newEnd.getTime() - oldEnd.getTime();
          if (diffMs !== 0) {
            const oldDelay = parseDate((delayEnd || '').split('T')[0]);
            if (oldDelay) {
              const shifted = new Date(oldDelay.getTime() + diffMs);
              delayEnd = toDateStr(shifted);
            }
          }
        }
      }
      emit('trigger-event', {
        name: 'onJobUpdate',
        event: { value: {
          jobId: selectedJobId.value,
          title: j?.title || null, type: j?.type || 'uv', quantity: Number(j?.quantity) || 0,
          startDate: rescheduleJob.startDate || null, endDate: endDate || null,
          endDate_delay: delayEnd, delay_reason: delayReason,
          bd_number: j?.bd_number || null, pic_id: j?.pic_id || null,
          arrival_date: j?.arrival_date || null,
          checkout_date: j?.checkout_date || null,
        } },
      });
      isRescheduling.value = false;
    }

    // ─── SEGMENT RENDERING ───
    const allSegments = computed(() => {
      const am = allAllocations.value, days = calendarDays.value;
      const jobSet = new Map();
      for (const day of days) {
        for (const a of (am[day.dateStr] || [])) {
          if (!jobSet.has(a.jobId)) {
            const job = resolvedJobs.value.find(j => j.id === a.jobId);
            jobSet.set(a.jobId, {
              id: a.jobId, title: a.title || job?.title || '', type: a.type,
              color: job?.color || '', totalQty: job?.quantity || draftJob.quantity || rescheduleJob.quantity || 0,
              isDraft: a.jobId === '__draft__',
            });
          }
        }
      }
      const segs = []; let si = 0;
      const wk = {};
      const ids = [...jobSet.keys()].sort((a, b) => {
        if (a === '__draft__') return 1; if (b === '__draft__') return -1;
        const ja = resolvedJobs.value.find(j => j.id === a);
        const jb = resolvedJobs.value.find(j => j.id === b);
        const ca = ja?.created_at || '', cb = jb?.created_at || '';
        if (ca !== cb) return ca.localeCompare(cb);
        return String(a).localeCompare(String(b));
      });
      for (const jid of ids) {
        const ji = jobSet.get(jid);
        // Build set of day indices that have allocation for this job
        const activeDays = new Set();
        for (const day of days) {
          const ja = (am[day.dateStr] || []).find(a => a.jobId === jid);
          if (ja) activeDays.add(day.idx);
        }
        if (!activeDays.size) continue;
        const col = ji.color || (ji.type === 'laser' ? JOB_COLORS_LASER[si % JOB_COLORS_LASER.length] : JOB_COLORS_UV[si % JOB_COLORS_UV.length]);
        ji.resolvedColor = col;

        // Find the full span per week (first active to last active in that week row)
        const weekSpans = {};
        for (const idx of activeDays) {
          const day = days[idx];
          const wi = day.weekIndex;
          if (!weekSpans[wi]) weekSpans[wi] = { min: day.dayIndex, max: day.dayIndex };
          else { weekSpans[wi].min = Math.min(weekSpans[wi].min, day.dayIndex); weekSpans[wi].max = Math.max(weekSpans[wi].max, day.dayIndex); }
        }

        // Assign consistent row index per job across all its weeks
        const weekKeys = Object.keys(weekSpans).map(Number).sort((a, b) => a - b);
        // Find a row index that doesn't collide in ANY of this job's weeks
        let ri = 0;
        let found = false;
        while (!found) {
          found = true;
          for (const wi of weekKeys) {
            const sp = weekSpans[wi];
            if (!wk[wi]) wk[wi] = [];
            if (wk[wi].some(r => r.ri === ri && !(sp.max < r.sc - 1 || sp.min > r.ec + 1))) { found = false; break; }
          }
          if (!found) ri++;
        }
        // Reserve the row
        for (const wi of weekKeys) {
          const sp = weekSpans[wi];
          if (!wk[wi]) wk[wi] = [];
          wk[wi].push({ sc: sp.min, ec: sp.max, ri });
        }

        // Build sub-segments per week: split into active (colored) and gap (grey) runs
        const isFirstWeek = weekKeys[0], isLastWeek = weekKeys[weekKeys.length - 1];
        let prevWasGap = false;
        for (const wi of weekKeys) {
          const sp = weekSpans[wi];
          let curType = null, curStart = sp.min;
          const isNewWeek = wi !== isFirstWeek;
          let firstActiveInWeek = true;
          for (let di = sp.min; di <= sp.max + 1; di++) {
            const dayIdx = wi * 7 + di;
            const isActive = di <= sp.max && activeDays.has(dayIdx);
            const segType = isActive ? 'active' : 'gap';
            if (di > sp.max || (curType !== null && segType !== curType)) {
              // Flush current run
              const endCol = di - 1;
              const isJobFirst = wi === isFirstWeek && curStart === sp.min && !prevWasGap;
              const isJobLast = wi === isLastWeek && endCol === sp.max;
              // Show label on first active segment of each week or after a gap
              const showLabel = curType === 'active' && (isJobFirst || (isNewWeek && firstActiveInWeek) || prevWasGap);
              segs.push({
                key: `${jid}-${wi}-${curStart}-${curType}`, jobId: jid, title: ji.title, type: ji.type,
                totalQty: ji.totalQty, color: curType === 'active' ? col : null, isGap: curType === 'gap',
                isDraft: ji.isDraft, isFirst: isJobFirst, isLast: isJobLast, showLabel,
                weekIndex: wi, startCol: curStart, endCol, rowIndex: ri,
              });
              if (curType === 'active') firstActiveInWeek = false;
              prevWasGap = curType === 'gap';
              curStart = di; curType = segType;
            } else if (curType === null) {
              curType = segType;
            }
          }
        }
        // Store row index for delay tail generation
        jobSet.get(jid).ri = ri;
        si++;
      }

      // ─── DELAY TAIL SEGMENTS ───
      // For jobs with endDate_delay, add red segments from endDate+1 to endDate_delay
      for (const jid of ids) {
        if (jid === '__draft__') continue;
        const job = resolvedJobs.value.find(j => j.id === jid);
        if (!job) continue;
        // Use delayDateInput preview if this job is selected and in delay mode
        const delayEndRaw = (delayMode.value && jid === selectedJobId.value && delayDateInput.value)
          ? delayDateInput.value
          : (job.endDate_delay || '');
        const delayEnd = delayEndRaw ? delayEndRaw.split('T')[0] : '';
        const jobEndClean = job.endDate ? job.endDate.split('T')[0] : '';
        if (!delayEnd || !jobEndClean || delayEnd <= jobEndClean) continue;
        const ji = jobSet.get(jid);
        if (!ji || ji.ri === undefined) continue;
        const ri = ji.ri;

        // Collect day indices for the delay range (endDate+1 through delayEnd, skip weekends)
        const delayDayIdxs = [];
        for (let di = 0; di < days.length; di++) {
          const d = days[di];
          if (d.outside) continue;
          if (d.dateStr > jobEndClean && d.dateStr <= delayEnd && !d.isWeekend) {
            delayDayIdxs.push(di);
          }
        }
        if (!delayDayIdxs.length) continue;

        // Build week spans for delay days
        const dWeekSpans = {};
        for (const idx of delayDayIdxs) {
          const d = days[idx];
          const wi = d.weekIndex;
          if (!dWeekSpans[wi]) dWeekSpans[wi] = { min: d.dayIndex, max: d.dayIndex };
          else { dWeekSpans[wi].min = Math.min(dWeekSpans[wi].min, d.dayIndex); dWeekSpans[wi].max = Math.max(dWeekSpans[wi].max, d.dayIndex); }
        }

        // Reserve rows for delay spans
        const dWeekKeys = Object.keys(dWeekSpans).map(Number).sort((a, b) => a - b);
        for (const wi of dWeekKeys) {
          const sp = dWeekSpans[wi];
          if (!wk[wi]) wk[wi] = [];
          // Don't need collision check — reuse same row as job
          const existing = wk[wi].find(r => r.ri === ri);
          if (existing) { existing.ec = Math.max(existing.ec, sp.max); }
          else { wk[wi].push({ sc: sp.min, ec: sp.max, ri }); }
        }

        const dLast = dWeekKeys[dWeekKeys.length - 1];
        for (const wi of dWeekKeys) {
          const sp = dWeekSpans[wi];
          segs.push({
            key: `${jid}-delay-${wi}`, jobId: jid, title: ji.title, type: ji.type,
            totalQty: ji.totalQty, color: ji.resolvedColor, isGap: false, isDelay: true,
            isDraft: false, isFirst: false, isLast: wi === dLast,
            showLabel: true, weekIndex: wi, startCol: sp.min, endCol: sp.max, rowIndex: ri,
          });
        }
      }

      return segs;
    });

    // Compute max job rows per week for dynamic row heights
    const weekRowCounts = computed(() => {
      const counts = {};
      for (const seg of allSegments.value) {
        const wi = seg.weekIndex;
        counts[wi] = Math.max(counts[wi] || 0, seg.rowIndex + 1);
      }
      return counts;
    });
    const numWeeks = computed(() => Math.max(1, Math.ceil(calendarDays.value.length / 7)));
    // Pixel heights per week row
    const weekRowPx = computed(() => {
      const wc = weekRowCounts.value;
      const rows = [];
      for (let i = 0; i < numWeeks.value; i++) {
        const jobRows = wc[i] || 0;
        rows.push(Math.max(80, 28 + jobRows * 22));
      }
      return rows;
    });
    const totalGridHeight = computed(() => weekRowPx.value.reduce((s, h) => s + h, 0));
    // Cumulative top offsets in px for each week row
    const weekRowTops = computed(() => {
      const tops = [0];
      for (let i = 0; i < weekRowPx.value.length - 1; i++) {
        tops.push(tops[i] + weekRowPx.value[i]);
      }
      return tops;
    });
    const gridRowHeights = computed(() => weekRowPx.value.map(h => `${h}px`).join(' '));
    const gridStyle = computed(() => ({
      gridTemplateRows: gridRowHeights.value,
    }));
    function segmentStyle(seg) {
      const bg = seg.isGap ? '#e5e7eb' : seg.color;
      const total = totalGridHeight.value || 1;
      const rowTop = weekRowTops.value[seg.weekIndex] || 0;
      const topPx = rowTop + 24 + seg.rowIndex * 22;
      const colW = 100 / 7;
      return {
        position: 'absolute',
        left: `${seg.startCol * colW}%`,
        width: `${(seg.endCol - seg.startCol + 1) * colW}%`,
        top: `${(topPx / total) * 100}%`,
        height: '20px',
        backgroundColor: bg,
        borderRadius: `${seg.isFirst ? '3px' : '0'} ${seg.isLast ? '3px' : '0'} ${seg.isLast ? '3px' : '0'} ${seg.isFirst ? '3px' : '0'}`,
      };
    }

    // ─── NAVIGATION ───
    function prevMonth() { if (currentMonth.value === 0) { currentMonth.value = 11; currentYear.value--; } else currentMonth.value--; emitMC(); }
    function nextMonth() { if (currentMonth.value === 11) { currentMonth.value = 0; currentYear.value++; } else currentMonth.value++; emitMC(); }
    function prevYear() { currentYear.value--; emitMC(); }
    function nextYear() { currentYear.value++; emitMC(); }
    function goToday() { const n = new Date(); currentMonth.value = n.getMonth(); currentYear.value = n.getFullYear(); emitMC(); }
    function emitMC() { emit('trigger-event', { name: 'onMonthChange', event: { value: { year: currentYear.value, month: currentMonth.value + 1 } } }); }

    // ─── JOB SELECTION & STAGE ───
    const selectedJobData = computed(() => selectedJobId.value ? resolvedJobs.value.find(j => j.id === selectedJobId.value) || null : null);
    const selectedBdBatch = computed(() => selectedJobData.value?.bd_number ? bdBatches.value[selectedJobData.value.bd_number] || null : null);

    // Stage index = current stage needing action. Matches STAGES array (0-5), 6 = all done.
    // 0=Created, 1=Connect BD, 2=Set Arrival, 3=Started, 4=Mark Complete, 5=Checkout
    const jobStageIndex = computed(() => {
      const j = selectedJobData.value;
      if (!j) return -1;
      if (j.checkout_date) return 6;
      const endHasTime = j.endDate && j.endDate.includes('T');
      const endDatePart = j.endDate ? j.endDate.split('T')[0] : '';
      if (endHasTime) return 5;
      if (j.arrival_date) {
        // Arrived: show "Started" stage (3) if not yet past end, "Complete" stage (4) if past end date
        return (endDatePart && todayStr > endDatePart) ? 4 : 3;
      }
      if (j.bd_number) return 2;
      return 1;
    });

    // Per-stage state: 'done' (green), 'warn' (yellow), 'active' (blue), 'pending' (grey)
    const stageStates = computed(() => {
      const j = selectedJobData.value;
      if (!j) return STAGES.map(() => 'pending');
      const si = jobStageIndex.value;
      return STAGES.map((step, i) => {
        if (i >= si) return i === si ? 'active' : 'pending';
        // Past stages — check for issues
        if (step.key === 'connected' && j.bd_number && !selectedBdBatch.value) return 'warn';
        return 'done';
      });
    });

    // Dynamic labels per stage based on job state
    const stageLabels = computed(() => {
      const j = selectedJobData.value;
      const states = stageStates.value;
      return STAGES.map((step, i) => {
        if (states[i] === 'warn') return step.warn;
        if (states[i] === 'pending') return step.pending;
        // Done or active — use context-aware labels
        if (step.key === 'started') {
          if (j && j.startDate && todayStr >= j.startDate) return 'Job Started';
          return 'Pending Start';
        }
        if (step.key === 'completed') {
          if (states[i] === 'active') {
            const ep = j?.endDate ? j.endDate.split('T')[0] : '';
            return (ep && todayStr > ep) ? 'Job Ended' : 'Pending Completion';
          }
          return 'Completed';
        }
        return states[i] === 'done' ? step.done : step.pending;
      });
    });

    // Date value to show under each timeline step
    const stageDates = computed(() => {
      const j = selectedJobData.value;
      if (!j) return STAGES.map(() => '');
      return STAGES.map((step) => {
        if (step.key === 'created') return fmtDate(j.created_at) || '';
        if (step.key === 'connected') return j.bd_number || '';
        if (step.key === 'arrived') return fmtDate(j.arrival_date) || '';
        if (step.key === 'started') return fmtDate(j.startDate) || '';
        if (step.key === 'completed') {
          if (j.endDate_delay) return 'Delayed: ' + (fmtDate((j.endDate_delay || '').split('T')[0]) || '');
          return fmtDate((j.endDate || '').split('T')[0]) || '';
        }
        if (step.key === 'checkout') return fmtDate(j.checkout_date) || '';
        return '';
      });
    });

    // Selected timeline step (for editing milestones out of order)
    const selectedStageIdx = ref(null); // null = follow current stage
    const activeStageIdx = computed(() => selectedStageIdx.value !== null ? selectedStageIdx.value : jobStageIndex.value);
    function selectStage(i) {
      if (i === jobStageIndex.value) { selectedStageIdx.value = null; return; }
      selectedStageIdx.value = i;
    }
    // Reset when job or stage changes
    watch(selectedJobId, () => { selectedStageIdx.value = null; stageEditing.value = null; });
    watch(activeStageIdx, () => { stageEditing.value = null; });

    const jobHasStarted = computed(() => {
      const j = selectedJobData.value;
      return j?.startDate && todayStr >= j.startDate;
    });
    const canEditEndDate = computed(() => {
      const j = selectedJobData.value;
      return j?.startDate && todayStr >= j.startDate;
    });
    const jobAutoCompleted = computed(() => {
      const j = selectedJobData.value;
      const ep = j?.endDate ? j.endDate.split('T')[0] : '';
      return ep && todayStr > ep && !(j.endDate && j.endDate.includes('T'));
    });

    function selectJob(jobId, isDraft) {
      if (isDraft) return;
      selectedJobId.value = jobId;
      activeTab.value = 'manage';
      isRescheduling.value = false;
      editMode.value = false;
      emit('trigger-event', { name: 'onJobSelect', event: { value: { jobId } } });
    }

    function emitJobDelete() {
      emit('trigger-event', { name: 'onJobDelete', event: { value: { jobId: selectedJobId.value } } });
      selectedJobId.value = null;
    }

    // ─── EDIT MODE ───
    const editMode = ref(false);
    const editForm = reactive({ title: '', type: 'uv', quantity: 0, startDate: '', endDate: '', arrival_date: '', checkout_date: '', _maxDays: 0 });

    function enterEditMode() {
      const j = selectedJobData.value;
      if (!j) return;
      Object.assign(editForm, {
        title: j.title || '', type: j.type || 'uv', quantity: Number(j.quantity) || 0,
        startDate: j.startDate || '', endDate: j.endDate || '',
        arrival_date: j.arrival_date || '', checkout_date: j.checkout_date || '',
      });
      editMode.value = true;
    }
    const editStartDateChanged = computed(() => {
      const j = selectedJobData.value;
      return editMode.value && j && editForm.startDate !== (j.startDate || '');
    });
    const editTypeChanged = computed(() => {
      const j = selectedJobData.value;
      return editMode.value && j && editForm.type !== (j.type || 'uv');
    });
    const editLosesPriority = computed(() => editStartDateChanged.value || editTypeChanged.value);
    function cancelEditMode() { editMode.value = false; }
    function saveEditMode() {
      const j = selectedJobData.value;
      if (!j) return;
      // Use recomputed end date if start date, quantity, or type changed
      const sd = editStartDateChanged.value ? (editForm.startDate || null) : (j.startDate || null);
      const qtyChanged = editForm.quantity !== Number(j.quantity);
      const typeChanged = editForm.type !== (j.type || 'uv');
      const ed = (editStartDateChanged.value || qtyChanged || typeChanged)
        ? (editPreviewEndDate.value || editForm.endDate || null)
        : (j.endDate || null);
      // Shift delay end date by the same offset as end date change
      let delayEnd = j.endDate_delay || null;
      let delayReason = j.delay_reason || null;
      if (delayEnd && ed && j.endDate) {
        const oldEnd = parseDate((j.endDate || '').split('T')[0]);
        const newEnd = parseDate((ed || '').split('T')[0]);
        if (oldEnd && newEnd) {
          const diffMs = newEnd.getTime() - oldEnd.getTime();
          if (diffMs !== 0) {
            const oldDelay = parseDate((delayEnd || '').split('T')[0]);
            if (oldDelay) {
              const shifted = new Date(oldDelay.getTime() + diffMs);
              delayEnd = toDateStr(shifted);
            }
          }
        }
      }
      emit('trigger-event', {
        name: 'onJobUpdate',
        event: { value: {
          jobId: selectedJobId.value,
          title: editForm.title || null, type: editForm.type || 'uv', quantity: editForm.quantity,
          startDate: sd, endDate: ed,
          endDate_delay: delayEnd, delay_reason: delayReason,
          bd_number: j.bd_number || null, pic_id: j.pic_id || null,
          arrival_date: editForm.arrival_date || null,
          checkout_date: editForm.checkout_date || null,
        } },
      });
      editMode.value = false;
    }

    // ─── TAB SWITCHING ───
    function switchTab(key) {
      activeTab.value = key;
      isRescheduling.value = false;
      if (key === 'new' && !draftJob.startDate) {
        let d = new Date();
        while (isWeekend(d)) d = nextDay(d);
        draftJob.startDate = toDateStr(d);
      }
    }

    // ─── DRAFT METHODS ───
    function cancelDraft() {
      Object.assign(draftJob, { title: '', type: 'uv', quantity: 100, startDate: '', _maxDays: 0, bd_number: '', pic_id: '' });
      bdSearch.value = ''; picSearch.value = '';
      activeTab.value = 'manage';
    }
    function submitDraft() {
      if (!canSubmitDraft.value) return;
      const endDate = draftEndDateRaw.value;
      const bdOpt = draftJob.bd_number ? bdOptions.value.find(o => o.bd_number === draftJob.bd_number) : null;
      emit('trigger-event', {
        name: 'onJobCreate',
        event: { value: {
          title: draftJob.title || null, type: draftJob.type || 'uv', quantity: draftJob.quantity,
          startDate: draftJob.startDate || null, endDate: endDate || null,
          bd_number: draftJob.bd_number || null, pic_id: draftJob.pic_id || null,
          batch_key: bdOpt?.batch_key || null, line_ids: bdOpt?.line_ids || [],
        } },
      });
      cancelDraft();
    }

    // ─── DRAG & DROP ───
    const dragState = reactive({ active: false, mode: null, lastDate: '', anchorEnd: '' });

    function startDrag(mode, event) {
      dragState.active = true;
      dragState.mode = mode;
      dragState.lastDate = '';
      dragState.anchorEnd = draftEndDateRaw.value;
      document.addEventListener('mousemove', onDragMove);
      document.addEventListener('mouseup', onDragEnd);
      event.preventDefault();
    }

    function handleJobMousedown(event, seg) {
      if (seg.isDelay) return; // delay segments handled by startDelayStretch
      if (seg.isDraft || (editMode.value && seg.jobId === selectedJobId.value)) {
        startDrag('move', event);
      }
    }
    function startDelayStretch(event) {
      startDrag('delay-stretch', event);
    }
    function handleResizeStart(event, dir) {
      startDrag(dir === 'left' ? 'resize-left' : 'resize-right', event);
    }
    function handleDayHover() {}
    function handleDayMousedown(event, day) {
      if (day.isWeekend || day.outside) return;
      if (isDrafting.value) { draftJob.startDate = day.dateStr; draftJob._maxDays = 0; }
      else if (isRescheduling.value) { rescheduleJob.startDate = day.dateStr; rescheduleJob._maxDays = 0; }
      else if (editMode.value) { editForm.startDate = day.dateStr; editForm._maxDays = 0; }
    }

    // Target for drag: draftJob, rescheduleJob, or editForm
    const dragTarget = computed(() => {
      if (isRescheduling.value) return rescheduleJob;
      if (editMode.value) return editForm;
      return draftJob;
    });

    function getDayFromPoint(x, y) {
      const el = document.elementFromPoint(x, y);
      if (!el) return null;
      const dc = el.closest('.cal-day-cell');
      if (!dc) return null;
      const ds = dc.dataset.date;
      if (!ds) return null;
      const d = parseDate(ds);
      if (!d || isWeekend(d)) return null;
      return ds;
    }

    function onDragMove(event) {
      if (!dragState.active) return;
      const ds = getDayFromPoint(event.clientX, event.clientY);
      if (!ds) return;
      if (ds === dragState.lastDate && dragState.mode === 'move') return;
      dragState.lastDate = ds;

      const t = dragTarget.value;
      if (dragState.mode === 'move') {
        t.startDate = ds;
        t._maxDays = 0;
      } else if (dragState.mode === 'resize-right') {
        if (ds >= t.startDate) {
          const wd = countWorkdays(parseDate(t.startDate), parseDate(ds));
          const mn = computeMinDays(t.quantity, t.type, t.startDate);
          t._maxDays = Math.max(wd, mn);
        }
      } else if (dragState.mode === 'resize-left') {
        const anchor = dragState.anchorEnd;
        if (anchor && ds <= anchor) {
          t.startDate = ds;
          const wd = countWorkdays(parseDate(ds), parseDate(anchor));
          const mn = computeMinDays(t.quantity, t.type, ds);
          t._maxDays = Math.max(wd, mn);
        }
      } else if (dragState.mode === 'delay-stretch') {
        const j = selectedJobData.value;
        if (j && ds >= (j.endDate ? j.endDate.split('T')[0] : '')) {
          delayDateInput.value = ds;
        }
      }
    }
    function onDragEnd() {
      dragState.active = false;
      dragState.lastDate = '';
      document.removeEventListener('mousemove', onDragMove);
      document.removeEventListener('mouseup', onDragEnd);
    }
    function computeMinDays(qty, type, sd) {
      let rem = qty, cur = parseDate(sd), days = 0, sf = 0;
      if (!cur) return 1;
      // Use filtered allocation (excludes the job being edited/rescheduled)
      const am = allocateJobs(jobsForAllocation.value, null).allocMap;
      while (rem > 0 && sf < 3650) {
        sf++;
        if (isWeekend(cur)) { cur = nextDay(cur); continue; }
        const ds = toDateStr(cur), tc = getCapacityForDate(ds, type);
        const used = (am[ds] || []).filter(a => a.type === type).reduce((s, a) => s + a.qty, 0);
        const avail = Math.max(0, tc - used);
        if (avail > 0) { rem -= avail; days++; }
        cur = nextDay(cur);
      }
      return Math.max(1, days);
    }
    onBeforeUnmount(() => { document.removeEventListener('mousemove', onDragMove); document.removeEventListener('mouseup', onDragEnd); });

    // ─── CAPACITY FORM ───
    const capForm = reactive({ title: '', ruleType: 'default', custType: 'uv', quantity: 100, month: '', startDate: '', endDate: '' });
    const canSubmitCapacity = computed(() => {
      if (!capForm.custType || capForm.quantity < 0) return false;
      return capForm.ruleType === 'default' ? !!capForm.month : !!(capForm.startDate && capForm.endDate && capForm.startDate <= capForm.endDate);
    });
    function submitCapacity() {
      if (!canSubmitCapacity.value) return;
      emit('trigger-event', {
        name: 'onCapacityCreate',
        event: { value: { title: capForm.title || null, ruleType: capForm.ruleType, custType: capForm.custType, quantity: capForm.quantity, startDate: capForm.ruleType === 'general' ? capForm.startDate || null : null, endDate: capForm.ruleType === 'general' ? capForm.endDate || null : null, month: capForm.ruleType === 'default' ? capForm.month || null : null } },
      });
      Object.assign(capForm, { title: '', ruleType: 'default', custType: 'uv', quantity: 100, month: '', startDate: '', endDate: '' });
    }
    function emitCapacityDelete(cid) { emit('trigger-event', { name: 'onCapacityDelete', event: { value: { capacityId: cid } } }); }

    // ─── HELPERS ───
    function statusKey(s) { return s ? s.toLowerCase().replace(/\s+/g, '-') : 'booked'; }

    const rootCssVars = computed(() => ({
      '--cal-header-bg': props.content?.colorHeaderBg || '#1e293b',
      '--cal-weekend-bg': props.content?.colorWeekendBg || '#f9fafb',
      '--cal-accent': props.content?.colorAccent || '#3b82f6',
      '--cal-border': props.content?.colorGridBorder || '#e5e7eb',
      '--cal-uv-color': props.content?.colorUvDefault || '#3b82f6',
      '--cal-laser-color': props.content?.colorLaserDefault || '#7c3aed',
    }));

    return {
      DOW, TABS, STAGES,
      currentMonth, currentYear, monthLabel, activeTab, selectedJobId, gridRef,
      calendarDays, resolvedCapacity, getCapacityOverrides, hasWeekendCapacity,
      uvUsed, uvTotal, laserUsed, laserTotal,
      allAllocations, allSegments, segmentStyle, gridStyle,
      prevMonth, nextMonth, prevYear, nextYear, goToday,
      selectedJobData, selectedBdBatch, jobStageIndex, stageStates, stageLabels, stageDates, activeStageIdx, selectStage, jobHasStarted, canEditEndDate, jobAutoCompleted,
      selectJob, emitJobDelete,
      editMode, editForm, editStartDateChanged, editTypeChanged, editLosesPriority, editPreviewEndDate, enterEditMode, cancelEditMode, saveEditMode,
      draftJob, isDrafting, draftEndDate, draftDaysRequired, canSubmitDraft,
      cancelDraft, submitDraft, switchTab,
      isRescheduling, rescheduleJob, rescheduleEndDate, enterReschedule, cancelReschedule, submitReschedule,
      bdSearch, bdDropdownOpen, filteredBdOptions, draftBdBatch, selectBdNumber, clearDraftBd, closeBdDropdown,
      picSearch, picDropdownOpen, filteredPicOptions, selectPic, clearDraftPic, closePicDropdown,
      stageBdSearch, stageBdOpen, stageBdSelected, filteredStageBdOptions, closeStageBdDropdown, selectStageBd, clearStageBd, submitStageBd,
      stageEditing, startStageEdit, cancelStageEdit,
      stageArrivalDate, stageCheckoutDate,
      submitArrival, submitCheckout,
      showEndTimeInput, endTimeOnly, endDateHasTime, setEndTime, removeEndTime, cancelEndTimeInput,
      showDelayEndTimeInput, delayEndTimeOnly, delayEndDateHasTime, setDelayEndTime, removeDelayEndTime, cancelDelayEndTimeInput,
      delayMode, delayDateInput, delayReasonInput, openDelayMode, cancelDelay, submitDelay, removeDelay,
      startDelayStretch,
      dragState, handleJobMousedown, handleResizeStart, handleDayHover, handleDayMousedown,
      capForm, canSubmitCapacity, submitCapacity, emitCapacityDelete,
      fmtDate, statusKey, getTeammateName, rootCssVars,
    };
  },
};
</script>

<style lang="scss" scoped>
$blue: #3b82f6; $blue-dark: #2563eb; $blue-50: #eff6ff;
$purple: #7c3aed; $purple-50: #f5f3ff;
$green: #059669; $green-50: #ecfdf5;
$red: #ef4444; $red-50: #fef2f2;
$amber: #f59e0b; $amber-50: #fffbeb;
$gray-900: #111827; $gray-800: #1f2937; $gray-700: #374151; $gray-600: #4b5563;
$gray-500: #6b7280; $gray-400: #9ca3af; $gray-300: #d1d5db; $gray-200: #e5e7eb;
$gray-100: #f3f4f6; $gray-50: #f9fafb; $white: #ffffff;

.prod-cal {
  display: flex; flex-direction: column; width: 100%; min-height: 100%;
  background: $gray-100; font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  font-size: 12px; color: $gray-900; box-sizing: border-box; line-height: 1.4;
  *, *::before, *::after { box-sizing: border-box; }
}

// ─── CALENDAR HEADER ───
.cal-header { display: flex; align-items: center; gap: 4px; padding: 8px 12px; background: var(--cal-header-bg); color: $white; user-select: none; }
.cal-month-label { font-size: 13px; font-weight: 700; min-width: 140px; text-align: center; }
.cal-nav-btn {
  padding: 4px 10px; font-size: 12px; font-weight: 600; font-family: inherit;
  background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.12); color: $white;
  cursor: pointer; border-radius: 3px; transition: background 0.12s;
  &:hover { background: rgba(255,255,255,0.18); }
}
.cal-today-btn { margin-left: auto; }

// ─── SCROLL WRAPPER ───
.cal-scroll { overflow-x: auto; flex: 1; }

// ─── DAY-OF-WEEK ───
.cal-dow-row { display: grid; grid-template-columns: repeat(7, minmax(120px, 1fr)); background: $gray-50; border-bottom: 1px solid var(--cal-border); min-width: 840px; }
.cal-dow-cell { padding: 5px 8px; font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; color: $gray-500; text-align: center; }

// ─── GRID ───
.cal-grid { display: grid; grid-template-columns: repeat(7, minmax(120px, 1fr)); position: relative; background: $white; min-width: 840px; }
.cal-grid--dragging .cal-jobs-layer { pointer-events: none !important; }
.cal-grid--dragging .cal-job-bar { pointer-events: none !important; }
.cal-day-cell {
  border-right: 1px solid var(--cal-border); border-bottom: 1px solid var(--cal-border); position: relative; cursor: default; overflow: hidden;
  &:nth-child(7n) { border-right: none; }
}
.cal-day--outside { opacity: 0.3; pointer-events: none; }
.cal-day--weekend { background: var(--cal-weekend-bg, $gray-50); }
.cal-day--today .cal-day-num { color: var(--cal-accent); font-weight: 800; }
.cal-day-header { display: flex; align-items: center; gap: 3px; padding: 2px 5px; border-bottom: 1px solid $gray-100; min-height: 22px; }
.cal-day-num { font-size: 11px; font-weight: 600; color: $gray-700; }
.cal-day-month { font-size: 9px; font-weight: 600; color: $gray-400; text-transform: uppercase; }
.cal-cap-badges { display: flex; gap: 3px; margin-left: auto; }
.cal-cap-badge { font-size: 9px; font-weight: 700; padding: 2px 5px; border-radius: 3px; white-space: nowrap; }
.cal-cap--uv { color: var(--cal-uv-color); background: $blue-50; }
.cal-cap--laser { color: var(--cal-laser-color); background: $purple-50; }
.cal-cap--over { color: $red; background: $red-50; }
.cal-cap-overrides { padding: 1px 4px; }
.cal-cap-override-tag { font-size: 7px; font-weight: 600; color: $amber; background: $amber-50; padding: 0 3px; border-radius: 2px; margin-right: 2px; }

// ─── JOB BARS ───
.cal-jobs-layer { position: absolute; top: 0; left: 0; right: 0; bottom: 0; pointer-events: none; z-index: 2; }
.cal-job-bar {
  display: flex; align-items: center; padding: 0 5px; font-size: 9px; font-weight: 600; color: $white;
  pointer-events: all; cursor: pointer; overflow: hidden; white-space: nowrap; text-overflow: ellipsis;
  transition: opacity 0.15s, filter 0.15s; position: relative; z-index: 3; min-width: 0;
  &:hover { filter: brightness(1.1); z-index: 10; }
}
.cal-job--selected { outline: 2px solid $gray-900; outline-offset: -1px; z-index: 8; }
.cal-job--draft { border: 1.5px dashed rgba(255,255,255,0.7); opacity: 0.9; cursor: grab; &:active { cursor: grabbing; } }
.cal-job--editable { cursor: grab; &:active { cursor: grabbing; } }
.cal-job--faded { opacity: 0.25; filter: grayscale(0.5); }
.cal-job--gap { opacity: 0.35; cursor: default; pointer-events: none; }
.cal-job--delay {
  opacity: 0.85; cursor: default;
  background-image: repeating-linear-gradient(45deg, transparent, transparent 3px, rgba(255,255,255,0.2) 3px, rgba(255,255,255,0.2) 6px) !important;
}
.cal-job-title { flex: 1; overflow: hidden; text-overflow: ellipsis; min-width: 0; }
.cal-job-qty { font-size: 8px; opacity: 0.8; margin-left: 4px; flex-shrink: 0; }
.cal-resize-handle {
  position: absolute; top: 0; bottom: 0; width: 7px; cursor: ew-resize; z-index: 15;
  &::after { content: ''; position: absolute; top: 50%; transform: translateY(-50%); width: 3px; height: 10px; border-radius: 1px; background: rgba(255,255,255,0.6); }
}
.cal-resize--left { left: 0; &::after { left: 2px; } }
.cal-resize--right { right: 0; &::after { right: 2px; } }

// ─── BOTTOM PANEL ───
.cal-panel { background: $white; border-top: 2px solid $gray-200; min-height: 120px; display: flex; flex-direction: column; overflow: visible; }
.cal-tab-bar { display: flex; gap: 0; border-bottom: 2px solid $gray-200; background: $gray-50; flex-shrink: 0; }
.cal-tab {
  padding: 8px 16px; font-size: 11px; font-weight: 600; font-family: inherit; color: $gray-500;
  background: none; border: none; border-bottom: 2px solid transparent; margin-bottom: -2px; cursor: pointer;
  transition: color 0.12s, border-color 0.12s; &:hover { color: $gray-700; }
}
.cal-tab--active { color: var(--cal-accent); border-bottom-color: var(--cal-accent); }
.cal-tab-body { flex: 1; overflow: visible; }
.cal-tab-content { padding: 12px 16px; overflow: visible; }
.cal-empty-tab { padding: 20px; text-align: center; color: $gray-400; font-size: 11px; border: 1px dashed $gray-300; border-radius: 4px; }

// ─── TIMELINE ───
.tl-track {
  display: flex; align-items: stretch; gap: 0; margin-bottom: 8px; padding: 8px 0 0;
}
.tl-step {
  display: flex; flex-direction: column; align-items: flex-start; flex: 1; min-width: 0;
  padding: 4px 6px; border-radius: 4px; margin: -4px -2px; transition: background 0.15s;
}
.tl-step--focus {
  background: $gray-100;
}
.tl-bar {
  display: flex; align-items: center; width: 100%; height: 12px;
}
.tl-dot {
  width: 10px; height: 10px; border-radius: 50%; background: $gray-300; border: 2px solid $gray-300;
  flex-shrink: 0; z-index: 2; transition: background 0.2s, border-color 0.2s;
}
.tl-line {
  flex: 1; height: 2px; background: $gray-300; transition: background 0.2s;
}
.tl-line--done { background: $gray-900; }
.tl-label {
  font-size: 8px; font-weight: 600; color: $gray-400; margin-top: 3px;
  text-transform: uppercase; letter-spacing: 0.03em;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 100%;
}
.tl-date {
  font-size: 9px; font-weight: 700; color: $gray-700; margin-top: 1px;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 100%;
}
.tl-step { cursor: pointer; &:hover .tl-dot { transform: scale(1.2); } }
.tl-step--done .tl-dot { background: $green; border-color: $green; }
.tl-step--done .tl-label { color: $green; }
.tl-step--warn .tl-dot { background: $amber; border-color: $amber; }
.tl-step--warn .tl-label { color: $amber; font-weight: 700; }
.tl-step--active .tl-dot { background: $white; border-color: var(--cal-accent, $blue); box-shadow: 0 0 0 2px rgba($blue, 0.2); }
.tl-step--active .tl-label { color: var(--cal-accent, $blue); font-weight: 700; }
.tl-step--pending .tl-dot { background: $gray-300; border-color: $gray-300; }
.tl-step--picked .tl-dot { background: $white; border-color: $gray-700; box-shadow: 0 0 0 2px rgba($gray-700, 0.25); }
.tl-step--picked .tl-label { color: $gray-700; font-weight: 700; }

// ─── STAGE PANEL ───
.stage-panel { margin-bottom: 8px; }
.stage-action {
  padding: 5px 8px; background: $gray-50; border: 1px solid $gray-200; border-radius: 3px; margin-bottom: 4px;
}
.stage-action--warn { border-color: $amber; background: $amber-50; }
.stage-inline {
  display: flex; align-items: center; gap: 6px; flex-wrap: wrap;
}
.stage-inline-label {
  font-size: 10px; font-weight: 700; color: $gray-500; text-transform: uppercase; letter-spacing: 0.03em; white-space: nowrap;
}
.stage-inline-value {
  font-size: 11px; font-weight: 700; color: $gray-900; white-space: nowrap;
}
.stage-inline-hint {
  font-size: 10px; color: $gray-500; white-space: nowrap;
}
.stage-inline-hint--active { color: $green; font-weight: 600; }
.stage-inline-computed { font-size: 11px; font-weight: 700; color: $green; }
.stage-inline-sep { width: 1px; height: 14px; background: $gray-300; flex-shrink: 0; }
.stage-warn-msg { font-size: 9px; color: $red; margin-top: 4px; font-style: italic; }

// ─── FORMS ───
.cal-form-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px; }
.cal-detail-table { display: flex; flex-direction: column; gap: 6px; margin-bottom: 10px; }
.detail-row { display: flex; gap: 12px; }
.detail-cell { flex: 1; display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.edit-field { display: flex; flex-direction: column; gap: 2px; }
.edit-field--wide { grid-column: 1 / -1; }
.edit-field--compact { min-width: 120px; }
.edit-label { font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; color: $gray-400; }
.edit-value { font-size: 12px; font-weight: 500; color: $gray-800; display: flex; flex-direction: column; gap: 1px; }
.edit-hint { font-size: 9px; color: $gray-400; font-weight: 400; font-style: italic; }
.edit-value--computed { color: $green; font-weight: 700; display: flex; flex-direction: column; gap: 1px; }
.edit-value--delay { color: $red; font-weight: 600; font-size: 11px; }
.edit-drag-hint { font-size: 10px; color: $gray-400; font-style: italic; margin-top: 6px; }
.edit-warn-msg { font-size: 10px; color: $red; font-style: italic; margin-top: 4px; }
.bd-warn { font-size: 11px; color: $amber; background: $amber-50; border: 1px solid $amber; border-radius: 3px; padding: 6px 10px; margin-top: 8px; }
.delay-form { margin-top: 6px; padding: 6px 8px; background: $red-50; border: 1px solid $red; border-radius: 3px; display: flex; flex-wrap: wrap; align-items: center; gap: 6px; }
.delay-reason-input { min-width: 140px; flex: 1; }
.delay-tag { color: $red !important; }
.delay-value { color: $red !important; }
.btn-action--warn { background: $amber; color: $white; border-color: $amber; font-size: 10px; &:hover:not(:disabled) { filter: brightness(0.9); } }
.btn-action--danger { background: $red; color: $white; border-color: $red; font-size: 10px; &:hover:not(:disabled) { filter: brightness(0.9); } }
.edit-input {
  padding: 4px 8px; font-size: 11px; font-family: inherit; border: 1px solid $gray-300; border-radius: 3px;
  outline: none; color: $gray-900; background: $white;
  &:focus { border-color: var(--cal-accent); box-shadow: 0 0 0 1px var(--cal-accent); }
  &::placeholder { color: $gray-400; }
}
.edit-input--sm { padding: 3px 6px; font-size: 10px; }
.edit-select {
  padding: 4px 8px; font-size: 11px; font-family: inherit; border: 1px solid $gray-300; border-radius: 3px;
  outline: none; color: $gray-900; background: $white; cursor: pointer;
  &:focus { border-color: var(--cal-accent); }
}
.cal-computed-value { font-size: 12px; font-weight: 700; color: $green; padding: 4px 0; }
.cal-draft-hint { font-size: 10px; color: $gray-400; margin-top: 6px; font-style: italic; }
.cal-form-actions { display: flex; gap: 6px; margin-top: 10px; justify-content: flex-end; }

// ─── BUTTONS ───
.btn-action {
  padding: 5px 14px; font-size: 11px; font-weight: 600; font-family: inherit;
  border: 1px solid $gray-300; border-radius: 3px; cursor: pointer; transition: background 0.12s, color 0.12s;
  &:disabled { opacity: 0.4; cursor: not-allowed; }
}
.btn-action--primary { background: $gray-800; color: $white; border-color: $gray-800; &:hover:not(:disabled) { background: $gray-900; } }
.btn-action--submit { background: $green; color: $white; border-color: $green; &:hover:not(:disabled) { background: darken($green, 5%); } }
.btn-action--muted { background: $gray-100; color: $gray-600; border-color: $gray-200; &:hover:not(:disabled) { background: $gray-200; } }
.btn-action--danger { background: $red-50; color: $red; border-color: transparent; &:hover:not(:disabled) { background: $red; color: $white; } }
.btn-sm { padding: 3px 10px; font-size: 10px; }
.btn-icon {
  display: inline-flex; align-items: center; justify-content: center; width: 22px; height: 22px;
  background: none; border: none; border-radius: 3px; cursor: pointer; font-size: 14px; font-weight: 700;
  color: $gray-400; transition: background 0.1s, color 0.1s;
  &:hover { background: $gray-100; color: $gray-600; }
}
.btn-icon--danger { &:hover { background: $red-50; color: $red; } }

// ─── TYPE TAGS ───
.type-tag { display: inline-block; font-size: 10px; font-weight: 700; padding: 1px 6px; border-radius: 3px; }
.type-tag--sm { font-size: 8px; padding: 0 4px; }
.type-tag--uv { color: var(--cal-uv-color); background: $blue-50; }
.type-tag--laser { color: var(--cal-laser-color); background: $purple-50; }

// ─── SECTION HEADING ───
.section-heading {
  font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; color: $gray-400; margin: 12px 0 6px;
  display: flex; align-items: center; gap: 6px;
}
.detail-heading { margin-top: 16px; padding-top: 10px; border-top: 1px solid $gray-200; justify-content: space-between; }
.detail-heading-actions { display: flex; gap: 4px; margin-left: auto; }
.cap-list-heading { margin-top: 16px; }

// ─── BD DROPDOWN ───
.bd-select-wrapper { position: relative; }
.bd-select-wrapper--inline { min-width: 200px; }
.bd-select-wrapper--stage { min-width: 140px; }
.bd-search-input { width: 100%; }
.bd-dropdown {
  position: absolute; top: 100%; left: 0; right: 0; background: $white;
  border: 1px solid $gray-300; border-top: none; border-radius: 0 0 3px 3px;
  max-height: 180px; overflow-y: auto; z-index: 50; box-shadow: 0 4px 12px rgba(0,0,0,0.08);
}
.bd-dropdown--compact { min-width: 260px; }
.bd-dropdown-item {
  display: flex; align-items: center; gap: 4px; padding: 4px 6px; font-size: 10px; cursor: pointer;
  transition: background 0.08s; &:hover { background: $gray-50; }
}
.bd-dropdown-item--selected { background: $blue-50; }
.bd-opt-num { font-weight: 700; color: $gray-800; min-width: 50px; font-size: 10px; }
.bd-opt-meta { color: $gray-500; font-size: 9px; margin-left: auto; white-space: nowrap; }
.bd-selected-tag {
  display: inline-flex; align-items: center; gap: 4px; margin-top: 4px; padding: 2px 8px;
  background: $blue-50; color: $blue; font-size: 11px; font-weight: 600; border-radius: 3px;
}
.bd-clear-btn { background: none; border: none; color: $blue; font-size: 14px; font-weight: 700; cursor: pointer; padding: 0 2px; line-height: 1; &:hover { color: $red; } }
.bd-pick {
  display: inline-flex; align-items: center; gap: 3px; padding: 1px 6px;
  background: $blue-50; color: $blue; font-size: 10px; font-weight: 700; border-radius: 2px; white-space: nowrap;
}
.bd-pick-x { background: none; border: none; color: $blue; font-size: 12px; font-weight: 700; cursor: pointer; padding: 0 1px; line-height: 1; &:hover { color: $red; } }

// ─── BD BATCH CARD ───
.bd-batch-card { background: $white; border: 1px solid $gray-200; border-radius: 4px; overflow: hidden; margin-bottom: 8px; }
.bd-batch-header { display: flex; align-items: center; gap: 8px; padding: 6px 10px; background: $gray-50; border-bottom: 1px solid $gray-200; font-size: 11px; }
.bd-batch-opid { font-weight: 700; color: $gray-800; background: $gray-200; padding: 1px 6px; border-radius: 3px; font-size: 10px; }
.bd-batch-title { font-weight: 500; color: $gray-700; flex: 1; }
.bd-batch-table-scroll { overflow-x: auto; }
.bd-batch-table {
  width: 100%; border-collapse: collapse; font-size: 11px;
  th { padding: 4px 8px; text-align: left; font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; color: $gray-400; background: $gray-50; border-bottom: 1px solid $gray-200; white-space: nowrap; }
  td { padding: 4px 8px; border-bottom: 1px solid $gray-100; color: $gray-700; white-space: nowrap; }
  tr:last-child td { border-bottom: none; }
}
.td-sku { font-weight: 600; font-family: monospace; font-size: 10px; color: $gray-800; }
.td-qty { font-weight: 600; text-align: center; }
.td-empty { color: $gray-300; }

// ─── STATUS PILLS ───
.status-pill { display: inline-block; font-size: 9px; font-weight: 700; padding: 1px 6px; border-radius: 3px; white-space: nowrap; }
.pill--booked { color: $blue; background: $blue-50; }
.pill--issue-raised { color: $red; background: $red-50; }
.pill--processing { color: $amber; background: $amber-50; }
.pill--delivered { color: $green; background: $green-50; }
.mockup-link { color: $blue; font-size: 10px; font-weight: 600; text-decoration: none; &:hover { text-decoration: underline; } }

// ─── MILESTONES ───
.cal-milestones { display: flex; flex-direction: column; gap: 4px; }
.cal-milestone-row { display: flex; align-items: center; gap: 8px; }
.milestone-label { min-width: 110px; }
.milestone-pending { color: $amber; font-style: italic; font-size: 11px; }

// ─── CAPACITY LIST ───
.cal-cap-list { display: flex; flex-direction: column; gap: 3px; }
.cal-cap-item { display: flex; align-items: center; gap: 8px; padding: 5px 8px; background: $gray-50; border: 1px solid $gray-200; border-radius: 3px; font-size: 11px; }
.cal-cap-title { font-weight: 600; color: $gray-800; }
.cal-cap-type-tag { font-size: 9px; font-weight: 700; padding: 1px 5px; border-radius: 2px; }
.cal-cap-meta { color: $gray-500; flex: 1; }
.cal-cap-qty { font-weight: 600; color: $gray-700; }

</style>
