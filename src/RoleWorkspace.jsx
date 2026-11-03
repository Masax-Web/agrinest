import { useEffect, useState } from 'react';

const roleScreens = {
  buyer: {
    'new-request': ['New Purchase Request', 'Tell suppliers what produce you need.', 'request', [['commodity', 'Commodity', 'text'], ['quantity', 'Quantity and unit', 'text'], ['budget', 'Target budget (TZS)', 'number'], ['delivery', 'Delivery location', 'text'], ['details', 'Quality or delivery requirements', 'textarea']]],
    purchase: ['Purchase Request', 'Save the purchase details you want to send to a seller.', 'shopping_cart', [['commodity', 'Commodity', 'text'], ['quantity', 'Quantity and unit', 'text'], ['budget', 'Offer amount (TZS)', 'number'], ['details', 'Seller and delivery notes', 'textarea']]],
    orders: ['My Orders', 'Track order notes and follow-up actions.', 'receipt_long', [['order', 'Order reference', 'text'], ['details', 'Update or question', 'textarea']]],
    logistics: ['Logistics', 'Record a delivery coordination request.', 'local_shipping', [['order', 'Order reference', 'text'], ['route', 'Pickup and delivery route', 'text'], ['details', 'Cargo and timing', 'textarea']]],
    suppliers: ['Suppliers', 'Save supplier contacts and sourcing notes.', 'groups', [['supplier', 'Supplier or cooperative', 'text'], ['region', 'Region', 'text'], ['details', 'Products and contact notes', 'textarea']]],
    analytics: ['Buyer Analytics', 'Record a sourcing target or procurement note.', 'analytics', [['title', 'Report or target', 'text'], ['details', 'Notes', 'textarea']]],
    settings: ['Buyer Settings', 'Save account and procurement preferences.', 'settings', [['title', 'Preference', 'text'], ['details', 'Preference details', 'textarea']]],
    alerts: ['Buyer Alerts', 'Save a market alert or delivery follow-up.', 'campaign', [['title', 'Alert', 'text'], ['details', 'Commodity, region, or order details', 'textarea']]],
  },
  institutional: {
    programmes: ['Programmes', 'Track programme milestones and field work.', 'account_tree', [['title', 'Programme or milestone', 'text'], ['region', 'Region', 'text'], ['details', 'Owner, status, and next step', 'textarea']]],
    beneficiaries: ['Beneficiaries', 'Save a beneficiary follow-up record.', 'groups', [['name', 'Farmer or group', 'text'], ['region', 'Region', 'text'], ['details', 'Follow-up notes', 'textarea']]],
    reports: ['Impact Reports', 'Create a report note for programme review.', 'assessment', [['title', 'Report title', 'text'], ['date', 'Reporting date', 'date'], ['details', 'Findings and evidence', 'textarea']]],
    'field-intel': ['Field Intelligence', 'Record a field observation for review.', 'map', [['region', 'Region or district', 'text'], ['title', 'Observation', 'text'], ['details', 'Evidence and follow-up', 'textarea']]],
    settings: ['Institutional Settings', 'Save workspace preferences.', 'settings', [['title', 'Preference', 'text'], ['details', 'Preference details', 'textarea']]],
    notifications: ['Notifications', 'Record an alert follow-up.', 'notifications', [['title', 'Alert', 'text'], ['details', 'Follow-up action', 'textarea']]],
    support: ['Support', 'Send a support request to the programme team.', 'help', [['title', 'Subject', 'text'], ['details', 'Describe the issue', 'textarea']]],
  },
  student: {
    'learning-path': ['Learning Path', 'Keep course and learning actions together.', 'school', [['course', 'Course or module', 'text'], ['details', 'Learning goal or progress note', 'textarea']]],
    internships: ['Internships', 'Track an opportunity or application follow-up.', 'work', [['opportunity', 'Opportunity', 'text'], ['organization', 'Organization', 'text'], ['details', 'Application notes', 'textarea']]],
    'research-hub': ['Research Hub', 'Create a research idea or paper record.', 'science', [['title', 'Paper or project title', 'text'], ['date', 'Review date', 'date'], ['details', 'Abstract or next steps', 'textarea']]],
    workspace: ['Research Workspace', 'Save a task for your current research project.', 'edit_note', [['title', 'Task', 'text'], ['date', 'Due date', 'date'], ['details', 'Dataset or supervisor notes', 'textarea']]],
    settings: ['Student Settings', 'Save academic workspace preferences.', 'settings', [['title', 'Preference', 'text'], ['details', 'Preference details', 'textarea']]],
  },
  transporter: {
    availability: ['Post Availability', 'Publish a local availability record for dispatch follow-up.', 'add_road', [['vehicle', 'Vehicle and capacity', 'text'], ['route', 'Available route', 'text'], ['date', 'Available from', 'date'], ['details', 'Rate and service notes', 'textarea']]],
    jobs: ['Open Jobs', 'Save a bid or job follow-up.', 'work_history', [['job', 'Job or route', 'text'], ['amount', 'Bid amount (TZS)', 'number'], ['details', 'Cargo and delivery terms', 'textarea']]],
    trips: ['Active Trips', 'Record a trip update for dispatch.', 'distance', [['trip', 'Trip reference', 'text'], ['status', 'Trip status', 'text'], ['details', 'Location and delivery note', 'textarea']]],
    fleet: ['Fleet Management', 'Track vehicle maintenance and availability.', 'local_shipping', [['vehicle', 'Vehicle registration', 'text'], ['date', 'Service or availability date', 'date'], ['details', 'Maintenance or capacity details', 'textarea']]],
    earnings: ['Earnings', 'Record an earnings or withdrawal request.', 'account_balance_wallet', [['amount', 'Amount (TZS)', 'number'], ['details', 'Payment or withdrawal note', 'textarea']]],
    route: ['Route Planner', 'Save a route and delivery plan.', 'map', [['origin', 'Pickup location', 'text'], ['destination', 'Destination', 'text'], ['details', 'Cargo and timing', 'textarea']]],
    settings: ['Transport Settings', 'Save fleet and dispatch preferences.', 'settings', [['title', 'Preference', 'text'], ['details', 'Preference details', 'textarea']]],
    support: ['Fleet Support', 'Send a support request to the logistics team.', 'support', [['title', 'Subject', 'text'], ['details', 'Describe the issue', 'textarea']]],
  },
  commercial: {
    fields: ['Fields', 'Register fields for the commercial operation.', 'agriculture', [['name', 'Field or block name', 'text'], ['crop', 'Crop', 'text'], ['area', 'Area (acres)', 'number']]],
    listings: ['Produce Offers', 'Record produce available to buyers.', 'storefront', [['title', 'Produce or lot', 'text'], ['amount', 'Quantity and unit', 'text'], ['details', 'Quality and price notes', 'textarea']]],
    income: ['Sales', 'Record a commercial produce sale.', 'payments', [['title', 'Buyer or invoice', 'text'], ['amount', 'Amount (TZS)', 'number'], ['date', 'Sale date', 'date']]],
    workforce: ['Workforce', 'Record a staffing or farm operations need.', 'groups', [['title', 'Role or work item', 'text'], ['amount', 'People needed', 'number'], ['details', 'Location and schedule', 'textarea']]],
    logistics: ['Logistics', 'Coordinate farm deliveries and input supply.', 'local_shipping', [['title', 'Shipment or route', 'text'], ['date', 'Required date', 'date'], ['details', 'Cargo and destination', 'textarea']]],
    analytics: ['Analytics', 'Record an operational metric or review.', 'analytics', [['title', 'Metric or review', 'text'], ['date', 'Review date', 'date'], ['details', 'Result and next step', 'textarea']]],
  },
  bank: {
    applications: ['Loan Applications', 'Record an application review and its next step.', 'assignment', [['title', 'Applicant or application ID', 'text'], ['amount', 'Requested amount (TZS)', 'number'], ['details', 'Review notes and status', 'textarea']]],
    portfolio: ['Portfolio', 'Track a portfolio review or account follow-up.', 'account_balance', [['title', 'Farmer or portfolio item', 'text'], ['amount', 'Exposure (TZS)', 'number'], ['details', 'Review notes', 'textarea']]],
    repayments: ['Repayments', 'Record a repayment follow-up.', 'payments', [['title', 'Loan or customer reference', 'text'], ['amount', 'Amount (TZS)', 'number'], ['date', 'Due or paid date', 'date']]],
    risk: ['Risk Reviews', 'Record a risk assessment and next review.', 'verified_user', [['title', 'Application or account', 'text'], ['date', 'Review date', 'date'], ['details', 'Risk notes and decision', 'textarea']]],
  },
  coop: {
    members: ['Members', 'Add a cooperative member record.', 'groups', [['name', 'Member name', 'text'], ['region', 'Ward or region', 'text'], ['details', 'Crops and contact notes', 'textarea']]],
    produce: ['Produce Lots', 'Record a collective produce lot.', 'agriculture', [['title', 'Crop or lot reference', 'text'], ['amount', 'Quantity and unit', 'text'], ['details', 'Quality and collection notes', 'textarea']]],
    orders: ['Orders', 'Track a cooperative order and fulfilment step.', 'receipt_long', [['title', 'Order reference', 'text'], ['date', 'Delivery date', 'date'], ['details', 'Buyer, produce, and status', 'textarea']]],
    payments: ['Payments', 'Record a member payment or settlement.', 'payments', [['title', 'Member or order', 'text'], ['amount', 'Amount (TZS)', 'number'], ['date', 'Payment date', 'date']]],
  },
  expert: {
    consultations: ['Consultations', 'Record a farmer consultation and follow-up.', 'support_agent', [['title', 'Farmer or topic', 'text'], ['date', 'Consultation date', 'date'], ['details', 'Advice and next steps', 'textarea']]],
    visits: ['Field Visits', 'Schedule or record an extension visit.', 'map', [['title', 'Farmer or field', 'text'], ['date', 'Visit date', 'date'], ['details', 'Location and observations', 'textarea']]],
    advisory: ['Advisory Notes', 'Save a practical advisory note for a farmer.', 'description', [['title', 'Topic', 'text'], ['details', 'Recommendation and context', 'textarea']]],
    diagnostics: ['Diagnostics', 'Record a crop diagnosis and recommended action.', 'biotech', [['title', 'Crop or diagnosis', 'text'], ['date', 'Observation date', 'date'], ['details', 'Symptoms and recommendation', 'textarea']]],
  },
};

