export default {
  editor: {
    label: 'Production Calendar',
    icon: 'calendar',
    customSettingsPropertiesOrder: [
      ['jobsData', 'capacityData'],
      ['defaultUvCapacity', 'defaultLaserCapacity'],
      ['orderplanHeadersData', 'orderplanDeliveriesData', 'orderplanAttBookingsData', 'orderplanLinesData'],
      ['bookingHeaders', 'bookingItems'],
      ['inventoryData', 'teammatesList'],
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
      event: { value: { title: '', type: '', quantity: 0, startDate: '', endDate: '', dailyAllocation: [], bd_number: '', pic_id: '' } },
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
      name: 'onJobConnectBd',
      label: { en: 'On job connect BD' },
      event: { value: { jobId: null, bd_number: '', batch_key: '', line_ids: [] } },
    },
    {
      name: 'onJobArrival',
      label: { en: 'On job arrival' },
      event: { value: { jobId: null, arrival_date: '' } },
    },
    {
      name: 'onJobComplete',
      label: { en: 'On job complete' },
      event: { value: { jobId: null, completed_at: '' } },
    },
    {
      name: 'onJobCheckout',
      label: { en: 'On job checkout' },
      event: { value: { jobId: null, checkout_date: '' } },
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
        tooltip: 'Array of { id, title, type (uv|laser), quantity, startDate, endDate, color, bd_number, pic_id, created_at, arrival_date, completed_at, checkout_date }',
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
    orderplanHeadersData: {
      label: { en: 'Order plan headers' },
      type: 'ObjectList',
      section: 'settings',
      bindable: true,
      defaultValue: [],
      bindingValidation: {
        tooltip: 'Array of { id, opid, title, pic_bda, pic_ops, quoteref, invoiceref, status, created_at }',
      },
    },
    orderplanDeliveriesData: {
      label: { en: 'Order plan deliveries' },
      type: 'ObjectList',
      section: 'settings',
      bindable: true,
      defaultValue: [],
      bindingValidation: {
        tooltip: 'Array of { id, headerid, label, deliverytype, address, remarks, pic_name, pic_phone, deadline }',
      },
    },
    orderplanAttBookingsData: {
      label: { en: 'Order plan attached bookings' },
      type: 'ObjectList',
      section: 'settings',
      bindable: true,
      defaultValue: [],
      bindingValidation: {
        tooltip: 'Array of { id, headerid, booking_headerid }',
      },
    },
    orderplanLinesData: {
      label: { en: 'Order plan lines' },
      type: 'ObjectList',
      section: 'settings',
      bindable: true,
      defaultValue: [],
      bindingValidation: {
        tooltip: 'Array of { id, headerid, bookingitems_headerid, deliveries_headerid, customization, quantity_assigned, labor, mockup_link, bd_number, do_folder }',
      },
    },
    bookingHeaders: {
      label: { en: 'Booking headers' },
      type: 'ObjectList',
      section: 'settings',
      bindable: true,
      defaultValue: [],
      bindingValidation: {
        tooltip: 'Array of { id, bookingnumber, bookingtitle, pic_id, status, unique_skus, total_quantity, created_at }',
      },
    },
    bookingItems: {
      label: { en: 'Booking items' },
      type: 'ObjectList',
      section: 'settings',
      bindable: true,
      defaultValue: [],
      bindingValidation: {
        tooltip: 'Array of { id, headerid, sku, quantity, status, balanceref, indicator }',
      },
    },
    inventoryData: {
      label: { en: 'Inventory data' },
      type: 'ObjectList',
      section: 'settings',
      bindable: true,
      defaultValue: [],
      bindingValidation: {
        tooltip: 'Array of { sku, type, model, color, size, tags, snt, imagelink }',
      },
    },
    teammatesList: {
      label: { en: 'Teammates list' },
      type: 'ObjectList',
      section: 'settings',
      bindable: true,
      defaultValue: [],
      bindingValidation: {
        tooltip: 'Array of { id, name, type, email, phone }',
      },
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
