export const DOCS_NAV = [
  {
    label: 'Kirish',
    items: [
      { id: 'intro', label: "Umumiy ma'lumot" },
      { id: 'auth-section', label: 'Autentifikatsiya' },
      { id: 'base-url', label: 'Base URL' },
    ],
  },
  {
    label: 'Kod bajarish',
    items: [
      { id: 'execute', label: 'POST /execute' },
      { id: 'ws-connect', label: 'WS /connect' },
      { id: 'runtimes', label: 'GET /runtimes' },
    ],
  },
  {
    label: 'Checker',
    items: [
      { id: 'check', label: 'POST /check' },
      { id: 'check-demo', label: 'POST /check/demo' },
      { id: 'checker-guide', label: 'Checker yozish' },
    ],
  },
  {
    label: 'Paketlar',
    items: [
      { id: 'pkg-list', label: 'GET /packages' },
      { id: 'pkg-install', label: 'POST /packages' },
      { id: 'pkg-uninstall', label: 'DELETE /packages' },
    ],
  },
  {
    label: 'Joblar',
    items: [
      { id: 'jobs-list', label: 'GET /jobs' },
      { id: 'jobs-detail', label: 'GET /jobs/:id' },
      { id: 'jobs-delete', label: 'DELETE /jobs/:id' },
      { id: 'jobs-delete-bulk', label: 'DELETE /jobs (bulk)' },
    ],
  },
  {
    label: 'Auth',
    items: [
      { id: 'auth-login', label: 'POST /auth/login' },
      { id: 'auth-logout', label: 'POST /auth/logout' },
      { id: 'auth-me', label: 'GET /auth/me' },
      { id: 'tokens-create', label: 'POST /auth/tokens' },
      { id: 'tokens-list', label: 'GET /auth/tokens' },
      { id: 'tokens-delete', label: 'DELETE /auth/tokens/:token' },
      { id: 'users-list', label: 'GET /auth/users' },
      { id: 'users-create', label: 'POST /auth/users' },
      { id: 'users-update', label: 'PUT /auth/users/:username' },
      { id: 'users-delete', label: 'DELETE /auth/users/:username' },
      { id: 'profile', label: 'PUT /auth/profile' },
    ],
  },
  {
    label: 'Xatolar',
    items: [{ id: 'errors', label: 'HTTP kodlar' }],
  },
];