const workflowStatuses = ['Open', 'In progress', 'Complete', 'On hold'];
const reviewStatuses = ['New', 'Under review', 'Resolved', 'Escalated'];

function defineWorkflow(description, primaryLabel, additionalFields = []) {
  return {
    description,
    fields: [['title', primaryLabel, 'text'], ...additionalFields, ['details', 'Notes', 'textarea']],
  };
}

const moduleWorkflows = {
  animals: defineWorkflow('Keep herd identity, location, and headcount up to date.', 'Herd or animal group', [['species', 'Species or breed', 'text'], ['count', 'Headcount', 'number'], ['location', 'Farm or location', 'text']]),
  health: defineWorkflow('Record a health concern and the care plan for follow-up.', 'Animal or herd', [['condition', 'Condition or concern', 'text'], ['severity', 'Severity', 'select', ['Low', 'Moderate', 'Urgent']], ['review_date', 'Next review', 'date']]),
  production: defineWorkflow('Track output by product, quantity, and production period.', 'Product or output', [['quantity', 'Quantity', 'number'], ['unit', 'Unit', 'text'], ['period', 'Production date', 'date']]),
  feed: defineWorkflow('Track feed stocks and the next replenishment point.', 'Feed type', [['quantity', 'Stock quantity', 'number'], ['unit', 'Unit', 'text'], ['reorder_at', 'Reorder threshold', 'number'], ['supplier', 'Supplier', 'text']]),
  consultations: defineWorkflow('Capture the consultation and the agreed follow-up.', 'Farmer or animal', [['topic', 'Consultation topic', 'text'], ['date', 'Consultation date', 'date'], ['outcome', 'Outcome', 'text']]),
  visits: defineWorkflow('Plan a field visit and record what was observed.', 'Farm or recipient', [['location', 'Location', 'text'], ['date', 'Visit date', 'date'], ['outcome', 'Visit outcome', 'text']]),
  vaccinations: defineWorkflow('Schedule vaccination work and keep completion visible.', 'Herd or animal', [['vaccine', 'Vaccine', 'text'], ['due_date', 'Due date', 'date'], ['status', 'Status', 'select', workflowStatuses]]),
  outbreaks: defineWorkflow('Report a disease event and track the response area.', 'Disease or outbreak', [['region', 'Affected region', 'text'], ['severity', 'Severity', 'select', ['Low', 'Moderate', 'High', 'Critical']], ['reported_at', 'Report date', 'date']]),
  inventory: defineWorkflow('Track stock levels, suppliers, and replenishment needs.', 'Product or stock item', [['quantity', 'Quantity on hand', 'number'], ['unit', 'Unit', 'text'], ['reorder_at', 'Reorder threshold', 'number'], ['supplier', 'Supplier', 'text']]),
  orders: defineWorkflow('Track an order from confirmation through fulfilment.', 'Order reference', [['counterparty', 'Buyer or supplier', 'text'], ['order_date', 'Order date', 'date'], ['amount', 'Order value (TZS)', 'number'], ['status', 'Order status', 'select', workflowStatuses]]),
  vouchers: defineWorkflow('Issue or reconcile an input voucher.', 'Voucher code', [['beneficiary', 'Beneficiary', 'text'], ['value', 'Value (TZS)', 'number'], ['expires_at', 'Expiry date', 'date'], ['status', 'Voucher status', 'select', workflowStatuses]]),
  analytics: defineWorkflow('Save a shop or operations metric for the selected period.', 'Metric or report', [['period', 'Reporting period', 'text'], ['value', 'Value', 'number'], ['date', 'Review date', 'date']]),
  capacity: defineWorkflow('Keep storage capacity and available space current.', 'Facility or commodity', [['total_capacity', 'Total capacity', 'number'], ['available_capacity', 'Available capacity', 'number'], ['unit', 'Capacity unit', 'text'], ['rate', 'Storage rate (TZS)', 'number']]),
  bookings: defineWorkflow('Manage a storage or equipment booking and its dates.', 'Booking reference', [['customer', 'Customer or farmer', 'text'], ['start_date', 'Start date', 'date'], ['end_date', 'End date', 'date'], ['status', 'Booking status', 'select', workflowStatuses]]),
  receipts: defineWorkflow('Record incoming produce and confirm its receiving details.', 'Receipt reference', [['depositor', 'Depositor', 'text'], ['commodity', 'Commodity', 'text'], ['quantity', 'Quantity received', 'number'], ['received_at', 'Received date', 'date']]),
  equipment: defineWorkflow('List equipment with its capacity, rate, and condition.', 'Equipment name', [['category', 'Equipment type', 'text'], ['capacity', 'Capacity', 'text'], ['daily_rate', 'Daily rate (TZS)', 'number'], ['condition', 'Condition', 'text']]),
  availability: defineWorkflow('Publish when and where a resource is available.', 'Resource or vehicle', [['location', 'Location or route', 'text'], ['available_from', 'Available from', 'date'], ['available_until', 'Available until', 'date'], ['rate', 'Rate (TZS)', 'number']]),
  maintenance: defineWorkflow('Schedule maintenance and record completed work.', 'Asset or equipment', [['service_date', 'Service date', 'date'], ['work_required', 'Work required', 'text'], ['cost', 'Estimated cost (TZS)', 'number'], ['status', 'Status', 'select', workflowStatuses]]),
  marketplace: defineWorkflow('Record a sourcing target and the produce requirements.', 'Commodity or lot', [['supplier', 'Supplier or producer', 'text'], ['quantity', 'Quantity and unit', 'text'], ['origin', 'Origin', 'text'], ['target_price', 'Target price (TZS)', 'number']]),
  traceability: defineWorkflow('Keep a batch origin and evidence trail for export review.', 'Batch reference', [['commodity', 'Commodity', 'text'], ['producer', 'Producer or source', 'text'], ['origin', 'Origin', 'text'], ['harvest_date', 'Harvest date', 'date'], ['certificate', 'Certificate reference', 'text']]),
  compliance: defineWorkflow('Track export standards, evidence, and expiry dates.', 'Standard or requirement', [['certificate', 'Certificate reference', 'text'], ['authority', 'Issuing authority', 'text'], ['expires_at', 'Expiry date', 'date'], ['status', 'Compliance status', 'select', reviewStatuses]]),
  contracts: defineWorkflow('Record commercial terms and delivery commitments.', 'Contract reference', [['counterparty', 'Buyer or producer', 'text'], ['commodity', 'Commodity', 'text'], ['quantity', 'Contract quantity', 'text'], ['price', 'Price (TZS)', 'number'], ['delivery_date', 'Delivery date', 'date']]),
  policies: defineWorkflow('Track policy coverage, premiums, and renewal dates.', 'Policy reference', [['policyholder', 'Policyholder', 'text'], ['coverage', 'Coverage type', 'text'], ['premium', 'Premium (TZS)', 'number'], ['renewal_date', 'Renewal date', 'date']]),
  claims: defineWorkflow('Review a claim and document its incident and decision.', 'Claim reference', [['policyholder', 'Policyholder', 'text'], ['incident_date', 'Incident date', 'date'], ['claimed_amount', 'Claimed amount (TZS)', 'number'], ['status', 'Claim status', 'select', reviewStatuses]]),
  payouts: defineWorkflow('Track a payout from approval through settlement.', 'Recipient or payout reference', [['amount', 'Amount (TZS)', 'number'], ['payment_reference', 'Payment reference', 'text'], ['payment_date', 'Payment date', 'date'], ['status', 'Payout status', 'select', workflowStatuses]]),
  reports: defineWorkflow('Prepare a reporting record with period and findings.', 'Report title', [['period', 'Reporting period', 'text'], ['metric', 'Key metric', 'text'], ['date', 'Report date', 'date']]),
  programmes: defineWorkflow('Track programme delivery, ownership, and milestones.', 'Programme or milestone', [['region', 'Region', 'text'], ['owner', 'Programme owner', 'text'], ['milestone_date', 'Milestone date', 'date'], ['status', 'Status', 'select', workflowStatuses]]),
  beneficiaries: defineWorkflow('Track beneficiary enrolment and programme follow-up.', 'Farmer or group', [['region', 'Region or district', 'text'], ['programme', 'Programme', 'text'], ['status', 'Follow-up status', 'select', workflowStatuses]]),
  'field-intel': defineWorkflow('Capture a field observation with location and evidence.', 'Observation', [['location', 'Region or district', 'text'], ['observed_at', 'Observation date', 'date'], ['severity', 'Severity', 'select', ['Low', 'Moderate', 'High']], ['evidence', 'Evidence summary', 'textarea']]),
  campaigns: defineWorkflow('Track an investment or fundraising campaign against its goal.', 'Campaign name', [['sponsor', 'Sponsor', 'text'], ['goal', 'Funding goal (TZS)', 'number'], ['deadline', 'Deadline', 'date'], ['status', 'Campaign status', 'select', workflowStatuses]]),
  portfolio: defineWorkflow('Track an investment, exposure, and expected outcome.', 'Investment or portfolio item', [['sponsor', 'Sponsor or owner', 'text'], ['amount', 'Amount (TZS)', 'number'], ['expected_return', 'Expected return', 'text'], ['status', 'Status', 'select', workflowStatuses]]),
  impact: defineWorkflow('Compare impact metrics over a defined reporting period.', 'Impact metric', [['baseline', 'Baseline', 'number'], ['current_value', 'Current value', 'number'], ['period', 'Reporting period', 'text'], ['evidence', 'Evidence source', 'text']]),
  users: defineWorkflow('Record an account lookup and its support or access outcome.', 'Account holder', [['contact', 'Phone or email', 'text'], ['persona', 'Persona', 'text'], ['status', 'Account status', 'select', workflowStatuses]]),
  audit: defineWorkflow('Document a financial audit check and its evidence.', 'Transaction reference', [['amount', 'Amount (TZS)', 'number'], ['reviewer', 'Reviewer', 'text'], ['review_date', 'Review date', 'date'], ['finding', 'Finding', 'text']]),
  models: defineWorkflow('Track model ownership, version, and release readiness.', 'Model name', [['version', 'Version', 'text'], ['owner', 'Model owner', 'text'], ['status', 'Model status', 'select', workflowStatuses]]),
  system: defineWorkflow('Document a platform setting and the reason for its change.', 'Setting name', [['value', 'Setting value', 'text'], ['environment', 'Environment', 'text'], ['status', 'Change status', 'select', workflowStatuses]]),
  datasets: defineWorkflow('Register a training dataset and its source and consent.', 'Dataset name', [['source', 'Data source', 'text'], ['start_date', 'Coverage start', 'date'], ['end_date', 'Coverage end', 'date'], ['record_count', 'Record count', 'number'], ['consent', 'Consent status', 'select', ['Confirmed', 'Pending review', 'Restricted']]]),
  evaluation: defineWorkflow('Record a model evaluation against a dataset and metric.', 'Model or evaluation run', [['version', 'Model version', 'text'], ['dataset', 'Evaluation dataset', 'text'], ['metric', 'Metric', 'text'], ['score', 'Score', 'number'], ['evaluated_at', 'Evaluation date', 'date']]),
  assignments: defineWorkflow('Assign a review item with an owner and due date.', 'Review item', [['reviewer', 'Assigned reviewer', 'text'], ['priority', 'Priority', 'select', ['Low', 'Normal', 'High', 'Urgent']], ['due_date', 'Due date', 'date'], ['status', 'Status', 'select', workflowStatuses]]),
  listings: defineWorkflow('Review a flagged listing and record the moderation action.', 'Listing reference', [['seller', 'Seller', 'text'], ['item', 'Listing item', 'text'], ['reason', 'Flag reason', 'text'], ['status', 'Review outcome', 'select', reviewStatuses]]),
  forum: defineWorkflow('Review a reported discussion and record the moderation outcome.', 'Thread reference', [['category', 'Category', 'text'], ['reason', 'Report reason', 'text'], ['status', 'Review outcome', 'select', reviewStatuses]]),
  messages: defineWorkflow('Review a reported message while retaining its reference.', 'Message reference', [['reporter', 'Reporter', 'text'], ['reason', 'Report reason', 'text'], ['severity', 'Severity', 'select', ['Low', 'Moderate', 'High']], ['status', 'Review outcome', 'select', reviewStatuses]]),
  disputes: defineWorkflow('Track the case parties, evidence, and resolution status.', 'Case reference', [['parties', 'Parties involved', 'text'], ['amount', 'Disputed amount (TZS)', 'number'], ['status', 'Case status', 'select', reviewStatuses], ['evidence', 'Evidence summary', 'textarea']]),
  queries: defineWorkflow('Track a support request from intake through response.', 'Ticket reference', [['requester', 'Requester', 'text'], ['category', 'Request category', 'text'], ['priority', 'Priority', 'select', ['Low', 'Normal', 'High', 'Urgent']], ['status', 'Ticket status', 'select', workflowStatuses]]),
  refunds: defineWorkflow('Review a refund request and document the decision.', 'Order reference', [['requester', 'Requester', 'text'], ['amount', 'Refund amount (TZS)', 'number'], ['reason', 'Refund reason', 'text'], ['status', 'Refund status', 'select', reviewStatuses]]),
  transactions: defineWorkflow('Reconcile a transaction and its payment status.', 'Transaction reference', [['account', 'Account or counterparty', 'text'], ['amount', 'Amount (TZS)', 'number'], ['transaction_date', 'Transaction date', 'date'], ['status', 'Transaction status', 'select', workflowStatuses]]),
  escrow: defineWorkflow('Track held funds, release conditions, and reconciliation.', 'Escrow reference', [['transaction', 'Transaction reference', 'text'], ['amount', 'Held amount (TZS)', 'number'], ['release_condition', 'Release condition', 'text'], ['status', 'Escrow status', 'select', workflowStatuses]]),
  fees: defineWorkflow('Manage a fee schedule and its effective date.', 'Fee name', [['rate', 'Rate or amount', 'number'], ['basis', 'Calculation basis', 'text'], ['effective_date', 'Effective date', 'date'], ['status', 'Fee status', 'select', workflowStatuses]]),
  partners: defineWorkflow('Keep partner contacts, regions, and agreements current.', 'Partner organization', [['contact', 'Primary contact', 'text'], ['region', 'Region', 'text'], ['agreement_end', 'Agreement end date', 'date'], ['status', 'Partner status', 'select', workflowStatuses]]),
  credentials: defineWorkflow('Track credential ownership and rotation without storing secrets.', 'Credential label', [['partner', 'Partner', 'text'], ['environment', 'Environment', 'text'], ['access_scope', 'Access scope', 'text'], ['rotation_date', 'Next rotation date', 'date']]),
  'service-levels': defineWorkflow('Track partner service targets and review performance.', 'Service name', [['partner', 'Partner', 'text'], ['response_target', 'Response target', 'text'], ['availability_target', 'Availability target', 'text'], ['review_date', 'Review date', 'date']]),
};

