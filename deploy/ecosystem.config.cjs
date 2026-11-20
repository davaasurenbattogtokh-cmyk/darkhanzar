// pm2 тохиргоо: server.js нь API + Next.js-ийг хамт ажиллуулна.
const path = require('node:path');
const root = path.resolve(__dirname, '..');
module.exports = {
  apps: [{
    name: 'darkhanzar',
    cwd: root,
    script: 'server.js',
    node_args: '--env-file-if-exists=.env',
    env: {NODE_ENV: 'production'},
    instances: 1,
    max_memory_restart: '1G',
    kill_timeout: 12000,
    time: true,
  }],
};
