export default {
  editor: {
    label: 'Production Calendar',
    icon: 'calendar',
    customSettingsPropertiesOrder: [
      ['jobsData', 'capacityData'],
      ['defaultUvCapacity', 'defaultLaserCapacity'],
      ['actionStatus'],
    ],
    customStylePropertiesOrder: [
      ['colorHeaderBg', 'colorWeekendBg', 'colorAccent', 'colorGridBorder'],
      ['colorUvDefault', 'colorLaserDefault'],
    ],
  },
  triggerEvents: [
    {
      name: 'onJobCreate',
      label: { en: 'On job create' },
      event: { value: { title: '', type: '', quantity: 0, startDate: '', endDate: '', dailyAllocation: [] } },
      default: true,
    },
    {
      name: 'onJobUpdate',
      label: { en: 'On job update' },
      event: { value: { jobId: null, changes: {} } },
    },
    {
      name: 'onJobDelete',
      label: { en: 'On job delete' },
      event: { value: { jobId: null } },
    },
    {
      name: 'onJobSelect',
      label: { en: 'On job select' },
      event: { value: { jobId: null } },
    },
    {
      name: 'onMilestoneUpdate',
      label: { en: 'On milestone update' },
      event: { value: { jobId: null, milestoneType: '', date: '' } },
    },
    {
      name: 'onCapacityCreate',
      label: { en: 'On capacity create' },
      event: { value: { title: '', ruleType: '', custType: '', quantity: 0, startDate: '', endDate: '', month: '' } },
    },
    {
      name: 'onCapacityUpdate',
      label: { en: 'On capacity update' },
      event: { value: { capacityId: null, changes: {} } },
    },
    {
      name: 'onCapacityDelete',
      label: { en: 'On capacity delete' },
      event: { value: { capacityId: null } },
    },
    {
      name: 'onMonthChange',
      label: { en: 'On month change' },
      event: { value: { year: 0, month: 0 } },
    },
  ],
  properties: {
    jobsData: {
      label: { en: 'Jobs data' },
      type: 'ObjectList',
      section: 'settings',
      bindable: true,
      defaultValue: [],
      bindingValidation: {
        tooltip: 'Array of { id, title, type (uv|laser), quantity, startDate, endDate, color, milestones }',
      },
    },
    capacityData: {
      label: { en: 'Capacity data' },
      type: 'ObjectList',
      section: 'settings',
      bindable: true,
      defaultValue: [],
      bindingValidation: {
        tooltip: 'Array of { id, title, ruleType (default|general), custType (uv|laser), quantity, startDate, endDate, month }',
      },
    },
    defaultUvCapacity: {
      label: { en: 'Default UV capacity/day' },
      type: 'Number',
      section: 'settings',
      bindable: true,
      defaultValue: 100,
    },
    defaultLaserCapacity: {
      label: { en: 'Default Laser capacity/day' },
      type: 'Number',
      section: 'settings',
      bindable: true,
      defaultValue: 50,
    },
    actionStatus: {
      label: { en: 'Action status' },
      type: 'Text',
      section: 'settings',
      bindable: true,
      defaultValue: '',
    },
    colorHeaderBg: {
      label: { en: 'Header background' },
      type: 'Color',
      section: 'style',
      defaultValue: '#1e293b',
    },
    colorWeekendBg: {
      label: { en: 'Weekend background' },
      type: 'Color',
      section: 'style',
      defaultValue: '#f9fafb',
    },
    colorAccent: {
      label: { en: 'Accent color' },
      type: 'Color',
      section: 'style',
      defaultValue: '#3b82f6',
    },
    colorGridBorder: {
      label: { en: 'Grid border color' },
      type: 'Color',
      section: 'style',
      defaultValue: '#e5e7eb',
    },
    colorUvDefault: {
      label: { en: 'UV job color' },
      type: 'Color',
      section: 'style',
      defaultValue: '#3b82f6',
    },
    colorLaserDefault: {
      label: { en: 'Laser job color' },
      type: 'Color',
      section: 'style',
      defaultValue: '#7c3aed',
    },
  },
};