function readWorkspaceRecords(storageKey) {
  try {
    const records = JSON.parse(window.localStorage.getItem(storageKey) || '[]');
    return Array.isArray(records) ? records : [];
  } catch {
    return [];
  }
}

export default function RoleWorkspace({ role, persona, page, storageKey, journeyStep, onBack, onSaved }) {
  const recordsStorageKey = storageKey || `agrinest-${role}-workspace-records`;
  const [records, setRecords] = useState(() => readWorkspaceRecords(recordsStorageKey));
  const [draft, setDraft] = useState({});
  const [notice, setNotice] = useState('');
  const personaModule = persona?.modules.find((module) => module.id === page);
  const moduleWorkflow = moduleWorkflows[page];
  const fallbackConfig = [
    personaModule?.label || page.replaceAll('-', ' '),
    moduleWorkflow?.description || `Create and track ${personaModule?.label.toLowerCase() || 'workspace'} records.`,
    personaModule?.icon || 'task_alt',
    moduleWorkflow?.fields || [['title', 'Record name', 'text'], ['status', 'Status', 'select', workflowStatuses], ['details', 'Notes', 'textarea']],
  ];
  const config = roleScreens[role]?.[page] || fallbackConfig;
  const [title, description, icon, fields] = config;

  useEffect(() => {
    setDraft({});
    setNotice('');
  }, [page]);

  const saveRecord = (event) => {
    event.preventDefault();
    const nextRecords = [{ ...draft, module: page, id: globalThis.crypto?.randomUUID?.() || `record-${Date.now()}`, savedAt: new Date().toISOString() }, ...records];
    setRecords(nextRecords);
    try {
      window.localStorage.setItem(recordsStorageKey, JSON.stringify(nextRecords));
      onSaved?.(nextRecords);
      setNotice('Saved on this device.');
    } catch {
      setNotice('Could not save this record in the browser.');
    }
    setDraft({});
  };

  return (
    <main className="role-workspace">
      <header className="role-workspace-header">
        <button type="button" onClick={onBack}><span className="material-symbols-outlined">arrow_back</span>Back to dashboard</button>
        <div>
          <span>{role.toUpperCase()} WORKSPACE</span>
          <h1><span className="material-symbols-outlined">{icon}</span>{title}</h1>
          <p>{journeyStep?.description || description}</p>
          <p className="role-workspace-local-note">Records are saved in this browser for this account only. They do not submit transactions, approvals, payments, or third-party verification. Older shared workspace records are not imported automatically.</p>
        </div>
      </header>
      {notice && <div className="role-workspace-notice" role="status">{notice}<button type="button" aria-label="Dismiss message" onClick={() => setNotice('')}><span className="material-symbols-outlined">close</span></button></div>}
      <section className="role-workspace-form">
        <h2>New record</h2>
        <form onSubmit={saveRecord}>
          <div className="role-workspace-fields">{fields.map(([name, label, type, options]) => <label key={name} className={type === 'textarea' ? 'wide' : ''}>{label}{type === 'textarea' ? <textarea required value={draft[name] || ''} onChange={(event) => setDraft((current) => ({ ...current, [name]: event.target.value }))} /> : type === 'select' ? <select required value={draft[name] || ''} onChange={(event) => setDraft((current) => ({ ...current, [name]: event.target.value }))}><option value="">Choose {label.toLowerCase()}</option>{options.map((option) => <option key={option} value={option}>{option}</option>)}</select> : <input required type={type} min={type === 'number' ? 0 : undefined} value={draft[name] || ''} onChange={(event) => setDraft((current) => ({ ...current, [name]: event.target.value }))} />}</label>)}</div>
          <button type="submit"><span className="material-symbols-outlined">save</span>Save record</button>
        </form>
      </section>
      <section className="role-workspace-records">
        <div><span>WORKSPACE HISTORY</span><h2>Saved records</h2></div>
        {records.length ? records.map((record) => <article key={record.id}><span className="material-symbols-outlined">{icon}</span><div><strong>{record.title || record.commodity || record.order || record.name || record.opportunity || record.job || record.trip || record.vehicle || record.origin || title}</strong><p>{record.details || record.route || record.region || record.delivery || record.quantity || record.amount || 'Saved record'}</p></div><small>{new Date(record.savedAt).toLocaleDateString()}</small></article>) : <p className="role-workspace-empty">No saved records yet.</p>}
      </section>
    </main>
  );
}