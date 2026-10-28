const ALL='BSGD';
const support=['Support & onboarding','Help when you need it',['Email support · self-serve setup','Email & chat · self-serve setup','Priority support · guided onboarding','Dedicated success manager · full onboarding']];
    export const PRODUCTS = {
      Legal: { label: 'Veridex Legal', price: { bronze: 35, silver: 49, gold: 59, diamond: 89 },
        names: { bronze: 'Veridex Legal Core', silver: 'Legal Core + Intake', gold: 'Veridex Firm', diamond: 'Veridex Legal Department' },
        groups: [
          ['Core platform', [
            ['Organization & sites', 'Organizations, sites, departments and business units', ALL],
            ['Users, roles & SSO', 'Invite users, set permissions, sign in with your identity provider', ALL],
            ['Matter management', 'Create, view, update and track legal matters', ALL],
            ['Contacts & parties', 'Claimants, clients, attorneys, adjusters and witnesses', ALL],
            ['Tasks & Kanban', 'Create and assign tasks on a standard board', ALL],
            ['Document repository', 'Upload, store, organize, view and download documents', ALL],
            ['Calendar & reminders', 'Key dates, due dates and reminders', ALL],
            ['Dashboard & notifications', 'Open matters, deadlines, workload and alerts', ALL],
            ['Activity timeline & audit', 'Track important user and system actions', ALL]]],
          ['Intake Studio', [
            ['Custom intake forms', 'Build forms and configure fields without code', 'SD'],
            ['Automatic matter setup', 'Submissions create matters, people, folders and first tasks', 'SD']]],
          ['Document Generator', [
            ['Template library', 'Legal documents filled from matter and person data', 'GD'],
            ['Save to matter', 'Generated documents are filed to the matter automatically', 'GD']]],
          ['Contract Management', [
            ['Contract repository', 'Upload contracts, extract and review key details', 'D'],
            ['Approvals & renewals', 'Owners, reminders, approvals, amendments and renewals', 'D'],
            ['Contract tasks', 'Contract work appears on your Kanban board', 'D']]],
          ['Advanced capabilities', [
            ['Multiple boards & routing', 'Several Kanban boards with automatic assignment', 'GD'],
            ['Matter lifecycle workflows', 'Stages and rules for complex matter types', 'D'],
            ['Document versioning & OCR', 'Version history and searchable scans', 'D'],
            ['Advanced docketing', 'Calculated deadlines and court schedules', 'D']]],
          ['Service', [support]]] },
      Broker: { label: 'Broker Management', price: { bronze: 29, silver: 45, gold: 65, diamond: 95 },
        names: { bronze: 'Broker Core', silver: 'Broker Plus', gold: 'Broker Pro', diamond: 'Broker Enterprise' },
        groups: [
          ['Core platform', [
            ['Agencies & producers', 'Agency, producer and hierarchy records', ALL],
            ['Contacts & accounts', 'Clients, carriers and key contacts', ALL],
            ['Tasks & Kanban', 'Create and assign tasks on a standard board', ALL],
            ['Document repository', 'Store agreements, licenses and client files', ALL],
            ['Dashboard', 'Producers, pipeline and workload at a glance', ALL],
            ['Users, roles & SSO', 'Permissions and single sign-on', ALL]]],
          ['Licensing & Appointments', [
            ['License tracking', 'Track licenses by state with expiry alerts', 'SGD'],
            ['Carrier appointments', 'Request and track appointments', 'SGD']]],
          ['Commission Management', [
            ['Commission schedules', 'Rates by carrier, product and producer', 'GD'],
            ['Producer statements', 'Calculate and publish commission statements', 'GD']]],
          ['Distribution tools', [
            ['Submission pipeline', 'Track submissions from request to bind', 'D'],
            ['Producer portal', 'Self-service portal for producers', 'D']]],
          ['Advanced capabilities', [
            ['Automated task routing', 'Assign work by rules and territory', 'GD'],
            ['Custom analytics', 'Build your own reports and dashboards', 'D']]],
          ['Service', [support]]] },
      Policy: { label: 'Policy Management', price: { bronze: 45, silver: 65, gold: 85, diamond: 120 },
        names: { bronze: 'Policy Core', silver: 'Policy Plus', gold: 'Policy Pro', diamond: 'Policy Enterprise' },
        groups: [
          ['Core platform', [
            ['Quote, bind & issue', 'Manual quoting, binding and policy issuance', ALL],
            ['Policy records', 'Insureds, coverages, limits and history', ALL],
            ['Policy documents', 'Standard declarations and forms', ALL],
            ['Tasks & dashboard', 'Work queues and key policy metrics', ALL],
            ['Users, roles & SSO', 'Permissions and single sign-on', ALL]]],
          ['Policy servicing', [
            ['Endorsements', 'Mid-term changes with premium adjustment', 'SGD'],
            ['Renewals & cancellations', 'Renewal workflow and cancellation notices', 'SGD']]],
          ['Rating Engine', [
            ['Rules-based rating', 'Automatic premium from rating rules', 'GD'],
            ['Rate tables', 'Manage rate tables by line and state', 'GD']]],
          ['Integrations & distribution', [
            ['Billing integration', 'Send invoices and payments to your billing system', 'D'],
            ['Agent portal', 'Agents quote and bind online', 'D']]],
          ['Advanced capabilities', [
            ['Document template designer', 'Design your own policy forms', 'GD'],
            ['Custom analytics', 'Build your own reports and dashboards', 'D']]],
          ['Service', [support]]] },
      Claims: { label: 'Claims Management', price: { bronze: 40, silver: 60, gold: 80, diamond: 110 },
        names: { bronze: 'Claims Core', silver: 'Claims Plus', gold: 'Claims Pro', diamond: 'Claims Enterprise' },
        groups: [
          ['Core platform', [
            ['FNOL capture', 'First notice of loss by web or phone', ALL],
            ['Claim file', 'Notes, diary, parties and documents in one file', ALL],
            ['Tasks & Kanban', 'Create and assign claim tasks', ALL],
            ['Dashboard', 'Open claims, aging and workload', ALL],
            ['Users, roles & SSO', 'Permissions and single sign-on', ALL]]],
          ['Adjusting & reserves', [
            ['Adjuster assignment', 'Assign claims by line, region and workload', 'SGD'],
            ['Reserve tracking', 'Set and change reserves with history', 'SGD'],
            ['Configurable FNOL forms', 'Tailor intake questions by line', 'SGD']]],
          ['Payments & recovery', [
            ['Claim payments', 'Issue and track payments', 'GD'],
            ['Subrogation & recovery', 'Track recoveries from third parties', 'GD']]],
          ['Litigation', [
            ['Handoff to Veridex Legal', 'Send litigated claims to your legal team', 'D']]],
          ['Advanced capabilities', [
            ['Automated task routing', 'Assign work by rules', 'GD'],
            ['Custom analytics', 'Build your own reports and dashboards', 'D']]],
          ['Service', [support]]] }
    };

export const TIERS = ['bronze', 'silver', 'gold', 'diamond'];
export const MODULES = Object.keys(PRODUCTS);
export const LABELS = { Legal: 'Legal', Broker: 'Broker management', Policy: 'Policy management', Claims: 'Claims management' };
export const DESCRIPTIONS = { Legal: 'Matters, documents, and deadlines in one place.', Broker: 'Connect agencies, producers, and commissions.', Policy: 'From quote and bind to servicing and renewal.', Claims: 'Keep claims moving, from first notice to settlement.' };
export const ROLES = { member: 'Member', manager: 'Module manager', viewer: 'Read-only' };
export const BUNDLES = [
  { id: 'claims-legal', name: 'Claims & litigation', description: 'Connect claims handling with your legal team.', modules: { Claims: 'diamond', Legal: 'diamond' }, audience: 'Claims & legal teams' },
  { id: 'distribution', name: 'Distribution & policy', description: 'Bring broker relationships and policy operations together.', modules: { Broker: 'gold', Policy: 'gold' }, audience: 'MGAs, MGUs & agencies' },
  { id: 'complete', name: 'VeriDex Complete', description: 'All four products, with a separate team for each.', modules: { Legal: 'diamond', Broker: 'diamond', Policy: 'diamond', Claims: 'diamond' }, audience: 'Connected operations' }
];
export const WORK_PROFILES = {
  operations: { label: 'Operations team', view: 'Task board', digest: 'Daily', role: 'member' },
  legal: { label: 'Legal team', view: 'Matter list', digest: 'Daily', role: 'member' },
  leadership: { label: 'Leadership team', view: 'Overview', digest: 'Weekly', role: 'viewer' }
};
